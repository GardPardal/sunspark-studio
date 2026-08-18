import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { publicClient } from "@/modules/site/site.server";
import { CIDADES } from "@/lib/local-seo";

const BASE_URL = "https://lz7energia.com.br";

const STATIC_ROUTES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
  { path: "/quiz", changefreq: "monthly", priority: "0.9" },
  { path: "/energia-solar-residencial", changefreq: "monthly", priority: "0.8" },
  { path: "/energia-solar-comercial", changefreq: "monthly", priority: "0.8" },
  { path: "/energia-solar-industrial", changefreq: "monthly", priority: "0.8" },
  { path: "/carport-solar", changefreq: "monthly", priority: "0.7" },
  { path: "/sistemas-hibridos", changefreq: "monthly", priority: "0.7" },
  { path: "/projetos", changefreq: "weekly", priority: "0.7" },
  { path: "/sobre", changefreq: "monthly", priority: "0.6" },
  { path: "/unidades", changefreq: "monthly", priority: "0.6" },
  { path: "/energia-solar", changefreq: "weekly", priority: "0.9" },
  ...CIDADES.map((c) => ({ path: `/energia-solar/${c.slug}`, changefreq: "monthly", priority: "0.8" })),
  { path: "/contato", changefreq: "monthly", priority: "0.6" },
  { path: "/seja-um-parceiro", changefreq: "monthly", priority: "0.5" },
  { path: "/trabalhe-conosco", changefreq: "weekly", priority: "0.5" },
  { path: "/politica-de-privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos-de-uso", changefreq: "yearly", priority: "0.3" },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Array<{
          path: string;
          changefreq: string;
          priority: string;
          lastmod?: string;
        }> = STATIC_ROUTES.map((r) => ({ ...r }));

        try {
          const sb = publicClient();
          const nowIso = new Date().toISOString();
          const [{ data: posts }, { data: projects }] = await Promise.all([
            sb
              .from("site_posts")
              .select("slug,published_at,updated_at")
              .eq("status", "publicado")
              .lte("published_at", nowIso)
              .order("published_at", { ascending: false })
              .limit(1000),
            sb.from("site_projects").select("slug,updated_at").eq("published", true).limit(500),
          ]);
          for (const p of posts ?? []) {
            entries.push({
              path: `/blog/${p.slug}`,
              changefreq: "monthly",
              priority: "0.7",
              lastmod: (p.updated_at ?? p.published_at)
                ? String(p.updated_at ?? p.published_at).slice(0, 10)
                : undefined,
            });
          }
          for (const p of projects ?? []) {
            entries.push({
              path: `/projetos/${p.slug}`,
              changefreq: "monthly",
              priority: "0.6",
              lastmod: p.updated_at ? String(p.updated_at).slice(0, 10) : undefined,
            });
          }
        } catch {
          // sitemap continua válido apenas com as rotas estáticas
        }

        const urls = entries
          .map(
            (e) =>
              `  <url>\n    <loc>${esc(BASE_URL + e.path)}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ""}    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          )
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=1800" },
        });
      },
    },
  },
});
