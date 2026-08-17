import { createFileRoute } from "@tanstack/react-router";
import { processQueue } from "@/modules/editorial/engine.server";

/** Cron: processa a fila editorial (apuração, redação, quality gate, capa, publicação). */
export const Route = createFileRoute("/api/public/editorial/worker")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await processQueue(2);
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[editorial/worker]", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true, info: "Fila editorial — use POST para processar." }),
    },
  },
});
