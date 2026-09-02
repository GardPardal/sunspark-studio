// Helpers para WhatsApp Cloud API (Meta)
// Doc: https://developers.facebook.com/docs/whatsapp/cloud-api

const GRAPH_VERSION = "v21.0";

export function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}${path}`;
}

export const DEFAULT_WHATSAPP_ACCESS_TOKEN =
  "EAARZALrz7fjwBSTa0RrmZBRImttrl0LkpFu44YgaZCMQaB29ZBr3wbnKXRXWq35wZCM5UtJAmLu3VU2T36KAsg6wfQs3GZAsemehulaZAAKE2OsXsjPANEU1jaRTS2R14FmggNMKPviSeNKDd9Wo2rYBTYXpXS6N2xGEMivxMrJZA2RMx8FCToGkVAysxkkxzwZDZD";
export const DEFAULT_PHONE_NUMBER_ID = "964552503415538";

export function getWhatsAppToken(): string {
  return process.env.WHATSAPP_ACCESS_TOKEN || DEFAULT_WHATSAPP_ACCESS_TOKEN;
}

export function getWhatsAppPhoneId(): string {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || DEFAULT_PHONE_NUMBER_ID;
}

export async function sendWhatsAppText(to: string, body: string) {
  const token = getWhatsAppToken();
  const phoneId = getWhatsAppPhoneId();

  const cleanTo = to.replace(/\D/g, "");

  const res = await fetch(graphUrl(`/${phoneId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanTo,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4000) },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WhatsApp send falhou [${res.status}]: ${t}`);
  }
  return res.json();
}

export async function sendWhatsAppMedia(
  to: string,
  type: "image" | "document" | "audio" | "video",
  mediaUrl: string,
  captionOrFilename?: string,
) {
  const token = getWhatsAppToken();
  const phoneId = getWhatsAppPhoneId();

  const cleanTo = to.replace(/\D/g, "");

  const mediaPayload: Record<string, any> = { link: mediaUrl };
  if (type === "document" && captionOrFilename) {
    mediaPayload.filename = captionOrFilename;
  } else if (captionOrFilename && (type === "image" || type === "video")) {
    mediaPayload.caption = captionOrFilename;
  }

  const res = await fetch(graphUrl(`/${phoneId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanTo,
      type,
      [type]: mediaPayload,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WhatsApp media send falhou [${res.status}]: ${t}`);
  }
  return res.json();
}

/** Verifica assinatura HMAC-SHA256 (X-Hub-Signature-256) do webhook. */
export async function verifyMetaSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice(7);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== provided.length) return false;
  // constant-time compare
  let ok = 0;
  for (let i = 0; i < expected.length; i++) ok |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return ok === 0;
}
