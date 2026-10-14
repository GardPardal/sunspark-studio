import { createFileRoute } from "@tanstack/react-router";

// Recebe os dados do relatório /relatoriotrafego. O corpo é assinado com HMAC-SHA256
// (cabeçalho X-Assinatura, hex) usando a PLOOMES_USER_KEY do servidor.

const CHAVE = "relatorio:trafego";
const LIMITE = 3_000_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

async function hmacHex(segredo: string, corpo: string) {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", chave, enc.encode(corpo));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function iguais(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export const Route = createFileRoute("/api/public/relatorio-trafego")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = process.env.PLOOMES_USER_KEY;
        if (!segredo) return json({ ok: false, error: "não configurado" }, 503);
        const corpo = await request.text();
        if (corpo.length > LIMITE) return json({ ok: false, error: "grande demais" }, 413);
        const recebida = (request.headers.get("x-assinatura") ?? "").toLowerCase();
        if (!iguais(recebida, await hmacHex(segredo, corpo)))
          return json({ ok: false, error: "assinatura inválida" }, 401);
        let payload: { dados?: unknown; comp?: unknown };
        try {
          payload = JSON.parse(corpo);
        } catch {
          return json({ ok: false, error: "json inválido" }, 400);
        }
        if (!payload?.dados || !payload?.comp)
          return json({ ok: false, error: "faltam dados ou comp" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("site_settings")
          .upsert(
            { key: CHAVE, value: corpo, updated_at: new Date().toISOString() },
            { onConflict: "key" },
          );
        if (error) return json({ ok: false, error: error.message }, 500);
        return json({ ok: true, bytes: corpo.length });
      },
    },
  },
});
