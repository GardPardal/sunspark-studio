import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { SolutionPage, solutionQueryOptions } from "@/components/site/solution-page";

const TITLE = "Sistemas Híbridos com Baterias | LZ7 Energia";
const DESCRIPTION = "Energia solar com armazenamento: autonomia durante quedas de energia e proteção para cargas essenciais.";
const URL = "https://lz7energia.com.br/sistemas-hibridos";

export const Route = createFileRoute("/sistemas-hibridos")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(solutionQueryOptions("sistemas-hibridos")),
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
  component: () => <SolutionPage slug="sistemas-hibridos" />,
});
