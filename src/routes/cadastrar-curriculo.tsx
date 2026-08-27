import { createFileRoute, Link } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { ResumeForm, rhQuestionsQuery } from "@/components/site/resume-form";

const TITLE = "Cadastrar currículo — banco de talentos LZ7 Energia";
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
        eyebrow="Banco de talentos"
        title="Cadastrar currículo"
        subtitle="Responda algumas perguntas rápidas e anexe seu currículo. Nosso time de gente e gestão avalia todos os perfis recebidos."
        breadcrumbs={[{ label: "Trabalhe conosco", to: "/trabalhe-conosco" }, { label: "Cadastrar currículo" }]}
      />

      <Section tone="muted">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex justify-center gap-2">
            <Link
              to="/trabalhe-conosco"
              className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold transition hover:border-lzgreen"
            >
              Vagas abertas
            </Link>
            <span className="rounded-full bg-navy-deep px-4 py-2 text-sm font-semibold text-white">
              Cadastrar currículo
            </span>
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <ResumeForm job={null} />
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
