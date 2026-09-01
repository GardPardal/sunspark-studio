import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Sparkles,
  TrendingUp,
  Leaf,
  Award,
  ArrowRight,
  MapPin,
  Building2,
  Clock,
  CheckCircle2,
  Users,
} from "lucide-react";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { listJobs } from "@/modules/site/public.functions";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { rhQuestionsQuery } from "@/components/site/resume-form";

const TITLE = "Trabalhe conosco — Vagas e Banco de Talentos na LZ7 Energia";
const DESCRIPTION =
  "Venha transformar o futuro da energia solar com a LZ7 Energia. Confira nossas vagas abertas ou cadastre seu currículo no banco de talentos.";
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

const CULTURE_PILLARS = [
  {
    icon: TrendingUp,
    title: "Crescimento Acelerado",
    description:
      "Faça parte de uma das empresas de energia solar que mais cresce no sul do país, com oportunidades reais de evolução na carreira.",
  },
  {
    icon: Award,
    title: "Treinamento & Reconhecimento",
    description:
      "Capacitação contínua, liderança próxima e uma cultura de meritocracia que valoriza quem faz acontecer.",
  },
  {
    icon: Leaf,
    title: "Propósito Sustentável",
    description:
      "Seu trabalho diário gera impacto direto na preservação do planeta e economia real para milhares de famílias e empresas.",
  },
  {
    icon: Users,
    title: "Ambiente Colaborativo",
    description:
      "Time unido, dinâmico e transparente, onde sua voz tem espaço e boas ideias são sempre incentivadas.",
  },
];

