import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";
import { SOLUTION_DEFAULTS } from "@/modules/site/site.shared";

const TITLE = "Sistemas Solares Híbridos com Bateria e Backup | LZ7";
const DESCRIPTION =
  "Energia solar com baterias e armazenamento inteligente. Autonomia garantida durante apagões e quedas de energia da rede para residências, empresas e clínicas.";
const URL = "https://lz7energia.com.br/sistemas-hibridos";

export const Route = createFileRoute("/sistemas-hibridos")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("sistemas-hibridos")),
    ]);
  },
  head: () => {
    const sol = SOLUTION_DEFAULTS["sistemas-hibridos"];
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
            "energia solar híbrida, bateria solar, gerador solar backup, energia solar no-break, inversor híbrido Paraná, LZ7 Energia",
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
                serviceType: "Sistemas Fotovoltaicos Híbridos com Bateria",
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
  component: () => <SolutionPage slug="sistemas-hibridos" />,
});
