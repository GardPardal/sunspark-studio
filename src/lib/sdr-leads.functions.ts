import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { _internalFetchSchema, PLOOMES_FORM_ENDPOINT } from "./ploomes-form.functions";

/**
 * Registra um Lead Qualificado pela SDR / Consultor.
 *
 * Fluxo:
 *  1. Insere lead em public.leads.
 *  2. Faz POST direto no formulário Ploomes com os 9 campos oficiais (Nome, Cidade, Telefone,
 *     Filial/Origem, Captação, Produto, Gasto, Observação, Responsável).
 *  3. Dispara CompleteRegistration para Meta CAPI via serviço central.
 *  4. Registra histórico e timeline do lead.
 */
export const registerQualifiedLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      nome: string;
      telefone: string;
      telefone_tipo?: "comercial" | "celular" | "residencial" | "outros" | string;
      telefone_tipo_ref?: string | null;
      cidade: string;
      estado?: string | null;
      valor_conta?: string | null;
      gasto_medio?: number | null;
      distribuidora?: string | null;
      observacoes?: string | null;
      origem?: string | null;
      // Seleções Ploomes
      ploomes_origem_id: number; // Filial (Origem do Lead)
      ploomes_captacao_id: number; // Como feita a captação
      ploomes_produto_id: number; // Produto de interesse
      ploomes_owner_id: number; // Responsável
      tracking?: {
        fbclid?: string | null;
        fbc?: string | null;
        fbp?: string | null;
        utm_source?: string | null;
        utm_medium?: string | null;
        utm_campaign?: string | null;
        utm_content?: string | null;
        utm_term?: string | null;
        campaign_id?: string | null;
        adset_id?: string | null;
        ad_id?: string | null;
        page_url?: string | null;
        user_agent?: string | null;
      } | null;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t = data.tracking ?? {};
    const phoneDigits = (data.telefone || "").replace(/\D/g, "");

    // Observação consolidada (nosso banco local)
    const obsParts: string[] = [];
    if (data.observacoes) obsParts.push(data.observacoes.trim());
    if (t.utm_campaign) obsParts.push(`Campanha: ${t.utm_campaign}`);
    if (t.utm_source) obsParts.push(`Origem: ${t.utm_source}`);
    const mensagem = obsParts.join("\n") || null;

    // 1) Central de Leads: dedupe por telefone + fila única para o Ploomes (API oficial).
    //    Filial/captação/produto/responsável vêm da escolha humana da SDR — nada presumido.
    const { ingestLead } = await import("@/lib/leads/lead-core.server");
    const AUMENTO_SISTEMA_SYNTHETIC = -1;
    const isAumentoSistema = data.ploomes_produto_id === AUMENTO_SISTEMA_SYNTHETIC;
    const ingest = await ingestLead(
      {
        nome: data.nome.trim(),
        telefone: phoneDigits || data.telefone,
        cidade: data.cidade ? data.cidade.trim() : null,
        estado: data.estado ? data.estado.trim() : null,
        valor_conta: data.valor_conta || (data.gasto_medio != null ? `R$ ${data.gasto_medio}` : null),
        mensagem,
        origem: data.origem || "Meta WhatsApp",
        origem_principal: data.origem || "Meta WhatsApp",
        canal: "WhatsApp",
        qualificado_por: "sdr",
        sistema_entrada: "sdr_form",
        produto_interesse: isAumentoSistema ? "Aumento de sistema" : null,
        utm_source: t.utm_source || null,
        utm_medium: t.utm_medium || null,
        utm_campaign: t.utm_campaign || null,
        utm_term: t.utm_term || null,
        utm_content: t.utm_content || null,
        fbclid: t.fbclid || null,
        fbc: t.fbc || null,
        fbp: t.fbp || null,
        page_url: t.page_url || null,
        user_agent: t.user_agent || null,
        created_by: context.userId,
        captacao_metodo: "sdr_qualificado",
        ploomes_filial_id: Number(data.ploomes_origem_id) || null,
        ploomes_captacao_id: Number(data.ploomes_captacao_id) || null,
        ploomes_produto_id: isAumentoSistema ? 610311595 : Number(data.ploomes_produto_id) || null,
        ploomes_owner_id: Number(data.ploomes_owner_id) || null,
      },
      { syncPolicy: "immediate", source: "sdr_form" },
    );
    const { data: inserted } = await supabaseAdmin.from("leads").select("*").eq("id", ingest.leadId).single();
    if (!inserted) throw new Error("Falha ao salvar lead no sistema");

    // 2) Sincroniza imediatamente (a fila reprocessa se falhar)
    let ploomesOut: { ok: boolean; status?: number; error?: string } = { ok: false };
    try {
      const { syncLeadToPloomes } = await import("@/lib/leads/ploomes-sync.server");
      const r = await syncLeadToPloomes(ingest.leadId);
      ploomesOut = r.ok ? { ok: true, status: 200 } : { ok: false, error: r.error };
      if (r.ok) {
        await (supabaseAdmin as any)
          .from("lead_sync_queue")
          .update({ status: "sincronizado", last_response: { contactId: r.contactId, dealId: r.dealId } })
          .eq("lead_id", ingest.leadId)
          .in("status", ["pendente", "processando"]);
      }
    } catch (e: any) {
      ploomesOut = { ok: false, error: String(e?.message ?? e) };
    }

    // 3) Meta CAPI — CompleteRegistration (best effort)
    let metaOut: any = { ok: false, status_detail: "ignorado" };
    try {
      const { dispatchEvent } = await import("./conversion-events.service");
      metaOut = await dispatchEvent({
        event: "CompleteRegistration",
        lead: {
          id: inserted.id,
          nome: inserted.nome,
          email: inserted.email,
          telefone: inserted.telefone,
          cidade: inserted.cidade,
          estado: inserted.estado,
          fbp: inserted.fbp,
          fbc: inserted.fbc,
          page_url: inserted.page_url,
          user_agent: inserted.user_agent,
          utm_source: inserted.utm_source,
          utm_medium: inserted.utm_medium,
          utm_campaign: inserted.utm_campaign,
          utm_content: inserted.utm_content,
          utm_term: inserted.utm_term,
        },
        actorId: context.userId,
        timelineOnLeadId: inserted.id,
      });
    } catch (e: any) {
      metaOut = { ok: false, status_detail: "falhou", error: String(e?.message ?? e) };
    }

    // 4) Timeline — evento SDR
    try {
      await supabaseAdmin.rpc("record_event", {
        _entity_type: "lead",
        _entity_id: inserted.id,
        _kind: "qualified_by_sdr",
        _title: "Lead qualificado pela SDR",
        _summary: `Origem: ${data.origem || "Meta WhatsApp"} · Ploomes: ${ploomesOut.ok ? "Sincronizado" : "Erro"}`,
        _source: "sdr_form",
        _payload: {
          distribuidora: data.distribuidora || null,
          tracking: t,
          ploomes: {
            owner_id: data.ploomes_owner_id,
            origem_id: data.ploomes_origem_id,
            captacao_id: data.ploomes_captacao_id,
            produto_id: data.ploomes_produto_id,
            status: ploomesOut.ok ? "sent" : "error",
          },
          meta: {
            status_detail: metaOut.status_detail,
          },
        },
        _actor_id: context.userId,
        _actor_name: undefined,
      } as any);
    } catch {
      /* best-effort */
    }

    return {
      ok: true,
      lead_id: inserted.id,
      lead_saved: true,
      ploomes: ploomesOut,
      meta: metaOut,
    };
  });
