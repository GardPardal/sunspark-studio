/**
 * Server-side conversion senders — Meta CAPI, TikTok Events API, GA4 Measurement Protocol.
 * Called ONLY from server functions after checking permissions.
 */
import { createHash } from "crypto";

type SettingsMap = Record<string, string | null | undefined>;

function sha256Lower(v?: string | null): string | undefined {
  if (!v) return undefined;
  return createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
}
function normPhone(v?: string | null): string | undefined {
  if (!v) return undefined;
  return v.replace(/\D/g, "");
}

export type LeadForConversion = {
  id: string;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  estado?: string | null;
  gclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  user_agent?: string | null;
  page_url?: string | null;
};

export type ConversionResult = { platform: string; status: string; response?: unknown };

const META_EVENT: Record<string, string> = {
  atendimento: "Lead",
  venda: "Purchase",
  faturado: "Purchase",
};
const TIKTOK_EVENT: Record<string, string> = {
  atendimento: "Lead",
  venda: "CompletePayment",
  faturado: "CompletePayment",
};
const GA4_EVENT: Record<string, string> = {
  atendimento: "qualified_lead",
  venda: "sale",
  faturado: "purchase",
};

async function sendMetaCAPI(
  lead: LeadForConversion,
  stage: string,
  value: number | undefined,
  eventId: string,
  settings: SettingsMap,
): Promise<ConversionResult | null> {
  const pixelId = settings.meta_pixel_id;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  const eventName = META_EVENT[stage];
  if (!pixelId || !token || !eventName) return null;

  const userData: Record<string, unknown> = {
    em: lead.email ? [sha256Lower(lead.email)] : undefined,
    ph: lead.telefone ? [sha256Lower(normPhone(lead.telefone))] : undefined,
    ct: lead.cidade ? [sha256Lower(lead.cidade)] : undefined,
    st: lead.estado ? [sha256Lower(lead.estado)] : undefined,
    country: [sha256Lower("br")],
    fbp: lead.fbp || undefined,
    fbc: lead.fbc || undefined,
    client_user_agent: lead.user_agent || undefined,
  };

  const body = {
    data: [{
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: "website",
      event_source_url: lead.page_url || undefined,
      user_data: userData,
      custom_data: { currency: "BRL", value: value ?? 1 },
    }],
    ...(settings.meta_test_event_code ? { test_event_code: settings.meta_test_event_code } : {}),
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json();
    return { platform: "meta_capi", status: res.ok ? "ok" : "error", response: json };
  } catch (e) {
    return { platform: "meta_capi", status: "error", response: { message: String(e) } };
  }
}

async function sendTikTokCAPI(
  lead: LeadForConversion,
  stage: string,
  value: number | undefined,
  eventId: string,
  settings: SettingsMap,
): Promise<ConversionResult | null> {
  const pixelCode = settings.tiktok_pixel_id;
  const token = process.env.TIKTOK_EVENTS_ACCESS_TOKEN;
  const eventName = TIKTOK_EVENT[stage];
  if (!pixelCode || !token || !eventName) return null;

  const body = {
    event_source: "web",
    event_source_id: pixelCode,
    data: [{
      event: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      user: {
        email: lead.email ? sha256Lower(lead.email) : undefined,
        phone: lead.telefone ? sha256Lower(normPhone(lead.telefone)) : undefined,
        ttp: lead.fbp || undefined,
        user_agent: lead.user_agent || undefined,
      },
      properties: { currency: "BRL", value: value ?? 1, content_type: "product" },
      page: { url: lead.page_url || undefined },
    }],
  };

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "content-type": "application/json", "Access-Token": token },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { platform: "tiktok_capi", status: res.ok && json.code === 0 ? "ok" : "error", response: json };
  } catch (e) {
    return { platform: "tiktok_capi", status: "error", response: { message: String(e) } };
  }
}

async function sendGA4MP(
  lead: LeadForConversion,
  stage: string,
  value: number | undefined,
  eventId: string,
  settings: SettingsMap,
): Promise<ConversionResult | null> {
  const measurementId = settings.ga4_measurement_id;
  const apiSecret = process.env.GA4_API_SECRET;
  const eventName = GA4_EVENT[stage];
  if (!measurementId || !apiSecret || !eventName) return null;

  const clientId = lead.id;
  const body = {
    client_id: clientId,
    events: [{
      name: eventName,
      params: {
        currency: "BRL",
        value: value ?? 1,
        transaction_id: eventId,
        gclid: lead.gclid || undefined,
      },
    }],
  };

  try {
    const res = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      { method: "POST", body: JSON.stringify(body) },
    );
    return { platform: "ga4_mp", status: res.ok ? "ok" : "error", response: { status: res.status } };
  } catch (e) {
    return { platform: "ga4_mp", status: "error", response: { message: String(e) } };
  }
}

export async function dispatchStageConversions(
  lead: LeadForConversion,
  stage: string,
  value: number | undefined,
  settings: SettingsMap,
): Promise<ConversionResult[]> {
  const eventId = `${lead.id}-${stage}-${Date.now()}`;
  const results = await Promise.all([
    sendMetaCAPI(lead, stage, value, eventId, settings),
    sendTikTokCAPI(lead, stage, value, eventId, settings),
    sendGA4MP(lead, stage, value, eventId, settings),
  ]);
  return results.filter((r): r is ConversionResult => !!r);
}
