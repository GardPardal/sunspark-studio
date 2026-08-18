import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { publicClient, rateLimit, clientIp, normalizeOrigin } from "./site.server";

/* ------------------------------- LEITURAS -------------------------------- */

export const getSolution = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 90) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("site_solutions")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar esta página agora.");
    return row as Record<string, any> | null;
  });

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("site_projects")
    .select("id,slug,title,category,city,state,power_kwp,summary,cover_url,project_date,featured")
    .eq("published", true)
    .order("featured", { ascending: false })
    .order("project_date", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw new Error("Não foi possível carregar os projetos agora.");
  return (data ?? []) as Array<Record<string, any>>;
});

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 120) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("site_projects")
      .select("*")
      .eq("slug", data.slug)
      .eq("published", true)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar este projeto agora.");
    return row as Record<string, any> | null;
  });

export const listPosts = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [{ data: posts, error }, { data: cats }, { data: authors }] = await Promise.all([
    sb
      .from("site_posts")
      .select("id,slug,title,subtitle,excerpt,cover_url,category_id,author_id,published_at,reading_minutes")
      .eq("status", "publicado")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(300),
    sb.from("site_categories").select("id,slug,name,ordem").order("ordem"),
    sb.from("site_authors").select("id,name,role,avatar_url"),
  ]);
  if (error) throw new Error("Não foi possível carregar os artigos agora.");
  return {
    posts: (posts ?? []) as Array<Record<string, any>>,
    categories: (cats ?? []) as Array<Record<string, any>>,
    authors: (authors ?? []) as Array<Record<string, any>>,
  };
});

export const getPost = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 140) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: post, error } = await sb
      .from("site_posts")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "publicado")
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar este artigo agora.");
    if (!post) return null;
    const [{ data: category }, { data: author }, { data: related }] = await Promise.all([
      post.category_id
        ? sb.from("site_categories").select("id,slug,name").eq("id", post.category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      post.author_id
        ? sb.from("site_authors").select("id,name,role,avatar_url").eq("id", post.author_id).maybeSingle()
        : Promise.resolve({ data: null }),
      sb
        .from("site_posts")
        .select("id,slug,title,excerpt,cover_url,published_at,reading_minutes")
        .eq("status", "publicado")
        .neq("id", post.id)
        .order("published_at", { ascending: false })
        .limit(3),
    ]);
    return { post, category, author, related: related ?? [] } as Record<string, any>;
  });

export const listJobs = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("site_jobs")
    .select("id,slug,title,department,city,state,work_model,contract_type,status,published_at")
    .in("status", ["aberta", "pausada"])
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error("Não foi possível carregar as vagas agora.");
  return (data ?? []) as Array<Record<string, any>>;
});

export const getJob = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 140) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb.from("site_jobs").select("*").eq("slug", data.slug).maybeSingle();
    if (error) throw new Error("Não foi possível carregar esta vaga agora.");
    return row as Record<string, any> | null;
  });

export const getAboutContent = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [{ data: timeline }, { data: stats }, { data: units }] = await Promise.all([
    sb.from("site_timeline").select("*").eq("published", true).order("ordem").order("year"),
    sb.from("site_stats").select("*").eq("published", true).order("ordem"),
    sb.from("site_units").select("*").eq("published", true).order("ordem"),
  ]);
  return {
    timeline: (timeline ?? []) as Array<Record<string, any>>,
    stats: (stats ?? []) as Array<Record<string, any>>,
    units: (units ?? []) as Array<Record<string, any>>,
  };
});

export const listUnits = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("site_units").select("*").eq("published", true).order("ordem");
  if (error) throw new Error("Não foi possível carregar as unidades agora.");
  return (data ?? []) as Array<Record<string, any>>;
});

export const getPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: String(d.slug).slice(0, 90) }))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: row, error } = await sb.from("site_pages").select("*").eq("slug", data.slug).maybeSingle();
    if (error) throw new Error("Não foi possível carregar esta página agora.");
    return row as Record<string, any> | null;
  });

/* ------------------------------- ENVIOS ---------------------------------- */

const guard = (bucket: string, max = 6) => {
  const req = getRequest();
  const ip = clientIp(req.headers);
  if (!rateLimit(`${bucket}:${ip}`, max)) {
    throw new Error("Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.");
  }
};

const baseContact = {
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(8).max(25),
  hp: z.string().max(0).optional().or(z.literal("")),
  consent: z.literal(true),
  origin: z.record(z.string(), z.any()).optional(),
};

