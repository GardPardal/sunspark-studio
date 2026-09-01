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

export const Route = createFileRoute("/api/public/hooks/meta-sheets")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
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
          /* vazio ok */
        }

        try {
          // 1) atualiza os dados do Meta (ontem + margem)
          const { syncMetaInsights } = await import("@/lib/meta.server");
          await syncMetaInsights(Number(body?.days ?? 2));

          // 2) exporta para a planilha
          const { exportMetaInsightsToSheet } = await import("@/lib/sheets-meta.server");
          const result = await exportMetaInsightsToSheet(body?.date);
          return json(200, { ok: true, ...result });
        } catch (e: any) {
          return json(500, { ok: false, error: String(e?.message ?? e) });
        }
      },
    },
  },
});
