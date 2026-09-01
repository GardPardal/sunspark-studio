import { createFileRoute } from "@tanstack/react-router";

// Debug/manual trigger for Meta insights sync.
// Guarded by META_SYSTEM_USER_TOKEN so only holders of the token can run.
export const Route = createFileRoute("/api/public/meta-run-insights")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provided = url.searchParams.get("token") ?? "";
        const expected = process.env.META_DEBUG_TOKEN ?? "";
        if (!expected || provided !== expected) {
          return new Response("forbidden", { status: 403 });
        }

        const days = Number(url.searchParams.get("days") ?? "7") || 7;
        try {
          const { syncMetaInsights } = await import("@/lib/meta.server");
          const r = await syncMetaInsights(days);
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});
