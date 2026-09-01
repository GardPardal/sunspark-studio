import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";

const TITLE = "Energia Solar Industrial de Alta Potência | LZ7 Energia";
const DESCRIPTION =
  "Projetos fotovoltaicos industriais com engenharia dedicada, estudo tarifário e usinas de médio e grande porte.";
const URL = "https://lz7energia.com.br/energia-solar-industrial";

export const Route = createFileRoute("/energia-solar-industrial")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("energia-solar-industrial")),
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
  component: () => <SolutionPage slug="energia-solar-industrial" />,
});
