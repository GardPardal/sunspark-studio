import { createFileRoute } from "@tanstack/react-router";

/**
 * Dispara a LIZ para responder as perguntas em aberto do fórum da Sala de
 * Comando. Exige `X-Hub-Secret`. Também é chamada automaticamente sempre que
 * alguém escreve no fórum (POST /api/public/dashhub).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Hub-Secret, Authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

async function authorized(request: Request, url: URL) {
  const got =
    request.headers.get("x-hub-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret") ??
    "";
  if (!got) return false;
  const expected = process.env["DASHHUB_WEBHOOK_SECRET"];
  if (expected && got === expected) return true;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("internal_tokens")
    .select("token")
    .eq("name", "liz_forum_cron")
    .maybeSingle();
  return Boolean(data?.token) && got === data.token;
}

async function run(request: Request) {
  const url = new URL(request.url);
  if (!(await authorized(request, url))) return json({ error: "não autorizado" }, 401);
  try {
    const { runLizForum } = await import("@/lib/liz-forum.server");
    return json(await runLizForum());
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
}

export const Route = createFileRoute("/api/public/dashhub/liz-forum")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
