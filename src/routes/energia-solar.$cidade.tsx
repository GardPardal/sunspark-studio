import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { siteSettingsQueryOptions } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section, FaqList } from "@/components/site/public-layout";
import {
  baseMaisProxima,
  estimativa,
  getCidade,
  isPrioritaria,
  perfilDe,
  regiaoDe,
  UF_NOME,
  type Cidade,
} from "@/lib/local-seo";

const BASE_URL = "https://lz7energia.com.br";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function seoDe(c: Cidade) {
  const { base, km } = baseMaisProxima(c);
  const title = `Energia Solar em ${c.nome} - ${c.uf} | LZ7 Energia`;
  const description = `Empresa de energia solar em ${c.nome} (${c.uf}): projeto, homologação na ${c.concessionaria} e instalação com equipe própria a ${km} km da nossa base de ${base.cidade}. Até 95% de economia na conta de luz.`;
  return { title, description, base, km, url: `${BASE_URL}/energia-solar/${c.slug}` };
}

function buildCityFaqs(c: Cidade) {
  const { base, km } = baseMaisProxima(c);
  const r = regiaoDe(c);
  const e = estimativa(c);
  const perfil = perfilDe(c);
  return [
    ...(perfil?.faq ?? []),
    {
      q: `Quanto custa energia solar em ${c.nome}?`,
      a: `O investimento depende do consumo do imóvel e do tipo de telhado. Para uma conta de cerca de ${brl(600)} por mês em ${c.nome}, o sistema costuma ficar em torno de ${e.kwp} kWp. O orçamento exato sai depois da análise da sua conta de luz — é gratuito e sem compromisso.`,
    },
    {
      q: `Vale a pena instalar energia solar em ${c.nome}?`,
      a: `Com irradiação média de ${r.irradiacao} kWh/m²/dia no ${r.nome} e tarifa da ${c.concessionaria}, cada kWp instalado gera aproximadamente ${e.geracaoPorKwp} kWh por mês. A economia estimada chega a ${brl(e.economiaMes)} por mês, ou ${brl(e.economiaAno)} por ano, em uma conta de ${brl(600)}.`,
    },
    {
      q: `A LZ7 atende ${c.nome} com equipe própria?`,
      a: `Sim. ${c.nome} fica a ${km} km da nossa base de ${base.cidade}, dentro do raio de atendimento das nossas equipes de instalação e assistência técnica. Não terceirizamos a obra.`,
    },
    {
      q: `Quem faz a homologação junto à ${c.concessionaria}?`,
      a: `Nós cuidamos de todo o processo: projeto elétrico, ART, protocolo junto à ${c.concessionaria}, acompanhamento da vistoria e troca do medidor. Você não precisa lidar com a burocracia.`,
    },
    {
      q: `Energia solar funciona em dias nublados em ${c.nome}?`,
      a: `Sim, com geração reduzida. O sistema é dimensionado pela média anual de irradiação, e o excedente gerado nos meses de mais sol vira crédito na ${c.concessionaria} para compensar os meses mais fracos.`,
    },
  ];
}

export const Route = createFileRoute("/energia-solar/$cidade")({
  loader: async ({ context, params }) => {
    const cidade = getCidade(params.cidade);
    if (!cidade) throw notFound();
    await context.queryClient.ensureQueryData(siteSettingsQueryOptions());
    return { cidade };
  },
  head: ({ loaderData }) => {
    const c = (loaderData as { cidade?: Cidade } | undefined)?.cidade;
    if (!c) return {};
    const { title, description, base, km, url } = seoDe(c);
    const r = regiaoDe(c);
    const faqs = buildCityFaqs(c);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "robots",
          content: isPrioritaria(c.slug)
            ? "index, follow, max-image-preview:large, max-snippet:-1"
            : "noindex, follow",
        },
        { name: "geo.region", content: `BR-${c.uf}` },
        { name: "geo.placename", content: c.nome },
        { name: "geo.position", content: `${c.lat};${c.lon}` },
        { name: "ICBM", content: `${c.lat}, ${c.lon}` },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:site_name", content: "LZ7 Energia" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SolarPowerStation",
                "@id": `${url}#business`,
                name: `LZ7 Energia — Energia Solar em ${c.nome}`,
                description,
                url,
                image: `${BASE_URL}/icon-512.png`,
                priceRange: "$$",
                areaServed: { "@type": "City", name: `${c.nome} - ${c.uf}` },
                address: {
                  "@type": "PostalAddress",
                  addressLocality: base.cidade,
                  addressRegion: base.uf,
                  addressCountry: "BR",
                },
                geo: { "@type": "GeoCoordinates", latitude: c.lat, longitude: c.lon },
                parentOrganization: { "@type": "Organization", name: "LZ7 Energia", url: BASE_URL },
              },
              {
                "@type": "Service",
                serviceType: "Instalação de energia solar fotovoltaica",
                provider: { "@id": `${url}#business` },
                areaServed: { "@type": "City", name: `${c.nome} - ${c.uf}` },
                description: `Projeto, homologação junto à ${c.concessionaria} e instalação de sistemas fotovoltaicos em ${c.nome} (${r.nome}), com equipe própria a ${km} km de distância.`,
              },
              {
                "@type": "FAQPage",
                "@id": `${url}#faq`,
                mainEntity: faqs.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: f.a,
                  },
                })),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Início", item: `${BASE_URL}/` },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Onde atendemos",
                    item: `${BASE_URL}/energia-solar`,
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: `Energia solar em ${c.nome}`,
                    item: url,
                  },
                ],
              },
            ],
          }),
        },
      ],
    };
  },
  component: Page,
});

