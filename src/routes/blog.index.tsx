import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, EmptyState } from "@/components/site/public-layout";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listPosts } from "@/modules/site/public.functions";
import { BlogHero, BlogCard, BlogSidebar, type BlogPost, type BlogCategory } from "@/components/site/blog-ui";
import { DsSkeleton } from "@/components/ds/skeleton";

const PAGE_SIZE = 9;

export const postsQuery = { queryKey: ["site_posts"], queryFn: () => listPosts(), staleTime: 5 * 60_000 };

const TITLE = "Blog LZ7 Energia — energia que move o futuro";
const DESCRIPTION =
  "Análises sobre energia solar, regulação, conta de luz e mercado de energia no Brasil, pela redação da LZ7 Energia.";
const URL = "https://lz7energia.com.br/blog";

export const Route = createFileRoute("/blog/")({
  loader: async ({ context }) => {
    const [, data] = await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(postsQuery),
    ]);
    return { posts: ((data as any)?.posts ?? []).slice(0, 20) as Array<Record<string, any>> };
  },
  head: ({ loaderData }) => {
    const posts = ((loaderData as any)?.posts ?? []) as Array<Record<string, any>>;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { property: "og:site_name", content: "LZ7 Energia" },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: URL },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
      ],
      links: [{ rel: "canonical", href: URL }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Blog",
                "@id": URL,
                name: "Blog LZ7 Energia",
                description: DESCRIPTION,
                inLanguage: "pt-BR",
                publisher: { "@type": "Organization", name: "LZ7 Energia", url: "https://lz7energia.com.br" },
              },
              {
                "@type": "ItemList",
                itemListElement: posts.slice(0, 20).map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  url: `https://lz7energia.com.br/blog/${p.slug}`,
                  name: p.title,
                })),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: "https://lz7energia.com.br/" },
                  { "@type": "ListItem", position: 2, name: "Blog", item: URL },
                ],
              },
            ],
          }),
        },
      ],
    };
  },

  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(postsQuery);
  const [cat, setCat] = useState<string | null>(null);

  const posts = (data.posts ?? []) as BlogPost[];
  const categories = (data.categories ?? []) as BlogCategory[];
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const p of posts) if (p.category_id) acc[p.category_id] = (acc[p.category_id] ?? 0) + 1;
    return acc;
  }, [posts]);

  const filtered = useMemo(
    () => (cat ? posts.filter((p) => (p.category_id ? catById[p.category_id]?.slug === cat : false)) : posts),
    [posts, cat, catById],
  );

  const maisLidos = useMemo(() => [...posts].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5), [posts]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => setVisible(PAGE_SIZE), [cat]);

  const featured = cat ? null : (filtered[0] ?? null);
  const fullGrid = (featured ? filtered.slice(1) : filtered) as BlogPost[];
  const grid = fullGrid.slice(0, visible);
  const hasMore = visible < fullGrid.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible((v) => v + PAGE_SIZE);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, fullGrid.length]);

  if (!posts.length) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-[1320px] px-4 py-16 md:px-8">
          <EmptyState title="Ainda não há artigos publicados" description="Estamos preparando os primeiros conteúdos. Volte em breve." />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      {featured ? (
        <BlogHero post={featured} categoryName={featured.category_id ? catById[featured.category_id]?.name : undefined} />
      ) : (
        <section className="bg-navy-deep text-white">
          <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8">
            <h1 className="font-display text-3xl font-bold md:text-5xl">Energia que move o futuro</h1>
            <p className="mt-3 text-white/70">{categories.find((c) => c.slug === cat)?.name ?? "Todos os conteúdos"}</p>
          </div>
        </section>
      )}

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-12 md:px-8 md:py-16 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide md:text-2xl">
                {cat ? categories.find((c) => c.slug === cat)?.name : "Últimas notícias"}
              </h2>
              {cat ? (
                <button type="button" onClick={() => setCat(null)} className="text-sm font-semibold text-lzgreen-strong hover:underline">
                  Limpar filtro
                </button>
              ) : null}
            </div>
            {grid.length ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2">
                  {grid.map((p) => (
                    <BlogCard key={p.id} post={p} categoryName={p.category_id ? catById[p.category_id]?.name : undefined} />
                  ))}
                </div>

                <div ref={sentinel} aria-hidden className="h-1 w-full" />

                {hasMore ? (
                  <div className="mt-6 grid gap-6 sm:grid-cols-2" aria-hidden>
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="overflow-hidden rounded-2xl border border-border">
                        <DsSkeleton variant="block" className="aspect-[16/10] h-auto w-full rounded-none" />
                        <div className="space-y-3 p-5">
                          <DsSkeleton variant="text" className="w-24" />
                          <DsSkeleton variant="line" className="w-4/5" />
                          <DsSkeleton variant="text" />
                          <DsSkeleton variant="text" className="w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-10 text-center text-sm text-muted-foreground">
                    Você chegou ao fim por agora — novas matérias entram todos os dias.
                  </p>
                )}
              </>
            ) : (
              <EmptyState title="Nenhum artigo nesta categoria" description="Escolha outra categoria para continuar lendo." />
            )}
          </div>

          <BlogSidebar
            maisLidos={maisLidos}
            categories={categories}
            activeCategory={cat}
            onSelectCategory={setCat}
            counts={counts}
          />
        </div>
      </section>
    </PublicLayout>
  );
}
