import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { FORUM_BRAIN_PROMPT } from "@/lib/liz-forum-prompt";

/**
 * LIZ responde o fórum da Sala de Comando quando o Claude está offline.
 *
 * POST (ou GET) /api/public/dashhub/liz-forum   — exige X-Hub-Secret
 *   1. lê o estado do fórum (hub_estado) e guarda atualizado_em
 *   2. filtra mensagens com resp vazio E fech vazio
 *   3. lê os números (hub_dados) + funil ao vivo do Ploomes
 *   4. chama o modelo com o "Cérebro do fórum" como system prompt
 *   5. relê o estado; se mudou, aborta sem gravar. Se não, grava resp/respD.
 *
 * Nunca grava resposta vazia e nunca toca em notas, trat, fech, ft
 * ou mensagens já respondidas.
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

function authorized(request: Request, url: URL) {
  const expected = process.env["DASHHUB_WEBHOOK_SECRET"];
  if (!expected) return false;
  const got =
    request.headers.get("x-hub-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return got === expected || url.searchParams.get("secret") === expected;
}

type Msg = {
  id?: string;
  quem?: string;
  sobre?: string;
  txt?: string;
  d?: string;
  resp?: string | null;
  respD?: string | null;
  fech?: string | null;
} & Record<string, unknown>;

type Estado = { msgs?: Msg[] } & Record<string, unknown>;

const emAberto = (m: Msg) => !String(m.resp ?? "").trim() && !String(m.fech ?? "").trim();

/** dd/mm HH:MM no horário de Brasília. */
function carimboBrasilia(): string {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p["day"]}/${p["month"]} ${p["hour"]}:${p["minute"]}`;
}

/** Seleciona só o pedaço dos dados que a pergunta pede (economia de contexto). */
function recortarDados(dados: Record<string, any>, pergunta: string) {
  const q = pergunta.toLowerCase();
  const out: Record<string, unknown> = {};
  const H = dados["H"] ?? {};
  const fichas: any[] = Array.isArray(H?.fichas) ? H.fichas : [];

  const citada = fichas.filter((f) => {
    const nome = String(f?.n ?? "").toLowerCase();
    if (!nome) return false;
    return nome.split(/\s+/).some((parte: string) => parte.length > 2 && q.includes(parte));
  });

  if (citada.length) {
    out["H"] = { ...H, fichas: citada };
    const P: any[] = Array.isArray(dados["P"]) ? dados["P"] : [];
    out["P"] = P.filter((p) =>
      citada.some((f) => String(p?.n ?? p?.nome ?? "").toLowerCase() === String(f?.n ?? "").toLowerCase()),
    );
  } else {
    out["H"] = H;
    out["P"] = dados["P"];
  }

  if (/tr[áa]fego|lead|meta|an[úu]ncio|unidade|resposta|cpl|invest/.test(q)) {
    out["TF"] = dados["TF"];
    out["MA"] = dados["MA"];
  }
  if (/mercado|share|cidade|concorr/.test(q)) out["MK"] = dados["MK"];
  return out;
}

/** Funil ao vivo do Ploomes (mesma fonte que o Claude consulta). */
async function funilPloomes() {
  try {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const { getSolarFunnel } = await import("@/lib/ploomes-funnel.server");
    return await getSolarFunnel(fmt(inicio), fmt(hoje), null);
  } catch (e) {
    return { erro: `Ploomes indisponível: ${String((e as Error)?.message ?? e).slice(0, 200)}` };
  }
}

async function run(request: Request) {
  const url = new URL(request.url);
  if (!authorized(request, url)) return json({ error: "não autorizado" }, 401);

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) return json({ error: "LOVABLE_API_KEY não configurada" }, 500);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const registrar = async (
    achadas: number,
    respondidas: number,
    erro: string | null,
  ) => {
    try {
      await db.from("forum_liz_log").insert({
        perguntas_encontradas: achadas,
        perguntas_respondidas: respondidas,
        erro,
      });
    } catch {
      /* log é best-effort */
    }
  };

  // 1) lê o fórum
  const { data: atual, error: errEstado } = await db
    .from("hub_estado")
    .select("estado, atualizado_em")
    .eq("id", 1)
    .maybeSingle();
  if (errEstado || !atual) {
    await registrar(0, 0, errEstado?.message ?? "estado não encontrado");
    return json({ error: errEstado?.message ?? "estado não encontrado" }, 500);
  }

  const estado = (atual.estado ?? {}) as Estado;
  const msgs: Msg[] = Array.isArray(estado.msgs) ? estado.msgs : [];
  const pendentes = msgs.filter(emAberto);

  // 2) nada em aberto: encerra em silêncio
  if (!pendentes.length) return json({ ok: true, pendentes: 0, respondidas: 0 });

  // 3) contexto: números do painel + Ploomes ao vivo
  const { data: pacote } = await db
    .from("hub_dados")
    .select("dados, atualizado_em")
    .eq("id", 1)
    .maybeSingle();
  const dados = (pacote?.dados ?? {}) as Record<string, any>;
  const ploomes = await funilPloomes();

  const gateway = createLovableAiGatewayProvider(lovableKey);
  const respostas = new Map<string, string>();
  let erroModelo: string | null = null;

  for (const m of pendentes.slice(0, 5)) {
    const pergunta = String(m.txt ?? "").trim();
    if (!pergunta || !m.id) continue;
    try {
      const contexto = recortarDados(dados, `${pergunta} ${m.sobre ?? ""}`);
      const result = await generateText({
        model: gateway("google/gemini-2.5-pro"),
        system: FORUM_BRAIN_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              `Pergunta de ${m.quem ?? "supervisor"}${m.sobre ? ` (sobre: ${m.sobre})` : ""}:`,
              pergunta,
              "",
              "Snapshot do painel (JSON):",
              JSON.stringify(contexto).slice(0, 180_000),
              "",
              "Funil ao vivo do Ploomes (mês corrente):",
              JSON.stringify(ploomes).slice(0, 20_000),
              "",
              "Responda em texto puro, 3 a 6 parágrafos curtos, ancorado nos números acima.",
            ].join("\n"),
          },
        ],
      });
      const texto = (result.text ?? "").trim();
      if (texto) respostas.set(String(m.id), texto);
    } catch (e) {
      erroModelo = String((e as Error)?.message ?? e).slice(0, 400);
    }
  }

  if (!respostas.size) {
    await registrar(pendentes.length, 0, erroModelo ?? "modelo devolveu vazio");
    return json({ ok: false, pendentes: pendentes.length, respondidas: 0, erro: erroModelo }, 200);
  }

  // 5) relê: se alguém escreveu no meio, não grava
  const { data: conferencia } = await db
    .from("hub_estado")
    .select("estado, atualizado_em")
    .eq("id", 1)
    .maybeSingle();
  if (!conferencia || conferencia.atualizado_em !== atual.atualizado_em) {
    await registrar(pendentes.length, 0, "estado mudou durante a execução");
    return json({ ok: false, motivo: "estado mudou, nada gravado" }, 200);
  }

  const carimbo = carimboBrasilia();
  const novoEstado: Estado = {
    ...estado,
    msgs: msgs.map((m) => {
      const texto = m.id ? respostas.get(String(m.id)) : undefined;
      if (!texto || !emAberto(m)) return m;
      return { ...m, resp: texto, respD: carimbo };
    }),
  };

  const { error: errGrava } = await db
    .from("hub_estado")
    .update({ estado: novoEstado, atualizado_em: new Date().toISOString() })
    .eq("id", 1);
  if (errGrava) {
    await registrar(pendentes.length, 0, errGrava.message);
    return json({ error: errGrava.message }, 500);
  }

  await registrar(pendentes.length, respostas.size, erroModelo);
  return json({
    ok: true,
    pendentes: pendentes.length,
    respondidas: respostas.size,
    respD: carimbo,
  });
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
