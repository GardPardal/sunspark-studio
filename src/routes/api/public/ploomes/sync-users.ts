import { createFileRoute } from "@tanstack/react-router";

/**
 * Sincronização automática dos responsáveis do Ploomes (chamada por cron).
 * Autenticação: header `apikey` com a chave pública do projeto.
 */
export const Route = createFileRoute("/api/public/ploomes/sync-users")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_ANON_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runPloomesUsersSync } = await import("@/lib/ploomes-users.server");
          const result = await runPloomesUsersSync(true);
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "erro" }, { status: 500 });
        }
      },
    },
  },
});
