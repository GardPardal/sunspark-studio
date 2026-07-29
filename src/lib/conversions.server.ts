/**
 * Server-side conversion senders — Meta CAPI (primary), TikTok, GA4.
 * Todo o envio Meta passa por `sendMetaEvent`, que monta o payload completo,
 * dispara para Graph v21 e devolve `event_id`, `fbtrace_id`, status HTTP e
 * o payload enviado (para auditoria em /mod/meta-debug).
 */
import { createHash } from "crypto";

export const META_GRAPH_VERSION = "v21.0";

type SettingsMap = Record<string, string | null | undefined>;

function sha256Lower(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim().toLowerCase();
  if (!s) return undefined;
  return createHash("sha256").update(s).digest("hex");
}
function sha256Raw(v?: string | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return createHash("sha256").update(s).digest("hex");
}
function normPhone(v?: string | null): string | undefined {
  if (!v) return undefined;
  const d = v.replace(/\D/g, "");
  return d || undefined;
}
function splitName(nome?: string | null): { fn?: string; ln?: string } {
  if (!nome) return {};
  const parts = String(nome).trim().split(/\s+/);
  if (!parts.length) return {};
  const fn = parts.shift();
  const ln = parts.join(" ") || undefined;
  return { fn, ln };
}
function digitsOnly(v?: string | null): string | undefined {
  if (!v) return undefined;
  const d = v.replace(/\D/g, "");
  return d || undefined;
}

