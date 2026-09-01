import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Dados numéricos da Sala de Comando (/dashhub).
 *
 * GET  -> retorna { ok, atualizado_em, origem, dados }  (aberto, a página lê)
 * POST -> grava o pacote de dados (exige X-Hub-Secret)
 *
 * Body do POST: { mode?: "replace" | "merge", origem?: string, dados: {...} }
 * Padrão é "merge" no primeiro nível: chaves enviadas sobrescrevem,
 * chaves ausentes permanecem. {"dados":{}} é no-op.
 * Antes de gravar, a versão anterior vai para public.hub_dados_hist.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Hub-Secret, Authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

function authorized(request: Request, url: URL) {
  const expected = process.env["DASHHUB_WEBHOOK_SECRET"];
  if (!expected) return false;
  const got =
    request.headers.get("x-hub-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return got === expected || url.searchParams.get("secret") === expected;
}

const bodySchema = z.object({
  mode: z.enum(["replace", "merge"]).optional(),
  origem: z.string().max(200).optional(),
  dados: z.record(z.string(), z.unknown()),
});

export const Route = createFileRoute("/api/public/dashhub/dados")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("hub_dados")
          .select("dados, origem, atualizado_em")
          .eq("id", 1)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        const row = data as { dados: unknown; origem: string | null; atualizado_em: string } | null;
        return json({
          ok: true,
          atualizado_em: row?.atualizado_em ?? null,
          origem: row?.origem ?? null,
          dados: row?.dados ?? {},
        });
      },

      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (!authorized(request, url)) return json({ error: "não autorizado" }, 401);

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "payload inválido", details: parsed.error.issues }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let dados = parsed.data.dados as Record<string, unknown>;

        // Objeto vazio nunca limpa nada: responde 200 sem alterar.
        if (Object.keys(dados).length === 0) {
          const { data: cur } = await supabaseAdmin
            .from("hub_dados")
            .select("dados, origem, atualizado_em")
            .eq("id", 1)
            .maybeSingle();
          const row = cur as {
            dados: unknown;
            origem: string | null;
            atualizado_em: string;
          } | null;
          return json({
            ok: true,
            noop: true,
            atualizado_em: row?.atualizado_em ?? null,
            origem: row?.origem ?? null,
            dados: row?.dados ?? {},
          });
        }

        // Padrão é merge no primeiro nível (equivalente a jsonb ||).
        if ((parsed.data.mode ?? "merge") === "merge") {
          const { data: cur } = await supabaseAdmin
            .from("hub_dados")
            .select("dados")
            .eq("id", 1)
            .maybeSingle();
          const prev = ((cur as { dados?: Record<string, unknown> } | null)?.dados ?? {}) as Record<
            string,
            unknown
          >;

          // Histórico: grava a versão ANTERIOR antes do merge.
          if (cur) {
            await supabaseAdmin.from("hub_dados_hist").insert({
              dados: prev as never,
              origem: parsed.data.origem ?? null,
            } as never);
          }

          dados = { ...prev, ...dados };
        }

        const { data, error } = await supabaseAdmin
          .from("hub_dados")
          .upsert(
            {
              id: 1,
              dados: dados as never,
              origem: parsed.data.origem ?? null,
              atualizado_em: new Date().toISOString(),
            } as never,
            { onConflict: "id" },
          )
          .select("dados, origem, atualizado_em")
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);

        const row = data as { dados: unknown; origem: string | null; atualizado_em: string } | null;
        return json({
          ok: true,
          atualizado_em: row?.atualizado_em ?? null,
          origem: row?.origem ?? null,
          dados: row?.dados ?? dados,
        });
      },
    },
  },
});
