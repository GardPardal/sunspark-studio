/**
 * Radar Regional — Norte Pioneiro / Campos Gerais.
 *
 * Fluxo automático (3x ao dia): lê os feeds públicos das fontes regionais,
 * apura o conteúdo público, reescreve com ângulo próprio da LZ7 (texto ORIGINAL,
 * fiel aos fatos, sem invenção) e publica no /blog dando crédito e link à fonte.
 *
 * Nunca reproduz o texto da fonte. Fontes que bloqueiam acesso automatizado
 * ficam registradas com status "bloqueada" e são reavaliadas a cada ciclo —
 * assim que liberarem, entram no fluxo sozinhas.
 */

import {
  assertSafeUrl,
  rssAdapter,
  stripHtml,
  urlHash,
  type DiscoveredItem,
} from "./adapters.server";
import { readingMinutes, similarity, slugify } from "./shared";
import { sanitizeArticleHtml as sanitizeHtml } from "@/lib/sanitize-html";

type Sb = any;

async function admin(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Sb;
}

async function log(
  sb: Sb,
  acao: string,
  resultado: string,
  extra: { source_id?: string | null; nivel?: "info" | "warn" | "error"; detalhes?: any } = {},
) {
  await sb.from("editorial_logs").insert({
    acao,
    resultado: resultado.slice(0, 500),
    nivel: extra.nivel ?? "info",
    source_id: extra.source_id ?? null,
    detalhes: extra.detalhes ?? {},
  });
}

/* ============================ FONTES REGIONAIS ============================ */

export type RegionalSeed = {
  nome: string;
  dominio: string;
  feed_url: string;
  prioridade: number;
  autoridade: number;
  politica_uso: string;
  /** "pt" (padrão) ou "en" — fontes em outro idioma são traduzidas na redação. */
  idioma?: string;
};

