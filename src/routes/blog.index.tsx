import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";
import { Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { listPosts } from "@/modules/site/public.functions";
import { formatDatePtBr } from "@/modules/site/site.shared";

export const postsQuery = { queryKey: ["site_posts"], queryFn: () => listPosts(), staleTime: 5 * 60_000 };

const TITLE = "Blog LZ7 Energia — conteúdo sobre energia solar";
const DESCRIPTION = "Artigos sobre energia solar, economia na conta de luz, tecnologia fotovoltaica e novidades do setor.";
const URL = "https://lz7energia.com.br/blog";

export const Route = createFileRoute("/blog/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(postsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(postsQuery);
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Conteúdo"
        title="Blog LZ7 Energia"
        subtitle="Tudo o que você precisa saber antes, durante e depois de instalar energia solar."
        breadcrumbs={[{ label: "Blog" }]}
      />
      <Section>
        {data.posts.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.posts.map((p) => (
              <Link
                key={p.id}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:shadow-lg"
              >
                {p.cover_url ? (
                  <img src={p.cover_url} alt={p.title} loading="lazy" className="h-44 w-full object-cover" />
                ) : (
                  <div className="h-44 w-full bg-navy-deep/90" />
                )}
                <div className="p-5">
                  <p className="text-xs text-muted-foreground">
                    {formatDatePtBr(p.published_at)}
                    {p.reading_minutes ? ` · ${p.reading_minutes} min de leitura` : ""}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-semibold">{p.title}</h2>
                  {p.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Ainda não há artigos publicados" description="Estamos preparando os primeiros conteúdos. Volte em breve." />
        )}
      </Section>
    </PublicLayout>
  );
}

