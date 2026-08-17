import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { listProjects } from "@/modules/site/public.functions";
import { PROJECT_CATEGORIES } from "@/modules/site/site.shared";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";

const TITLE = "Projetos de energia solar realizados | LZ7 Energia";
const DESCRIPTION =
  "Conheça usinas fotovoltaicas residenciais, comerciais, rurais e industriais instaladas pela LZ7 Energia no Paraná e em São Paulo.";
const URL = "https://lz7energia.com.br/projetos";

export const projectsQuery = {
  queryKey: ["site_projects"],
  queryFn: () => listProjects(),
  staleTime: 5 * 60_000,
};

export const Route = createFileRoute("/projetos/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(projectsQuery),
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
  component: ProjetosPage,
});

function ProjetosPage() {
  const { data: projects } = useSuspenseQuery(projectsQuery);
  const [cat, setCat] = useState<string>("todos");

  const list = cat === "todos" ? projects : projects.filter((p) => p.category === cat);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Portfólio"
        title="Projetos que já estão gerando economia"
        subtitle="Usinas instaladas pela nossa equipe em residências, comércios, indústrias e áreas rurais."
        breadcrumbs={[{ label: "Projetos" }]}
      />

      <Section>
        <div className="mb-8 flex flex-wrap gap-2">
          {[{ value: "todos", label: "Todos" }, ...PROJECT_CATEGORIES].map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCat(c.value)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                cat === c.value
                  ? "border-lzgreen bg-lzgreen/10 text-lzgreen-strong"
                  : "border-border text-muted-foreground hover:border-lzgreen/50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {list.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <Link
                key={p.id}
                to="/projetos/$slug"
                params={{ slug: p.slug }}
                className="group overflow-hidden rounded-2xl border border-border bg-white transition hover:shadow-lg"
              >
                {p.cover_url ? (
                  <img
                    src={p.cover_url}
                    alt={`Projeto ${p.title}`}
                    loading="lazy"
                    className="h-48 w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="h-48 w-full bg-navy-deep/90" />
                )}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-lzgreen-strong">
                    {PROJECT_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-semibold">{p.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[p.city, p.state].filter(Boolean).join(" - ")}
                    {p.power_kwp ? ` · ${p.power_kwp} kWp` : ""}
                  </p>
                  {p.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Ainda não há projetos publicados nesta categoria"
            description="Fale com a gente no WhatsApp para ver cases parecidos com o seu."
          />
        )}
      </Section>
    </PublicLayout>
  );
}