export const REGIONAL_SOURCES: RegionalSeed[] = [
  {
    nome: "Folha Extra — Norte Pioneiro",
    dominio: "folhaextra.com",
    feed_url: "https://folhaextra.com/feed/",
    prioridade: 100,
    autoridade: 70,
    politica_uso:
      "Aguardando liberação do veículo para leitura automatizada (bloqueio ativo contra bots). Uso previsto: apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "NP Diário — Norte Pioneiro",
    dominio: "npdiario.com",
    feed_url: "https://npdiario.com/feed/",
    prioridade: 95,
    autoridade: 70,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "Tribuna do Norte — Campos Gerais",
    dominio: "tnonline.uol.com.br",
    feed_url: "https://tnonline.uol.com.br/rss",
    prioridade: 90,
    autoridade: 72,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "Folha de Londrina — Paraná",
    dominio: "folhadelondrina.com.br",
    feed_url: "https://www.folhadelondrina.com.br/rss",
    prioridade: 80,
    autoridade: 78,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "G1 Paraná — Norte e Noroeste",
    dominio: "g1.globo.com",
    feed_url: "https://g1.globo.com/rss/g1/pr/norte-noroeste/",
    prioridade: 88,
    autoridade: 90,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "G1 Paraná — Campos Gerais e Sul",
    dominio: "g1-campos-gerais.globo.com",
    feed_url: "https://g1.globo.com/rss/g1/pr/campos-gerais-sul/",
    prioridade: 86,
    autoridade: 90,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "CNN Brasil — Nacional",
    dominio: "cnnbrasil.com.br",
    feed_url: "https://www.cnnbrasil.com.br/feed",
    prioridade: 70,
    autoridade: 88,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "Agência Brasil — Últimas notícias",
    dominio: "agenciabrasil.ebc.com.br",
    feed_url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
    prioridade: 66,
    autoridade: 85,
    politica_uso:
      "Conteúdo público (EBC). Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "Canal Solar — Setor de energia",
    dominio: "canalsolar.com.br",
    feed_url: "https://canalsolar.com.br/feed/",
    prioridade: 64,
    autoridade: 80,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "G1 Economia — Nacional",
    dominio: "g1-economia.globo.com",
    feed_url: "https://g1.globo.com/rss/g1/economia/",
    prioridade: 62,
    autoridade: 90,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "Gazeta do Povo — Paraná",
    dominio: "gazetadopovo.com.br",
    feed_url: "https://www.gazetadopovo.com.br/feed/rss/parana.xml",
    prioridade: 84,
    autoridade: 86,
    politica_uso:
      "Feed RSS público. Apuração com reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "Poder360 — Nacional",
    dominio: "poder360.com.br",
    feed_url: "https://www.poder360.com.br/feed/",
    prioridade: 60,
    autoridade: 84,
    politica_uso:
      "Feed RSS público com embeds liberados. Reescrita própria, crédito e link para a origem.",
  },
  {
    nome: "Metrópoles — Nacional",
    dominio: "metropoles.com",
    feed_url: "https://www.metropoles.com/feed",
    prioridade: 58,
    autoridade: 82,
    politica_uso:
      "Feed RSS público com vídeos incorporáveis. Reescrita própria, crédito e link para a origem.",
  },
  {
    nome: "InfoMoney — Economia",
    dominio: "infomoney.com.br",
    feed_url: "https://www.infomoney.com.br/feed/",
    prioridade: 56,
    autoridade: 84,
    politica_uso: "Feed RSS público. Reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "G1 Tecnologia — Nacional",
    dominio: "g1-tecnologia.globo.com",
    feed_url: "https://g1.globo.com/rss/g1/tecnologia/",
    prioridade: 54,
    autoridade: 90,
    politica_uso: "Feed RSS público. Reescrita própria, crédito e link para a matéria original.",
  },
  {
    nome: "G1 Pop & Arte — Nacional",
    dominio: "g1-popart.globo.com",
    feed_url: "https://g1.globo.com/rss/g1/pop-arte/",
    prioridade: 52,
    autoridade: 90,
    politica_uso: "Feed RSS público. Reescrita própria, crédito e link para a matéria original.",
  },

  /* ---------------- FONTES INTERNACIONAIS (traduzidas para pt-BR) ---------------- */
  {
    nome: "Reuters — World (internacional)",
    dominio: "reuters.com",
    feed_url:
      "https://news.google.com/rss/search?q=when:1d+site:reuters.com&hl=en-US&gl=US&ceid=US:en",
    prioridade: 75,
    autoridade: 95,
    idioma: "en",
    politica_uso:
      "Feed público. Apuração, tradução e reescrita própria em pt-BR, com crédito e link para a matéria original.",
  },
  {
    nome: "BBC News — World (internacional)",
    dominio: "bbc.com",
    feed_url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    prioridade: 74,
    autoridade: 95,
    idioma: "en",
    politica_uso:
      "Feed RSS público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "The Guardian — World (internacional)",
    dominio: "theguardian.com",
    feed_url: "https://www.theguardian.com/world/rss",
    prioridade: 72,
    autoridade: 93,
    idioma: "en",
    politica_uso:
      "Feed RSS público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "Al Jazeera — Internacional",
    dominio: "aljazeera.com",
    feed_url: "https://www.aljazeera.com/xml/rss/all.xml",
    prioridade: 68,
    autoridade: 88,
    idioma: "en",
    politica_uso:
      "Feed RSS público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "CNBC — Economia global",
    dominio: "cnbc.com",
    feed_url:
      "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    prioridade: 67,
    autoridade: 90,
    idioma: "en",
    politica_uso:
      "Feed RSS público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "Reuters Energy via Google News",
    dominio: "news-energy.google.com",
    feed_url:
      "https://news.google.com/rss/search?q=when:1d+(energy+OR+solar+OR+%22renewable%22)&hl=en-US&gl=US&ceid=US:en",
    prioridade: 66,
    autoridade: 85,
    idioma: "en",
    politica_uso:
      "Agregador público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "PV Magazine — Solar global",
    dominio: "pv-magazine.com",
    feed_url: "https://www.pv-magazine.com/feed/",
    prioridade: 65,
    autoridade: 86,
    idioma: "en",
    politica_uso:
      "Feed RSS público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "Euronews — Internacional",
    dominio: "euronews.com",
    feed_url: "https://www.euronews.com/rss?level=theme&name=news",
    prioridade: 60,
    autoridade: 85,
    idioma: "en",
    politica_uso:
      "Feed RSS público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "Ars Technica — Tecnologia global",
    dominio: "arstechnica.com",
    feed_url: "https://feeds.arstechnica.com/arstechnica/index",
    prioridade: 55,
    autoridade: 84,
    idioma: "en",
    politica_uso:
      "Feed RSS público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
  {
    nome: "AP News via Google News",
    dominio: "news-ap.google.com",
    feed_url:
      "https://news.google.com/rss/search?q=when:1d+site:apnews.com&hl=en-US&gl=US&ceid=US:en",
    prioridade: 58,
    autoridade: 92,
    idioma: "en",
    politica_uso:
      "Agregador público. Tradução e reescrita própria em pt-BR, com crédito e link para a origem.",
  },
];

/** Domínios/fontes cujo conteúdo chega em outro idioma e precisa ser traduzido. */
export const IDIOMA_POR_DOMINIO: Record<string, string> = Object.fromEntries(
  REGIONAL_SOURCES.filter((s) => s.idioma && s.idioma !== "pt").map((s) => [
    s.dominio,
    s.idioma as string,
  ]),
);

export function isInternacional(source: {
  dominio?: string | null;
  categorias?: string[] | null;
}): boolean {
  if (Array.isArray(source.categorias) && source.categorias.includes("internacional")) return true;
  return Boolean(source.dominio && IDIOMA_POR_DOMINIO[source.dominio]);
}

/** Garante o cadastro das fontes regionais (idempotente) e devolve as ativas. */
export async function ensureRegionalSources(sb: Sb): Promise<any[]> {
  const ativos: any[] = [];
  for (const seed of REGIONAL_SOURCES) {
    const { data: found } = await sb
      .from("editorial_sources")
      .select("*")
      .eq("dominio", seed.dominio)
      .maybeSingle();
    if (found) {
      if (found.ativo !== false) ativos.push(found);
      continue;
    }
    const { data: created } = await sb
      .from("editorial_sources")
      .insert({
        nome: seed.nome,
        dominio: seed.dominio,
        feed_url: seed.feed_url,
        tipo: "geral",
        categorias:
          seed.idioma && seed.idioma !== "pt" ? ["noticias", "internacional"] : ["noticias"],
        prioridade: seed.prioridade,
        autoridade: seed.autoridade,
        metodo: "rss",
        adapter: "rssAdapter",
        frequencia_minutos: 480,
        politica_uso: seed.politica_uso,
        ativo: true,
      })
      .select("*")
      .maybeSingle();
    if (created) ativos.push(created);
  }
  return ativos;
}

/* ============================ APURAÇÃO ============================ */

const UA = "LZ7EnergiaRadarBot/1.0 (+https://lz7energia.com.br/blog/politica-editorial)";

type Apuracao = {
  texto: string;
  imagem: string | null;
  imagens: string[];
  videos: string[];
  legendas: Record<string, string>;
};

const LIXO_IMG =
  /(^|[-_/])(logo|logotipo|avatar|banner|sprite|icone?|favicon|placeholder|publicidade|anuncio|advert|ads?)([-_.0-9]|$)/i;

/** Apenas o nome do arquivo, para não confundir "uploads/" com "ads". */
function nomeArquivo(u: string): string {
  try {
    return new URL(u).pathname.split("/").pop() ?? u;
  } catch {
    return u;
  }
}

/** Converte URL de vídeo em URL de embed suportada. */
function embedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (h.endsWith("youtube.com") || h.endsWith("youtube-nocookie.com")) {
      const id =
        u.searchParams.get("v") ?? u.pathname.match(/\/(embed|shorts|v)\/([\w-]{6,})/)?.[2];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (h.endsWith("vimeo.com")) {
      const id = u.pathname.match(/(\d{6,})/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchArticle(url: string): Promise<Apuracao> {
  assertSafeUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = (await res.text()).slice(0, 1_400_000);
    const og =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
      null;

    const abs = (v: string) => {
      try {
        return new URL(v, url).toString();
      } catch {
        return null;
      }
    };

    // corpo principal (article / entry-content) quando existir
    const artigoHtml =
      html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ??
      html.match(
        /<div[^>]+class=["'][^"']*(entry-content|post-content|td-post-content|content-materia)[^"']*["'][\s\S]*?<\/div>\s*<\/div>/i,
      )?.[0] ??
      html;

    // imagens do corpo
    const imagens: string[] = [];
    const legendas: Record<string, string> = {};
    const imgRe = /<img\b[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe.exec(artigoHtml)) && imagens.length < 12) {
      const tag = im[0];
      const src =
        tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ??
        tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1] ??
        tag.match(/\bsrcset\s*=\s*["']([^"'\s,]+)/i)?.[1];
      if (!src) continue;
      const full = abs(src);
      if (!full || !/^https?:/i.test(full)) continue;
      if (LIXO_IMG.test(nomeArquivo(full))) continue;
      if (/\.svg(\?|$)/i.test(full)) continue;
      if (imagens.includes(full)) continue;
      imagens.push(
        full.replace(/(glbimg\.com)\/x(\d{2,4})\//i, (all, host: string, w: string) =>
          Number(w) < 720 ? `${host}/x720/` : all,
        ),
      );
      const alt = tag.match(/\balt\s*=\s*["']([^"']{6,180})["']/i)?.[1];
      if (alt) legendas[full] = stripHtml(alt);
    }
    if (og) {
      const o = abs(og);
      if (o && !imagens.includes(o)) imagens.unshift(o);
    }

    // vídeos (iframes de player + links diretos do youtube)
    const videos: string[] = [];
    const push = (v: string | null) => {
      if (v && !videos.includes(v) && videos.length < 4) videos.push(v);
    };
    for (const m of artigoHtml.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi))
      push(embedUrl(abs(m[1]!) ?? m[1]!));
    for (const m of artigoHtml.matchAll(
      /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)[\w-]{6,}|youtu\.be\/[\w-]{6,})/gi,
    ))
      push(embedUrl(m[0]));

    const corpo = artigoHtml
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ");
    return {
      texto: stripHtml(corpo).slice(0, 22_000),
      imagem: imagens[0] ?? null,
      imagens,
      videos,
      legendas,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ============================ REDAÇÃO ============================ */

const REGIONAL_SYSTEM = `Você é repórter da redação da LZ7 Energia, empresa de energia solar do Norte Pioneiro do Paraná. Escreve em português do Brasil, para leitores da região.

REGRAS INEGOCIÁVEIS:
- Escreva um texto ORIGINAL, com apuração e estrutura próprias. NUNCA copie, transcreva ou parafraseie frase a frase o material recebido.
- COBERTURA COMPLETA: nada de resumo. Aproveite TODOS os fatos relevantes do material — datas, horários, locais, valores, nomes, cargos, números, programação, regras, prazos, contatos, declarações. Se o material trouxer uma lista (programação, atrações, etapas, serviços), reproduza a lista inteira em <ul> ou tabela, com todos os itens.
- EXTENSÃO: entre 700 e 1.100 palavras, com pelo menos 5 subtítulos <h2>, parágrafos densos e informativos. Se o material for muito extenso, cubra tudo; nunca corte informação por concisão.
- Declarações citadas no material devem aparecer em <blockquote> com atribuição de quem falou.
- NUNCA invente fatos, números, datas, nomes, cargos, cidades ou declarações. Use SOMENTE o que está no material apurado.
- Se algum dado estiver ambíguo ou faltando, simplesmente não afirme — escreva apenas o que está confirmado.
- Nada de suposições, previsões inventadas ou "histórias". Jornalismo factual, direto e sóbrio.
- Atribua a informação à fonte quando fizer sentido ("segundo o veículo", "de acordo com a prefeitura").
- Quando o assunto tiver ligação real com energia, conta de luz, economia local ou infraestrutura, inclua uma leitura de contexto da LZ7. Se não tiver ligação nenhuma, deixe "visao_lz7": null e apenas informe.
- Sem emojis, sem sensacionalismo, sem "neste artigo".
- Se o briefing listar mídias (ex.: [IMG2], [IMG3], [VIDEO1]), insira esses marcadores sozinhos, em linhas próprias entre parágrafos, distribuídos ao longo do texto. Escreva o marcador exatamente como recebido, fora de qualquer tag. Não use [IMG1] (já é a capa).

RESPONDA APENAS JSON VÁLIDO:
{
 "title": "título original próprio, 45-75 caracteres, diferente do título da fonte",
 "subtitle": "uma linha de contexto",
 "excerpt": "resumo de 1-2 frases",
 "tldr": "resumo em uma frase",
 "content_html": "<p>lide completo</p><h2>O que aconteceu</h2><p>...</p><h2>Detalhes</h2><ul><li>...</li></ul>[IMG2]<h2>Programação / números / regras</h2><p>...</p><blockquote>declaração</blockquote>[VIDEO1]<h2>Serviço</h2><p>...</p><h2>O que isso significa para a região</h2><p>...</p>",
 "visao_lz7": "parágrafo de contexto energético, ou null",
 "seo": {"title":"até 60 caracteres","description":"até 155 caracteres"},
 "slug": "slug-curto-sem-data",
 "tags": ["até 6 tags"],
 "cidade": "cidade principal citada ou null",
 "alertas": ["dados que não puderam ser confirmados; vazio se nenhum"]
}

Use apenas h2, h3, p, ul, ol, li, strong, em, blockquote, table. Nada de <script>, <img>, <iframe>, <style> ou <a> — as mídias entram pelos marcadores.`;

/** Redação de pauta internacional: traduz integralmente para português do Brasil. */
const INTERNACIONAL_SYSTEM = `${REGIONAL_SYSTEM}

CONTEXTO ADICIONAL — PAUTA INTERNACIONAL:
- O material apurado vem de um veículo estrangeiro e pode estar em inglês, espanhol ou outro idioma. TRADUZA TUDO para português do Brasil natural e jornalístico: título, subtítulo, resumo, corpo, legendas e declarações. Nenhuma palavra ou frase pode ficar no idioma original (exceto nomes próprios, siglas e nomes de empresas).
- Converta unidades e formatos para o padrão brasileiro quando fizer sentido: datas (dd/mm/aaaa), moeda (informe o valor original e, entre parênteses, a referência em dólar/euro como veio — nunca invente conversão para real), temperaturas em °C, distâncias em km.
- Explique brevemente contextos estrangeiros pouco conhecidos no Brasil (instituições, cargos, siglas) na primeira menção.
- Sempre que houver relação real com energia, tarifa, combustíveis, clima ou economia, conecte o fato ao impacto para o consumidor brasileiro em "visao_lz7".
- Mantenha as declarações traduzidas em <blockquote>, com a atribuição correta.`;

async function aiJson(model: string, system: string, user: string): Promise<any> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("IA indisponível (chave ausente).");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
      max_tokens: 9000,
    }),
  });
  if (!res.ok)
    throw new Error(`IA ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data: any = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "");
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Resposta da IA fora do formato esperado.");
  }
}

async function uniqueSlug(sb: Sb, base: string): Promise<string> {
  let slug = base || `regional-${Date.now()}`;
  for (let i = 0; i < 6; i++) {
    const { data } = await sb.from("site_posts").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================ ESCOPO REGIONAL ============================ */

/** Cidades do Norte Pioneiro e Campos Gerais atendidas pela LZ7. */
const CIDADES = [
  "wenceslau braz",
  "santo antonio da platina",
  "jacarezinho",
  "cambara",
  "bandeirantes",
  "cornelio procopio",
  "ibaiti",
  "siqueira campos",
  "arapoti",
  "carlopolis",
  "joaquim tavora",
  "quatigua",
  "tomazina",
  "pinhalao",
  "japira",
  "conselheiro mairinck",
  "curiuva",
  "figueira",
  "sengesr",
  "senges",
  "jaguariaiva",
  "piraí do sul",
  "pirai do sul",
  "castro",
  "ponta grossa",
  "telemaco borba",
  "ortigueira",
  "ventania",
  "imbau",
  "reserva",
  "tibagi",
  "palmeira",
  "londrina",
  "norte pioneiro",
  "campos gerais",
  "parana",
  "ribeirao claro",
  "salto do itarare",
  "sao jose da boa vista",
  "guapirama",
  "santana do itarare",
  "abatia",
  "andira",
  "itambaraca",
  "rancho alegre",
  "sertaneja",
  "leopolis",
  "santa mariana",
  "assai",
  "nova fatima",
  "congonhinhas",
];

/** Assuntos que nunca entram no blog institucional. */
const BLOQUEIO = [
  "loteria",
  "lotofacil",
  "lotofácil",
  "mega-sena",
  "quina",
  "horoscopo",
  "horóscopo",
  "signo",
  "fofoca",
  "bbb",
  "a fazenda",
  "big brother",
  "conteudo adulto",
  "conteúdo adulto",
];

/** Interesse editorial LZ7 (energia, economia, infraestrutura, agro, cidade). */
const INTERESSE = [
  "energia",
  "solar",
  "conta de luz",
  "tarifa",
  "copel",
  "aneel",
  "obra",
  "investimento",
  "industria",
  "indústria",
  "comercio",
  "comércio",
  "emprego",
  "economia",
  "agro",
  "agricultura",
  "prefeitura",
  "camara",
  "câmara",
  "governo",
  "infraestrutura",
  "asfalto",
  "rodovia",
  "saude",
  "saúde",
  "educacao",
  "educação",
  "seguranca",
  "segurança",
  "chuva",
  "clima",
  "temporal",
  "apagao",
  "apagão",
  "queda de energia",
  "sustentabilidade",
  "meio ambiente",
  "turismo",
  "hospital",
  "escola",
  "empresa",
  "leilao",
  "leilão",
  "imposto",
  "financiamento",
];

/** Assuntos nacionais com alto potencial de tráfego (mesmo sem cidade da região no texto). */
const TRAFEGO_NACIONAL = [
  "energia",
  "solar",
  "conta de luz",
  "bandeira tarifaria",
  "bandeira tarifária",
  "tarifa",
  "aneel",
  "copel",
  "petrobras",
  "gasolina",
  "combustivel",
  "combustível",
  "inflacao",
  "inflação",
  "selic",
  "juros",
  "dolar",
  "dólar",
  "salario minimo",
  "salário mínimo",
  "inss",
  "fgts",
  "imposto de renda",
  "bolsa familia",
  "bolsa família",
  "pix",
  "auxilio",
  "auxílio",
  "concurso publico",
  "concurso público",
  "emprego",
  "aposentadoria",
  "reforma",
  "eleicao",
  "eleição",
  "governo federal",
  "supremo",
  "clima",
  "temporal",
  "onda de calor",
  "seca",
  "apagao",
  "apagão",
  "leilao de energia",
  "leilão de energia",
  "agro",
  "safra",
  "caminhoneiro",
  "veiculo eletrico",
  "veículo elétrico",
  "inteligencia artificial",
  "inteligência artificial",
];

/** Palavras-chave (inglês/espanhol/português) que liberam pautas internacionais. */
const TRAFEGO_INTERNACIONAL: string[] = [
  "energy",
  "solar",
  "renewable",
  "electricity",
  "power grid",
  "blackout",
  "battery",
  "oil",
  "gas prices",
  "opec",
  "climate",
  "heat wave",
  "storm",
  "hurricane",
  "drought",
  "flood",
  "inflation",
  "interest rate",
  "central bank",
  "fed",
  "economy",
  "recession",
  "stocks",
  "market",
  "dollar",
  "trade war",
  "tariff",
  "china",
  "united states",
  "europe",
  "brazil",
  "brasil",
  "election",
  "war",
  "ukraine",
  "middle east",
  "technology",
  "artificial intelligence",
  "ai",
  "electric vehicle",
  "tesla",
  "nasa",
  "space",
  "science",
  "health",
  "who",
  "agriculture",
  "crop",
  "soy",
  "commodities",
  "petrobras",
  "energia",
  "clima",
  "economia",
  "guerra",
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Publica: (1) qualquer pauta da nossa região com interesse editorial, ou
 * (2) pauta nacional de alto tráfego (economia, energia, serviços, clima).
 */
export function regionalScope(
  titulo: string,
  resumo: string,
  internacional = false,
): { ok: boolean; motivo: string } {
  const t = norm(`${titulo} ${resumo}`);
  if (BLOQUEIO.some((b) => t.includes(norm(b)))) return { ok: false, motivo: "assunto-bloqueado" };
  const daRegiao = CIDADES.some((c) => t.includes(norm(c)));
  if (daRegiao) {
    if (INTERESSE.some((k) => t.includes(norm(k)))) return { ok: true, motivo: "regional" };
    return { ok: true, motivo: "regional-geral" };
  }
  if (TRAFEGO_NACIONAL.some((k) => t.includes(norm(k))))
    return { ok: true, motivo: "nacional-trafego" };
  if (internacional) {
    if (TRAFEGO_INTERNACIONAL.some((k) => t.includes(norm(k))))
      return { ok: true, motivo: "internacional" };
    return { ok: false, motivo: "internacional-fora-de-escopo" };
  }
  return { ok: false, motivo: "fora-de-escopo" };
}

/* ============================ CICLO ============================ */

export async function runRegionalCycle(opts: { maxPosts?: number; porFonte?: number } = {}) {
  const started = Date.now();
  const sb = await admin();
  const maxPosts = Math.min(opts.maxPosts ?? 6, 20);
  const porFonte = opts.porFonte ?? 12;

  const { data: settings } = await sb
    .from("editorial_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  const modelo = settings?.modelo_texto || "google/gemini-2.5-flash";
  if (settings?.pausar_publicacao) {
    return {
      ok: true,
      pausado: true,
      publicados: 0,
      message: "Publicação pausada pelo administrador.",
    };
  }

  const sources = await ensureRegionalSources(sb);
  const { data: cat } = await sb
    .from("site_categories")
    .select("id")
    .eq("slug", "noticias")
    .maybeSingle();
  const { data: autor } = await sb
    .from("site_authors")
    .select("id")
    .eq("name", "Redação LZ7 Energia")
    .maybeSingle();

  const fila: Array<{ source: any; item: DiscoveredItem }> = [];
  const bloqueadas: string[] = [];

  for (const source of sources) {
    try {
      const items = await rssAdapter(source.feed_url, porFonte);
      let ultimaPub: string | null = null;
      for (const it of items) {
        if (it.publicado_em && (!ultimaPub || it.publicado_em > ultimaPub))
          ultimaPub = it.publicado_em;
        const hash = urlHash(it.url);
        const { data: exists } = await sb
          .from("editorial_items")
          .select("id")
          .eq("url_hash", hash)
          .maybeSingle();
        if (exists) continue;
        fila.push({ source, item: it });
      }
      await sb
        .from("editorial_sources")
        .update({
          ultima_verificacao: new Date().toISOString(),
          ultima_publicacao_encontrada: ultimaPub ?? source.ultima_publicacao_encontrada,
          status: "ok",
          erros_consecutivos: 0,
          ultimo_erro: null,
        })
        .eq("id", source.id);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      bloqueadas.push(`${source.nome}: ${msg}`);
      await sb
        .from("editorial_sources")
        .update({
          ultima_verificacao: new Date().toISOString(),
          erros_consecutivos: (source.erros_consecutivos ?? 0) + 1,
          ultimo_erro: msg.slice(0, 300),
          status: /403|401|forbidden/i.test(msg) ? "bloqueada" : source.status,
        })
        .eq("id", source.id);
      await log(sb, "regional", `Fonte indisponível — ${msg}`, {
        source_id: source.id,
        nivel: "warn",
      });
    }
  }

  // Regional primeiro; depois as mais recentes; empate pela prioridade da fonte.
  const isRegional = (x: { item: DiscoveredItem }) =>
    regionalScope(x.item.titulo, x.item.resumo ?? "").motivo.startsWith("regional") ? 1 : 0;
  fila.sort((a, b) => {
    const ra = isRegional(a);
    const rb = isRegional(b);
    if (ra !== rb) return rb - ra;
    const pa = `${a.item.publicado_em ?? ""}`;
    const pb = `${b.item.publicado_em ?? ""}`;
    if (pa !== pb) return pb.localeCompare(pa);
    return (b.source.prioridade ?? 0) - (a.source.prioridade ?? 0);
  });

  // Garante espaço para pauta internacional: a cada 2 nacionais/regionais, 1 do mundo.
  const nacionais = fila.filter((x) => !isInternacional(x.source));
  const internacionais = fila.filter((x) => isInternacional(x.source));
  if (internacionais.length) {
    const mix: typeof fila = [];
    let i = 0;
    let j = 0;
    while (i < nacionais.length || j < internacionais.length) {
      for (let k = 0; k < 2 && i < nacionais.length; k++) mix.push(nacionais[i++]!);
      if (j < internacionais.length) mix.push(internacionais[j++]!);
    }
    fila.length = 0;
    fila.push(...mix);
  }

  const { data: recentes } = await sb
    .from("site_posts")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(120);
  const titulosRecentes: string[] = (recentes ?? []).map((p: any) => p.title ?? "");

  let publicados = 0;
  let ignorados = 0;
  const erros: string[] = [];
  const resultados: any[] = [];

  for (const { source, item } of fila) {
    if (publicados >= maxPosts) break;
    const hash = urlHash(item.url);
    try {
      const intl = isInternacional(source);
      const escopo = regionalScope(item.titulo, item.resumo ?? "", intl);

      if (!escopo.ok) {
        ignorados++;
        await sb.from("editorial_items").insert({
          source_id: source.id,
          url: item.url,
          url_hash: hash,
          titulo: item.titulo,
          resumo: item.resumo ?? null,
          publicado_em: item.publicado_em ?? null,
          relevancia: 0,
          keywords: ["regional", `fora-de-escopo:${escopo.motivo}`],
        });
        continue;
      }
      if (titulosRecentes.some((t) => similarity(t, item.titulo) >= 55)) {
        ignorados++;
        await sb.from("editorial_items").insert({
          source_id: source.id,
          url: item.url,
          url_hash: hash,
          titulo: item.titulo,
          resumo: item.resumo ?? null,
          publicado_em: item.publicado_em ?? null,
          relevancia: 0,
          keywords: ["regional", "duplicado"],
        });
        continue;
      }

      let texto = item.resumo ?? "";
      let imagem: string | null = null;
      let imagens: string[] = [];
      let videos: string[] = [];
      let legendas: Record<string, string> = {};
      try {
        const art = await fetchArticle(item.url);
        if (art.texto.length > texto.length) texto = art.texto;
        imagem = art.imagem;
        imagens = art.imagens;
        videos = art.videos;
        legendas = art.legendas;
      } catch {
        /* segue com o resumo público do feed */
      }
      if (texto.replace(/\s+/g, " ").trim().length < 280) {
        ignorados++;
        await sb.from("editorial_items").insert({
          source_id: source.id,
          url: item.url,
          url_hash: hash,
          titulo: item.titulo,
          resumo: item.resumo ?? null,
          publicado_em: item.publicado_em ?? null,
          relevancia: 0,
          keywords: ["regional", "sem-conteudo"],
        });
        continue;
      }

      const midiaBriefing = [
        ...imagens
          .slice(1, 6)
          .map(
            (u, i) => `[IMG${i + 2}] imagem disponível${legendas[u] ? ` — ${legendas[u]}` : ""}`,
          ),
        ...videos.slice(0, 3).map((_, i) => `[VIDEO${i + 1}] vídeo disponível`),
      ];

      const briefing = [
        `VEÍCULO DE ORIGEM: ${source.nome} (${source.dominio})`,
        `TÍTULO PUBLICADO NA ORIGEM: ${item.titulo}`,
        item.publicado_em ? `DATA: ${item.publicado_em}` : "",
        `URL: ${item.url}`,
        intl
          ? `IDIOMA DE ORIGEM: ${IDIOMA_POR_DOMINIO[source.dominio] ?? "en"} — TRADUZA INTEGRALMENTE PARA PORTUGUÊS DO BRASIL.`
          : "",
        midiaBriefing.length
          ? `\nMÍDIAS PARA DISTRIBUIR NO TEXTO (use os marcadores exatamente assim, em linhas próprias):\n${midiaBriefing.join("\n")}`
          : "",
        "",
        "MATERIAL APURADO (única base permitida — reescreva com estrutura e palavras próprias, SEM RESUMIR: cubra todos os fatos, listas, números e falas):",
        texto.slice(0, 18_000),
      ]
        .filter(Boolean)
        .join("\n");

      const artigo = await aiJson(modelo, intl ? INTERNACIONAL_SYSTEM : REGIONAL_SYSTEM, briefing);

      const tituloNovo = String(artigo.title ?? "").trim();
      if (tituloNovo.length < 20) throw new Error("Título gerado inválido.");
      let corpoBase = String(artigo.content_html ?? "");
      if (stripHtml(corpoBase).split(/\s+/).filter(Boolean).length < 350) {
        throw new Error("Texto gerado curto demais.");
      }

      // Substitui os marcadores pelas mídias reais; o que sobrar vai para o fim.
      const figuraImg = (u: string) =>
        `<figure><img src="${escapeHtml(u)}" alt="${escapeHtml(legendas[u] ?? tituloNovo)}" loading="lazy" /><figcaption>${escapeHtml(
          legendas[u] ?? `Foto: ${source.nome}`,
        )}</figcaption></figure>`;
      const figuraVideo = (u: string) =>
        `<figure class="video-embed"><iframe src="${escapeHtml(u)}" title="Vídeo da reportagem" loading="lazy" allowfullscreen></iframe><figcaption>Vídeo: ${escapeHtml(
          source.nome,
        )}</figcaption></figure>`;

      const usadas = new Set<string>();
      corpoBase = corpoBase.replace(/\[IMG(\d+)\]/g, (_m, n: string) => {
        const u = imagens[Number(n) - 1];
        if (!u || usadas.has(u)) return "";
        usadas.add(u);
        return figuraImg(u);
      });
      corpoBase = corpoBase.replace(/\[VIDEO(\d+)\]/g, (_m, n: string) => {
        const u = videos[Number(n) - 1];
        if (!u || usadas.has(u)) return "";
        usadas.add(u);
        return figuraVideo(u);
      });

      const restoImgs = imagens.slice(1, 6).filter((u) => !usadas.has(u));
      const restoVideos = videos.slice(0, 3).filter((u) => !usadas.has(u));
      const galeria =
        restoImgs.length || restoVideos.length
          ? `<h2>Imagens e vídeos da cobertura</h2>${restoImgs.map(figuraImg).join("")}${restoVideos.map(figuraVideo).join("")}`
          : "";

      const visao =
        artigo.visao_lz7 && String(artigo.visao_lz7).trim()
          ? `<h2>Leitura da LZ7 Energia</h2><p>${escapeHtml(String(artigo.visao_lz7).trim())}</p>`
          : "";
      const credito = `<p><em>Fonte: <a href="${escapeHtml(item.url)}" target="_blank" rel="nofollow noopener">${escapeHtml(
        source.nome,
      )}</a> — matéria original publicada em ${escapeHtml(source.dominio)}. Imagens e vídeos: ${escapeHtml(
        source.nome,
      )}. Texto apurado e reescrito pela redação da LZ7 Energia.</em></p>`;
      const content = sanitizeHtml(`${corpoBase}${galeria}${visao}${credito}`);

      const slug = await uniqueSlug(sb, slugify(artigo.slug || tituloNovo));
      const tags = [
        "Regional",
        "Norte Pioneiro",
        ...(Array.isArray(artigo.tags) ? artigo.tags.slice(0, 4) : []),
      ].slice(0, 6);

      const { data: post, error: postErr } = await sb
        .from("site_posts")
        .insert({
          slug,
          title: tituloNovo.slice(0, 200),
          subtitle: artigo.subtitle ?? null,
          excerpt: artigo.excerpt ?? null,
          tldr: artigo.tldr ?? null,
          content,
          cover_url: imagem,
          category_id: cat?.id ?? null,
          author_id: autor?.id ?? null,
          status: "publicado",
          published_at: item.publicado_em ?? new Date().toISOString(),
          reading_minutes: readingMinutes(content),
          seo: {
            title: String(artigo.seo?.title ?? tituloNovo).slice(0, 60),
            description: String(artigo.seo?.description ?? artigo.excerpt ?? "").slice(0, 155),
            alt_text: `Imagem: ${source.nome}`,
            tags,
          },
          cta: {},
          origin: "automatico",
          content_type: "noticia",
          sources: [
            {
              nome: source.nome,
              url: item.url,
              tipo: "regional",
              titulo: item.titulo,
              credito_imagem: imagem ? source.nome : null,
            },
          ],
          quality_score: Array.isArray(artigo.alertas) && artigo.alertas.length ? 70 : 90,
          breaking_news: false,
        })
        .select("id,slug,title")
        .maybeSingle();
      if (postErr) throw new Error(postErr.message);

      await sb.from("editorial_items").insert({
        source_id: source.id,
        url: item.url,
        url_hash: hash,
        titulo: item.titulo,
        resumo: item.resumo ?? null,
        publicado_em: item.publicado_em ?? null,
        relevancia: 60,
        keywords: ["regional", "publicado"],
      });

      titulosRecentes.push(tituloNovo);
      titulosRecentes.push(item.titulo);
      publicados++;
      resultados.push({ fonte: source.nome, slug: post?.slug, title: post?.title });
      await log(sb, "regional", `Publicado: ${post?.title}`, {
        source_id: source.id,
        detalhes: { origem: item.url, slug: post?.slug },
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      erros.push(`${item.titulo}: ${msg}`);
      await log(sb, "regional", msg, {
        source_id: source.id,
        nivel: "error",
        detalhes: { url: item.url },
      });
    }
  }

  await sb.from("editorial_runs").insert({
    tipo: "scan",
    itens_encontrados: fila.length,
    pautas_novas: publicados,
    pautas_relevantes: publicados,
    erros: erros.length,
    duracao_ms: Date.now() - started,
    detalhes: { regional: true, bloqueadas, ignorados, resultados },
  });

  return {
    ok: true,
    fontes: sources.length,
    candidatos: fila.length,
    publicados,
    ignorados,
    bloqueadas,
    erros,
    resultados,
  };
}
