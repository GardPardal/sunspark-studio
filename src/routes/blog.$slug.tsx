import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { getPost } from "@/modules/site/public.functions";
import { formatDatePtBr } from "@/modules/site/site.shared";
import { PublicLayout, PageHero, Section, FaqList } from "@/components/site/public-layout";
import { ArticleBody } from "@/components/site/blog-ui";
import { htmlToPlainText } from "@/lib/sanitize-html";

const postQuery = (slug: string) => ({
  queryKey: ["site_post", slug],
  queryFn: () => getPost({ data: { slug } }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    const [, data] = await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(postQuery(params.slug)),
    ]);
    if (!data) throw notFound();
    return { post: data.post as Record<string, any> };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return { meta: [{ title: "Artigo não encontrado — LZ7 Energia" }, { name: "robots", content: "noindex" }] };
    }
    const url = `https://lz7energia.com.br/blog/${params.slug}`;
    const plain = htmlToPlainText(String(post.content ?? ""));
    const description = String(post.excerpt || post.tldr || plain || `${post.title} — conteúdo da LZ7 Energia sobre energia solar.`)
      .slice(0, 158)
      .trim();
    const title = `${String(post.title).slice(0, 62)} | Blog LZ7 Energia`;
    const image = typeof post.cover_url === "string" && post.cover_url.startsWith("https://") ? post.cover_url : null;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "author", content: "LZ7 Energia" },
      { property: "og:site_name", content: "LZ7 Energia" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:title", content: String(post.title) },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "article:published_time", content: String(post.published_at ?? "") },
      { property: "article:modified_time", content: String(post.updated_at ?? post.published_at ?? "") },
      { property: "article:section", content: "Energia" },
      { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: String(post.title) },
      { name: "twitter:description", content: description },
    ];
    if (Array.isArray(post.tags) && post.tags.length) {
      meta.push({ name: "keywords", content: post.tags.slice(0, 12).join(", ") });
    }
    if (image) {
      meta.push({ property: "og:image", content: image });
      meta.push({ name: "twitter:image", content: image });
      meta.push({ property: "og:image:alt", content: String(post.title) });
    }
    const faqs = Array.isArray(post.faqs)
      ? post.faqs
          .map((f: any) => ({ q: String(f?.q ?? f?.question ?? ""), a: String(f?.a ?? f?.answer ?? "") }))
          .filter((f: any) => f.q && f.a)
      : [];
    const graph: Array<Record<string, any>> = [
      {
        "@type": "NewsArticle",
        headline: String(post.title).slice(0, 110),
        description,
        image: image ? [image] : undefined,
        datePublished: post.published_at,
        dateModified: post.updated_at ?? post.published_at,
        inLanguage: "pt-BR",
        wordCount: plain ? plain.split(/\s+/).length : undefined,
        author: { "@type": "Organization", name: "LZ7 Energia", url: "https://lz7energia.com.br" },
        publisher: {
          "@type": "Organization",
          name: "LZ7 Energia",
          url: "https://lz7energia.com.br",
          logo: { "@type": "ImageObject", url: "https://lz7energia.com.br/favicon.ico" },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: "https://lz7energia.com.br/" },
          { "@type": "ListItem", position: 2, name: "Blog", item: "https://lz7energia.com.br/blog" },
          { "@type": "ListItem", position: 3, name: String(post.title), item: url },
        ],
      },
    ];
    if (faqs.length) {
      graph.push({
        "@type": "FAQPage",
        mainEntity: faqs.map((f: any) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
        },
      ],
    };
  },

  notFoundComponent: PostNotFound,
  errorComponent: PostNotFound,
  component: PostPage,
});

function PostNotFound() {
  return (
    <PublicLayout>
      <PageHero title="Artigo não encontrado" breadcrumbs={[{ label: "Blog", to: "/blog" }, { label: "Não encontrado" }]} />
      <Section>
        <Link to="/blog" className="font-semibold text-lzgreen-strong hover:underline">
          Ver todos os artigos
        </Link>
      </Section>
    </PublicLayout>
  );
}

function PostPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(postQuery(slug));
  if (!data) return <PostNotFound />;
  const { post, author, category, related } = data as Record<string, any>;
  const faqs = Array.isArray(post.faqs)
    ? post.faqs.map((f: any) => ({ q: f?.q ?? f?.question ?? "", a: f?.a ?? f?.answer ?? "" })).filter((f: any) => f.q && f.a)
    : [];

  return (
    <PublicLayout>
      <PageHero
        eyebrow={category?.name ?? "Blog"}
        title={post.title}
        subtitle={post.subtitle ?? post.excerpt ?? undefined}
        breadcrumbs={[{ label: "Blog", to: "/blog" }, { label: post.title }]}
      />
      <Section>
        <article className="mx-auto max-w-3xl">
          <p className="text-xs text-muted-foreground">
            {formatDatePtBr(post.published_at)}
            {post.reading_minutes ? ` · ${post.reading_minutes} min de leitura` : ""}
            {author?.name ? ` · por ${author.name}` : ""}
          </p>
          {post.cover_url ? (
            <img src={post.cover_url} alt={post.title} className="mt-6 aspect-[16/9] w-full rounded-2xl object-cover" />
          ) : null}
          {post.tldr ? (
            <div className="mt-8 rounded-2xl border-l-4 border-lzgreen bg-muted/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-lzgreen-strong">Resumo rápido</p>
              <p className="mt-1 text-base leading-relaxed text-foreground">{post.tldr}</p>
            </div>
          ) : null}
          <div className="mt-8">
            <ArticleBody content={String(post.content ?? "")} />
          </div>
          {faqs.length ? (
            <div className="mt-10">
              <h2 className="mb-4 font-display text-xl font-bold">Perguntas frequentes</h2>
              <FaqList faqs={faqs} />
            </div>
          ) : null}
        </article>
      </Section>

      {related?.length ? (
        <Section tone="muted" title="Leia também">
          <div className="grid gap-5 sm:grid-cols-3">
            {related.map((r: any) => (
              <Link
                key={r.id}
                to="/blog/$slug"
                params={{ slug: r.slug }}
                className="rounded-2xl border border-border bg-white p-5 transition hover:shadow-md"
              >
                <p className="text-xs text-muted-foreground">{formatDatePtBr(r.published_at)}</p>
                <p className="mt-1 font-display text-base font-semibold">{r.title}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </PublicLayout>
  );
}
