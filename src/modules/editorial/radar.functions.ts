import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertEditor(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  const { data: isCoord } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "coordenador",
  });
  if (!isAdmin && !isCoord) throw new Error("Acesso restrito à equipe editorial.");
  return true;
}

/** Painel: números do dia, pautas quentes, fila e fontes com problema. */
export const radarOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const { dailyDigest, getSettings } = await import("./engine.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;

    const [digest, settings, topics, jobs, sources, revisao, runs] = await Promise.all([
      dailyDigest(),
      getSettings(sb),
      sb
        .from("editorial_topics")
        .select(
          "id,assunto,categoria,status,lz7_score,confidence_score,quantidade_fontes,breaking_news,primeira_detectada_em,post_id,motivo_bloqueio",
        )
        .order("score", { ascending: false })
        .limit(25)
        .then((r: any) => r.data ?? []),
      sb
        .from("editorial_jobs")
        .select("id,status,tentativas,erro,created_at,editorial_topics(assunto)")
        .order("created_at", { ascending: false })
        .limit(12)
        .then((r: any) => r.data ?? []),
      sb
        .from("editorial_sources")
        .select(
          "id,nome,tipo,dominio,ativo,status,autoridade,frequencia_minutos,ultima_verificacao,erros_consecutivos,ultimo_erro",
        )
        .order("autoridade", { ascending: false })
        .then((r: any) => r.data ?? []),
      sb
        .from("site_posts")
        .select("id,slug,title,status,quality_score,created_at,sources")
        .eq("origin", "automatico")
        .in("status", ["revisao", "rascunho"])
        .order("created_at", { ascending: false })
        .limit(15)
        .then((r: any) => r.data ?? []),
      sb
        .from("editorial_runs")
        .select("tipo,itens_encontrados,pautas_novas,pautas_relevantes,erros,duracao_ms,created_at")
        .order("created_at", { ascending: false })
        .limit(6)
        .then((r: any) => r.data ?? []),
    ]);

    return { digest, settings, topics, jobs, sources, revisao, runs };
  });

/** Executa a descoberta manualmente. */
export const radarScanNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceId?: string } | undefined) => ({ sourceId: d?.sourceId }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { runScan } = await import("./engine.server");
    return runScan(data.sourceId ? { sourceId: data.sourceId } : {});
  });

/** Processa a fila manualmente (gera artigos das pautas aprovadas). */
export const radarWorkNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { max?: number } | undefined) => ({
    max: Math.min(3, Math.max(1, d?.max ?? 1)),
  }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { processQueue } = await import("./engine.server");
    return processQueue(data.max);
  });

/** Aprova a pauta manualmente: entra na fila de produção. */
export const radarApproveTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topicId: string }) => ({ topicId: String(d.topicId) }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    await sb
      .from("editorial_jobs")
      .insert({ topic_id: data.topicId, tipo: "artigo", status: "queued" });
    await sb.from("editorial_topics").update({ status: "coletando" }).eq("id", data.topicId);
    return { ok: true };
  });

/** Descarta a pauta (não volta a ser sugerida). */
export const radarIgnoreTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { topicId: string; motivo?: string }) => ({
    topicId: String(d.topicId),
    motivo: d.motivo ? String(d.motivo).slice(0, 300) : null,
  }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("editorial_topics")
      .update({ status: "ignorado", motivo_bloqueio: data.motivo })
      .eq("id", data.topicId);
    return { ok: true };
  });

/** Publica um artigo que estava em revisão. */
export const radarPublishPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { postId: string }) => ({ postId: String(d.postId) }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const { error } = await sb
      .from("site_posts")
      .update({ status: "publicado", published_at: new Date().toISOString() })
      .eq("id", data.postId);
    if (error) throw new Error(error.message);
    await sb.from("editorial_topics").update({ status: "publicado" }).eq("post_id", data.postId);
    return { ok: true };
  });

/** Aprova TODAS as pautas pendentes de uma vez (entram na fila de produção). */
export const radarApproveAllTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const { data: topics } = await sb
      .from("editorial_topics")
      .select("id")
      .in("status", ["identificada", "verificando"])
      .limit(500);
    const ids: string[] = (topics ?? []).map((t: any) => t.id);
    if (!ids.length) return { aprovadas: 0 };
    await sb
      .from("editorial_jobs")
      .insert(ids.map((id) => ({ topic_id: id, tipo: "artigo", status: "queued" })));
    await sb.from("editorial_topics").update({ status: "coletando" }).in("id", ids);
    return { aprovadas: ids.length };
  });

/** Publica TODOS os artigos em revisão/rascunho de uma vez. */
export const radarPublishAllPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb: any = supabaseAdmin;
    const { data: posts } = await sb
      .from("site_posts")
      .select("id")
      .in("status", ["revisao", "rascunho"])
      .limit(500);
    const ids: string[] = (posts ?? []).map((p: any) => p.id);
    if (!ids.length) return { publicados: 0 };
    const { error } = await sb
      .from("site_posts")
      .update({ status: "publicado", published_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw new Error(error.message);
    await sb.from("editorial_topics").update({ status: "publicado" }).in("post_id", ids);
    return { publicados: ids.length };
  });

/** Atualiza as regras do motor editorial. */
export const radarSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, any>) => d)
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = [
      "modo_publicacao",
      "pausar_publicacao",
      "pausar_descoberta",
      "max_artigos_dia",
      "min_confidence",
      "min_relevancia",
      "max_similaridade",
      "modelo_texto",
    ];
    const patch: Record<string, any> = { id: true, updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in data) patch[k] = data[k];
    const { error } = await (supabaseAdmin as any)
      .from("editorial_settings")
      .upsert(patch, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Liga/desliga uma fonte. */
export const radarToggleSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceId: string; ativo: boolean }) => ({
    sourceId: String(d.sourceId),
    ativo: !!d.ativo,
  }))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("editorial_sources")
      .update({ ativo: data.ativo, erros_consecutivos: 0, status: data.ativo ? "ok" : "pausada" })
      .eq("id", data.sourceId);
    return { ok: true };
  });

/** Cadastra (ou atualiza) as fontes iniciais do radar. */
export const radarSeedSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { SEED_SOURCES } = await import("./sources.seed");
    const { seedSources } = await import("./engine.server");
    const total = await seedSources(supabaseAdmin as any, SEED_SOURCES as any[]);
    return { ok: true, total };
  });
