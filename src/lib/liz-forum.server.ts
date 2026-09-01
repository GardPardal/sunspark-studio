// Motor da LIZ que responde o fórum da Sala de Comando (/dashhub).
// Server-only: importar apenas de handlers.
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { FORUM_BRAIN_PROMPT } from "@/lib/liz-forum-prompt";

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

/** Monta o contexto: painel inteiro (menos a casca visual) + destaque da pessoa citada. */
function montarContexto(dados: Record<string, any>, pergunta: string) {
  const q = pergunta.toLowerCase();
  const { APP: _app, ...resto } = dados as any;

  const H = resto["H"] ?? {};
  const fichas: any[] = Array.isArray(H?.fichas) ? H.fichas : [];
  const P: any[] = Array.isArray(resto["P"]) ? resto["P"] : [];

  const bate = (nome: string) => {
    const n = String(nome ?? "").toLowerCase();
    if (!n) return false;
    return n.split(/\s+/).some((parte: string) => parte.length > 2 && q.includes(parte));
  };

  const fichaCitada = fichas.filter((f) => bate(String(f?.n ?? "")));
  const diagCitado = P.filter((p) => bate(String(p?.n ?? p?.nome ?? "")));

  return {
    // Foco: tudo o que existe sobre quem foi citado.
    foco:
      fichaCitada.length || diagCitado.length
        ? { fichas: fichaCitada, diagnostico: diagCitado }
        : null,
    // Base completa para comparação com o time e com as unidades.
    painel: resto,
  };
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

export async function runLizForum(): Promise<{
  ok: boolean;
  pendentes: number;
  respondidas: number;
  motivo?: string;
  erro?: string | null;
  respD?: string;
}> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const registrar = async (achadas: number, respondidas: number, erro: string | null) => {
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
    return {
      ok: false,
      pendentes: 0,
      respondidas: 0,
      erro: errEstado?.message ?? "estado não encontrado",
    };
  }

  const estado = (atual.estado ?? {}) as Estado;
  const msgs: Msg[] = Array.isArray(estado.msgs) ? estado.msgs : [];
  const pendentes = msgs.filter(emAberto);

  // 2) nada em aberto: encerra em silêncio
  if (!pendentes.length) return { ok: true, pendentes: 0, respondidas: 0 };

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

  // Respostas anteriores (Claude) viram referência de padrão e profundidade.
  const exemplos = msgs
    .filter((x) => String(x.resp ?? "").trim().length > 400)
    .slice(-2)
    .map(
      (x) =>
        `PERGUNTA: ${String(x.txt ?? "").trim()}\nRESPOSTA MODELO:\n${String(x.resp).trim().slice(0, 4000)}`,
    )
    .join("\n\n---\n\n");

  const REGRAS_RESPOSTA = `PADRÃO DE RESPOSTA (obrigatório — o supervisor compara com as respostas anteriores do fórum):
- Abra com a tese: a conclusão real em uma frase, mesmo que contrarie a premissa da pergunta.
- Use números concretos e nomeados: série mês a mês do histórico (hist), vendas do mês, média 6 meses, valor em R$, nº de negócios por etapa, dias sem toque, nomes de clientes parados e seus valores, tarefas vencidas, blocos de atividade (ligação 9h, prospecção, apresentação, fechamento 18h), dias ativos.
- Explique o gargalo em um lugar só: aponte a etapa exata onde o dinheiro está parado, com valor somado.
- Cruze com comportamento: use o DISC (disc e discv) para explicar POR QUE a pessoa trava naquela etapa — e diga o que NÃO adianta pedir a ela.
- Feche com plano da semana: ações específicas, com nome de cliente e dia, no formato que o perfil dela cumpre.
- Contexto do time: compare com a média do time, com a unidade (TR) e com o funil ao vivo, para separar problema individual de problema geral.
- Honestidade: se um dado não existe no painel, diga que não existe — nunca invente. Se a premissa da pergunta está errada pelos números, corrija com o número.
- Texto puro, sem markdown, sem títulos, sem bullets. De 5 a 8 parágrafos densos.`;

  for (const m of pendentes.slice(0, 5)) {
    const pergunta = String(m.txt ?? "").trim();
    if (!pergunta || !m.id) continue;
    try {
      const contexto = montarContexto(dados, `${pergunta} ${m.sobre ?? ""}`);
      const result = await generateText({
        model: gateway("google/gemini-3.7-flash"),
        system: FORUM_BRAIN_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              exemplos
                ? `EXEMPLOS DE RESPOSTAS ANTERIORES DESTE FÓRUM (mesmo nível ou melhor):\n${exemplos}\n\n---\n`
                : "",
              `Pergunta de ${m.quem ?? "supervisor"}${m.sobre ? ` (sobre: ${m.sobre})` : ""}:`,
              pergunta,
              "",
              "Dados do painel — 'foco' é tudo o que existe sobre quem foi citado; 'painel' é a base completa (H fichas do time, P diagnósticos, TF funil, TR por unidade, OR negócios parados, MA meta ads, MK mercado):",
              JSON.stringify(contexto).slice(0, 300_000),
              "",
              "Funil ao vivo do Ploomes (mês corrente):",
              JSON.stringify(ploomes).slice(0, 20_000),
              "",
              REGRAS_RESPOSTA,
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
    return { ok: false, pendentes: pendentes.length, respondidas: 0, erro: erroModelo };
  }

  // 5) relê: se alguém escreveu no meio, não grava
  const { data: conferencia } = await db
    .from("hub_estado")
    .select("estado, atualizado_em")
    .eq("id", 1)
    .maybeSingle();
  if (!conferencia || conferencia.atualizado_em !== atual.atualizado_em) {
    await registrar(pendentes.length, 0, "estado mudou durante a execução");
    return {
      ok: false,
      pendentes: pendentes.length,
      respondidas: 0,
      motivo: "estado mudou, nada gravado",
    };
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
    return { ok: false, pendentes: pendentes.length, respondidas: 0, erro: errGrava.message };
  }

  await registrar(pendentes.length, respostas.size, erroModelo);
  return {
    ok: true,
    pendentes: pendentes.length,
    respondidas: respostas.size,
    respD: carimbo,
  };
}
