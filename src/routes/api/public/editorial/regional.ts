import { createFileRoute } from "@tanstack/react-router";
import { runRegionalCycle } from "@/modules/editorial/regional.server";

/** Cron 3x/dia: notícias regionais (apuração + reescrita própria com crédito à fonte). */
export const Route = createFileRoute("/api/public/editorial/regional")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: any = {};
          try {
            body = await request.json();
          } catch {
            body = {};
          }
          const result = await runRegionalCycle({
            maxPosts: Number(body?.maxPosts) || undefined,
            porFonte: Number(body?.porFonte) || undefined,
          });
          return Response.json(result);
        } catch (e: any) {
          console.error("[editorial/regional]", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      GET: async () =>
        Response.json({ ok: true, info: "Radar Regional — use POST para executar." }),
    },
  },
});
