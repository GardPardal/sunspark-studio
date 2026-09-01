import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Sun,
  Zap,
  ShieldCheck,
  MapPin,
  TrendingDown,
  Building2,
  Tractor,
  Home,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Clock,
  Award,
} from "lucide-react";
import { siteSettingsQueryOptions, useResolvedSiteSettings } from "@/lib/site-settings";
import { PublicLayout, PageHero, Section, FaqList } from "@/components/site/public-layout";
import { WhatsAppGate } from "@/components/site/whatsapp-gate";
import { WhatsAppIcon } from "@/components/site/icons";
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
  const title = `Energia Solar em ${c.nome} - ${c.uf} | Até 95% de Economia · LZ7 Energia`;
  const description = `Especialista em energia solar fotovoltaica em ${c.nome} (${c.uf}). Projeto personalizado, homologação rápida na ${c.concessionaria} e instalação com equipe própria LZ7 a ${km} km da base de ${base.cidade}. Financiamento sem entrada e garantia de 25 anos.`;
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
      q: `Quanto custa instalar energia solar em ${c.nome}?`,
      a: `O investimento varia conforme a sua média de consumo mensal e o tipo de imóvel (residencial, comercial ou rural). Para uma conta média de ${brl(600)} por mês em ${c.nome}, o sistema ideal fica em torno de ${e.kwp} kWp. A LZ7 realiza um estudo personalizado gratuito para indicar o dimensionamento exato e opções de financiamento com até 100% de cobertura.`,
    },
    {
      q: `Qual é o potencial de geração solar em ${c.nome}?`,
      a: `Com irradiação média de ${r.irradiacao} kWh/m²/dia no ${r.nome} e tarifas da ${c.concessionaria}, cada kWp instalado em ${c.nome} produz em média ${e.geracaoPorKwp} kWh por mês. Uma conta de ${brl(600)} tem economia estimada de ${brl(e.economiaMes)} mensais, superando ${brl(e.economiaAno)} ao ano.`,
    },
    {
      q: `A LZ7 Energia atende ${c.nome} com equipe técnica própria?`,
      a: `Sim! ${c.nome} está a ${km} km da nossa base operacional de ${base.cidade}. Nossas equipes de engenharia, montagem e pós-venda são 100% próprias, sem terceirização, o que garante máxima qualidade e rapidez no atendimento.`,
    },
    {
      q: `Como funciona a homologação junto à ${c.concessionaria}?`,
      a: `Cuidamos de toda a parte burocrática e técnica: elaboração do projeto elétrico, emissão de ART registrada no CREA, protocolo e acompanhamento da aprovação na ${c.concessionaria}, vistoria e troca do relógio medidor bidirecional.`,
    },
    {
      q: `O que acontece nos dias chuvosos ou nublados em ${c.nome}?`,
      a: `Mesmo com o céu encoberto, os módulos fotovoltaicos continuam captando a radiação difusa e gerando eletricidade. O excedente produzido nos dias de sol intenso é injetado na rede da ${c.concessionaria} e vira créditos com validade de 60 meses para compensar os meses de menor insolação ou consumo noturno.`,
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
        { property: "og:image", content: "https://lz7energia.com.br/og-image.png" },
        { property: "og:image:secure_url", content: "https://lz7energia.com.br/og-image.png" },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: "https://lz7energia.com.br/og-image.png" },
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
  const settings = useResolvedSiteSettings();
  const r = regiaoDe(c);
  const { base, km } = baseMaisProxima(c);
  const e = estimativa(c);
  const perfil = perfilDe(c);
  const faqs = buildCityFaqs(c);

  const [billValue, setBillValue] = useState<number>(600);

  // Cálculos dinâmicos com base no slider/input da cidade
  const currentConsumoKwh = Math.round(billValue / e.tarifa);
  const currentKwp = Math.max(1, Math.round((currentConsumoKwh / e.geracaoPorKwp) * 10) / 10);
  const currentEconomiaMes = Math.round(billValue * 0.95);
  const currentEconomiaAno = currentEconomiaMes * 12;
  const currentEconomia25Anos = currentEconomiaAno * 25 * 1.5; // Projeção com reajustes moderados

  const vizinhas = c.vizinhas.map(getCidade).filter(Boolean) as Cidade[];

  return (
    <PublicLayout>
      {/* Hero com Badges de Credibilidade Local */}
      <PageHero
        eyebrow={`📍 ${c.nome} — ${UF_NOME[c.uf]}`}
        title={`Energia solar em ${c.nome}: reduza até 95% da sua conta de luz`}
        subtitle={`Empresa especializada em usinas solares fotovoltaicas com equipe própria e base a apenas ${km} km de ${c.nome} (${base.cidade}). Projeto sob medida, homologação completa na ${c.concessionaria} e garantia de 25 anos.`}
        breadcrumbs={[{ label: "Onde atendemos", to: "/energia-solar" }, { label: c.nome }]}
      >
        {/* Badges de Destaque Local */}
        <div className="mt-4 mb-6 flex flex-wrap gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-lzgreen border border-white/10">
            <Sun className="h-3.5 w-3.5" /> Irradiação: {r.irradiacao} kWh/m²/dia
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/10">
            <ShieldCheck className="h-3.5 w-3.5 text-lzgreen" /> Homologação na {c.concessionaria}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/10">
            <MapPin className="h-3.5 w-3.5 text-lzgreen" /> Base LZ7 a {km} km ({base.cidade})
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-white border border-white/10">
            <Award className="h-3.5 w-3.5 text-lzgreen" /> Instalação com Equipe Própria
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/quiz"
            className="inline-flex items-center gap-2 rounded-xl bg-lzgreen hover:bg-lzgreen-strong px-7 py-3.5 text-sm font-bold text-navy-deep shadow-lg transition"
          >
            <Sparkles className="h-4 w-4" /> Simular Economia em {c.nome}
          </Link>
          <WhatsAppGate
            whatsapp={settings.whatsapp}
            location={`cidade_hero_${c.slug}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 hover:border-lzgreen hover:text-lzgreen px-6 py-3.5 text-sm font-semibold text-white transition"
          >
            <WhatsAppIcon className="h-4 w-4" /> Falar com Especialista
          </WhatsAppGate>
        </div>
      </PageHero>

      {/* Seção Editorial Hiperlocal (se houver perfil detalhado da cidade) */}
      {perfil ? (
        <Section title={`Energia solar em ${c.nome}: cenário real e vocação local`}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              {perfil.intro.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 mt-4">
                <p className="text-foreground">
                  <strong className="text-primary">⚡ Perfil de Consumo em {c.nome}:</strong>{" "}
                  {perfil.consumo}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/60 border border-border mt-2">
                <p className="text-foreground">
                  <strong className="text-foreground">🚚 Logística e Suporte:</strong>{" "}
                  {perfil.logistica}
                </p>
              </div>
            </div>

            <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> {perfil.bairrosLabel}
              </h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {perfil.bairros.map((b) => (
                  <li
                    key={b}
                    className="rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    {b}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Atendemos 100% da área urbana, condomínios e toda a zona rural do município de{" "}
                {c.nome}.
              </p>
            </aside>
          </div>
        </Section>
      ) : null}

      {/* Simulador Interativo Local para a Cidade */}
      <Section title={`Simule sua economia de energia em ${c.nome}`}>
        <div className="rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 p-6 md:p-10 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-3">
                <Sun className="h-3.5 w-3.5" /> Calibrado para {c.nome} ({r.irradiacao} kWh/m²/dia)
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">
                Quanto você paga de conta de luz por mês?
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Arraste a barra para estimar o tamanho da sua usina e quanto vai sobrar no seu bolso
                todo mês.
              </p>

              {/* Slider & Presets */}
              <div className="mt-6">
                <div className="flex items-center justify-between font-display text-3xl font-extrabold text-primary">
                  <span>{brl(billValue)}</span>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    por mês
                  </span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="50"
                  value={billValue}
                  onChange={(e) => setBillValue(Number(e.target.value))}
                  className="mt-4 h-3 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[300, 600, 1200, 2500, 4000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBillValue(preset)}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                        billValue === preset
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      }`}
                    >
                      {brl(preset)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultado do Dimensionamento Local */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 rounded-2xl bg-card border border-border p-5 md:p-6 shadow-sm">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <span className="text-xs font-medium text-muted-foreground block">
                  Economia Mensal
                </span>
                <span className="font-display text-xl sm:text-2xl font-extrabold text-primary mt-1 block">
                  {brl(currentEconomiaMes)}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  até 95% a menos
                </span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs font-medium text-muted-foreground block">
                  Economia Anual
                </span>
                <span className="font-display text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {brl(currentEconomiaAno)}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  direto no seu caixa
                </span>
              </div>

              <div className="p-4 rounded-xl bg-muted/60 border border-border">
                <span className="text-xs font-medium text-muted-foreground block">
                  Potência Estimada
                </span>
                <span className="font-display text-lg sm:text-xl font-bold text-foreground mt-1 block">
                  ~{currentKwp} kWp
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  com placas Tier 1
                </span>
              </div>

              <div className="p-4 rounded-xl bg-muted/60 border border-border">
                <span className="text-xs font-medium text-muted-foreground block">
                  Economia em 25 Anos
                </span>
                <span className="font-display text-lg sm:text-xl font-bold text-foreground mt-1 block">
                  {brl(currentEconomia25Anos)}
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  patrimônio protegido
                </span>
              </div>

              <div className="col-span-2 pt-2">
                <Link
                  to="/quiz"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-lzgreen hover:bg-lzgreen-strong text-navy-deep font-bold py-3 text-sm shadow transition"
                >
                  Garantir Proposta Oficial para {c.nome} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Raio-X Técnico e Clima Solar em {c.nome} */}
      <Section tone="muted" title={`Potencial solar e dados técnicos de ${c.nome}`}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
            <p>
              {c.nome} está inserida na região do <strong>{r.nome}</strong>, com índice médio de
              irradiação solar de{" "}
              <strong className="text-foreground">{r.irradiacao} kWh/m²/dia</strong> segundo dados
              do Atlas Solarimétrico Brasileiro. {r.descricao}
            </p>
            <p>
              Em {c.nome}, cada 1 kWp instalado gera em média{" "}
              <strong className="text-foreground">{e.geracaoPorKwp} kWh por mês</strong>. O
              investimento se paga em cerca de 3 a 5 anos e a usina continua gerando energia limpa
              por mais de 25 anos com garantia oficial de fábrica.
            </p>
            <p>
              <strong>Vocação e atividade local:</strong> {c.destaques.join(" e ")}. Seja em
              telhados de residências urbanas, galpões comerciais ou barracões rurais, nossos
              projetos respeitam a carga de vento e a estrutura original de cada edificação.
            </p>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Ficha Técnica: {c.nome}
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Região</dt>
                <dd className="font-semibold text-foreground">{r.nome}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Irradiação Média</dt>
                <dd className="font-semibold text-foreground">{r.irradiacao} kWh/m²/dia</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Concessionária</dt>
                <dd className="font-semibold text-foreground">{c.concessionaria}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/50 pb-2">
                <dt className="text-muted-foreground">Base Operacional LZ7</dt>
                <dd className="font-semibold text-foreground">
                  {base.cidade} ({km} km)
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rendimento Médio</dt>
                <dd className="font-semibold text-foreground">
                  ~{e.geracaoPorKwp} kWh/mês por kWp
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </Section>

      {/* Aplicações Mais Populares na Cidade */}
      <Section title={`Soluções solares mais procuradas em ${c.nome}`}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
                <Home className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">Residencial</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Casas e sobrados que desejam eliminar o custo do ar-condicionado e chuveiro
                elétrico.
              </p>
            </div>
            <Link
              to="/energia-solar-residencial"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              Saiba mais <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
                <Building2 className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">
                Comercial & Clínicas
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Supermercados, lojas, farmácias e consultórios com alto consumo diurno contínuo.
              </p>
            </div>
            <Link
              to="/energia-solar-comercial"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              Saiba mais <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
                <Tractor className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">Agro & Rural</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Leite, ordenhas, resfriadores, granjas de aves/suínos e pivôs de irrigação.
              </p>
            </div>
            <Link
              to="/projetos"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              Saiba mais <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
            <div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary mb-4">
                <Zap className="h-5 w-5" />
              </span>
              <h3 className="font-display text-lg font-bold text-foreground">Industrial & Solo</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Fábricas, serrarias, confecções e usinas em solo de média e alta tensão.
              </p>
            </div>
            <Link
              to="/energia-solar-industrial"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              Saiba mais <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </Section>

      {/* O que a LZ7 faz por você na cidade */}
      <Section tone="muted" title={`O que a LZ7 garante na sua obra em ${c.nome}`}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "1. Estudo & Visita Técnica",
              d: `Engenheiro avalia o padrão e a estrutura do imóvel em ${c.nome} antes de fechar a proposta.`,
            },
            {
              t: `2. Homologação ${c.concessionaria}`,
              d: "Projeto elétrico, ART no CREA, protocolo e acompanhamento da vistoria 100% por nossa conta.",
            },
            {
              t: "3. Instalação com Equipe Própria",
              d: `Técnicos da base de ${base.cidade} executam a montagem sem subcontratação.`,
            },
            {
              t: "4. Garantia & Monitoramento",
              d: "25 anos de garantia de geração nos módulos e acompanhamento do rendimento pelo app no celular.",
            },
          ].map((s) => (
            <div key={s.t} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-display text-base font-bold text-foreground">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Cidades Vizinhas */}
      {vizinhas.length ? (
        <Section title="Cidades atendidas na mesma região">
          <ul className="flex flex-wrap gap-3">
            {vizinhas.map((v) => (
              <li key={v.slug}>
                <Link
                  to="/energia-solar/$cidade"
                  params={{ cidade: v.slug }}
                  className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-lzgreen hover:text-lzgreen"
                >
                  Energia solar em {v.nome}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/energia-solar"
                className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-lzgreen hover:text-lzgreen"
              >
                Ver todas as cidades atendidas
              </Link>
            </li>
          </ul>
        </Section>
      ) : null}

      {/* FAQ Local da Cidade */}
      <Section title={`Perguntas Frequentes sobre Energia Solar em ${c.nome}`}>
        <FaqList faqs={faqs} />
        <div className="mt-10 rounded-3xl border border-border bg-navy-deep p-8 md:p-12 text-white shadow-xl">
          <div className="max-w-2xl">
            <h3 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">
              Pronto para zerar até 95% da sua conta de luz em {c.nome}?
            </h3>
            <p className="mt-3 text-sm md:text-base text-white/75 leading-relaxed">
              Faça sua simulação gratuita agora. Nossa equipe da base de {base.cidade} analisa sua
              conta de luz e entrega um estudo de engenharia completo.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                to="/quiz"
                className="inline-flex items-center gap-2 rounded-xl bg-lzgreen hover:bg-lzgreen-strong text-navy-deep font-bold px-7 py-3.5 text-sm shadow-lg transition"
              >
                Fazer Simulação Gratuita em {c.nome} <ArrowRight className="h-4 w-4" />
              </Link>
              <WhatsAppGate
                whatsapp={settings.whatsapp}
                location={`cidade_cta_bottom_${c.slug}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 hover:border-lzgreen hover:text-lzgreen px-6 py-3.5 text-sm font-semibold text-white transition"
              >
                <WhatsAppIcon className="h-4 w-4" /> Falar no WhatsApp
              </WhatsAppGate>
            </div>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