function Page() {
  const { cidade: c } = Route.useLoaderData();
  const r = regiaoDe(c);
  const { base, km } = baseMaisProxima(c);
  const e = estimativa(c);
  const faqs = buildCityFaqs(c);

  const vizinhas = c.vizinhas.map(getCidade).filter(Boolean) as Cidade[];

  return (
    <PublicLayout>
      <PageHero
        eyebrow={`${c.nome} — ${UF_NOME[c.uf]}`}
        title={`Energia solar em ${c.nome}: economize até 95% na conta de luz`}
        subtitle={`Somos uma empresa de energia solar com equipe própria a ${km} km de ${c.nome}, operando a partir da base de ${base.cidade}. Projeto, homologação na ${c.concessionaria}, instalação e pós-venda com um único responsável.`}
        breadcrumbs={[{ label: "Onde atendemos", to: "/energia-solar" }, { label: c.nome }]}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            to="/quiz"
            className="inline-flex rounded-xl bg-lzgreen px-6 py-3 text-sm font-semibold text-navy-deep transition hover:opacity-90"
          >
            Simular economia em {c.nome}
          </Link>
          <Link
            to="/contato"
            className="inline-flex rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:border-lzgreen hover:text-lzgreen"
          >
            Falar com um especialista
          </Link>
        </div>
      </PageHero>

      {perfil ? (
        <Section title={`Energia solar em ${c.nome}: como é na prática`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              {perfil.intro.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
              <p>
                <strong className="text-foreground">Perfil de consumo local.</strong>{" "}
                {perfil.consumo}
              </p>
              <p>
                <strong className="text-foreground">Como atendemos.</strong> {perfil.logistica}
              </p>
            </div>

            <aside className="h-fit rounded-2xl border border-border bg-muted/40 p-6">
              <h3 className="font-display text-base font-semibold">{perfil.bairrosLabel}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {perfil.bairros.map((b) => (
                  <li
                    key={b}
                    className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium"
                  >
                    {b}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Não achou seu bairro? Atendemos todo o município de {c.nome} e as cidades vizinhas.
              </p>
            </aside>
          </div>
        </Section>
      ) : null}

      <Section
        tone={perfil ? "muted" : undefined}
        title={`Como é gerar a própria energia em ${c.nome}`}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            <p>
              {c.nome} está no {r.nome}, região onde a irradiação solar média é de{" "}
              <strong className="text-foreground">{r.irradiacao} kWh/m²/dia</strong>. {r.descricao}
            </p>
            <p>
              Na prática, isso significa que cada 1 kWp instalado em um telhado de {c.nome} gera
              cerca de <strong className="text-foreground">{e.geracaoPorKwp} kWh por mês</strong>.
              Para uma conta de {brl(600)} na {c.concessionaria} — algo em torno de {e.consumoKwh}{" "}
              kWh mensais — o sistema indicado fica perto de {e.kwp} kWp, com economia estimada de{" "}
              {brl(e.economiaMes)} por mês.
            </p>
            <p>
              O perfil local pesa no dimensionamento: {c.destaques.join(" e ")}. Quem consome
              durante o dia (comércio, indústria, irrigação, câmara fria) aproveita a geração no
              mesmo instante; quem consome à noite usa o sistema de compensação da{" "}
              {c.concessionaria} para abater os créditos na fatura seguinte.
            </p>
            <p>
              Todo projeto passa por visita técnica presencial antes da proposta — avaliamos
              estrutura do telhado, padrão de entrada, sombreamento e histórico dos últimos 12 meses
              da sua conta.
            </p>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-muted/40 p-6">
            <h3 className="font-display text-base font-semibold">Resumo técnico de {c.nome}</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Região</dt>
                <dd className="text-right font-medium">{r.nome}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Irradiação média</dt>
                <dd className="text-right font-medium">{r.irradiacao} kWh/m²/dia</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Distribuidora</dt>
                <dd className="text-right font-medium">{c.concessionaria}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Base LZ7 mais próxima</dt>
                <dd className="text-right font-medium">
                  {base.cidade} ({km} km)
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Geração por kWp</dt>
                <dd className="text-right font-medium">~{e.geracaoPorKwp} kWh/mês</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Estimativas baseadas na média regional de irradiação e em tarifa média de {brl(1)}
              /kWh. O resultado final depende da análise técnica.
            </p>
          </aside>
        </div>
      </Section>

      <Section title={`O que a LZ7 faz por você em ${c.nome}`}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "Visita e projeto",
              d: `Engenheiro avalia o imóvel em ${c.nome} e dimensiona o sistema pelo seu consumo real.`,
            },
            {
              t: `Homologação na ${c.concessionaria}`,
              d: "Projeto elétrico, ART, protocolo, vistoria e troca do medidor por nossa conta.",
            },
            {
              t: "Instalação própria",
              d: `Equipe LZ7 de ${base.cidade} executa a obra — sem subcontratar terceiros.`,
            },
            {
              t: "Monitoramento e garantia",
              d: "Acompanhamento da geração, suporte local e garantias de módulos e inversores.",
            },
          ].map((s) => (
            <div key={s.t} className="rounded-2xl border border-border bg-white p-6">
              <h3 className="font-display text-base font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Soluções disponíveis em ${c.nome}`}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              to: "/energia-solar-residencial",
              t: "Residencial",
              d: "Casas e condomínios que querem tirar a conta de luz do orçamento.",
            },
            {
              to: "/energia-solar-comercial",
              t: "Comercial",
              d: "Lojas, clínicas e escritórios com consumo em horário comercial.",
            },
            {
              to: "/energia-solar-industrial",
              t: "Industrial",
              d: "Alta demanda, média tensão e grandes coberturas.",
            },
            {
              to: "/carport-solar",
              t: "Carport solar",
              d: "Estacionamentos que geram energia e ainda protegem os veículos.",
            },
            {
              to: "/sistemas-hibridos",
              t: "Sistemas híbridos",
              d: "Solar com baterias para quem precisa de autonomia.",
            },
            {
              to: "/projetos",
              t: "Projetos entregues",
              d: "Obras reais executadas pelas nossas equipes na região.",
            },
          ].map((s) => (
            <Link
              key={s.to}
              to={s.to as never}
              className="rounded-2xl border border-border bg-white p-6 transition hover:border-lzgreen"
            >
              <h3 className="font-display text-base font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </Link>
          ))}
        </div>
      </Section>

      {vizinhas.length ? (
        <Section tone="muted" title="Também atendemos por perto">
          <ul className="flex flex-wrap gap-3">
            {vizinhas.map((v) => (
              <li key={v.slug}>
                <Link
                  to="/energia-solar/$cidade"
                  params={{ cidade: v.slug }}
                  className="inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-medium transition hover:border-lzgreen hover:text-lzgreen-strong"
                >
                  Energia solar em {v.nome}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/energia-solar"
                className="inline-flex rounded-full border border-border bg-white px-4 py-2 text-sm font-medium transition hover:border-lzgreen hover:text-lzgreen-strong"
              >
                Ver todas as cidades
              </Link>
            </li>
          </ul>
        </Section>
      ) : null}

      <Section title={`Perguntas frequentes sobre energia solar em ${c.nome}`}>
        <FaqList faqs={faqs} />
        <div className="mt-8 rounded-2xl border border-border bg-navy-deep p-8 text-white">
          <h3 className="font-display text-xl font-bold">
            Quer saber quanto você economiza em {c.nome}?
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            Responda 5 perguntas rápidas e nossa equipe de {base.cidade} retorna com uma estimativa
            baseada na sua conta de luz.
          </p>
          <Link
            to="/quiz"
            className="mt-6 inline-flex rounded-xl bg-lzgreen px-6 py-3 text-sm font-semibold text-navy-deep transition hover:opacity-90"
          >
            Fazer o diagnóstico gratuito
          </Link>
        </div>
      </Section>
    </PublicLayout>
  );
}
