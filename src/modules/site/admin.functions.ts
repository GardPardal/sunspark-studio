import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tabelas do CMS gerenciáveis pelo painel. A RLS já restringe a admin/coordenador. */
export const CMS_TABLES = [
  "site_pages",
  "site_solutions",
  "site_projects",
  "site_posts",
  "site_categories",
  "site_authors",
  "site_jobs",
  "site_rh_questions",
  "site_units",
  "site_timeline",
  "site_stats",
] as const;
export type CmsTable = (typeof CMS_TABLES)[number];

export const INBOX_TABLES = [
  "job_applications",
  "partner_requests",
  "contact_messages",
  "newsletter_subscribers",
] as const;
export type InboxTable = (typeof INBOX_TABLES)[number];

const assertCms = (t: string): CmsTable => {
  if (!(CMS_TABLES as readonly string[]).includes(t)) throw new Error("Recurso inválido.");
  return t as CmsTable;
};
const assertInbox = (t: string): InboxTable => {
  if (!(INBOX_TABLES as readonly string[]).includes(t)) throw new Error("Recurso inválido.");
  return t as InboxTable;
};

const ORDER: Record<string, { column: string; ascending: boolean }> = {
  site_pages: { column: "slug", ascending: true },
  site_solutions: { column: "ordem", ascending: true },
  site_projects: { column: "created_at", ascending: false },
  site_posts: { column: "created_at", ascending: false },
  site_categories: { column: "ordem", ascending: true },
  site_authors: { column: "name", ascending: true },
  site_jobs: { column: "created_at", ascending: false },
  site_units: { column: "ordem", ascending: true },
  site_timeline: { column: "ordem", ascending: true },
  site_stats: { column: "ordem", ascending: true },
};

export const cmsList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string }) => ({ table: assertCms(d.table) }))
  .handler(async ({ data, context }) => {
    const ord = ORDER[data.table] ?? { column: "created_at", ascending: false };
    const { data: rows, error } = await context.supabase
      .from(data.table)
      .select("*")
      .order(ord.column, { ascending: ord.ascending })
      .limit(500);
    if (error) throw new Error("Não foi possível carregar os registros.");
    return (rows ?? []) as Array<Record<string, any>>;
  });

export const cmsSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string; id?: string | null; values: Record<string, any> }) => ({
    table: assertCms(d.table),
    id: d.id ?? null,
    values: d.values ?? {},
  }))
  .handler(async ({ data, context }) => {
    const values = { ...data.values };
    delete values.id;
    delete values.created_at;
    delete values.updated_at;
    if (data.id) {
      const { error } = await context.supabase.from(data.table).update(values as never).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from(data.table)
      .insert(values as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: (row as any)?.id as string };
  });

export const cmsDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string; id: string }) => ({ table: assertCms(d.table), id: String(d.id) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const inboxList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string }) => ({ table: assertInbox(d.table) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from(data.table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("Não foi possível carregar os envios.");
    return (rows ?? []) as Array<Record<string, any>>;
  });

export const inboxUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { table: string; id: string; values: Record<string, any> }) => ({
    table: assertInbox(d.table),
    id: String(d.id),
    values: d.values ?? {},
  }))
  .handler(async ({ data, context }) => {
    const allowed = ["status", "internal_notes"];
    const values: Record<string, any> = {};
    for (const k of allowed) if (k in data.values) values[k] = data.values[k];
    if (!Object.keys(values).length) return { ok: true };
    const { error } = await context.supabase.from(data.table).update(values as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** URL assinada de currículo (bucket privado) — apenas para quem passa na RLS de RH/Admin. */
export const resumeSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => ({ path: String(d.path) }))
  .handler(async ({ data, context }) => {
    const { data: app, error: appErr } = await context.supabase
      .from("job_applications")
      .select("id")
      .eq("resume_path", data.path)
      .maybeSingle();
    if (appErr || !app) throw new Error("Currículo não encontrado ou sem permissão.");
    const { data: signed, error } = await context.supabase.storage
      .from("resumes")
      .createSignedUrl(data.path, 300);
    if (error || !signed) throw new Error("Não foi possível gerar o link do currículo.");
    return { url: signed.signedUrl };
  });

export const siteOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const count = async (table: any, filter?: (q: any) => any) => {
      let q = (context.supabase as any).from(table).select("id", { count: "exact", head: true });
      if (filter) q = filter(q);
      const { count: c } = await q;
      return c ?? 0;
    };
    const [posts, publishedPosts, projects, jobs, openJobs, apps, partners, contacts, news] =
      await Promise.all([
        count("site_posts"),
        count("site_posts", (q) => q.eq("status", "publicado")),
        count("site_projects", (q) => q.eq("published", true)),
        count("site_jobs"),
        count("site_jobs", (q) => q.eq("status", "aberta")),
        count("job_applications", (q) => q.eq("status", "novo")),
        count("partner_requests", (q) => q.eq("status", "novo")),
        count("contact_messages", (q) => q.eq("status", "novo")),
        count("newsletter_subscribers", (q) => q.eq("status", "ativo")),
      ]);
    return { posts, publishedPosts, projects, jobs, openJobs, apps, partners, contacts, news };
  });
