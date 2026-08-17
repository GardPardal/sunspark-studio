/** Motor editorial LZ7 — descoberta, apuração, redação, quality gate e publicação. Server-only. */

import { runAdapter, urlHash, fetchPublicText } from "./adapters.server";
import {
  confidenceFromSources,
  fingerprint,
  guessCategory,
  lz7Relevance,
  readingMinutes,
  similarity,
  slugify,
} from "./shared";

type Sb = any;

async function admin(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Sb;
}

async function log(
  sb: Sb,
  acao: string,
  resultado: string,
  extra: { source_id?: string | null; topic_id?: string | null; nivel?: "info" | "warn" | "error"; detalhes?: any } = {},
) {
  await sb.from("editorial_logs").insert({
    acao,
    resultado: resultado.slice(0, 500),
    nivel: extra.nivel ?? "info",
    source_id: extra.source_id ?? null,
    topic_id: extra.topic_id ?? null,
    detalhes: extra.detalhes ?? {},
  });
}

export async function getSettings(sb: Sb) {
  const { data } = await sb.from("editorial_settings").select("*").eq("id", true).maybeSingle();
  return (
    data ?? {
      modo_publicacao: "semiautomatica",
      pausar_publicacao: false,
      pausar_descoberta: false,
      max_artigos_dia: 4,
      min_confidence: 90,
      min_relevancia: 75,
      max_similaridade: 70,
      modelo_texto: "google/gemini-2.5-flash",
    }
  );
}

/* ============================ 1. DESCOBERTA ============================ */

