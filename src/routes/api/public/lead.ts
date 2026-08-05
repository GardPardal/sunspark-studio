import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Endpoint público de captação de leads para o site WordPress/Elementor.
 *
 * Uso no Elementor (Form > Actions After Submit > Webhook):
 *   URL: https://app.lz7energia.com.br/api/public/lead
 *
 * Também aceita JSON:
 *   POST { nome, telefone, email?, cidade?, estado?, valor_conta?, mensagem?, origem?, utm_* }
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(8).max(25),
  email: z.string().trim().email().max(160).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  estado: z.string().trim().max(60).optional().nullable(),
  valor_conta: z.string().trim().max(60).optional().nullable(),
  mensagem: z.string().trim().max(2000).optional().nullable(),
  origem: z.string().trim().max(80).optional().nullable(),
  utm_source: z.string().trim().max(120).optional().nullable(),
  utm_medium: z.string().trim().max(120).optional().nullable(),
  utm_campaign: z.string().trim().max(160).optional().nullable(),
  utm_term: z.string().trim().max(160).optional().nullable(),
  utm_content: z.string().trim().max(160).optional().nullable(),
  gclid: z.string().trim().max(255).optional().nullable(),
  fbclid: z.string().trim().max(255).optional().nullable(),
  fbp: z.string().trim().max(255).optional().nullable(),
  fbc: z.string().trim().max(255).optional().nullable(),
  page_url: z.string().trim().max(500).optional().nullable(),
  referrer: z.string().trim().max(500).optional().nullable(),
});

/** Elementor manda campos como form_fields[nome]; normalizamos os aliases mais comuns. */
function normalize(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.replace(/^form_fields\[(.+)\]$/, "$1").trim().toLowerCase();
    if (v === "" || v == null) continue;
    out[key] = typeof v === "string" ? v : String(v);
  }
  const pick = (...keys: string[]) => {
    for (const k of keys) if (out[k]) return out[k] as string;
    return undefined;
  };
  return {
    nome: pick("nome", "name", "your-name", "field_nome"),
    telefone: pick("telefone", "phone", "whatsapp", "celular", "tel"),
    email: pick("email", "e-mail", "your-email"),
    cidade: pick("cidade", "city"),
    estado: pick("estado", "state", "uf"),
    valor_conta: pick("valor_conta", "conta", "valor", "media_conta"),
    mensagem: pick("mensagem", "message", "obs", "observacao"),
    origem: pick("origem", "source") ?? "wordpress",
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_term: pick("utm_term"),
    utm_content: pick("utm_content"),
    gclid: pick("gclid"),
    fbclid: pick("fbclid"),
    fbp: pick("fbp", "_fbp"),
    fbc: pick("fbc", "_fbc"),
    page_url: pick("page_url", "referrer_url", "page_title_url"),
    referrer: pick("referrer", "referer"),
  };
}

export const Route = createFileRoute("/api/public/lead")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") ?? "";
          let raw: Record<string, unknown> = {};
          if (contentType.includes("application/json")) {
            raw = (await request.json()) as Record<string, unknown>;
          } else {
            const fd = await request.formData();
            for (const [k, v] of fd.entries()) raw[k] = typeof v === "string" ? v : "";
          }

          const parsed = schema.safeParse(normalize(raw));
          if (!parsed.success) {
            return Response.json(
              { ok: false, error: "Dados inválidos", issues: parsed.error.issues.map((i) => i.path.join(".")) },
              { status: 400, headers: CORS },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("leads").insert({
            ...parsed.data,
            user_agent: request.headers.get("user-agent") ?? null,
          });
          if (error) {
            console.error("[api/public/lead] insert failed:", error.message);
            return Response.json({ ok: false, error: "Falha ao registrar lead" }, { status: 500, headers: CORS });
          }

          return Response.json({ ok: true }, { status: 200, headers: CORS });
        } catch (e) {
          console.error("[api/public/lead] error:", e);
          return Response.json({ ok: false, error: "Erro inesperado" }, { status: 500, headers: CORS });
        }
      },
    },
  },
});