function Page() {
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const activeJobs = jobs.filter((j) => j.status === "aberta");
  const pausedJobs = jobs.filter((j) => j.status === "pausada");
  const visibleJobs = [...activeJobs, ...pausedJobs];

  const scrollToJobs = () => {
    const el = document.getElementById("vagas");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <PublicLayout>
      {/* HERO COM CTAS DIRETOS */}
      <section className="relative overflow-hidden bg-navy-deep py-16 text-white md:py-24">
        <div className="relative mx-auto max-w-[1320px] px-4 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-lzgreen/30 bg-lzgreen/10 px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-wider text-lzgreen">
              <Sparkles className="h-3.5 w-3.5" /> Carreiras na LZ7 Energia
            </span>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Construa o futuro da energia limpa com a gente
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/80 md:text-lg">
              Trabalhe em um ambiente dinâmico, inovador e com foco em excelência. Confira nossas vagas
              abertas ou cadastre seu currículo no nosso banco de talentos.
            </p>

            {/* AÇÕES RÁPIDAS */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={scrollToJobs}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lzgreen px-6 font-display text-sm font-bold text-navy-deep shadow-lg transition hover:bg-lzgreen-strong hover:text-white sm:w-auto"
              >
                <Briefcase className="h-4 w-4" />
                Ver Vagas Abertas {visibleJobs.length > 0 ? `(${visibleJobs.length})` : ""}
              </button>

              <Link
                to="/cadastrar-curriculo"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/5 px-6 font-display text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10 sm:w-auto"
              >
                <Users className="h-4 w-4 text-lzgreen" />
                Cadastrar no Banco de Talentos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PILARES / CULTURA LZ7 */}
      <Section title="Por que fazer parte da LZ7?" tone="muted">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CULTURE_PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="rounded-2xl border border-border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-lzgreen/10 text-lzgreen-strong">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-navy-deep">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* SEÇÃO DE VAGAS ABERTAS */}
      <section id="vagas" className="scroll-mt-16 py-16 md:py-24">
        <div className="mx-auto max-w-[1320px] px-4 md:px-8">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-wider text-lzgreen-strong">
                Oportunidades
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-navy-deep sm:text-3xl">
                Vagas em Aberto
              </h2>
            </div>
            {visibleJobs.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Exibindo <strong>{visibleJobs.length}</strong> {visibleJobs.length === 1 ? "oportunidade" : "oportunidades"} disponíveis
              </p>
            ) : null}
          </div>

          {visibleJobs.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visibleJobs.map((j) => (
                <div
                  key={j.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-white p-6 shadow-sm transition hover:border-lzgreen/60 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-bold text-navy-deep">{j.title}</h3>
                      {j.status === "pausada" ? (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          Pausada
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                          Aberta
                        </span>
                      )}
                    </div>

                    {/* TAGS DA VAGA */}
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {j.department ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                          <Building2 className="h-3 w-3 text-lzgreen-strong" /> {j.department}
                        </span>
                      ) : null}
                      {j.city || j.state ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                          <MapPin className="h-3 w-3 text-lzgreen-strong" />
                          {[j.city, j.state].filter(Boolean).join(" - ")}
                        </span>
                      ) : null}
                      {j.work_model ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                          <Briefcase className="h-3 w-3 text-lzgreen-strong" /> {j.work_model}
                        </span>
                      ) : null}
                      {j.contract_type ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-medium">
                          <Clock className="h-3 w-3 text-lzgreen-strong" /> {j.contract_type}
                        </span>
                      ) : null}
                    </div>

                    {j.description ? (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {j.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-6 border-t border-border/60 pt-4">
                    <Link
                      to="/vagas/$slug"
                      params={{ slug: j.slug }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-deep px-4 py-2.5 font-display text-xs font-semibold text-white transition hover:bg-lzgreen hover:text-navy-deep"
                    >
                      Ver detalhes e candidatar-se <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* EMPTY STATE QUANDO NÃO HÁ VAGAS ABERTAS */
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-center sm:p-12">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-lzgreen shadow-sm ring-1 ring-border">
                <Briefcase className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-navy-deep">
                Nenhuma vaga aberta no momento
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No momento todas as nossas posições estão preenchidas, mas estamos em constante
                expansão! Cadastre seu currículo no nosso banco de talentos para ser avisado assim que surgir
                uma oportunidade.
              </p>
              <div className="mt-6">
                <Link
                  to="/cadastrar-curriculo"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-navy-deep px-6 font-display text-sm font-semibold text-white transition hover:bg-lzgreen hover:text-navy-deep"
                >
                  <Users className="h-4 w-4" /> Cadastrar no Banco de Talentos
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* BANNER DESTACADO PARA O BANCO DE TALENTOS */}
      <section className="bg-muted/60 py-16">
        <div className="mx-auto max-w-[1320px] px-4 md:px-8">
          <div className="overflow-hidden rounded-3xl bg-navy-deep p-8 text-white shadow-xl md:p-12 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10">
            <div>
              <span className="font-display text-xs font-bold uppercase tracking-wider text-lzgreen">
                Banco de Talentos
              </span>
              <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl lg:text-4xl">
                Não encontrou a vaga perfeita para você hoje?
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/80 md:text-base">
                Envie seu currículo para nosso Banco de Talentos. Nosso time de Gente & Gestão avalia
                constantemente os perfis cadastrados para novas oportunidades em todas as áreas.
              </p>
              <ul className="mt-6 space-y-2.5 text-xs text-white/80 md:text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-lzgreen" /> Análise personalizada pelo time de RH
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-lzgreen" /> Prioridade de contato em novos processos seletivos
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-lzgreen" /> Oportunidades no Paraná, São Paulo e Santa Catarina
                </li>
              </ul>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center rounded-2xl bg-white/5 p-6 text-center backdrop-blur ring-1 ring-white/10 lg:mt-0">
              <Sparkles className="h-8 w-8 text-lzgreen" />
              <h3 className="mt-3 font-display text-lg font-bold">Faça parte do nosso radar</h3>
              <p className="mt-1 text-xs text-white/70">
                Leva apenas 2 minutos para preencher seus dados e enviar seu currículo.
              </p>
              <Link
                to="/cadastrar-curriculo"
                className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-lzgreen px-6 font-display text-sm font-bold text-navy-deep shadow-lg transition hover:bg-lzgreen-strong hover:text-white sm:w-auto"
              >
                Cadastrar Meu Currículo <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
