import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: isCoord } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "coordenador" });
  if (!isAdmin && !isCoord) throw new Error("Acesso restrito a admin/coordenação.");
}

async function loadSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_settings").select("key,value");
  const settings: Record<string, string> = {};
  for (const r of data ?? []) settings[r.key] = r.value ?? "";
  return settings;
}

/** Diagnóstico das credenciais + gatilhos configurados */
export const metaDiagnose = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const settings = await loadSettings();
    const pixelId = settings.meta_pixel_id || null;
    const hasToken = !!process.env.META_CAPI_ACCESS_TOKEN;
    const testCode = settings.meta_test_event_code || null;

    const { DEFAULT_STAGE_MAP, ALL_META_EVENTS, metaEventForStage } = await import("./conversions.server");
    const stageMap = Object.keys(DEFAULT_STAGE_MAP).map((stage) => ({
      stage,
      event: metaEventForStage(stage, settings) || null,
      isCustom: !!(settings[`meta_event_${stage}`] || "").trim(),
    }));

    // Ping simples: consulta o pixel no Graph
    let ping: any = { ok: false, message: "não testado" };
    if (pixelId && hasToken) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${pixelId}?fields=name,id&access_token=${process.env.META_CAPI_ACCESS_TOKEN}`,
        );
        const j = await res.json().catch(() => ({}));
        ping = { ok: res.ok && !j?.error, status: res.status, name: j?.name, id: j?.id, error: j?.error };
      } catch (e: any) {
        ping = { ok: false, message: String(e?.message ?? e) };
      }
    }

    return {
      pixelId,
      hasToken,
      testCode,
      testMode: !!testCode,
      stageMap,
      allEvents: ALL_META_EVENTS,
      ping,
    };
  });

/** Atualiza mapa de eventos por stage e/ou test_event_code / pixel_id */
export const metaSaveConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    pixel_id?: string;
    test_event_code?: string;
    stage_map?: Record<string, string>;
  }) => d)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const upserts: { key: string; value: string }[] = [];
    if (data.pixel_id !== undefined) upserts.push({ key: "meta_pixel_id", value: data.pixel_id });
    if (data.test_event_code !== undefined) upserts.push({ key: "meta_test_event_code", value: data.test_event_code });
    if (data.stage_map) {
      for (const [stage, ev] of Object.entries(data.stage_map)) {
        upserts.push({ key: `meta_event_${stage}`, value: ev });
      }
    }
    if (upserts.length) {
      const { error } = await supabaseAdmin
        .from("site_settings")
        .upsert(upserts.map((u) => ({ ...u, updated_at: new Date().toISOString() })), { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return { ok: true, saved: upserts.length };
  });

/** Últimos eventos enviados (com fbtrace_id, payload, http_status, status_detail, match_quality). */
export const metaListEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; status?: string; event_name?: string } | undefined) => d ?? {})
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("conversion_events")
      .select("id, created_at, event_name, platform, status, status_detail, value, response, event_id, fbtrace_id, http_status, test_mode, lead_id, match_quality, validation_errors, retry_of")
      .eq("platform", "meta_capi")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(data.limit ?? 50, 1), 200));
    if (data.status) q = q.eq("status", data.status);
    if (data.event_name) q = q.eq("event_name", data.event_name);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });

/** Métricas do dia — cards do topo do painel /mod/meta-conversions. */
export const metaTodayMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: rows } = await supabaseAdmin
      .from("conversion_events")
      .select("event_name, status, status_detail, match_quality, fbtrace_id, created_at")
      .eq("platform", "meta_capi")
      .gte("created_at", startOfDay.toISOString());
    const arr = rows ?? [];
    const complete = arr.filter((r: any) => r.event_name === "CompleteRegistration").length;
    const total = arr.length;
    const ok = arr.filter((r: any) => r.status === "ok").length;
    const aceito = arr.filter((r: any) => r.status_detail === "aceito_meta").length;
    const errors = arr.filter((r: any) => r.status === "error").length;
    const skipped = arr.filter((r: any) => r.status_detail === "skipped_validation").length;
    const reenviado = arr.filter((r: any) => r.status_detail === "reenviado").length;
    const mqValues = arr.map((r: any) => Number(r.match_quality ?? 0)).filter((v) => v > 0);
    const avgMatch = mqValues.length ? Math.round((mqValues.reduce((a, b) => a + b, 0) / mqValues.length) * 10) / 10 : 0;
    const successRate = total ? Math.round((ok / total) * 100) : 0;
    return {
      total, ok, aceito, errors, skipped, reenviado, complete,
      successRate, avgMatch,
    };
  });


/** Detalhe (inclui request_payload completo). */
export const metaGetEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("conversion_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { event: row };
  });

/** Envia evento de teste (usa lead sintético + test_event_code). */
export const metaSendTestEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { event: string; value?: number; lead_id?: string }) => d)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const settings = await loadSettings();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendMetaEvent, persistConversionEvent, ALL_META_EVENTS } = await import("./conversions.server");
    if (!ALL_META_EVENTS.includes(data.event as any)) throw new Error("evento inválido");

    let lead: any;
    if (data.lead_id) {
      const { data: row } = await supabaseAdmin.from("leads").select("*").eq("id", data.lead_id).maybeSingle();
      lead = row;
    }
    if (!lead) {
      lead = {
        id: `test-${Date.now()}`,
        nome: "Teste LZ7 CAPI",
        email: "teste-capi@lz7energia.com.br",
        telefone: "5543999990000",
        cidade: "Londrina",
        estado: "PR",
        page_url: "https://lz7energia.com.br/?debug=capi",
        user_agent: "LZ7-CAPI-Debug/1.0",
      };
    }

    // Garante test_event_code: se não configurado, força TEST12345 apenas neste envio.
    const effectiveSettings = { ...settings };
    if (!effectiveSettings.meta_test_event_code) effectiveSettings.meta_test_event_code = "TEST12345";

    const r = await sendMetaEvent(data.event as any, lead, {
      value: data.value ?? 1,
      settings: effectiveSettings,
    });
    await persistConversionEvent(typeof lead.id === "string" && lead.id.startsWith("test-") ? null : lead.id, r, data.value ?? null);
    return { result: r };
  });

/** Reenvia (retry) um evento existente com o mesmo payload / event_id. */
export const metaRetryEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("conversion_events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error(error?.message || "evento não encontrado");
    const settings = await loadSettings();
    const pixelId = settings.meta_pixel_id;
    const token = process.env.META_CAPI_ACCESS_TOKEN;
    if (!pixelId || !token) throw new Error("faltam credenciais Meta");

    const payload = row.request_payload as any;
    if (!payload) throw new Error("payload original ausente — não é possível reenviar");

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${token}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
      );
      const json = await res.json().catch(() => ({}));
      const { persistConversionEvent } = await import("./conversions.server");
      await persistConversionEvent(row.lead_id, {
        ok: res.ok && !json?.error,
        event_name: row.event_name,
        event_id: row.event_id || `retry-${Date.now()}`,
        http_status: res.status,
        fbtrace_id: json?.fbtrace_id,
        events_received: json?.events_received,
        request_payload: payload,
        response: json,
        test_mode: !!row.test_mode,
      }, row.value ?? null);
      return { ok: res.ok && !json?.error, status: res.status, response: json };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

/** Nota de qualidade 0-100 (agregado das últimas 24h). */
export const metaQualityScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const settings = await loadSettings();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("conversion_events")
      .select("status, http_status, fbtrace_id, request_payload, event_id, test_mode")
      .eq("platform", "meta_capi")
      .gte("created_at", since);

    const arr = rows ?? [];
    const total = arr.length;
    const ok = arr.filter((r: any) => r.status === "ok").length;
    const withTrace = arr.filter((r: any) => !!r.fbtrace_id).length;
    const withEventId = arr.filter((r: any) => !!r.event_id).length;

    // Média de campos user_data preenchidos por evento
    let userDataFields = 0;
    let userDataCount = 0;
    for (const r of arr) {
      const ud = (r.request_payload as any)?.data?.[0]?.user_data;
      if (ud) {
        userDataFields += Object.keys(ud).length;
        userDataCount++;
      }
    }
    const avgUserData = userDataCount ? userDataFields / userDataCount : 0;

    // Score simples (heurístico, 0-100)
    let score = 0;
    if (settings.meta_pixel_id) score += 15;
    if (process.env.META_CAPI_ACCESS_TOKEN) score += 15;
    if (total > 0) score += 10;
    if (total > 0) score += Math.round((ok / total) * 25);
    if (total > 0) score += Math.round((withTrace / total) * 15);
    if (total > 0) score += Math.round((withEventId / total) * 10);
    if (avgUserData >= 6) score += 10; else if (avgUserData >= 3) score += 5;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      total,
      ok,
      errors: total - ok,
      withTrace,
      withEventId,
      avgUserDataFields: Math.round(avgUserData * 10) / 10,
      testMode: !!settings.meta_test_event_code,
      pixelConfigured: !!settings.meta_pixel_id,
      tokenConfigured: !!process.env.META_CAPI_ACCESS_TOKEN,
    };
  });
