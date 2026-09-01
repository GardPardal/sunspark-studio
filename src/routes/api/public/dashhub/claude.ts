import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Canal de atuação do Claude na Sala de Comando (/dashhub).
 *
 * GET  ?action=docs        -> manual da API (público)
 * GET  ?action=estado      -> estado completo do fórum
 * GET  ?action=pendentes   -> perguntas sem resposta (default do GET)
 * POST {action:"responder"|"nota"|"perguntar"|"fechar"|"estado", ...}
 *
 * Autenticação: header `X-Hub-Secret: <segredo>` (ou `Authorization: Bearer`,
 * ou `?secret=`). Leitura de `docs` é livre; o resto exige o segredo.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Hub-Secret, Authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

type Msg = {
  id: string;
  quem?: string;
  sobre?: string;
  txt?: string;
  d?: string;
  resp?: string | null;
  respD?: string | null;
  fech?: string | null;
};
type Nota = { v?: string; a?: string; t?: string; d?: string; fech?: string | null };
type Estado = { trat?: Record<string, unknown>; notas?: Nota[]; msgs?: Msg[] } & Record<
  string,
  unknown
>;

function authorized(request: Request, url: URL) {
  const expected = process.env["DASHHUB_WEBHOOK_SECRET"];
  if (!expected) return false;
  const got =
    request.headers.get("x-hub-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return got === expected || url.searchParams.get("secret") === expected;
}

const hoje = () => new Date().toISOString().slice(0, 10);

async function loadEstado(): Promise<Estado> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("hub_estado")
    .select("estado")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (((data as { estado?: Estado } | null)?.estado ?? {}) as Estado) || {};
}

async function saveEstado(estado: Estado) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("hub_estado")
    .update({ estado: estado as never })
    .eq("id", 1)
    .select("atualizado_em")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { atualizado_em?: string } | null)?.atualizado_em ?? null;
}

const DOCS = {
  ok: true,
  nome: "LZ7 · Sala de Comando — canal do Claude",
  pagina: "/dashhub",
  base: "/api/public/dashhub/claude",
  autenticacao: {
    header: "X-Hub-Secret: <segredo>",
    alternativas: ["Authorization: Bearer <segredo>", "?secret=<segredo>"],
    obs: "Peça o segredo ao Alison (variável DASHHUB_WEBHOOK_SECRET).",
  },
  leitura: {
    "GET ?action=pendentes":
      "perguntas do fórum ainda sem resposta (this is the default) — responda cada uma pelo POST responder",
    "GET ?action=estado":
      "estado completo: trat (tratativas), notas (observações de campo), msgs (fórum)",
    "GET ?action=docs": "este manual (público)",
  },
  escrita: {
    responder: { action: "responder", id: "m1724... (id da msg)", resp: "texto da resposta" },
    perguntar: { action: "perguntar", quem: "Claude", sobre: "assunto", txt: "pergunta" },
    nota: { action: "nota", vendedor: "Nome do vendedor", autor: "Claude", txt: "observação" },
    fechar: { action: "fechar", id: "m1724..." },
    estado: {
      action: "estado",
      mode: "merge | replace",
      estado: { trat: {}, notas: [], msgs: [] },
    },
  },
  fluxo_sugerido: [
    "1. GET ?action=pendentes",
    "2. GET ?action=estado para cruzar funil/agenda/perfil antes de responder",
    "3. POST responder com o diagnóstico e a próxima ação concreta",
  ],
  outros_canais: {
    dados_do_crm_via_mcp: "/mcp (OAuth) — leads, agenda, criação de lead e compromisso",
    estado_bruto: "/api/public/dashhub (GET/POST merge|replace)",
  },
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("responder"),
    id: z.string().min(1),
    resp: z.string().min(1).max(20000),
  }),
  z.object({
    action: z.literal("perguntar"),
    quem: z.string().max(120).optional(),
    sobre: z.string().max(200).optional(),
    txt: z.string().min(1).max(20000),
  }),
  z.object({
    action: z.literal("nota"),
    vendedor: z.string().min(1).max(200),
    autor: z.string().max(120).optional(),
    txt: z.string().min(1).max(20000),
  }),
  z.object({ action: z.literal("fechar"), id: z.string().min(1) }),
  z.object({
    action: z.literal("estado"),
    mode: z.enum(["merge", "replace"]).optional(),
    estado: z.record(z.string(), z.unknown()),
  }),
]);

export const Route = createFileRoute("/api/public/dashhub/claude")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "pendentes";
        if (action === "docs") return json(DOCS);
        if (!authorized(request, url))
          return json({ error: "não autorizado", docs: DOCS.autenticacao }, 401);

        try {
          const estado = await loadEstado();
          if (action === "estado") return json({ ok: true, estado });
          const pendentes = (estado.msgs ?? []).filter((m) => !m.resp && !m.fech);
          return json({ ok: true, total: pendentes.length, pendentes });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "erro" }, 500);
        }
      },

      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (!authorized(request, url))
          return json({ error: "não autorizado", docs: DOCS.autenticacao }, 401);

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success)
          return json(
            { error: "payload inválido", details: parsed.error.issues, docs: DOCS.escrita },
            400,
          );

        try {
          const estado = await loadEstado();
          estado.msgs = Array.isArray(estado.msgs) ? estado.msgs : [];
          estado.notas = Array.isArray(estado.notas) ? estado.notas : [];
          const body = parsed.data;

          if (body.action === "responder") {
            const msg = estado.msgs.find((m) => m.id === body.id);
            if (!msg) return json({ error: "pergunta não encontrada", id: body.id }, 404);
            msg.resp = body.resp;
            msg.respD = hoje();
          } else if (body.action === "perguntar") {
            estado.msgs.push({
              id: "m" + Date.now(),
              quem: body.quem ?? "Claude",
              sobre: body.sobre ?? "",
              txt: body.txt,
              d: hoje(),
              resp: null,
              respD: null,
              fech: null,
            });
          } else if (body.action === "nota") {
            estado.notas.push({
              v: body.vendedor,
              a: body.autor ?? "Claude",
              t: body.txt,
              d: hoje(),
              fech: null,
            });
          } else if (body.action === "fechar") {
            const msg = estado.msgs.find((m) => m.id === body.id);
            if (!msg) return json({ error: "pergunta não encontrada", id: body.id }, 404);
            msg.fech = hoje();
          } else {
            const novo = body.estado as Estado;
            const final = (body.mode ?? "merge") === "merge" ? { ...estado, ...novo } : novo;
            const at = await saveEstado(final);
            return json({ ok: true, atualizado_em: at, estado: final });
          }

          const atualizado_em = await saveEstado(estado);
          return json({ ok: true, atualizado_em, estado });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "erro" }, 500);
        }
      },
    },
  },
});
