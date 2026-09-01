import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";
import { SOLUTION_DEFAULTS } from "@/modules/site/site.shared";

const TITLE = "Energia Solar Residencial no Paraná e São Paulo | Até 95% de Economia · LZ7";
const DESCRIPTION =
  "Usinas solares residenciais para casas e condomínios. Reduza até 95% da conta de luz, financiamento 100% sem entrada em até 120x e 25 anos de garantia. Peça seu orçamento gratuito!";
const URL = "https://lz7energia.com.br/energia-solar-residencial";

export const Route = createFileRoute("/energia-solar-residencial")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("energia-solar-residencial")),
    ]);
  },
  head: () => {
    const sol = SOLUTION_DEFAULTS["energia-solar-residencial"];
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
            "energia solar residencial, painel solar para casa, energia solar casas Paraná, economia de luz residencial, financiamento solar residencial, LZ7 Energia",
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
                serviceType: "Energia Solar Fotovoltaica Residencial",
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
  component: () => <SolutionPage slug="energia-solar-residencial" />,
});
