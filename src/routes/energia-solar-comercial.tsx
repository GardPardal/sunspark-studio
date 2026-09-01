import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";
import { SOLUTION_DEFAULTS } from "@/modules/site/site.shared";

const TITLE = "Energia Solar Comercial e Empresarial | Até 95% de Redução · LZ7";
const DESCRIPTION =
  "Corte o custo fixo de energia do seu comércio ou empresa no PR e SP. Mais margem, previsibilidade e retorno em 3 a 5 anos com usinas fotovoltaicas sob medida.";
const URL = "https://lz7energia.com.br/energia-solar-comercial";

export const Route = createFileRoute("/energia-solar-comercial")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("energia-solar-comercial")),
    ]);
  },
  head: () => {
    const sol = SOLUTION_DEFAULTS["energia-solar-comercial"];
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: URL },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: TITLE },
        { name: "twitter:description", content: DESCRIPTION },
        {
          name: "keywords",
          content:
            "energia solar comercial, painel solar empresas, energia solar comércio Paraná, redução custo energia empresas, LZ7 Energia",
        },
      ],
      links: [{ rel: "canonical", href: URL }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Service",
                name: sol.name,
                serviceType: "Energia Solar Fotovoltaica Comercial",
                description: DESCRIPTION,
                provider: {
                  "@type": "Organization",
                  name: "LZ7 Energia",
                  url: "https://lz7energia.com.br",
                },
                areaServed: ["Paraná", "São Paulo"],
                url: URL,
              },
              {
                "@type": "FAQPage",
                mainEntity: sol.faqs.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              },
            ],
          }),
        },
      ],
    };
  },
  component: () => <SolutionPage slug="energia-solar-comercial" />,
});
