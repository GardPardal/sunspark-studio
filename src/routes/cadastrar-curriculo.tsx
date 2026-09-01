import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { ResumeForm, rhQuestionsQuery } from "@/components/site/resume-form";

const TITLE = "Cadastrar Currículo — Banco de Talentos LZ7 Energia";
const DESCRIPTION =
  "Cadastre seu currículo no banco de talentos da LZ7 Energia e seja chamado quando surgir uma oportunidade na sua área.";
const URL = "https://lz7energia.com.br/cadastrar-curriculo";

export const Route = createFileRoute("/cadastrar-curriculo")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
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
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Banco de Talentos"
        title="Cadastre seu currículo"
        subtitle="Deixe suas informações registradas no nosso radar. Nosso time de Gente & Gestão avalia todos os perfis para posições no Paraná, São Paulo e Santa Catarina."
        breadcrumbs={[
          { label: "Trabalhe conosco", to: "/trabalhe-conosco" },
          { label: "Banco de Talentos" },
        ]}
      />

      <Section tone="muted">
        <div className="mx-auto max-w-3xl">
          {/* BOTÃO VOLTAR E CONTROLE DE NAVEGAÇÃO */}
          <div className="mb-6 flex items-center justify-between">
            <Link
              to="/trabalhe-conosco"
              className="inline-flex items-center gap-2 font-display text-sm font-semibold text-lzgreen-strong transition hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para vagas abertas
            </Link>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-lzgreen/10 px-3 py-1 font-display text-xs font-semibold text-lzgreen-strong">
              <Sparkles className="h-3.5 w-3.5" /> Cadastro rápido
            </span>
          </div>

          {/* CARD PRINCIPAL DO FORMULÁRIO */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 border-b border-border/60 pb-5">
              <h2 className="font-display text-xl font-bold text-navy-deep sm:text-2xl">
                Formulário de Inscrição no Banco de Talentos
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Preencha seus dados de contato, responda as perguntas do nosso time e anexe seu
                currículo em PDF ou DOCX.
              </p>
            </div>

            <ResumeForm job={null} />

            <div className="mt-8 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lzgreen-strong" />
                <p>
                  Seus dados pessoais e currículo são confidenciais e utilizados exclusivamente para
                  fins de recrutamento e seleção pela equipe de RH da LZ7 Energia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
