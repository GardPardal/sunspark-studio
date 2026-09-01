import { createFileRoute } from "@tanstack/react-router";

// Endpoint para o pg_cron/agendador externo disparar a sincronização Ploomes.
// GET e POST aceitos. Use ?force=1 para ignorar o throttle de 10 minutos.
export const Route = createFileRoute("/api/public/meta/audience/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => runSync(request),
      POST: async ({ request }) => runSync(request),
    },
  },
});

async function runSync(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const { syncPloomesAudienceAll } = await import("@/lib/ploomes-audience.server");
  try {
    const result = await syncPloomesAudienceAll(force);
    return Response.json({ ok: true, result });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
