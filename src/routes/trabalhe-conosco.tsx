import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { listJobs } from "@/modules/site/public.functions";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";
import { ResumeForm, rhQuestionsQuery } from "@/components/site/resume-form";

const TITLE = "Trabalhe conosco — vagas na LZ7 Energia";
const DESCRIPTION =
  "Veja as vagas abertas na LZ7 Energia e cadastre seu currículo no nosso banco de talentos.";
const URL = "https://lz7energia.com.br/trabalhe-conosco";

const jobsQuery = { queryKey: ["site_jobs"], queryFn: () => listJobs(), staleTime: 5 * 60_000 };

export const Route = createFileRoute("/trabalhe-conosco")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(jobsQuery),
      context.queryClient.ensureQueryData(rhQuestionsQuery),
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
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const [tab, setTab] = useState<"vagas" | "curriculo">("vagas");
  const [selected, setSelected] = useState<Record<string, any> | null>(null);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Carreiras"
        title="Trabalhe conosco"
        subtitle="Faça parte de um time que leva energia limpa para milhares de famílias e empresas."
        breadcrumbs={[{ label: "Trabalhe conosco" }]}
      />

      <div className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1320px] gap-2 px-4 py-4 md:px-8">
          <TabButton active={tab === "vagas"} onClick={() => setTab("vagas")}>
            Vagas abertas {jobs.length ? `(${jobs.length})` : ""}
          </TabButton>
          <TabButton
            active={tab === "curriculo"}
            onClick={() => {
              setSelected(null);
              setTab("curriculo");
            }}
          >
            Cadastrar currículo
          </TabButton>
        </div>
      </div>

      {tab === "vagas" ? (
        <>
          <Section title="Vagas abertas">
            {jobs.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {jobs.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => {
                      setSelected(j);
                      setTimeout(
                        () => document.getElementById("candidatura")?.scrollIntoView({ behavior: "smooth" }),
                        30,
                      );
                    }}
                    className={`rounded-2xl border p-6 text-left transition ${
                      selected?.id === j.id
                        ? "border-lzgreen bg-lzgreen/5"
                        : "border-border bg-white hover:shadow-md"
                    }`}
                  >
                    <h3 className="font-display text-lg font-semibold">{j.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[j.department, [j.city, j.state].filter(Boolean).join(" - "), j.work_model, j.contract_type]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {j.status === "pausada" ? (
                      <p className="mt-2 text-xs font-semibold uppercase text-amber-600">Processo pausado</p>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nenhuma vaga aberta no momento"
                description="Cadastre seu currículo no banco de talentos e avisaremos quando surgir uma oportunidade."
              />
            )}
            <p className="mt-6 text-sm text-muted-foreground">
              Não encontrou a vaga ideal?{" "}
              <Link to="/cadastrar-curriculo" className="font-semibold text-lzgreen-strong hover:underline">
                Cadastre seu currículo no banco de talentos
              </Link>
              .
            </p>
          </Section>

          <Section tone="muted" id="candidatura">
            <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="font-display text-xl font-bold">
                {selected ? `Candidatar-se: ${selected.title}` : "Cadastrar currículo"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected
                  ? "Preencha seus dados, responda as perguntas e anexe seu currículo."
                  : "Selecione uma vaga acima ou envie seu currículo para o banco de talentos."}
              </p>
              {selected ? (
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="mt-2 text-xs font-semibold text-lzgreen-strong hover:underline"
                >
                  Cadastrar no banco de talentos
                </button>
              ) : null}
              <div className="mt-5">
                <ResumeForm key={selected?.id ?? "talentos"} job={selected} />
              </div>
            </div>
          </Section>
        </>
      ) : (
        <Section tone="muted">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold">Banco de talentos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Responda as perguntas do nosso time de gente e gestão e anexe seu currículo.
            </p>
            <div className="mt-5">
              <ResumeForm job={null} />
            </div>
          </div>
        </Section>
      )}
    </PublicLayout>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-navy-deep text-white"
          : "border border-border bg-white text-foreground hover:border-lzgreen"
      }`}
    >
      {children}
    </button>
  );
}
