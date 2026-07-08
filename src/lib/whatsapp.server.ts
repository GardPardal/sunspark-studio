// Helpers para WhatsApp Cloud API (Meta)
// Doc: https://developers.facebook.com/docs/whatsapp/cloud-api

const GRAPH_VERSION = "v21.0";

export function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}${path}`;
}

export async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WhatsApp não configurado");

  const res = await fetch(graphUrl(`/${phoneId}/messages`), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
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
