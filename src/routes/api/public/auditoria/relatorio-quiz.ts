import { createFileRoute } from "@tanstack/react-router";

/**
 * Relatório diário dos leads do quiz (tráfego interno), gerado às 15h (Brasília)
 * pelo agendador do banco. Grava em `relatorios_quiz`; a leitura é na aba /auditoria.
 * Protegido por token interno (tabela internal_tokens, nome `relatorio_quiz_cron`).
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
    .eq("name", "relatorio_quiz_cron")
    .maybeSingle();
  return Boolean(data?.token) && got === data.token;
}

export const Route = createFileRoute("/api/public/auditoria/relatorio-quiz")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await authorized(request))) return new Response("unauthorized", { status: 401 });
        try {
          const { gerarESalvarRelatorio } = await import("@/lib/auditoria-quiz.server");
          const out = await gerarESalvarRelatorio("agendado");
          return Response.json({ ok: true, ...out });
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
