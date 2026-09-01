import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";

const TITLE = "Energia Solar Residencial em Londrina e Paraná | LZ7 Energia";
const DESCRIPTION =
  "Energia solar para residências no Paraná e São Paulo: projeto personalizado, instalação própria e até 95% de economia na conta de luz.";
const URL = "https://lz7energia.com.br/energia-solar-residencial";

export const Route = createFileRoute("/energia-solar-residencial")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("energia-solar-residencial")),
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
  component: () => <SolutionPage slug="energia-solar-residencial" />,
});
