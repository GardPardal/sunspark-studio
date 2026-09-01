import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";

const TITLE = "Carport Solar: Estacionamento que Gera Energia | LZ7 Energia";
const DESCRIPTION =
  "Cobertura solar para estacionamentos: sombra, proteção veicular e geração de energia limpa.";
const URL = "https://lz7energia.com.br/carport-solar";

export const Route = createFileRoute("/carport-solar")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("carport-solar")),
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
  component: () => <SolutionPage slug="carport-solar" />,
});
