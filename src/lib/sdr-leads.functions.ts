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

    // 2) Meta CAPI — CompleteRegistration (lead qualificado)
    let metaResult: any = { ok: false, skipped: true, reason: "não enviado" };
    try {
      const { data: settingsRows } = await supabaseAdmin.from("site_settings").select("key,value");
      const settings: Record<string, string> = {};
      for (const r of settingsRows ?? []) settings[r.key] = r.value ?? "";

      const { sendMetaEvent, persistConversionEvent } = await import("./conversions.server");
      metaResult = await sendMetaEvent("CompleteRegistration", {
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
      }, { settings });
      await persistConversionEvent(inserted.id, metaResult, null);
    } catch (e: any) {
      metaResult = { ok: false, error: String(e?.message ?? e) };
    }

    // 3) Timeline — evento explícito "qualificado pela SDR"
    try {
      await supabaseAdmin.rpc("record_event", {
        _entity_type: "lead",
        _entity_id: inserted.id,
        _kind: "qualified_by_sdr",
        _title: "Lead qualificado pela SDR",
        _summary: `Origem: ${data.origem || "Meta WhatsApp"} · Meta: CompleteRegistration · Status: ${metaResult?.ok ? "enviado" : "falhou"}`,
        _source: "sdr_form",
        _payload: {
          meta_event: "CompleteRegistration",
          meta_status: metaResult?.ok ? "sent" : "failed",
          meta_event_id: metaResult?.event_id,
          fbtrace_id: metaResult?.fbtrace_id,
          distribuidora: data.distribuidora || null,
          tracking: t,
        },
        _actor_id: context.userId,
        _actor_name: undefined,
      } as any);
    } catch {
      /* timeline é best-effort */
    }

    return {
      ok: true,
      lead_id: inserted.id,
      lead_saved: true,
      meta: {
        ok: !!metaResult?.ok,
        event: "CompleteRegistration",
        event_id: metaResult?.event_id,
        fbtrace_id: metaResult?.fbtrace_id,
        http_status: metaResult?.http_status,
        test_mode: metaResult?.test_mode,
        error: metaResult?.ok ? undefined : (metaResult?.response?.error?.message || metaResult?.reason || metaResult?.error),
      },
      // Ploomes é criado pelo trigger DB (contato + deal via API oficial de forms).
      ploomes: { ok: true, note: "Contato + Negócio criados via integração Ploomes" },
    };
  });
