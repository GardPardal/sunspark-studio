import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";
import { SOLUTION_DEFAULTS } from "@/modules/site/site.shared";

const TITLE = "Energia Solar Industrial e Usinas de Alta Potência | LZ7";
const DESCRIPTION =
  "Usinas solares industriais no PR e SP. Estudo de demanda, enquadramento tarifário Grupo A, projetos em solo e telhado metálico com engenharia e ART dedicadas.";
const URL = "https://lz7energia.com.br/energia-solar-industrial";

export const Route = createFileRoute("/energia-solar-industrial")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("energia-solar-industrial")),
    ]);
  },
  head: () => {
    const sol = SOLUTION_DEFAULTS["energia-solar-industrial"];
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
            "energia solar industrial, usina solar solo, energia solar indústria Paraná, mercado livre de energia, grupo A energia solar, LZ7 Energia",
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
                serviceType: "Energia Solar Fotovoltaica Industrial",
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
  component: () => <SolutionPage slug="energia-solar-industrial" />,
});
