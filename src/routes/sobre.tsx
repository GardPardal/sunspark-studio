import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { siteSettingsQueryOptions, useResolvedSiteSettings } from "@/lib/site-settings";
import { getAboutContent } from "@/modules/site/public.functions";
import { PublicLayout, PageHero, Section, EmptyState } from "@/components/site/public-layout";
import { WhatsAppGate } from "@/components/site/whatsapp-gate";
import { WhatsAppIcon } from "@/components/site/icons";
import { INSTITUTIONAL } from "@/components/site/home-content";

const TITLE = "Sobre a LZ7 Energia — história, valores e unidades";
const DESCRIPTION =
  "Conheça a LZ7 Energia: empresa paranaense de energia solar com equipe própria, mais de 10 MWp instalados e atendimento em PR e SP.";
const URL = "https://lz7energia.com.br/sobre";

const aboutQuery = {
  queryKey: ["site_about"],
  queryFn: () => getAboutContent(),
  staleTime: 5 * 60_000,
};

export const Route = createFileRoute("/sobre")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(aboutQuery),
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
  component: SobrePage,
});

const VALUES = [
  {
    title: "Transparência",
    text: "Projeto, prazo e retorno apresentados com clareza antes de qualquer contrato.",
  },
  { title: "Equipe própria", text: "Do projeto à instalação, sem terceirização do que é crítico." },
  {
    title: "Compromisso pós-venda",
    text: "Monitoramento, manutenção e suporte depois que o sistema entra em operação.",
  },
  {
    title: "Energia limpa",
    text: "Cada instalação é uma redução real de emissões na região onde atuamos.",
  },
];

function SobrePage() {
  const settings = useResolvedSiteSettings();
  const { data } = useSuspenseQuery(aboutQuery);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Institucional"
        title="Energia limpa, economia real e gente da região"
        subtitle={INSTITUTIONAL.text}
        breadcrumbs={[{ label: "Sobre nós" }]}
      />

      {data.stats.length ? (
        <Section tone="muted">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.stats.map((s) => (
              <div key={s.id} className="rounded-2xl border border-border bg-white p-6 text-center">
                <p className="font-display text-3xl font-bold text-lzgreen-strong">
                  {s.value}
                  {s.suffix ?? ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Nossos valores">
        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-border bg-white p-6">
              <h3 className="font-display text-lg font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="muted" title="Nossa história">
        {data.timeline.length ? (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {data.timeline.map((t) => (
              <li key={t.id}>
                <span className="absolute -left-[7px] mt-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-lzgreen" />
                <p className="font-display text-sm font-bold text-lzgreen-strong">{t.year}</p>
                <p className="font-display text-lg font-semibold">{t.title}</p>
                {t.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title="Linha do tempo em construção"
            description="Em breve publicaremos os marcos da história da LZ7 Energia."
          />
        )}
      </Section>

      {data.units.length ? (
        <Section title="Onde estamos" description="Unidades LZ7 Energia com equipe local.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.units.map((u) => (
              <div key={u.id} className="rounded-2xl border border-border bg-white p-6">
                <p className="font-display text-lg font-semibold">{u.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[u.address, u.city, u.state].filter(Boolean).join(", ")}
                </p>
                {u.phone ? <p className="mt-1 text-sm text-muted-foreground">{u.phone}</p> : null}
                {u.maps_url ? (
                  <a
                    href={u.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-semibold text-lzgreen-strong hover:underline"
                  >
                    Ver no mapa
                  </a>
                ) : null}
              </div>
            ))}
          </div>
          <Link
            to="/unidades"
            className="mt-6 inline-block text-sm font-semibold text-lzgreen-strong hover:underline"
          >
            Ver todas as unidades
          </Link>
        </Section>
      ) : null}

      <Section tone="muted">
        <div className="rounded-2xl bg-navy-deep px-6 py-10 text-center text-white md:px-12">
          <h2 className="font-display text-2xl font-bold md:text-3xl">
            Quer conhecer nossos projetos?
          </h2>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/projetos"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3 font-display text-sm font-semibold text-white transition hover:border-lzgreen hover:text-lzgreen"
            >
              Ver projetos
            </Link>
            <WhatsAppGate
              whatsapp={settings.whatsapp}
              location="sobre_cta"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-lzgreen px-6 py-3 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white"
            >
              Falar com especialista <WhatsAppIcon className="h-4 w-4" />
            </WhatsAppGate>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
