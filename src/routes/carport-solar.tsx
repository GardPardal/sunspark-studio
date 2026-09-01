import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";
import { SOLUTION_DEFAULTS } from "@/modules/site/site.shared";

const TITLE = "Carport Solar: Garagem e Estacionamento Solar Fotovoltaico | LZ7";
const DESCRIPTION =
  "Cobertura fotovoltaica para estacionamentos comerciais, residenciais e industriais. Proteção veicular contra sol e chuva e geração de energia limpa com até 95% de economia.";
const URL = "https://lz7energia.com.br/carport-solar";

export const Route = createFileRoute("/carport-solar")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("carport-solar")),
    ]);
  },
  head: () => {
    const sol = SOLUTION_DEFAULTS["carport-solar"];
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
            "carport solar, estacionamento solar, garagem solar fotovoltaica, cobertura solar veículos, carregador veicular solar, LZ7 Energia",
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
                serviceType: "Carport Solar Fotovoltaico",
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
  component: () => <SolutionPage slug="carport-solar" />,
});
