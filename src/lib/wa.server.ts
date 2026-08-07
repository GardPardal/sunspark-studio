// Núcleo server-only do canal WhatsApp (Cloud API / Graph).
// Não importar em código de cliente.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const GRAPH_VERSION = "v21.0";

export function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}${path}`;
}

/** Cliente service-role para o processamento interno do WhatsApp. */
export function waAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server env ausente");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Normaliza telefone brasileiro para E.164 (+55...). */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length <= 11 && !d.startsWith("55")) d = `55${d}`;
  if (d.length < 12 || d.length > 15) return d.length >= 10 ? `+${d}` : null;
  return `+${d}`;
}

/** Compara duas strings hex em tempo constante. */
function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifica assinatura HMAC-SHA256 (X-Hub-Signature-256) do webhook Meta.
 * Retorna false quando o segredo não está configurado — o chamador decide.
 */
export async function verifyWaSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice(7).toLowerCase();

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

  return timingSafeEqualHex(expected, provided);
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

function waCredentials() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WhatsApp não configurado");
  return { token, phoneId };
}

async function graphPost(path: string, body: unknown) {
  const { token } = waCredentials();
  const res = await fetch(graphUrl(path), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`WhatsApp Graph falhou [${res.status}]: ${text}`);
  return JSON.parse(text) as { messages?: Array<{ id?: string }> };
}

export async function waSendText(to: string, body: string) {
  const { phoneId } = waCredentials();
  return graphPost(`/${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to: to.replace(/^\+/, ""),
    type: "text",
    text: { preview_url: false, body: body.slice(0, 4000) },
  });
}

export async function waSendTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  variables: string[] = [],
) {
  const { phoneId } = waCredentials();
  return graphPost(`/${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to: to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(variables.length
        ? {
            components: [
              {
                type: "body",
                parameters: variables.map((text) => ({ type: "text", text })),
              },
            ],
          }
        : {}),
    },
  });
}

export async function waMarkRead(providerMessageId: string) {
  const { phoneId } = waCredentials();
  return graphPost(`/${phoneId}/messages`, {
    messaging_product: "whatsapp",
    status: "read",
    message_id: providerMessageId,
  });
}

/** Envio com retry exponencial simples (erros de rede / 5xx). */
export async function waSendWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      // erros 4xx não adiantam repetir
      if (/\[4\d\d\]/.test(msg)) break;
      await new Promise((r) => setTimeout(r, 400 * 2 ** i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Falha no envio WhatsApp");
}

// ---------------------------------------------------------------------------
// Janela de 24h
// ---------------------------------------------------------------------------

export function isInsideServiceWindow(lastInboundAt: string | null | undefined) {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export async function waAudit(
  supabase: ReturnType<typeof waAdminClient>,
  entry: {
    org_id?: string | null;
    actor_id?: string | null;
    action: string;
    entity_type?: string | null;
    entity_id?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("wa_audit_log").insert({
      org_id: entry.org_id ?? null,
      actor_id: entry.actor_id ?? null,
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      detail: (entry.detail ?? {}) as never,
    });
  } catch (e) {
    console.error("[wa audit]", e);
  }
}
