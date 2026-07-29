import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Registra um Lead Qualificado pela SDR.
 *
 * Fluxo orquestrado (usa a infra já existente):
 *  1. Insere o lead em public.leads (o trigger `leads_push_to_ploomes` dispara
 *     a criação de Contato + Deal no Ploomes automaticamente via API oficial
 *     de forms; o trigger `tg_lead_stage_to_timeline` registra na Timeline).
 *  2. Dispara evento CompleteRegistration para a Meta CAPI e persiste em
 *     conversion_events (com fbtrace_id / http_status / payload).
 *  3. Registra evento adicional na Timeline marcando "lead qualificado pela SDR".
 */
export const registerQualifiedLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    nome: string;
    telefone: string;
    cidade: string;
    estado?: string | null;
    valor_conta?: string | null;
    distribuidora?: string | null;
    observacoes?: string | null;
    origem?: string | null;
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
  }) => d)
  .handler(async ({ context, data }) => {
    // Só SDR (ou acima) pode registrar lead qualificado
    const { data: isSdr } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "sdr" });
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isCoord } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "coordenador" });
    if (!isSdr && !isAdmin && !isCoord) {
      throw new Error("Acesso restrito a SDR/coordenação.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const t = data.tracking ?? {};

    // Observação consolidada — inclui distribuidora e IDs de anúncio (campaign/adset/ad)
    // porque a tabela `leads` não tem colunas dedicadas para eles.
    const obsParts: string[] = [];
    if (data.distribuidora) obsParts.push(`Distribuidora: ${data.distribuidora}`);
    if (data.observacoes) obsParts.push(data.observacoes);
    if (t.campaign_id) obsParts.push(`campaign_id: ${t.campaign_id}`);
    if (t.adset_id) obsParts.push(`adset_id: ${t.adset_id}`);
    if (t.ad_id) obsParts.push(`ad_id: ${t.ad_id}`);
    const mensagem = obsParts.join("\n") || null;

    // 1) Insere o lead — trigger cuida do push pro Ploomes + timeline base
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("leads")
      .insert({
        nome: data.nome.trim(),
        telefone: data.telefone.replace(/\D/g, "") || data.telefone,
        cidade: data.cidade || null,
        estado: data.estado || null,
        valor_conta: data.valor_conta || null,
        mensagem,
        origem: data.origem || "Meta WhatsApp",
        stage: "novo",
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
      } as any)
      .select("*")
      .single();

    if (insErr || !inserted) {
      throw new Error(`Falha ao salvar lead: ${insErr?.message || "desconhecido"}`);
    }

    // 2) Meta CAPI — CompleteRegistration via serviço central (valida, envia, persiste, timeline)
    let metaOut: any = { ok: false, status_detail: "falhou" };
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

    // 3) Timeline complementar — "lead qualificado pela SDR"
    try {
      await supabaseAdmin.rpc("record_event", {
        _entity_type: "lead",
        _entity_id: inserted.id,
        _kind: "qualified_by_sdr",
        _title: "Lead qualificado pela SDR",
        _summary: `Origem: ${data.origem || "Meta WhatsApp"} · Distribuidora: ${data.distribuidora || "—"}`,
        _source: "sdr_form",
        _payload: {
          distribuidora: data.distribuidora || null,
          tracking: t,
          meta: {
            status_detail: metaOut.status_detail,
            event_id: metaOut.event_id,
            fbtrace_id: metaOut.fbtrace_id,
            match_quality: metaOut.match_quality,
          },
        },
        _actor_id: context.userId,
        _actor_name: undefined,
      } as any);
    } catch { /* best-effort */ }

    return {
      ok: true,
      lead_id: inserted.id,
      lead_saved: true,
      meta: {
        ok: !!metaOut.ok,
        event: "CompleteRegistration",
        status_detail: metaOut.status_detail,
        event_id: metaOut.event_id,
        fbtrace_id: metaOut.fbtrace_id,
        http_status: metaOut.http_status,
        test_mode: metaOut.test_mode,
        match_quality: metaOut.match_quality,
        pixel_id: metaOut.pixel_id,
        validation_errors: metaOut.validation_errors,
        error: metaOut.error,
      },
      ploomes: { ok: true, note: "Contato + Negócio criados via integração Ploomes" },
    };
  });

