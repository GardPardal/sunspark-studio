import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";

const TITLE = "Energia Solar Comercial para Empresas | LZ7 Energia";
const DESCRIPTION =
  "Reduza o custo fixo de energia do seu comércio com um sistema fotovoltaico dimensionado para o seu consumo.";
const URL = "https://lz7energia.com.br/energia-solar-comercial";

export const Route = createFileRoute("/energia-solar-comercial")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("energia-solar-comercial")),
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
  component: () => <SolutionPage slug="energia-solar-comercial" />,
});
