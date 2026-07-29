import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/meta/audience/customers.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const skipSync = url.searchParams.get("sync") === "0";
        const force = url.searchParams.get("force") === "1";

        const { syncPloomesAudienceAll, buildAudienceCsv } = await import(
          "@/lib/ploomes-audience.server"
        );

        let syncInfo: any = null;
        if (!skipSync) {
          try {
            syncInfo = await syncPloomesAudienceAll(force);
          } catch (e: any) {
            syncInfo = { error: e?.message ?? String(e) };
          }
        }

        const { csv, rows } = await buildAudienceCsv("customers");
        const today = new Date().toISOString().slice(0, 10);
        return new Response(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="lz7-customers-${today}.csv"`,
            "Cache-Control": "private, max-age=300",
            "X-Row-Count": String(rows),
            "X-Sync-Info": syncInfo ? JSON.stringify(syncInfo).slice(0, 400) : "skipped",
          },
        });
      },
    },
  },
});
