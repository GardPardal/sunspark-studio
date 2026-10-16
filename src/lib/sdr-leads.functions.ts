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
      /** Código da página-ponte ("cód. 7K2QX") lido na conversa pela extensão. */
      codigo_clique?: string | null;
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

    // Clique do anúncio (página-ponte /whatsapp): dados do navegador DO CLIENTE no momento do clique.
    let clique: Record<string, any> | null = null;
    if (data.codigo_clique) {
      try {
        const { cliquePeloCodigo } = await import("@/lib/leads/clique-whatsapp.server");
        const c = await cliquePeloCodigo(data.codigo_clique);
        clique = c ? { ...(c.detail ?? {}), _evento_id: c.id } : null;
      } catch {
        clique = null;
      }
    }
    const ck = (k: string) => (clique && typeof clique[k] === "string" ? clique[k] : null);

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
        valor_conta:
          data.valor_conta || (data.gasto_medio != null ? `R$ ${data.gasto_medio}` : null),
        mensagem,
        origem: data.origem || "Meta WhatsApp",
        origem_principal: data.origem || "Meta WhatsApp",
        canal: "WhatsApp",
        qualificado_por: "sdr",
        sistema_entrada: "sdr_form",
        produto_interesse: isAumentoSistema ? "Aumento de sistema" : null,
        // O navegador aqui é o da SDR, não o do cliente: cookies da Meta (_fbp/_fbc), UTMs e user-agent dela
        // não podem ir para o lead — a Meta ligaria todas as vendas à identidade da SDR. A origem real
        // de quem chegou por anúncio de WhatsApp é descoberta pelo telefone (ID do anúncio no webhook).
        // Com o código da página-ponte, os identificadores são os do CLIENTE (gravados no clique do anúncio).
        utm_source: ck("utm_source"),
        utm_medium: ck("utm_medium"),
        utm_campaign: ck("utm_campaign"),
        utm_term: ck("utm_term"),
        utm_content: ck("utm_content"),
        fbclid: ck("fbclid"),
        fbc: ck("fbc"),
        fbp: ck("fbp"),
        page_url: ck("page_url"),
        user_agent: ck("user_agent"),
        created_by: context.userId,
        captacao_metodo: "sdr_qualificado",
        ploomes_filial_id: Number(data.ploomes_origem_id) || null,
        ploomes_captacao_id: Number(data.ploomes_captacao_id) || null,
        ploomes_produto_id: isAumentoSistema ? 610311595 : Number(data.ploomes_produto_id) || null,
        ploomes_owner_id: Number(data.ploomes_owner_id) || null,
      },
      // Sem fila aqui: o envio é feito logo abaixo, direto. Com "immediate" o gatilho da fila acordava o
      // worker na mesma hora e ele disputava a trava com esta chamada (sem a regra do funil Comercial).
      { syncPolicy: "never", source: "sdr_form" },
    );

    // A escolha da SDR vale mais que o que o lead já tinha (telefone que já existia no CRM: o upsert
    // preserva os valores antigos). Dados do clique do anúncio também entram por cima.
    const escolhaSdr: Record<string, unknown> = {
      ploomes_owner_id: Number(data.ploomes_owner_id) || null,
      ploomes_filial_id: Number(data.ploomes_origem_id) || null,
      ploomes_captacao_id: Number(data.ploomes_captacao_id) || null,
      ploomes_produto_id: isAumentoSistema ? 610311595 : Number(data.ploomes_produto_id) || null,
      qualificado_por: "sdr",
    };
    if (data.cidade?.trim()) escolhaSdr.cidade = data.cidade.trim();
    if (data.estado?.trim()) escolhaSdr.estado = data.estado.trim();
    if (clique) {
      for (const k of [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "fbc",
        "fbp",
        "page_url",
        "user_agent",
      ])
        if (ck(k)) escolhaSdr[k] = ck(k);
      if (ck("client_ip")) escolhaSdr.client_ip = ck("client_ip");
      escolhaSdr.origem_principal = "Meta ADS";
    }
    try {
      await (supabaseAdmin as any).from("leads").update(escolhaSdr).eq("id", ingest.leadId);
    } catch (e) {
      console.warn("[registerQualifiedLead] escolha da SDR:", e);
    }

    const { data: inserted } = await supabaseAdmin
      .from("leads")
      .select("*")
      .eq("id", ingest.leadId)
      .single();
    if (!inserted) throw new Error("Falha ao salvar lead no sistema");

    // 2) Envia agora ao Ploomes: card no funil Comercial / Energia Solar → Qualificação do Lead.
    //    Se falhar, entra na fila (o worker tenta de novo).
    let ploomesOut: { ok: boolean; status?: number; error?: string; dealId?: number | null } = {
      ok: false,
    };
    try {
      const { syncLeadToPloomes } = await import("@/lib/leads/ploomes-sync.server");
      let r = await syncLeadToPloomes(ingest.leadId, { exigirComercial: true });
      // outra sincronização deste lead em andamento (webhook): espera a trava sair e tenta de novo
      for (let i = 0; i < 4 && !r.ok && /trava/.test(r.error ?? ""); i++) {
        await new Promise((res) => setTimeout(res, 5000));
        r = await syncLeadToPloomes(ingest.leadId, { exigirComercial: true });
      }
      ploomesOut = r.ok
        ? { ok: true, status: 200, dealId: r.dealId ?? null }
        : { ok: false, error: r.error };
    } catch (e: any) {
      ploomesOut = { ok: false, error: String(e?.message ?? e) };
    }
    if (!ploomesOut.ok) {
      try {
        await (supabaseAdmin as any).rpc("lead_enqueue_sync", {
          _lead_id: ingest.leadId,
          _reason: `formulário SDR: ${ploomesOut.error ?? "falha no envio"}`.slice(0, 200),
        });
      } catch {
        /* best-effort */
      }
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

    // 3b) Meta CAPI — "Lead": o cadastro da SDR é o que conta como lead (conversa fria não conta).
    //     Com código da página-ponte, vai com fbc/fbp/IP/navegador do clique → a Meta liga ao anúncio.
    let metaLead: any = { ok: false, status_detail: "ignorado" };
    try {
      const { dispatchEvent } = await import("./conversion-events.service");
      metaLead = await dispatchEvent({
        event: "Lead",
        eventId: `lead-sdr-${inserted.id}`,
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
          client_ip: ck("client_ip") ?? (inserted as any).client_ip ?? null,
          visitor_id: ck("visitor_id") ?? (inserted as any).visitor_id ?? null,
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
      metaLead = { ok: false, status_detail: "falhou", error: String(e?.message ?? e) };
    }
    if (clique?._evento_id) {
      try {
        await (supabaseAdmin as any)
          .from("lead_events")
          .update({ lead_id: inserted.id })
          .eq("id", clique._evento_id);
        // IP do clique no lead: os eventos de funil seguintes (QualifiedLead, Schedule, Purchase) reaproveitam.
        if (ck("client_ip"))
          await (supabaseAdmin as any)
            .from("leads")
            .update({ client_ip: ck("client_ip") })
            .eq("id", inserted.id);
      } catch {
        /* best-effort */
      }
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
      meta_lead: metaLead,
      clique_anuncio: Boolean(clique),
    };
  });

/**
 * Análise inteligente da conversa lida na tela do WhatsApp pela extensão (sem Z-API): nome, cidade,
 * conta de luz (ou valor lido na foto da fatura), filial mais próxima e código do clique do anúncio.
 */
export const analisarConversaWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      mensagens: Array<{ de: "cliente" | "atendente"; texto: string }>;
      imagens?: string[];
      /** Código "(cód. 7K2QX)" que a extensão achou na conversa (inclusive em mensagens antigas). */
      codigo?: string | null;
    }) => ({
      codigo: typeof d?.codigo === "string" ? d.codigo.trim().toUpperCase().slice(0, 5) : null,
      mensagens: (Array.isArray(d?.mensagens) ? d.mensagens : []).slice(-120).map((m) => ({
        de: m?.de === "cliente" ? ("cliente" as const) : ("atendente" as const),
        texto: String(m?.texto ?? "").slice(0, 2000),
      })),
      imagens: (Array.isArray(d?.imagens) ? d.imagens : [])
        .filter((x) => typeof x === "string" && x.startsWith("data:image/") && x.length < 3_000_000)
        .slice(-3),
    }),
  )
  .handler(async ({ data }) => {
    const { analisarConversa } = await import("@/lib/leads/ler-conversa.server");
    const leitura = await analisarConversa(data.mensagens, data.imagens);
    if (!leitura.codigo_clique && data.codigo) leitura.codigo_clique = data.codigo;
    let anuncio: { campanha: string | null; anuncio: string | null } | null = null;
    if (leitura.codigo_clique) {
      const { cliquePeloCodigo } = await import("@/lib/leads/clique-whatsapp.server");
      const c = await cliquePeloCodigo(leitura.codigo_clique);
      if (c)
        anuncio = {
          campanha: c.detail?.utm_campaign ?? null,
          anuncio: c.detail?.utm_content ?? null,
        };
      else leitura.codigo_clique = null;
    }
    return { ...leitura, anuncio };
  });

/**
 * Origem do contato pelo telefone: se a pessoa chegou por anúncio de WhatsApp (Click-to-WhatsApp),
 * devolve campanha, conjunto e anúncio. Usado na tela da SDR para mostrar "tráfego pago" ou não.
 */
export const consultarOrigemWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { telefone: string }) => d)
  .handler(async ({ data }) => {
    const { atribuicaoWhatsApp, produtoPelaCampanha } =
      await import("@/lib/leads/atribuicao-wa.server");
    const { normalizePhone } = await import("@/lib/leads/lead-core.server");
    const e164 = normalizePhone(data.telefone);
    if (!e164) return { encontrado: false as const };
    const at = await atribuicaoWhatsApp(e164);
    if (!at) return { encontrado: false as const };
    return {
      encontrado: true as const,
      campanha: at.campanha,
      conjunto: at.conjunto,
      anuncio: at.anuncio,
      ad_id: at.ad_id,
      em: at.em,
      produto: produtoPelaCampanha(at.campanha),
    };
  });
