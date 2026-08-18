import { createFileRoute, Link } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { BASES, CIDADES, UF_NOME, baseMaisProxima, cidadesPorEstado } from "@/lib/local-seo";

const TITLE = "Empresa de Energia Solar no PR, SP e SC | LZ7 Energia";
const DESCRIPTION =
  "Instaladora de energia solar com equipes próprias em Londrina, Ponta Grossa e Wenceslau Braz, atendendo mais de 50 cidades do Paraná, São Paulo e Santa Catarina.";
const URL = "https://lz7energia.com.br/energia-solar";

export const Route = createFileRoute("/energia-solar/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(siteSettingsQueryOptions());
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "LZ7 Energia",
          url: "https://lz7energia.com.br",
          areaServed: CIDADES.map((c) => ({ "@type": "City", name: `${c.nome} - ${c.uf}` })),
          location: BASES.map((b) => ({
            "@type": "Place",
            name: b.nome,
            address: { "@type": "PostalAddress", addressLocality: b.cidade, addressRegion: b.uf, addressCountry: "BR" },
          })),
        }),
      },
    ],
  }),
  component: Page,
});

function Page() {
  const grupos = cidadesPorEstado();
  return (
    <PublicLayout>
      <PageHero
        eyebrow="Cobertura"
        title="Energia solar com equipe própria perto de você"
        subtitle="Operamos a partir de três bases no Paraná — Londrina, Ponta Grossa e Wenceslau Braz — e atendemos mais de 50 cidades num raio de 500 km, no PR, em SP e no norte de SC."
        breadcrumbs={[{ label: "Onde atendemos" }]}
      />

      <Section title="Nossas bases operacionais" description="Projeto, homologação, instalação e pós-venda feitos por time próprio — sem terceirizar a obra.">
        <div className="grid gap-5 sm:grid-cols-3">
          {BASES.map((b) => (
            <div key={b.slug} className="rounded-2xl border border-border bg-white p-6">
              <h3 className="font-display text-lg font-semibold">{b.cidade} — {b.uf}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Base de atendimento e logística para as cidades da região.
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted" title="Cidades atendidas" description="Escolha sua cidade para ver irradiação regional, distância da nossa base mais próxima e estimativa de economia.">
        <div className="space-y-10">
          {Object.entries(grupos).map(([uf, cidades]) => (
            <div key={uf}>
              <h3 className="font-display text-lg font-semibold">{UF_NOME[uf] ?? uf}</h3>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cidades.map((c) => {
                  const { km } = baseMaisProxima(c);
                  return (
                    <li key={c.slug}>
                      <Link
                        to="/energia-solar/$cidade"
                        params={{ cidade: c.slug }}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium transition hover:border-lzgreen hover:text-lzgreen-strong"
                      >
                        <span>Energia solar em {c.nome}</span>
                        <span className="text-xs text-muted-foreground">{km} km</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Não encontrou sua cidade?">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Atendemos também municípios vizinhos aos listados acima. Faça o diagnóstico rápido e nossa equipe confirma a
          cobertura para o seu endereço.
        </p>
        <Link
          to="/quiz"
          className="mt-6 inline-flex rounded-xl bg-lzgreen px-6 py-3 text-sm font-semibold text-navy-deep transition hover:opacity-90"
        >
          Simular minha economia
        </Link>
      </Section>
    </PublicLayout>
  );
}
