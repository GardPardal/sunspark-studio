import { createFileRoute } from "@tanstack/react-router";
import { runScan } from "@/modules/editorial/engine.server";

/** Cron: descoberta de pautas. Chamado pelo agendador interno. */
export const Route = createFileRoute("/api/public/editorial/scan")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runScan({});
          return Response.json(result);
        } catch (e: any) {
          console.error("[editorial/scan]", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async () =>
        Response.json({ ok: true, info: "Radar Editorial — use POST para executar." }),
    },
  },
});
