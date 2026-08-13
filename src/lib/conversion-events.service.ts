/**
 * Conversion Events Service (server-only).
 *
 * Ponto único de envio à Meta CAPI (Lead, CompleteRegistration, Schedule, Purchase).
 * Centraliza:
 *   - validação obrigatória (telefone, nome, cidade quando aplicável)
 *   - hashing + deduplicação determinística (já feito em sendMetaEvent)
 *   - cálculo do Match Quality (0-10) por evento
 *   - persistência enriquecida em conversion_events (status_detail, match_quality, validation_errors)
 *   - registro na Timeline (best-effort)
 *
 * Usado por:
 *   - /sdr-leadqualified (CompleteRegistration)
 *   - webhook Ploomes (Lead, Schedule, Purchase via dispatchStageConversions)
 *   - formulários do site (Lead)
 *   - painel /mod/meta-conversions (test / retry)
 */
import type { LeadForConversion, MetaEventName, MetaSendResult } from "./conversions.server";

type SettingsMap = Record<string, string | null | undefined>;

/** Campos de user_data que contam para o Match Quality. */
const MATCH_QUALITY_FIELDS = [
  "em", "ph", "fn", "ln", "ct", "st", "zp",
  "external_id", "fbp", "fbc", "client_ip_address", "client_user_agent",
] as const;

/** Requisitos por evento — se faltar, evento é marcado skipped_validation. */
const EVENT_REQUIREMENTS: Record<MetaEventName, Array<keyof LeadForConversion>> = {
  PageView: [],
  ViewContent: [],
  Lead: ["telefone"],
  CompleteRegistration: ["nome", "telefone", "cidade"],
  Schedule: ["telefone"],
  Purchase: ["telefone"],
};

export type DispatchInput = {
  event: MetaEventName;
  lead: LeadForConversion;
  value?: number;
  currency?: string;
  actorId?: string | null;
  timelineOnLeadId?: string | null;
  retryOf?: string | null;
  /** event_id compartilhado com o Pixel do navegador (deduplicação Pixel ↔ CAPI). */
  eventId?: string | null;
};

export type DispatchOutput = {
  ok: boolean;
  status_detail: "enviado" | "aceito_meta" | "falhou" | "skipped_validation" | "reenviado";
  event_name: MetaEventName;
  event_id?: string;
  fbtrace_id?: string;
  http_status?: number;
  match_quality?: number;
  test_mode?: boolean;
  validation_errors?: string[];
  pixel_id?: string;
  db_id?: string;
  error?: string;
};

/** Calcula uma nota 0-10 baseada nos campos preenchidos em user_data (hasheados). */
export function computeMatchQuality(user_data: Record<string, unknown> | undefined | null): number {
  if (!user_data) return 0;
  let filled = 0;
  for (const k of MATCH_QUALITY_FIELDS) {
    const v = (user_data as any)[k];
    if (v && (Array.isArray(v) ? v.length > 0 : true)) filled++;
  }
  return Math.round((filled / MATCH_QUALITY_FIELDS.length) * 100) / 10;
}

/** Valida dados mínimos por evento. Retorna array vazio se OK. */
export function validateForEvent(event: MetaEventName, lead: LeadForConversion): string[] {
  const errors: string[] = [];
  for (const field of EVENT_REQUIREMENTS[event]) {
    const v = (lead as any)[field];
    if (!v || String(v).trim().length < 2) errors.push(`Campo obrigatório ausente: ${field}`);
  }
  if (EVENT_REQUIREMENTS[event].includes("telefone") && lead.telefone) {
    const digits = String(lead.telefone).replace(/\D/g, "");
    if (digits.length < 10) errors.push("Telefone com menos de 10 dígitos");
  }
  return errors;
}

async function loadSettings(): Promise<SettingsMap> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("site_settings").select("key,value");
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key] = r.value ?? "";
  return out;
}

/**
 * Dispara um evento único para a Meta CAPI através do serviço centralizado.
 * Sempre persiste em conversion_events (mesmo quando skipped_validation).
 */