/** Orçamento/simulação → grava na tabela `leads` (fluxo comercial existente). */
export const submitQuote = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        ...baseContact,
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
        cidade: z.string().trim().max(120).optional().or(z.literal("")),
        estado: z.string().trim().max(60).optional().or(z.literal("")),
        valor_conta: z.string().trim().max(60).optional().or(z.literal("")),
        mensagem: z.string().trim().max(2000).optional().or(z.literal("")),
        produto_interesse: z.string().trim().max(120).optional().or(z.literal("")),
        origem: z.string().trim().max(80),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true };
    guard("quote");
    const origin = normalizeOrigin(data.origin);
    const sb = publicClient();
    const { error } = await sb.from("leads").insert({
      nome: data.nome,
      telefone: data.telefone,
      email: data.email || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      valor_conta: data.valor_conta || null,
      mensagem: data.mensagem || null,
      produto_interesse: data.produto_interesse || null,
      origem: data.origem,
      utm_source: origin.utm_source ?? null,
      utm_medium: origin.utm_medium ?? null,
      utm_campaign: origin.utm_campaign ?? null,
      utm_term: origin.utm_term ?? null,
      utm_content: origin.utm_content ?? null,
      gclid: origin.gclid ?? null,
      fbclid: origin.fbclid ?? null,
      fbp: origin.fbp ?? null,
      fbc: origin.fbc ?? null,
      page_url: origin.page ?? origin.url ?? null,
      referrer: origin.referrer ?? null,
    });
    if (error) throw new Error("Não foi possível enviar sua solicitação agora. Tente novamente.");
    return { ok: true };
  });

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        ...baseContact,
        subject_type: z.string().trim().max(40),
        routed_to: z.string().trim().max(40).optional(),
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
        cidade: z.string().trim().max(120).optional().or(z.literal("")),
        mensagem: z.string().trim().max(3000).optional().or(z.literal("")),
        extra: z.record(z.string(), z.any()).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true };
    guard("contact");
    const sb = publicClient();
    const { error } = await sb.from("contact_messages").insert({
      subject_type: data.subject_type,
      routed_to: data.routed_to ?? null,
      name: data.nome,
      phone: data.telefone,
      email: data.email || null,
      city: data.cidade || null,
      message: data.mensagem || null,
      extra: data.extra ?? {},
      origin: normalizeOrigin(data.origin),
    });
    if (error) throw new Error("Não foi possível enviar sua mensagem agora. Tente novamente.");
    return { ok: true };
  });

export const submitPartner = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        ...baseContact,
        company: z.string().trim().max(160).optional().or(z.literal("")),
        cnpj: z.string().trim().max(30).optional().or(z.literal("")),
        cidade: z.string().trim().max(120).optional().or(z.literal("")),
        estado: z.string().trim().max(60).optional().or(z.literal("")),
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
        website: z.string().trim().max(200).optional().or(z.literal("")),
        partnership_type: z.string().trim().max(60).optional().or(z.literal("")),
        proposal: z.string().trim().max(3000).optional().or(z.literal("")),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true };
    guard("partner");
    const sb = publicClient();
    const { error } = await sb.from("partner_requests").insert({
      name: data.nome,
      phone: data.telefone,
      company: data.company || null,
      cnpj: data.cnpj || null,
      city: data.cidade || null,
      state: data.estado || null,
      email: data.email || null,
      website: data.website || null,
      partnership_type: data.partnership_type || null,
      proposal: data.proposal || null,
      origin: normalizeOrigin(data.origin),
    });
    if (error) throw new Error("Não foi possível enviar sua proposta agora. Tente novamente.");
    return { ok: true };
  });

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        name: z.string().trim().max(120).optional().or(z.literal("")),
        email: z.string().trim().email().max(160),
        consent: z.literal(true),
        hp: z.string().max(0).optional().or(z.literal("")),
        origin: z.record(z.string(), z.any()).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    if (data.hp) return { ok: true };
    guard("newsletter", 4);
    const sb = publicClient();
    const { error } = await sb.from("newsletter_subscribers").insert({
      name: data.name || null,
      email: data.email.toLowerCase(),
      consent: true,
      origin: normalizeOrigin(data.origin),
    });
    if (error && !`${error.message}`.includes("duplicate")) {
      throw new Error("Não foi possível concluir sua inscrição agora.");
    }
    return { ok: true };
  });
