import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Hub-Secret, Authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const estadoSchema = z.object({
  trat: z.record(z.string(), z.unknown()).optional(),
  notas: z.array(z.unknown()).optional(),
  msgs: z.array(z.unknown()).optional(),
});

const bodySchema = z.object({
  mode: z.enum(["replace", "merge"]).optional(),
  estado: estadoSchema.passthrough(),
});

function authorized(request: Request, url: URL) {
  const expected = process.env["DASHHUB_WEBHOOK_SECRET"];
  if (!expected) return false;
  const got =
    request.headers.get("x-hub-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") ??
    "";
  return got === expected || url.searchParams.get("secret") === expected;
}

export const Route = createFileRoute("/api/public/dashhub")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),

      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("hub_estado")
          .select("estado, atualizado_em")
          .eq("id", 1)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "estado não encontrado" }, 404);
        return json({
          ok: true,
          atualizado_em: (data as { atualizado_em: string }).atualizado_em,
          estado: (data as { estado: unknown }).estado,
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

        let estado: Record<string, unknown> = parsed.data.estado as Record<string, unknown>;
        if ((parsed.data.mode ?? "merge") === "merge") {
          const { data: cur } = await supabaseAdmin
            .from("hub_estado")
            .select("estado")
            .eq("id", 1)
            .maybeSingle();
          const prev = ((cur as { estado?: Record<string, unknown> } | null)?.estado ?? {}) as Record<
            string,
            unknown
          >;
          estado = { ...prev, ...estado };
        }

        const { data, error } = await supabaseAdmin
          .from("hub_estado")
          .update({ estado: estado as never })
          .eq("id", 1)
          .select("estado, atualizado_em")
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);

        return json({
          ok: true,
          atualizado_em: (data as { atualizado_em: string } | null)?.atualizado_em ?? null,
          estado: (data as { estado: unknown } | null)?.estado ?? estado,
        });
      },
    },
  },
});