export type LeadForConversion = {
  id: string;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  gclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  user_agent?: string | null;
  page_url?: string | null;
  client_ip?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

export type MetaEventName =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "CompleteRegistration"
  | "Schedule"
  | "Purchase";

export const ALL_META_EVENTS: MetaEventName[] = [
  "PageView",
  "ViewContent",
  "Lead",
  "CompleteRegistration",
  "Schedule",
  "Purchase",
];

/** Mapa padrão Stage do Ploomes/CRM → evento Meta. Configurável via site_settings `meta_event_<stage>`. */
export const DEFAULT_STAGE_MAP: Record<string, MetaEventName | ""> = {
  novo: "Lead",
  atendimento: "CompleteRegistration",
  agendado: "Schedule",
  venda: "Purchase",
  faturado: "Purchase",
  nao_atendido: "",
  perdido: "",
};

export function metaEventForStage(stage: string, settings: SettingsMap): MetaEventName | undefined {
  const custom = (settings[`meta_event_${stage}`] || "").trim();
  if (custom) return custom as MetaEventName;
  const def = DEFAULT_STAGE_MAP[stage];
  return def ? (def as MetaEventName) : undefined;
}

/** event_id determinístico: mesmo lead + mesmo evento + mesma janela de 15min = mesmo id (dedup Pixel↔CAPI). */
export function buildEventId(leadId: string, event: string, at: number = Date.now()) {
  const bucket = Math.floor(at / (15 * 60 * 1000));
  return createHash("sha1").update(`${leadId}|${event}|${bucket}`).digest("hex");
}

export type MetaSendResult = {
  ok: boolean;
  event_name: string;
  event_id: string;
  http_status: number;
  fbtrace_id?: string;
  events_received?: number;
  request_payload: unknown;
  response: unknown;
  test_mode: boolean;
  skipped?: boolean;
  reason?: string;
};

/**
 * Monta e envia um evento único para a Meta CAPI.
 * Retorna toda a evidência (payload, status, fbtrace_id) para auditoria.
 */
export async function sendMetaEvent(
  event: MetaEventName,
  lead: LeadForConversion,
  opts: { value?: number; currency?: string; settings: SettingsMap; eventId?: string; force?: boolean } = {} as any,
): Promise<MetaSendResult> {
  const settings = opts.settings || {};
  const pixelId = settings.meta_pixel_id;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const testCode = (settings.meta_test_event_code || "").trim();
  const testMode = !!testCode;
  const now = Math.floor(Date.now() / 1000);
  const event_id = opts.eventId || buildEventId(lead.id, event);

  const payloadPreview = {
    pixelId, event, event_id, test_event_code: testCode || undefined,
  };

  if (!pixelId || !token) {
    return {
      ok: false, event_name: event, event_id, http_status: 0,
      request_payload: payloadPreview, response: { error: "faltam credenciais Meta (pixel/token)" },
      test_mode: testMode, skipped: true, reason: "missing_credentials",
    };
  }

  const { fn, ln } = splitName(lead.nome);
  const value = typeof opts.value === "number" ? opts.value : 1;
  const currency = opts.currency || "BRL";

  const user_data: Record<string, unknown> = {
    em: lead.email ? [sha256Lower(lead.email)] : undefined,
    ph: lead.telefone ? [sha256Lower(normPhone(lead.telefone))] : undefined,
    fn: fn ? [sha256Lower(fn)] : undefined,
    ln: ln ? [sha256Lower(ln)] : undefined,
    ct: lead.cidade ? [sha256Lower(lead.cidade)] : undefined,
    st: lead.estado ? [sha256Lower(lead.estado)] : undefined,
    zp: lead.cep ? [sha256Lower(digitsOnly(lead.cep))] : undefined,
    country: [sha256Lower("br")],
    external_id: [sha256Raw(lead.id)],
    fbp: lead.fbp || undefined,
    fbc: lead.fbc || undefined,
    client_ip_address: lead.client_ip || undefined,
    client_user_agent: lead.user_agent || undefined,
  };
  // limpa undefined
  for (const k of Object.keys(user_data)) if (user_data[k] === undefined) delete user_data[k];

  const custom_data: Record<string, unknown> = {
    currency,
    value,
    content_name: `LZ7 Solar - ${event}`,
    content_category: "solar_energy",
    content_ids: [lead.id],
    contents: [{ id: lead.id, quantity: 1, item_price: value }],
    lead_id: lead.id,
    utm_source: lead.utm_source || undefined,
    utm_medium: lead.utm_medium || undefined,
    utm_campaign: lead.utm_campaign || undefined,
    utm_content: lead.utm_content || undefined,
    utm_term: lead.utm_term || undefined,
  };
  for (const k of Object.keys(custom_data)) if (custom_data[k] === undefined) delete custom_data[k];

  const eventObj: Record<string, unknown> = {
    event_name: event,
    event_time: now,
    event_id,
    action_source: "website",
    event_source_url: lead.page_url || settings.site_url || "https://lz7energia.com.br",
    user_data,
    custom_data,
    data_processing_options: [],
  };

  const body = {
    data: [eventObj],
    ...(testCode ? { test_event_code: testCode } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${pixelId}/events?access_token=${token}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    const json = await res.json().catch(() => ({}));
    return {
      ok: res.ok && !json?.error,
      event_name: event,
      event_id,
      http_status: res.status,
      fbtrace_id: json?.fbtrace_id,
      events_received: json?.events_received,
      request_payload: body,
      response: json,
      test_mode: testMode,
    };
  } catch (e: any) {
    return {
      ok: false, event_name: event, event_id, http_status: 0,
      request_payload: body, response: { message: String(e?.message ?? e) },
      test_mode: testMode,
    };
  }
}

/** Persiste o resultado em public.conversion_events (server-side). */
export async function persistConversionEvent(
  leadId: string | null,
  result: MetaSendResult,
  value: number | null,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("conversion_events").insert({
    lead_id: leadId,
    event_name: result.event_name,
    platform: "meta_capi",
    status: result.ok ? "ok" : (result.skipped ? "skipped" : "error"),
    value,
    response: result.response as any,
    event_id: result.event_id,
    fbtrace_id: result.fbtrace_id ?? null,
    request_payload: result.request_payload as any,
    http_status: result.http_status,
    test_mode: result.test_mode,
  } as any);
}

/** ==== Legado: TikTok / GA4 mantidos como estavam ==== */

const TIKTOK_EVENT: Record<string, string> = {
  novo: "Lead", atendimento: "Lead", venda: "CompletePayment", faturado: "CompletePayment",
};
const GA4_EVENT: Record<string, string> = {
  novo: "generate_lead", atendimento: "qualified_lead", venda: "sale", faturado: "purchase",
};

async function sendTikTokCAPI(lead: LeadForConversion, stage: string, value: number | undefined, eventId: string, settings: SettingsMap) {
  const pixelCode = settings.tiktok_pixel_id;
  const token = process.env.TIKTOK_EVENTS_ACCESS_TOKEN;
  const eventName = TIKTOK_EVENT[stage];
  if (!pixelCode || !token || !eventName) return null;
  const body = {
    event_source: "web", event_source_id: pixelCode,
    data: [{ event: eventName, event_time: Math.floor(Date.now() / 1000), event_id: eventId,
      user: { email: lead.email ? sha256Lower(lead.email) : undefined, phone: lead.telefone ? sha256Lower(normPhone(lead.telefone)) : undefined, ttp: lead.fbp || undefined, user_agent: lead.user_agent || undefined },
      properties: { currency: "BRL", value: value ?? 1, content_type: "product" },
      page: { url: lead.page_url || undefined },
    }],
  };
  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST", headers: { "content-type": "application/json", "Access-Token": token }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { platform: "tiktok_capi", status: res.ok && json.code === 0 ? "ok" : "error", response: json };
  } catch (e) { return { platform: "tiktok_capi", status: "error", response: { message: String(e) } }; }
}

async function sendGA4MP(lead: LeadForConversion, stage: string, value: number | undefined, eventId: string, settings: SettingsMap) {
  const measurementId = settings.ga4_measurement_id;
  const apiSecret = process.env.GA4_API_SECRET;
  const eventName = GA4_EVENT[stage];
  if (!measurementId || !apiSecret || !eventName) return null;
  const body = {
    client_id: lead.id,
    events: [{ name: eventName, params: { currency: "BRL", value: value ?? 1, transaction_id: eventId, gclid: lead.gclid || undefined } }],
  };
  try {
    const res = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`, { method: "POST", body: JSON.stringify(body) });
    return { platform: "ga4_mp", status: res.ok ? "ok" : "error", response: { status: res.status } };
  } catch (e) { return { platform: "ga4_mp", status: "error", response: { message: String(e) } }; }
}

/**
 * Dispara conversões para um Stage (usado pelo webhook Ploomes).
 * Meta → evento resolvido via `metaEventForStage`; TikTok/GA4 mantêm o mapa legado.
 */
export async function dispatchStageConversions(
  lead: LeadForConversion,
  stage: string,
  value: number | undefined,
  settings: SettingsMap,
) {
  const results: any[] = [];
  const metaEvent = metaEventForStage(stage, settings);
  if (metaEvent) {
    const r = await sendMetaEvent(metaEvent, lead, { value, settings });
    // já persiste internamente em conversion_events (com fbtrace_id/payload).
    await persistConversionEvent(lead.id, r, value ?? null);
  }
  const eventId = buildEventId(lead.id, stage);
  const tk = await sendTikTokCAPI(lead, stage, value, eventId, settings);
  if (tk) results.push(tk);
  const ga = await sendGA4MP(lead, stage, value, eventId, settings);
  if (ga) results.push(ga);
  return results;
}
