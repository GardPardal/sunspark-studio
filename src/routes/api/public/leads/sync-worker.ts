import { createFileRoute } from "@tanstack/react-router";

/**
 * Worker da fila de sincronização CRM interno → Ploomes.
 * Chamado pelo agendador interno (a cada minuto) e manualmente pelo painel.
 * Protegido por token interno (tabela internal_tokens, nome `lead_sync_cron`).
 */
async function authorized(request: Request) {
  const got =
    request.headers.get("x-internal-token") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") ??
    "";
  if (!got) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("internal_tokens")
    .select("token")
    .eq("name", "lead_sync_cron")
    .maybeSingle();
  return Boolean(data?.token) && got === data.token;
}

export const Route = createFileRoute("/api/public/leads/sync-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await authorized(request))) return new Response("unauthorized", { status: 401 });
        try {
          const { processLeadSyncQueue } = await import("@/lib/leads/ploomes-sync.server");
          const out = await processLeadSyncQueue(10, "cron");
          return Response.json({
            ...out,
            ok: true,
            results: out.results.map((r) => ({
              lead_id: r.lead_id,
              ok: r.ok,
              error: (r as any).error ?? null,
            })),
          });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