export async function runScan(opts: { limitPerSource?: number; sourceId?: string } = {}) {
  const started = Date.now();
  const sb = await admin();
  const settings = await getSettings(sb);
  if (settings.pausar_descoberta && !opts.sourceId) {
    return { ok: true, paused: true, message: "Descoberta pausada pelo administrador." };
  }

  // Primeira execução: cadastra as fontes padrão automaticamente.
  const { count: totalFontes } = await sb.from("editorial_sources").select("id", { count: "exact", head: true });
  if (!totalFontes) {
    const { SEED_SOURCES } = await import("./sources.seed");
    await sb.from("editorial_sources").upsert(SEED_SOURCES as any, { onConflict: "dominio" });
    await log(sb, "fontes", `${SEED_SOURCES.length} fontes padrão cadastradas`);
  }

  let q = sb.from("editorial_sources").select("*").eq("ativo", true);
  if (opts.sourceId) q = q.eq("id", opts.sourceId);
  const { data: sources } = await q;
  const list: any[] = sources ?? [];

  const now = Date.now();
  const due = opts.sourceId
    ? list
    : list.filter((s) => {
        if (!s.ultima_verificacao) return true;
        return now - new Date(s.ultima_verificacao).getTime() >= s.frequencia_minutos * 60_000;
      });

  let encontrados = 0;
  let novos = 0;
  let erros = 0;
  const limit = opts.limitPerSource ?? 30;

  for (const source of due) {
    try {
      const items = await runAdapter(source.adapter, source.feed_url || `https://${source.dominio}`, limit);
      encontrados += items.length;
      let ultimaPub: string | null = null;

      for (const it of items) {
        const hash = urlHash(it.url);
        const { data: exists } = await sb
          .from("editorial_items")
          .select("id")
          .eq("url_hash", hash)
          .maybeSingle();
        if (exists) continue;

        const rel = lz7Relevance(it.titulo, it.resumo ?? "");
        const { data: inserted } = await sb
          .from("editorial_items")
          .insert({
            source_id: source.id,
            url: it.url,
            url_hash: hash,
            titulo: it.titulo,
            resumo: it.resumo ?? null,
            autor: it.autor ?? null,
            publicado_em: it.publicado_em,
            keywords: rel.matched,
            relevancia: rel.score,
          })
          .select("id")
          .maybeSingle();
        novos++;
        if (it.publicado_em && (!ultimaPub || it.publicado_em > ultimaPub)) ultimaPub = it.publicado_em;
        if (inserted && rel.score >= 30) {
          await attachToTopic(sb, inserted.id, source, it, rel);
        }
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
      await log(sb, "scan", `${items.length} itens lidos`, { source_id: source.id });
    } catch (e: any) {
      erros++;
      const erroCount = (source.erros_consecutivos ?? 0) + 1;
      await sb
        .from("editorial_sources")
        .update({
          ultima_verificacao: new Date().toISOString(),
          erros_consecutivos: erroCount,
          ultimo_erro: String(e?.message ?? e).slice(0, 300),
          status: erroCount >= 5 ? "erro" : source.status,
        })
        .eq("id", source.id);
      await log(sb, "scan", String(e?.message ?? e), { source_id: source.id, nivel: "error" });
    }
  }

  const relevantes = await promoteTopics(sb, settings);

  await sb.from("editorial_runs").insert({
    tipo: "scan",
    itens_encontrados: encontrados,
    pautas_novas: novos,
    pautas_relevantes: relevantes,
    erros,
    duracao_ms: Date.now() - started,
    detalhes: { fontes: due.length },
  });

  return { ok: true, fontes: due.length, itens: encontrados, novos, relevantes, erros };
}

/** Agrupa o item em uma pauta existente (cluster) ou cria uma nova. */
async function attachToTopic(sb: Sb, itemId: string, source: any, it: any, rel: { score: number }) {
  const fp = fingerprint(it.titulo);
  const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const { data: candidates } = await sb
    .from("editorial_topics")
    .select("id,assunto,fingerprint,quantidade_fontes,lz7_score")
    .gte("primeira_detectada_em", since)
    .in("status", ["identificada", "coletando", "verificando", "gerando", "revisao"])
    .limit(120);

  let topic = (candidates ?? []).find(
    (t: any) => t.fingerprint === fp || similarity(t.assunto, it.titulo) >= 45,
  );

  if (!topic) {
    const categoria = guessCategory(it.titulo, it.resumo ?? "");
    const { data: created } = await sb
      .from("editorial_topics")
      .insert({
        assunto: it.titulo.slice(0, 280),
        titulo_interno: it.titulo.slice(0, 280),
        resumo_factual: (it.resumo ?? "").slice(0, 1200) || null,
        categoria,
        relevancia: rel.score,
        lz7_score: rel.score,
        quantidade_fontes: 1,
        fonte_primaria_id: source.id,
        fingerprint: fp,
        confidence_score: confidenceFromSources([source.tipo]),
        score: rel.score,
        breaking_news: false,
      })
      .select("id")
      .maybeSingle();
    topic = created;
  }
  if (!topic) return;

  await sb.from("editorial_items").update({ topic_id: topic.id }).eq("id", itemId);
  await sb
    .from("editorial_topic_sources")
    .upsert(
      {
        topic_id: topic.id,
        source_id: source.id,
        item_id: itemId,
        peso: source.autoridade ?? 50,
        papel: source.tipo === "oficial" ? "primaria" : "contexto",
      },
      { onConflict: "topic_id,item_id" },
    );

  // Recalcula confiança e nº de fontes com base em todas as fontes ligadas.
  const { data: links } = await sb
    .from("editorial_topic_sources")
    .select("source_id, editorial_sources(tipo, autoridade, id)")
    .eq("topic_id", topic.id);
  const tipos = (links ?? []).map((l: any) => l.editorial_sources?.tipo).filter(Boolean);
  const conf = confidenceFromSources(tipos);
  const oficial = (links ?? []).find((l: any) => l.editorial_sources?.tipo === "oficial");
  const nFontes = new Set((links ?? []).map((l: any) => l.source_id)).size;

  await sb
    .from("editorial_topics")
    .update({
      quantidade_fontes: nFontes,
      confidence_score: conf,
      ultima_atualizacao: new Date().toISOString(),
      score: Math.round(conf * 0.4 + rel.score * 0.6),
      fonte_primaria_id: oficial?.source_id ?? topic.fonte_primaria_id ?? source.id,
      breaking_news: conf >= 90 && nFontes >= 3,
    })
    .eq("id", topic.id);
}

/** Enfileira as melhores pautas do dia, respeitando o limite configurado. */
async function promoteTopics(sb: Sb, settings: any): Promise<number> {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);

  const { count: publicadosHoje } = await sb
    .from("site_posts")
    .select("id", { count: "exact", head: true })
    .eq("origin", "automatico")
    .gte("created_at", hoje.toISOString());

  const { count: naFila } = await sb
    .from("editorial_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "fetching", "researching", "generating", "validating", "image", "seo", "publishing"]);

  const capacidade = Math.max(0, (settings.max_artigos_dia ?? 4) - (publicadosHoje ?? 0) - (naFila ?? 0));
  if (capacidade <= 0) return 0;

  const { data: topics } = await sb
    .from("editorial_topics")
    .select("*")
    .eq("status", "identificada")
    .gte("lz7_score", 50)
    .order("score", { ascending: false })
    .limit(capacidade);

  let n = 0;
  for (const t of topics ?? []) {
    await sb.from("editorial_jobs").insert({ topic_id: t.id, tipo: "artigo", status: "queued" });
    await sb.from("editorial_topics").update({ status: "coletando" }).eq("id", t.id);
    await log(sb, "fila", `Pauta enfileirada: ${t.assunto}`, { topic_id: t.id });
    n++;
  }
  return n;
}

/* ============================ 2. IA ============================ */

async function aiJson(model: string, system: string, user: string): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
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
      temperature: 0.6,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: any = new Error(`IA ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const data: any = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Resposta da IA fora do formato esperado.");
  }
}

const WRITER_SYSTEM = `Você é a redação da LZ7 Energia, empresa brasileira de energia solar. Escreve em português do Brasil.

REGRAS INEGOCIÁVEIS:
- NUNCA copie, traduza ou parafraseie frase a frase o material recebido. Escreva um texto ORIGINAL a partir dos fatos.
- NUNCA invente números, datas, nomes de leis, resoluções ou valores. Só use dados presentes nos fatos apurados.
- Quando um dado vier de uma fonte, atribua no texto ("segundo a ANEEL", "de acordo com a EPE").
- Voz profissional, clara e direta. Sem sensacionalismo, sem jargão desnecessário, sem emojis, sem "neste artigo vamos".
- Traduza o assunto para quem paga conta de luz, para empresas e para produtores rurais.
- CTA comercial SOMENTE quando houver contexto real. Se for pauta puramente regulatória, use cta = null.
- Se faltar informação para afirmar algo, escreva o que é conhecido e sinalize o que ainda depende de confirmação.

RESPONDA APENAS JSON VÁLIDO:
{
 "title": "título original, claro, 45-70 caracteres",
 "subtitle": "uma linha explicando o impacto",
 "excerpt": "resumo de 1-2 frases",
 "tldr": "resumo em uma frase objetiva",
 "content_type": "noticia|analise|guia|editorial",
 "content_html": "<h2>O que aconteceu</h2><p>...</p><h2>O que muda</h2><p>...</p><h2>Quem é afetado</h2><p>...</p><h2>Por que isso importa</h2><p>...</p><h2>Visão LZ7</h2><p>...</p><h2>O que acompanhar agora</h2><p>...</p>",
 "seo": {"title":"até 60 caracteres","description":"até 155 caracteres"},
 "slug": "slug-curto-sem-datas",
 "tags": ["até 8 tags"],
 "cta": null,
 "image_prompt": "prompt em INGLÊS para capa editorial 16:9, fotografia realista, azul-marinho e verde, sem texto, sem logotipos, sem rostos reconhecíveis",
 "alt_text": "descrição da capa em português",
 "alertas": ["liste aqui qualquer dado que não pôde ser confirmado; vazio se nenhum"]
}
Use apenas tags HTML simples: h2, h3, p, ul, li, strong. Nada de <script>, <img> ou <style>.`;

/* ============================ 3. PIPELINE ============================ */

export async function processQueue(max = 2) {
  const sb = await admin();
  const settings = await getSettings(sb);
  const { data: jobs } = await sb
    .from("editorial_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at")
    .limit(max);

  const results: any[] = [];
  for (const job of jobs ?? []) {
    try {
      results.push(await processJob(sb, settings, job));
    } catch (e: any) {
      const tentativas = (job.tentativas ?? 0) + 1;
      const failed = tentativas >= (job.max_tentativas ?? 3);
      await sb
        .from("editorial_jobs")
        .update({
          status: failed ? "failed" : "queued",
          tentativas,
          erro: String(e?.message ?? e).slice(0, 500),
        })
        .eq("id", job.id);
      if (failed && job.topic_id) {
        await sb.from("editorial_topics").update({ status: "erro" }).eq("id", job.topic_id);
      }
      await log(sb, "worker", String(e?.message ?? e), {
        topic_id: job.topic_id,
        nivel: "error",
      });
      results.push({ jobId: job.id, ok: false, erro: String(e?.message ?? e) });
    }
  }
  return { processados: results.length, results };
}

async function setJob(sb: Sb, jobId: string, status: string) {
  await sb.from("editorial_jobs").update({ status, iniciado_em: new Date().toISOString() }).eq("id", jobId);
}

export async function processJob(sb: Sb, settings: any, job: any) {
  const { data: topic } = await sb.from("editorial_topics").select("*").eq("id", job.topic_id).maybeSingle();
  if (!topic) throw new Error("Pauta não encontrada.");

  /* --- Apuração --- */
  await setJob(sb, job.id, "researching");
  await sb.from("editorial_topics").update({ status: "verificando" }).eq("id", topic.id);

  const { data: links } = await sb
    .from("editorial_topic_sources")
    .select("papel, editorial_sources(nome,tipo,autoridade,dominio), editorial_items(url,titulo,resumo,publicado_em)")
    .eq("topic_id", topic.id);

  const fontes = (links ?? [])
    .map((l: any) => ({
      nome: l.editorial_sources?.nome ?? "Fonte",
      tipo: l.editorial_sources?.tipo ?? "geral",
      autoridade: l.editorial_sources?.autoridade ?? 50,
      url: l.editorial_items?.url,
      titulo: l.editorial_items?.titulo,
      resumo: l.editorial_items?.resumo,
      data: l.editorial_items?.publicado_em,
    }))
    .filter((f: any) => f.url)
    .sort((a: any, b: any) => b.autoridade - a.autoridade)
    .slice(0, 6);

  if (!fontes.length) throw new Error("Pauta sem fontes utilizáveis.");

  // Texto público das fontes de maior autoridade (apuração, nunca reprodução).
  const apurado: Array<{ nome: string; url: string; texto: string }> = [];
  for (const f of fontes.slice(0, 3)) {
    try {
      const texto = await fetchPublicText(f.url, 5000);
      if (texto.length > 200) apurado.push({ nome: f.nome, url: f.url, texto });
    } catch {
      /* fonte indisponível: seguimos com título e resumo públicos */
    }
  }

  // Fatos verificados
  await sb.from("editorial_facts").delete().eq("topic_id", topic.id);
  for (const f of fontes) {
    if (!f.resumo && !f.titulo) continue;
    await sb.from("editorial_facts").insert({
      topic_id: topic.id,
      informacao: (f.resumo || f.titulo).slice(0, 900),
      fonte_nome: f.nome,
      fonte_url: f.url,
      confianca: f.tipo === "oficial" ? 95 : f.tipo === "entidade" ? 80 : 65,
      data_fato: f.data ? String(f.data).slice(0, 10) : null,
      confirmado_por: fontes.length,
    });
  }

  const confidence = confidenceFromSources(fontes.map((f: any) => f.tipo));

  /* --- Redação --- */
  await setJob(sb, job.id, "generating");
  await sb.from("editorial_topics").update({ status: "gerando", confidence_score: confidence }).eq("id", topic.id);

  const briefing = [
    `PAUTA: ${topic.assunto}`,
    `CATEGORIA SUGERIDA: ${topic.categoria}`,
    `NÍVEL DE CONFIANÇA DAS FONTES: ${confidence}/100`,
    "",
    "FATOS APURADOS (única base permitida):",
    ...fontes.map(
      (f: any, i: number) =>
        `${i + 1}. [${f.tipo.toUpperCase()}] ${f.nome} — ${f.titulo}\n   ${f.resumo ?? "(sem resumo público)"}\n   ${f.url}`,
    ),
    "",
    ...apurado.map((a) => `CONTEÚDO PÚBLICO DE ${a.nome} (${a.url}):\n${a.texto.slice(0, 3500)}`),
  ].join("\n");

  const artigo = await aiJson(settings.modelo_texto || "google/gemini-2.5-flash", WRITER_SYSTEM, briefing);

  /* --- Quality gate --- */
  await setJob(sb, job.id, "validating");
  const gate = qualityGate(artigo, fontes);
  const simFonte = Math.max(...fontes.map((f: any) => similarity(artigo.title ?? "", f.titulo ?? "")), 0);
  if (simFonte > (settings.max_similaridade ?? 70)) {
    gate.problemas.push("Título muito parecido com o da fonte original.");
  }

  // Duplicidade contra artigos já publicados
  const { data: publicados } = await sb
    .from("site_posts")
    .select("id,slug,title")
    .order("created_at", { ascending: false })
    .limit(200);
  const dup = (publicados ?? []).find((p: any) => similarity(p.title, artigo.title ?? "") >= 65);
  if (dup) gate.problemas.push(`Conteúdo semelhante ao artigo já publicado: ${dup.title}`);

  /* --- Capa --- */
  await setJob(sb, job.id, "image");
  let coverUrl: string | null = null;
  try {
    coverUrl = await generateCover(sb, artigo.image_prompt || `${artigo.title} — editorial energia`, artigo.slug || slugify(artigo.title ?? "capa"));
  } catch (e: any) {
    await log(sb, "imagem", String(e?.message ?? e), { topic_id: topic.id, nivel: "warn" });
  }

  /* --- SEO / gravação --- */
  await setJob(sb, job.id, "seo");
  const slugBase = slugify(artigo.slug || artigo.title || topic.assunto);
  const slug = await uniqueSlug(sb, slugBase);

  const { data: cat } = await sb
    .from("site_categories")
    .select("id")
    .eq("slug", artigo.categoria_slug || topic.categoria || "noticias")
    .maybeSingle();
  const { data: autor } = await sb
    .from("site_authors")
    .select("id")
    .eq("name", "Redação LZ7 Energia")
    .maybeSingle();

  const autoOk =
    settings.modo_publicacao === "automatica" &&
    !settings.pausar_publicacao &&
    gate.problemas.length === 0 &&
    confidence >= (settings.min_confidence ?? 90) &&
    (topic.lz7_score ?? 0) >= (settings.min_relevancia ?? 75) &&
    !!coverUrl;

  const sources = fontes.map((f: any) => ({ nome: f.nome, url: f.url, tipo: f.tipo, titulo: f.titulo }));
  const content = sanitizeHtml(artigo.content_html ?? "");

  await setJob(sb, job.id, "publishing");
  const { data: post, error: postErr } = await sb
    .from("site_posts")
    .insert({
      slug,
      title: String(artigo.title ?? topic.assunto).slice(0, 200),
      subtitle: artigo.subtitle ?? null,
      excerpt: artigo.excerpt ?? null,
      tldr: artigo.tldr ?? null,
      content,
      cover_url: coverUrl,
      category_id: cat?.id ?? null,
      author_id: autor?.id ?? null,
      status: autoOk ? "publicado" : "revisao",
      published_at: autoOk ? new Date().toISOString() : null,
      reading_minutes: readingMinutes(content),
      seo: {
        title: (artigo.seo?.title ?? artigo.title ?? "").slice(0, 60),
        description: (artigo.seo?.description ?? artigo.excerpt ?? "").slice(0, 155),
        alt_text: artigo.alt_text ?? null,
        tags: (artigo.tags ?? []).slice(0, 8),
      },
      cta: artigo.cta ?? {},
      origin: "automatico",
      content_type: artigo.content_type ?? "noticia",
      topic_id: topic.id,
      sources,
      quality_score: gate.score,
      breaking_news: !!topic.breaking_news,
    })
    .select("id,slug,title,status")
    .maybeSingle();
  if (postErr) throw new Error(`Falha ao gravar artigo: ${postErr.message}`);

  await sb
    .from("editorial_topics")
    .update({
      status: autoOk ? "publicado" : "revisao",
      post_id: post.id,
      motivo_bloqueio: gate.problemas.join(" | ") || null,
      ultima_atualizacao: new Date().toISOString(),
    })
    .eq("id", topic.id);

  await sb
    .from("editorial_jobs")
    .update({ status: "completed", concluido_em: new Date().toISOString() })
    .eq("id", job.id);

  await log(sb, "artigo", autoOk ? `Publicado: ${post.title}` : `Aguardando revisão: ${post.title}`, {
    topic_id: topic.id,
    detalhes: { gate, slug },
  });

  return { jobId: job.id, ok: true, postId: post.id, status: post.status, gate };
}

/* ============================ 4. QUALIDADE ============================ */

export function qualityGate(artigo: any, fontes: any[]) {
  const problemas: string[] = [];
  const content: string = String(artigo?.content_html ?? "");
  const texto = content.replace(/<[^>]+>/g, " ");
  if (!artigo?.title || String(artigo.title).length < 20) problemas.push("Título ausente ou curto demais.");
  if (texto.split(/\s+/).filter(Boolean).length < 320) problemas.push("Texto curto demais para publicação.");
  if (!artigo?.seo?.description) problemas.push("Meta description ausente.");
  if (!fontes.length) problemas.push("Nenhuma fonte registrada.");
  if (/lorem ipsum/i.test(texto)) problemas.push("Conteúdo de preenchimento detectado.");
  if (/<script|<iframe|onerror=/i.test(content)) problemas.push("HTML não permitido no conteúdo.");
  if (Array.isArray(artigo?.alertas) && artigo.alertas.length) {
    problemas.push(`Dados não confirmados: ${artigo.alertas.slice(0, 3).join("; ")}`);
  }
  // Números importantes devem aparecer em alguma fonte apurada.
  const base = fontes.map((f) => `${f.titulo ?? ""} ${f.resumo ?? ""}`).join(" ");
  const numeros = [...texto.matchAll(/\b\d{1,3}(?:\.\d{3})*(?:,\d+)?\s?(?:%|GW|MW|kW|bilh|milh)/gi)].map((m) => m[0]);
  const naoConfirmados = numeros.filter((n) => !base.includes(n.split(/\s/)[0]!));
  if (naoConfirmados.length > 2) {
    problemas.push(`Números sem confirmação direta nas fontes: ${naoConfirmados.slice(0, 3).join(", ")}`);
  }
  const score = Math.max(0, 100 - problemas.length * 18);
  return { score, problemas };
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/<(?!\/?(h2|h3|p|ul|ol|li|strong|em|a|blockquote|br)\b)[^>]*>/gi, "");
}

async function uniqueSlug(sb: Sb, base: string): Promise<string> {
  let slug = base || `artigo-${Date.now()}`;
  for (let i = 0; i < 6; i++) {
    const { data } = await sb.from("site_posts").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/* ============================ 5. IMAGEM ============================ */

const IMAGE_STYLE =
  "editorial cover photograph, 16:9, deep navy blue and vivid green accent palette, premium corporate energy aesthetic, natural light, high detail, no text, no logos, no watermarks, no recognizable faces, not a documentary photo of a specific real event";

export async function generateCover(sb: Sb, prompt: string, slug: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Geração de imagem indisponível.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      prompt: `${prompt}. ${IMAGE_STYLE}`,
      size: "1536x1024",
      n: 1,
    }),
  });
  if (!res.ok) throw new Error(`Imagem ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Gateway não retornou imagem.");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `capas/${new Date().toISOString().slice(0, 7)}/${slug}-${Date.now().toString(36)}.png`;
  const { error } = await sb.storage.from("blog-media").upload(path, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (error) throw new Error(`Upload da capa falhou: ${error.message}`);
  return `/api/public/blog-image/${path}`;
}

/* ============================ 6. RESUMOS ============================ */

export async function dailyDigest() {
  const sb = await admin();
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);
  const iso = hoje.toISOString();

  const counts = async (table: string, build: (q: any) => any) => {
    const { count } = await build(sb.from(table).select("id", { count: "exact", head: true }));
    return count ?? 0;
  };

  const [itens, pautas, relevantes, emProducao, publicados, revisao, ignorados] = await Promise.all([
    counts("editorial_items", (q) => q.gte("created_at", iso)),
    counts("editorial_topics", (q) => q.gte("primeira_detectada_em", iso)),
    counts("editorial_topics", (q) => q.gte("primeira_detectada_em", iso).gte("lz7_score", 50)),
    counts("editorial_jobs", (q) =>
      q.in("status", ["queued", "fetching", "researching", "generating", "validating", "image", "seo", "publishing"]),
    ),
    counts("site_posts", (q) => q.eq("origin", "automatico").eq("status", "publicado").gte("created_at", iso)),
    counts("site_posts", (q) => q.eq("status", "revisao")),
    counts("editorial_topics", (q) => q.eq("status", "ignorado").gte("primeira_detectada_em", iso)),
  ]);

  return { itens, pautas, relevantes, emProducao, publicados, revisao, ignorados };
}
