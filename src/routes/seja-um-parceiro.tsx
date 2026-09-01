import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";
import { PartnerForm } from "@/components/site/site-forms";

const TITLE = "Seja um parceiro da LZ7 Energia";
const DESCRIPTION =
  "Indicação, representação ou fornecimento: envie sua proposta e faça parte da rede de parceiros da LZ7 Energia.";
const URL = "https://lz7energia.com.br/seja-um-parceiro";

export const Route = createFileRoute("/seja-um-parceiro")({
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(siteSettingsQueryOptions())]);
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
        eyebrow="Parcerias"
        title="Cresça junto com a LZ7 Energia"
        subtitle="Indicadores, representantes, imobiliárias, construtoras, arquitetos e fornecedores: temos um modelo de parceria para você."
        breadcrumbs={[{ label: "Seja um parceiro" }]}
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-4">
            {[
              {
                t: "Indicação",
                d: "Você indica, a gente atende e você recebe pela venda concretizada.",
              },
              {
                t: "Representação",
                d: "Represente a LZ7 na sua região com suporte técnico e comercial.",
              },
              {
                t: "Fornecimento",
                d: "Fornecedores de equipamentos, estrutura e serviços de instalação.",
              },
            ].map((i) => (
              <div key={i.t} className="rounded-2xl border border-border bg-white p-6">
                <h2 className="font-display text-lg font-semibold">{i.t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{i.d}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold">Envie sua proposta</h2>
            <div className="mt-5">
              <PartnerForm />
            </div>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
