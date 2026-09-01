import { createFileRoute } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getPage } from "@/modules/site/public.functions";

const HEADING = "Política de Privacidade";
const pageQuery = {
  queryKey: ["site_page", "politica-de-privacidade"],
  queryFn: () => getPage({ data: { slug: "politica-de-privacidade" } }),
  staleTime: 5 * 60_000,
};

const TITLE = "Política de Privacidade | LZ7 Energia";
const DESCRIPTION =
  "Como a LZ7 Energia coleta, usa e protege seus dados pessoais, conforme a LGPD.";
const URL = "https://lz7energia.com.br/politica-de-privacidade";

export const Route = createFileRoute("/politica-de-privacidade")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(pageQuery),
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
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(pageQuery);
  return (
    <PublicLayout>
      <PageHero title={data?.title || HEADING} breadcrumbs={[{ label: HEADING }]} />
      <Section>
        {data?.content ? (
          <div className="prose max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {typeof data.content === "string" ? data.content : JSON.stringify(data.content)}
          </div>
        ) : (
          <div className="max-w-3xl space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              A LZ7 Energia trata dados pessoais apenas para atender solicitações de orçamento,
              contato, candidaturas e parcerias, conforme a Lei Geral de Proteção de Dados (LGPD).
            </p>
            <p>
              Coletamos nome, telefone, e-mail, cidade e informações que você envia voluntariamente
              nos formulários. Utilizamos esses dados para retorno comercial, suporte e comunicação
              institucional.
            </p>
            <p>
              Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento
              pelos canais de contato publicados neste site.
            </p>
            <p>Este texto pode ser atualizado a qualquer momento pela área responsável.</p>
          </div>
        )}
      </Section>
    </PublicLayout>
  );
}
