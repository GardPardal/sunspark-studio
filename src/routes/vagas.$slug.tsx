import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { getJob } from "@/modules/site/public.functions";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { ResumeForm, rhQuestionsQuery } from "@/components/site/resume-form";
import { ShareBar } from "@/components/site/share-bar";

const BASE = "https://lz7energia.com.br";

export const Route = createFileRoute("/vagas/$slug")({
  loader: async ({ context, params }) => {
    const [job] = await Promise.all([
      getJob({ data: { slug: params.slug } }),
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(rhQuestionsQuery),
    ]);
    if (!job || job.status === "rascunho") throw notFound();
    return { job };
  },
  head: ({ loaderData }) => {
    const job = loaderData?.job as Record<string, any> | undefined;
    const title = job ? `${job.title} — vaga na LZ7 Energia` : "Vaga — LZ7 Energia";
    const local = [job?.city, job?.state].filter(Boolean).join("/");
    const description = job
      ? `${job.title}${local ? ` em ${local}` : ""}${job.work_model ? ` · ${job.work_model}` : ""}. Candidate-se em poucos minutos e envie seu currículo.`
      : "Vagas abertas na LZ7 Energia.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `${BASE}/vagas/${job?.slug ?? ""}` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `${BASE}/vagas/${job?.slug ?? ""}` }],
    };
  },
  errorComponent: () => (
    <PublicLayout>
      <Section>
        <p className="text-muted-foreground">Não foi possível carregar esta vaga agora.</p>
      </Section>
    </PublicLayout>
  ),
  notFoundComponent: () => (
    <PublicLayout>
      <Section title="Vaga não encontrada">
        <p className="text-muted-foreground">
          Esta vaga saiu do ar.{" "}
          <Link
            to="/trabalhe-conosco"
            className="font-semibold text-lzgreen-strong hover:underline"
          >
            Ver vagas abertas
          </Link>
          .
        </p>
      </Section>
    </PublicLayout>
  ),
  component: Page,
});

function Block({ title, body }: { title: string; body?: string | null }) {
  if (!body?.trim()) return null;
  return (
    <div className="mt-6">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
        {body}
      </div>
    </div>
  );
}

function Page() {
  const { job } = Route.useLoaderData();
  const open = job.status === "aberta";
  const url = `${BASE}/vagas/${job.slug}`;
  const facts = [
    job.department,
    [job.city, job.state].filter(Boolean).join(" - "),
    job.work_model,
    job.contract_type,
    job.schedule,
  ].filter(Boolean) as string[];

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Vaga aberta"
        title={job.title}
        subtitle={facts.join(" · ")}
        breadcrumbs={[{ label: "Trabalhe conosco", to: "/trabalhe-conosco" }, { label: job.title }]}
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  open
                    ? "bg-lzgreen/15 text-lzgreen-strong"
                    : job.status === "pausada"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {open
                  ? "Recebendo candidaturas"
                  : job.status === "pausada"
                    ? "Processo pausado"
                    : "Processo encerrado"}
              </span>
              {facts.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
                >
                  {f}
                </span>
              ))}
            </div>

            <Block title="Sobre a vaga" body={job.description} />
            <Block title="Responsabilidades" body={job.responsibilities} />
            <Block title="Requisitos" body={job.requirements} />
            <Block title="Diferenciais" body={job.differentials} />
            <Block title="Benefícios" body={job.benefits} />

            <div className="mt-8">
              <ShareBar url={url} title={`Vaga: ${job.title} — LZ7 Energia`} />
            </div>
          </div>

          <aside id="candidatura" className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              {open ? (
                <>
                  <h2 className="font-display text-xl font-bold">Candidatar-se</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Leva poucos minutos. Não é preciso criar conta.
                  </p>
                  <div className="mt-5">
                    <ResumeForm job={job} />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-bold">
                    {job.status === "pausada" ? "Processo pausado" : "Processo encerrado"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Esta vaga não está recebendo candidaturas agora. Cadastre seu currículo no banco
                    de talentos e avisaremos quando abrir uma oportunidade parecida.
                  </p>
                  <Link
                    to="/cadastrar-curriculo"
                    className="mt-4 inline-flex rounded-xl bg-navy-deep px-5 py-3 text-sm font-semibold text-white"
                  >
                    Cadastrar currículo
                  </Link>
                </>
              )}
            </div>
          </aside>
        </div>
      </Section>
    </PublicLayout>
  );
}
