import { createFileRoute } from "@tanstack/react-router";

/**
 * Gatilho público da LIZ: a página da Sala de Comando chama aqui logo depois
 * que alguém grava uma pergunta, para a resposta chegar em segundos em vez de
 * esperar o cron. Não exige segredo porque não escreve nada por si — só dispara
 * `runLizForum`, que sai em silêncio quando não há pergunta em aberto. Uma
 * trava em memória evita execuções simultâneas/abuso (custo de IA).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

// Trava em memória: no máximo 1 execução a cada 20s por instância.
let ultima = 0;
const JANELA_MS = 20_000;

async function run() {
  const agora = Date.now();
  if (agora - ultima < JANELA_MS) return json({ ok: true, disparado: false, motivo: "trava de 20s" });
  ultima = agora;
  try {
    const { runLizForum } = await import("@/lib/liz-forum.server");
    return json({ ok: true, disparado: true, ...(await runLizForum()) });
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
}

export const Route = createFileRoute("/api/public/dashhub/liz-ping")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: () => run(),
      POST: () => run(),
    },
  },
});
