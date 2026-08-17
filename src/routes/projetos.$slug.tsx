import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { siteSettingsQueryOptions, useResolvedSiteSettings } from "@/lib/site-settings";
import { getProject } from "@/modules/site/public.functions";
import { PROJECT_CATEGORIES, formatDatePtBr } from "@/modules/site/site.shared";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { WhatsAppGate } from "@/components/site/whatsapp-gate";
import { WhatsAppIcon } from "@/components/site/icons";

const projectQuery = (slug: string) => ({
  queryKey: ["site_project", slug],
  queryFn: () => getProject({ data: { slug } }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/projetos/$slug")({
  loader: async ({ context, params }) => {
    const [, project] = await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(projectQuery(params.slug)),
    ]);
    if (!project) throw notFound();
    return { project };
  },
  head: ({ params, loaderData }) => {
    const project = loaderData?.project as Record<string, any> | undefined;
    if (!project) {
      return { meta: [{ title: "Projeto não encontrado — LZ7 Energia" }, { name: "robots", content: "noindex" }] };
    }
    const url = `https://lz7energia.com.br/projetos/${params.slug}`;
    const title = `${project.title} — Projeto LZ7 Energia`;
    const description = project.summary || `Projeto de energia solar realizado pela LZ7 Energia em ${project.city ?? "Paraná"}.`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (typeof project.cover_url === "string" && project.cover_url.startsWith("https://")) {
      meta.push({ property: "og:image", content: project.cover_url });
      meta.push({ name: "twitter:image", content: project.cover_url });
    }
    return { meta, links: [{ rel: "canonical", href: url }] };
  },
  notFoundComponent: ProjectNotFound,
  errorComponent: ProjectNotFound,
  component: ProjectPage,
});

function ProjectNotFound() {
  return (
    <PublicLayout>
      <PageHero
        title="Projeto não encontrado"
        subtitle="O projeto que você procura pode ter sido despublicado."
        breadcrumbs={[{ label: "Projetos", to: "/projetos" }, { label: "Não encontrado" }]}
      />
      <Section>
        <Link to="/projetos" className="font-semibold text-lzgreen-strong hover:underline">
          Ver todos os projetos
        </Link>
      </Section>
    </PublicLayout>
  );
}

function ProjectPage() {
  const { slug } = Route.useParams();
  const settings = useResolvedSiteSettings();
  const { data } = useSuspenseQuery(projectQuery(slug));
  if (!data) return <ProjectNotFound />;

  const gallery: string[] = Array.isArray(data.gallery) ? data.gallery.filter((g: any) => typeof g === "string") : [];
  const equipment: string[] = Array.isArray(data.equipment)
    ? data.equipment.map((e: any) => (typeof e === "string" ? e : e?.name ?? "")).filter(Boolean)
    : [];

  const facts = [
    data.power_kwp ? { label: "Potência", value: `${data.power_kwp} kWp` } : null,
    data.modules_count ? { label: "Módulos", value: String(data.modules_count) } : null,
    data.estimated_savings ? { label: "Economia estimada", value: String(data.estimated_savings) } : null,
    data.project_date ? { label: "Conclusão", value: formatDatePtBr(data.project_date) } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <PublicLayout>
      <PageHero
        eyebrow={PROJECT_CATEGORIES.find((c) => c.value === data.category)?.label ?? data.category}
        title={data.title}
        subtitle={[data.city, data.state].filter(Boolean).join(" - ")}
        breadcrumbs={[{ label: "Projetos", to: "/projetos" }, { label: data.title }]}
      />

      <Section>
        {data.cover_url ? (
          <img
            src={data.cover_url}
            alt={`Projeto ${data.title}`}
            className="mb-8 h-[320px] w-full rounded-2xl object-cover md:h-[440px]"
          />
        ) : null}

        {facts.length ? (
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="rounded-2xl border border-border bg-muted/30 p-5 text-center">
                <p className="font-display text-xl font-bold text-lzgreen-strong">{f.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            {data.challenge ? (
              <div>
                <h2 className="font-display text-xl font-bold">O desafio</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{data.challenge}</p>
              </div>
            ) : null}
            {data.solution ? (
              <div>
                <h2 className="font-display text-xl font-bold">A solução</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{data.solution}</p>
              </div>
            ) : null}
            {data.result ? (
              <div>
                <h2 className="font-display text-xl font-bold">O resultado</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{data.result}</p>
              </div>
            ) : null}
            {data.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{data.description}</p>
            ) : null}
          </div>

          <aside className="space-y-4">
            {equipment.length ? (
              <div className="rounded-2xl border border-border bg-white p-6">
                <h2 className="font-display text-lg font-bold">Equipamentos</h2>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {equipment.map((e) => (
                    <li key={e}>• {e}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="rounded-2xl bg-navy-deep p-6 text-white">
              <p className="font-display text-lg font-bold">Quer um projeto assim?</p>
              <p className="mt-1 text-sm text-white/70">Fale com um especialista e receba um estudo para o seu imóvel.</p>
              <WhatsAppGate
                whatsapp={settings.whatsapp}
                location="projeto_detalhe"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lzgreen px-6 py-3 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white"
              >
                Falar no WhatsApp <WhatsAppIcon className="h-4 w-4" />
              </WhatsAppGate>
            </div>
          </aside>
        </div>

        {gallery.length ? (
          <div className="mt-12">
            <h2 className="font-display text-xl font-bold">Galeria</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((g) => (
                <img key={g} src={g} alt={`Foto do projeto ${data.title}`} loading="lazy" className="h-56 w-full rounded-xl object-cover" />
              ))}
            </div>
          </div>
        ) : null}
      </Section>
    </PublicLayout>
  );
}
