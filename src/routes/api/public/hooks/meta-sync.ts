import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/hooks/meta-sync")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        // Autentica via apikey (anon) — padrão pg_cron do projeto
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          "";
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          new URL(request.url).searchParams.get("apikey") ??
          "";
        if (!expected || provided !== expected) {
          return json(401, { ok: false, error: "unauthorized" });
        }

        let body: any = {};
        try {
          body = await request.json();
        } catch {
          /* body vazio ok */
        }
        const mode = body?.mode ?? "all"; // 'entities' | 'insights' | 'all'
        const days = Number(body?.days ?? 3);

        const results: any = {};
        try {
          if (mode === "entities" || mode === "all") {
            const { syncMetaEntities } = await import("@/lib/meta.server");
            results.entities = await syncMetaEntities();
          }
          if (mode === "insights" || mode === "all") {
            const { syncMetaInsights } = await import("@/lib/meta.server");
            results.insights = await syncMetaInsights(days);
          }
          return json(200, { ok: true, results });
        } catch (e: any) {
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );
          await supabaseAdmin.from("meta_sync_state").upsert(
            {
              entity: mode === "insights" ? "insights" : "entities",
              last_run_at: new Date().toISOString(),
              last_status: "error",
              last_message: String(e?.message ?? e).slice(0, 500),
            },
            { onConflict: "entity" },
          );
          return json(500, { ok: false, error: String(e?.message ?? e) });
        }
      },
    },
  },
});
