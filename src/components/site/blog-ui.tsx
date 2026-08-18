import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { formatDatePtBr } from "@/modules/site/site.shared";
import { sanitizeArticleHtml, looksLikeHtml, enhanceArticleMedia, extractSourceUrl, upscaleImageUrl } from "@/lib/sanitize-html";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt?: string | null;
  cover_url?: string | null;
  category_id?: string | null;
  published_at?: string | null;
  reading_minutes?: number | null;
  views?: number | null;
};

export type BlogCategory = { id: string; slug: string; name: string };

function Cover({ src, alt, className, priority }: { src?: string | null; alt: string; className?: string; priority?: boolean }) {
  if (src) {
    return (
      <img
        src={upscaleImageUrl(src)}
        alt={alt}
        width={1200}
        height={750}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
        className={className ?? "h-full w-full object-cover"}
      />
    );
  }
  return (
    <div
      className={`${className ?? "h-full w-full"} bg-navy-deep`}
      style={{ backgroundImage: "radial-gradient(circle at 30% 20%, color-mix(in oklab, var(--lz-green) 35%, transparent), transparent 60%)" }}
      aria-hidden="true"
    />
  );
}

function Meta({ post }: { post: BlogPost }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>{formatDatePtBr(post.published_at ?? null)}</span>
      {post.reading_minutes ? (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {post.reading_minutes} min
        </span>
      ) : null}
    </p>
  );
}

/** Destaque grande do topo do blog. */
export function BlogHero({ post, categoryName }: { post: BlogPost; categoryName?: string }) {
  return (
    <section className="bg-navy-deep text-white">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-12 md:grid-cols-[1.05fr_1fr] md:items-center md:px-8 md:py-16">
        <div className="min-w-0">
          <p className="mb-4 inline-flex rounded-full border border-lzgreen/40 bg-lzgreen/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lzgreen">
            {categoryName ?? "Em destaque"}
          </p>
          <h1 className="font-display text-3xl font-bold leading-[1.1] md:text-5xl">Energia que move o futuro</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
            Análises, regulação e prática do setor elétrico brasileiro — pela redação da LZ7 Energia.
          </p>
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 md:p-6">
            <Link to="/blog/$slug" params={{ slug: post.slug }} className="group block">
              <h2 className="font-display text-xl font-semibold leading-snug transition group-hover:text-lzgreen md:text-2xl">
                {post.title}
              </h2>
              {post.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-white/65">{post.excerpt}</p> : null}
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-lzgreen">
                Ler matéria
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
        <Link
          to="/blog/$slug"
          params={{ slug: post.slug }}
          className="block overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
        >
          <Cover src={post.cover_url} alt={post.title} priority className="aspect-[4/3] w-full object-cover" />
        </Link>
      </div>
    </section>
  );
}

/** Card padrão do grid de notícias. */
export function BlogCard({ post, categoryName }: { post: BlogPost; categoryName?: string }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="aspect-[16/10] w-full overflow-hidden">
        <Cover src={post.cover_url} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {categoryName ? (
          <span className="w-fit rounded-full bg-lzgreen/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-lzgreen-strong">
            {categoryName}
          </span>
        ) : null}
        <h3 className="font-display text-lg font-semibold leading-snug transition group-hover:text-lzgreen-strong">{post.title}</h3>
        {post.excerpt ? <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p> : null}
        <div className="mt-auto pt-3">
          <Meta post={post} />
        </div>
      </div>
    </Link>
  );
}

/** Barra lateral: mais lidos + categorias + CTA. */
export function BlogSidebar({
  maisLidos,
  categories,
  activeCategory,
  onSelectCategory,
  counts,
}: {
  maisLidos: BlogPost[];
  categories: BlogCategory[];
  activeCategory: string | null;
  onSelectCategory: (slug: string | null) => void;
  counts: Record<string, number>;
}) {
  return (
    <aside className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wide">Mais lidos</h2>
        <ol className="mt-4 space-y-4">
          {maisLidos.map((p, i) => (
            <li key={p.id} className="flex gap-3">
              <span className="font-display text-lg font-bold text-lzgreen">{String(i + 1).padStart(2, "0")}</span>
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="min-w-0 text-sm font-medium leading-snug transition hover:text-lzgreen-strong"
              >
                {p.title}
              </Link>
            </li>
          ))}
          {maisLidos.length === 0 ? <li className="text-sm text-muted-foreground">Em breve.</li> : null}
        </ol>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-base font-bold uppercase tracking-wide">Categorias</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeCategory === null ? "border-lzgreen bg-lzgreen/12 text-lzgreen-strong" : "border-border text-muted-foreground hover:border-lzgreen/50"
            }`}
          >
            Todas
          </button>
          {categories
            .filter((c) => (counts[c.id] ?? 0) > 0)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCategory(c.slug)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeCategory === c.slug
                    ? "border-lzgreen bg-lzgreen/12 text-lzgreen-strong"
                    : "border-border text-muted-foreground hover:border-lzgreen/50"
                }`}
              >
                {c.name} <span className="opacity-60">{counts[c.id] ?? 0}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="rounded-2xl bg-navy-deep p-6 text-white">
        <h2 className="font-display text-lg font-bold leading-snug">Quer saber quanto você economizaria?</h2>
        <p className="mt-2 text-sm text-white/70">Faça a simulação em 2 minutos e receba uma análise da sua conta de luz.</p>
        <Link
          to="/quiz"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lzgreen px-4 py-2.5 text-sm font-semibold text-navy-deep transition hover:brightness-110"
        >
          Simular economia
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}

/** Renderiza o corpo do artigo: HTML sanitizado (Radar Editorial) ou texto simples. */
export function ArticleBody({ content }: { content: string }) {
  const raw = String(content ?? "");

  if (looksLikeHtml(raw)) {
    const safe = sanitizeArticleHtml(raw);
    return (
      <div
        className="article-body space-y-5 text-base leading-[1.8] text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: enhanceArticleMedia(safe, extractSourceUrl(safe)) }}
      />
    );
  }

  const blocks: Array<{ type: "h2" | "p" | "ul"; text?: string; items?: string[] }> = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push({ type: "ul", items: list });
      list = [];
    }
  };
  for (const line0 of raw.split(/\n+/)) {
    const line = line0.trim();
    if (!line) continue;
    if (/^[-•*]\s+/.test(line)) {
      list.push(line.replace(/^[-•*]\s+/, ""));
      continue;
    }
    flush();
    if (/^#{2,3}\s+/.test(line)) blocks.push({ type: "h2", text: line.replace(/^#{2,3}\s+/, "") });
    else blocks.push({ type: "p", text: line.replace(/\*\*/g, "") });
  }
  flush();

  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        if (b.type === "h2")
          return (
            <h2 key={i} className="pt-4 font-display text-xl font-bold text-foreground md:text-2xl">
              {b.text}
            </h2>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="space-y-2 pl-1">
              {b.items!.map((it, j) => (
                <li key={j} className="flex gap-3 text-base leading-relaxed text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-lzgreen" aria-hidden="true" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="text-base leading-[1.8] text-muted-foreground">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