export async function dispatchEvent(input: DispatchInput): Promise<DispatchOutput> {
  const settings = await loadSettings();
  const { sendMetaEvent, buildEventId } = await import("./conversions.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const pixel_id = settings.meta_pixel_id || undefined;
  const validation_errors = validateForEvent(input.event, input.lead);

  // Validação obrigatória — não envia se faltar campo requerido.
  if (validation_errors.length) {
    const event_id = input.eventId || buildEventId(input.lead.id, input.event);
    const { data: row } = await supabaseAdmin.from("conversion_events").insert({
      lead_id: input.lead.id.startsWith("test-") ? null : input.lead.id,
      event_name: input.event,
      platform: "meta_capi",
      status: "skipped",
      status_detail: "skipped_validation",
      value: input.value ?? null,
      response: { skipped: true, reason: "validation", errors: validation_errors } as any,
      event_id,
      http_status: 0,
      test_mode: !!(settings.meta_test_event_code || "").trim(),
      validation_errors: validation_errors as any,
      match_quality: 0,
      retry_of: input.retryOf ?? null,
    } as any).select("id").maybeSingle();
    return {
      ok: false,
      status_detail: "skipped_validation",
      event_name: input.event,
      event_id,
      validation_errors,
      pixel_id,
      db_id: row?.id,
    };
  }

  // Envia à Meta.
  const result: MetaSendResult = await sendMetaEvent(input.event, input.lead, {
    value: input.value,
    currency: input.currency,
    settings,
    eventId: input.eventId || undefined,
  });

  const user_data = result.request_payload?.data?.[0]?.user_data;
  const match_quality = computeMatchQuality(user_data);
  // Status detalhado
  const status_detail: DispatchOutput["status_detail"] = input.retryOf
    ? "reenviado"
    : result.ok
      ? ((result.events_received ?? 0) > 0 ? "aceito_meta" : "enviado")
      : "falhou";

  const { data: row } = await supabaseAdmin.from("conversion_events").insert({
    lead_id: input.lead.id.startsWith("test-") ? null : input.lead.id,
    event_name: result.event_name,
    platform: "meta_capi",
    status: result.ok ? "ok" : (result.skipped ? "skipped" : "error"),
    status_detail,
    value: input.value ?? null,
    response: result.response as any,
    event_id: result.event_id,
    fbtrace_id: result.fbtrace_id ?? null,
    request_payload: result.request_payload as any,
    http_status: result.http_status,
    test_mode: result.test_mode,
    match_quality,
    retry_of: input.retryOf ?? null,
  } as any).select("id").maybeSingle();

  // Timeline best-effort
  if (input.timelineOnLeadId) {
    try {
      await supabaseAdmin.rpc("record_event", {
        _entity_type: "lead",
        _entity_id: input.timelineOnLeadId,
        _kind: "meta_capi_event",
        _title: `Meta CAPI · ${input.event} · ${status_detail}`,
        _summary: result.ok
          ? `event_id=${result.event_id?.slice(0, 10)} · fbtrace=${result.fbtrace_id ?? "—"} · match=${match_quality}/10`
          : `Falhou: ${result.response?.error?.message || result.reason || "erro"}`,
        _source: "conversion_events_service",
        _payload: {
          event: input.event,
          event_id: result.event_id,
          fbtrace_id: result.fbtrace_id,
          http_status: result.http_status,
          match_quality,
          test_mode: result.test_mode,
        },
        _actor_id: input.actorId ?? null,
        _actor_name: undefined,
      } as any);
    } catch { /* best-effort */ }
  }

  return {
    ok: result.ok,
    status_detail,
    event_name: input.event,
    event_id: result.event_id,
    fbtrace_id: result.fbtrace_id,
    http_status: result.http_status,
    match_quality,
    test_mode: result.test_mode,
    pixel_id,
    db_id: row?.id,
    error: result.ok ? undefined : (result.response?.error?.message || result.reason),
  };
}
