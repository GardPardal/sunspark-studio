import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sun, Leaf, TrendingUp, Home, Wrench, Headphones, ShieldCheck, Users, Zap,
  MapPin, Phone, Mail, Instagram, ArrowRight, CheckCircle2, DollarSign, Menu, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings, waHref, DEFAULT_SETTINGS } from "@/lib/site-settings";

import logoAsset from "@/assets/lz7-logo.png.asset.json";
import solar1 from "@/assets/solar-1.jpg.asset.json";
import solar2 from "@/assets/solar-2.jpg.asset.json";
import solar3 from "@/assets/solar-3.jpg.asset.json";
import solar4 from "@/assets/solar-4.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LZ7 Energia — Energia Solar para PR, SP e SC | Economize até 95%" },
      {
        name: "description",
        content:
          "Instale energia solar com a LZ7 Energia e economize até 95% na conta de luz. Projetos personalizados no Paraná, São Paulo e Santa Catarina. Solicite seu orçamento gratuito.",
      },
      { property: "og:title", content: "LZ7 Energia — Energia Solar para sua casa ou empresa" },
      {
        property: "og:description",
        content:
          "Reduza sua conta de luz em até 95% com sistemas fotovoltaicos personalizados. Atendemos PR, SP e SC.",
      },
      { property: "og:url", content: "/" },
      { name: "keywords", content: "energia solar, painel solar, fotovoltaico, Paraná, São Paulo, Santa Catarina, Wenceslau Braz, Londrina, LZ7" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: "LZ7 Energia",
          image: logoAsset.url,
          "@id": "https://lz7energia.com.br",
          telephone: "+55 43 99617-2509",
          areaServed: ["Paraná", "São Paulo", "Santa Catarina"],
          address: [
            { "@type": "PostalAddress", addressLocality: "Wenceslau Braz", addressRegion: "PR", addressCountry: "BR" },
            { "@type": "PostalAddress", addressLocality: "Londrina", addressRegion: "PR", addressCountry: "BR" },
            { "@type": "PostalAddress", addressLocality: "São Paulo", addressRegion: "SP", addressCountry: "BR" },
          ],
          description: "Instalação de sistemas de energia solar fotovoltaica para residências, empresas e propriedades rurais.",
        }),
      },
    ],
  }),
  component: LandingPage,
});

/* ---------------------------------- data ---------------------------------- */

const benefits = [
  { icon: DollarSign, title: "Economia de até 95%", text: "Reduza drasticamente sua conta de luz todos os meses." },
  { icon: Leaf, title: "Energia limpa", text: "Fonte 100% renovável, sem emissão de poluentes." },
  { icon: Home, title: "Valoriza o imóvel", text: "Imóveis com sistema solar valem até 8% mais." },
  { icon: Wrench, title: "Projeto personalizado", text: "Dimensionamento sob medida para o seu consumo." },
  { icon: ShieldCheck, title: "Garantia de 25 anos", text: "Equipamentos de primeira linha com garantia estendida." },
  { icon: Headphones, title: "Suporte especializado", text: "Equipe técnica dedicada em todas as fases." },
];

const steps = [
  { n: "01", title: "Solicite orçamento", text: "Preencha o formulário e nossa equipe entra em contato." },
  { n: "02", title: "Análise da conta", text: "Avaliamos seu consumo e o melhor sistema para você." },
  { n: "03", title: "Projeto técnico", text: "Elaboramos o projeto e a homologação junto à concessionária." },
  { n: "04", title: "Instalação", text: "Nossa equipe própria instala com segurança e agilidade." },
  { n: "05", title: "Economia", text: "Sua usina começa a gerar economia no próximo ciclo." },
];

const differentiators = [
  { icon: Users, title: "Equipe própria e especializada" },
  { icon: ShieldCheck, title: "Equipamentos homologados" },
  { icon: Zap, title: "Atendimento rápido" },
  { icon: CheckCircle2, title: "Garantia estendida" },
  { icon: Wrench, title: "Projetos personalizados" },
  { icon: DollarSign, title: "Financiamento facilitado" },
];

const offices = [
  { city: "Wenceslau Braz", state: "PR" },
  { city: "Londrina", state: "PR" },
  { city: "São Paulo", state: "SP" },
];

const testimonials = [
  { name: "Marcelo A.", city: "Londrina — PR", text: "Reduzi minha conta de R$ 1.200 para R$ 89. Atendimento impecável do início ao fim." },
  { name: "Fernanda R.", city: "Wenceslau Braz — PR", text: "Equipe profissional, instalação rápida e resultado surpreendente já no primeiro mês." },
  { name: "Rodrigo S.", city: "São Paulo — SP", text: "Projeto sob medida para minha empresa. Retorno do investimento em pouco tempo." },
];

const faqs = [
  { q: "Quanto posso economizar com energia solar?", a: "A economia varia entre 70% e 95% da sua conta de luz, dependendo do consumo e do dimensionamento do sistema." },
  { q: "Quanto tempo leva a instalação?", a: "Em média entre 30 e 60 dias, incluindo projeto, homologação com a concessionária e instalação física." },
  { q: "Existe financiamento?", a: "Sim. Trabalhamos com as principais linhas de financiamento verde do mercado, com parcelas que geralmente cabem na economia gerada." },
  { q: "Qual a garantia dos equipamentos?", a: "Os painéis solares possuem 25 anos de garantia de geração e os inversores até 12 anos, dependendo da marca." },
  { q: "Vocês atendem minha região?", a: "Atendemos todo o Paraná, São Paulo e Santa Catarina, com escritórios em Wenceslau Braz, Londrina e São Paulo." },
  { q: "Preciso fazer manutenção?", a: "A manutenção é mínima. Recomendamos apenas limpeza periódica dos painéis e uma vistoria anual do sistema." },
];

/* --------------------------------- helpers -------------------------------- */

function trackEvent(name: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  // GTM dataLayer
  const w = window as unknown as { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: name, ...data });
  if (typeof w.fbq === "function") w.fbq("track", name, data);
}

function toEmbed(url: string) {
  if (!url) return "";
  if (url.includes("/embed/")) return url;
  const m = url.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

/* --------------------------------- page ---------------------------------- */

function LandingPage() {
  const { data: settings = DEFAULT_SETTINGS } = useSiteSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  // scroll depth tracking
  useEffect(() => {
    const seen = new Set<number>();
    const onScroll = () => {
      const p = Math.round(((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100);
      [25, 50, 75, 100].forEach((mark) => {
        if (p >= mark && !seen.has(mark)) {
          seen.add(mark);
          trackEvent("scroll_depth", { depth: mark });
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const navLinks = [
    { id: "sobre", label: "Sobre" },
    { id: "beneficios", label: "Benefícios" },
    { id: "como-funciona", label: "Como funciona" },
    { id: "atendimento", label: "Atendimento" },
    { id: "faq", label: "FAQ" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------- HEADER ---------- */}
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-primary/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <a href="#top" className="flex items-center gap-2" aria-label="LZ7 Energia">
            <img src={logoAsset.url} alt="LZ7 Energia" className="h-10 w-auto" width={120} height={40} />
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <button
                key={l.id}
                onClick={() => { trackEvent("menu_click", { item: l.id }); scrollTo(l.id); }}
                className="text-sm font-medium text-primary-foreground/80 transition hover:text-primary-foreground"
              >
                {l.label}
              </button>
            ))}
          </nav>
          <div className="hidden md:block">
            <Button
              onClick={() => { trackEvent("cta_click", { location: "header" }); scrollTo("orcamento"); }}
              className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
            >
              Solicitar orçamento
            </Button>
          </div>
          <button
            className="md:hidden text-primary-foreground"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-primary-foreground/10 bg-primary px-4 py-4 space-y-3">
            {navLinks.map((l) => (
              <button key={l.id} onClick={() => scrollTo(l.id)} className="block w-full text-left text-primary-foreground">
                {l.label}
              </button>
            ))}
            <Button
              onClick={() => scrollTo("orcamento")}
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold"
            >
              Solicitar orçamento
            </Button>
          </div>
        )}
      </header>

      <main id="top" className="pt-16">
        {/* ---------- HERO ---------- */}
        <section className="relative overflow-hidden bg-gradient-hero">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-6 md:py-24 lg:grid-cols-2 lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sun className="h-3.5 w-3.5" /> Energia Solar Fotovoltaica
              </span>
              <h1 className="text-4xl font-normal leading-[1.05] text-foreground md:text-6xl">
                {settings.hero_title}
              </h1>
              <p className="max-w-xl text-lg text-muted-foreground">{settings.hero_subtitle}</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => { trackEvent("cta_click", { location: "hero" }); scrollTo("orcamento"); }}
                  className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold shadow-elegant"
                >
                  Solicitar orçamento gratuito <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  onClick={() => trackEvent("whatsapp_click", { location: "hero" })}
                  className="border-primary text-primary hover:bg-primary/5"
                >
                  <a href={waHref(settings.whatsapp)} target="_blank" rel="noreferrer">
                    Falar pelo WhatsApp
                  </a>
                </Button>
              </div>
              <div className="flex flex-wrap gap-6 pt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> +500 projetos entregues</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> 25 anos de garantia</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> PR · SP · SC</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative aspect-video overflow-hidden rounded-2xl bg-primary shadow-elegant"
            >
              <iframe
                src={toEmbed(settings.video_url)}
                title="Vídeo institucional LZ7 Energia"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="h-full w-full"
                onLoad={() => trackEvent("video_view")}
              />
            </motion.div>
          </div>
        </section>

        {/* ---------- SOBRE ---------- */}
        <section id="sobre" className="py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <img src={solar1.url} alt="Instalação de painéis solares pela LZ7" loading="lazy" width={800} height={500}
                className="rounded-2xl object-cover shadow-elegant aspect-[4/3] w-full" />
              <img src={solar2.url} alt="Equipe LZ7 em telhado industrial" loading="lazy" width={300} height={200}
                className="absolute -bottom-8 -right-4 hidden w-1/2 rounded-2xl border-4 border-background shadow-elegant md:block aspect-[4/3] object-cover" />
            </div>
            <div className="space-y-6">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">Sobre a LZ7</span>
              <h2 className="text-3xl md:text-5xl">Energia solar com autonomia, técnica e presença regional</h2>
              <p className="text-lg text-muted-foreground">
                Somos uma empresa especializada em projetos de energia solar fotovoltaica. Cuidamos de cada etapa
                — do dimensionamento à homologação e instalação — com equipe própria, equipamentos homologados e
                atendimento próximo do cliente.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-5 border-primary/10">
                  <MapPin className="h-5 w-5 text-primary mb-2" />
                  <h3 className="font-semibold text-base mb-1">Presença física</h3>
                  <p className="text-sm text-muted-foreground">Escritórios em Wenceslau Braz, Londrina e São Paulo.</p>
                </Card>
                <Card className="p-5 border-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary mb-2" />
                  <h3 className="font-semibold text-base mb-1">Atendimento regional</h3>
                  <p className="text-sm text-muted-foreground">Projetos entregues em PR, SP e SC.</p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- BENEFÍCIOS ---------- */}
        <section id="beneficios" className="py-20 md:py-28 bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center mb-14">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">Benefícios</span>
              <h2 className="mt-2 text-3xl md:text-5xl">Por que investir em energia solar?</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {benefits.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                >
                  <Card className="group h-full p-7 border-primary/10 transition hover:shadow-elegant hover:border-primary/30 hover:-translate-y-1">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <b.icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{b.title}</h3>
                    <p className="text-muted-foreground">{b.text}</p>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- COMO FUNCIONA ---------- */}
        <section id="como-funciona" className="py-20 md:py-28">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center mb-14">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">Passo a passo</span>
              <h2 className="mt-2 text-3xl md:text-5xl">Simples do começo ao fim</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-5">
              {steps.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                  className="relative rounded-2xl border border-primary/10 bg-card p-6 text-center"
                >
                  <div className="font-display text-4xl text-primary/40">{s.n}</div>
                  <h3 className="mt-3 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- DIFERENCIAIS ---------- */}
        <section className="py-20 md:py-28 bg-gradient-dark text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center mb-14">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary-foreground/70">Diferenciais</span>
              <h2 className="mt-2 text-3xl md:text-5xl text-primary-foreground">O que nos torna únicos</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {differentiators.map((d, i) => (
                <motion.div
                  key={d.title}
                  initial={{ opacity: 0, scale: 0.96 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="flex items-center gap-4 rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 backdrop-blur transition hover:bg-primary-foreground/10"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cta text-cta-foreground">
                    <d.icon className="h-6 w-6" />
                  </div>
                  <span className="font-semibold">{d.title}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- ATENDIMENTO ---------- */}
        <section id="atendimento" className="py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">Área de atendimento</span>
              <h2 className="mt-2 text-3xl md:text-5xl">Presença em três estados</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Atuamos em todo o Paraná, São Paulo e Santa Catarina com escritórios físicos que garantem
                atendimento local e agilidade nas visitas técnicas.
              </p>
              <div className="mt-8 space-y-3">
                {offices.map((o) => (
                  <div key={o.city} className="flex items-center gap-4 rounded-xl border border-primary/10 bg-card p-4">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-semibold">{o.city}</div>
                      <div className="text-sm text-muted-foreground">{o.state}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Paraná", "São Paulo", "Santa Catarina"].map((s) => (
                  <span key={s} className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <img src={solar3.url} alt="Instalação solar residencial" loading="lazy" width={400} height={500}
                className="rounded-2xl object-cover shadow-soft aspect-[4/5]" />
              <img src={solar4.url} alt="Instalação solar comercial" loading="lazy" width={400} height={500}
                className="mt-8 rounded-2xl object-cover shadow-soft aspect-[4/5]" />
            </div>
          </div>
        </section>

        {/* ---------- DEPOIMENTOS ---------- */}
        <section className="py-20 md:py-28 bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center mb-14">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">Depoimentos</span>
              <h2 className="mt-2 text-3xl md:text-5xl">Clientes que já economizam</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <Card className="h-full p-7 border-primary/10">
                    <div className="mb-3 flex text-cta">{"★★★★★"}</div>
                    <p className="italic text-foreground">"{t.text}"</p>
                    <div className="mt-4">
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-sm text-muted-foreground">{t.city}</div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="py-20 md:py-28">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <div className="mb-10 text-center">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">FAQ</span>
              <h2 className="mt-2 text-3xl md:text-5xl">Dúvidas frequentes</h2>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((f, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ---------- FORM ---------- */}
        <LeadForm whatsapp={settings.whatsapp} />

        {/* ---------- FOOTER ---------- */}
        <footer className="bg-gradient-dark text-primary-foreground">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-6 md:grid-cols-4">
            <div>
              <img src={logoAsset.url} alt="LZ7 Energia" className="h-12 w-auto" />
              <p className="mt-4 text-sm text-primary-foreground/70">
                Energia solar para residências, empresas e propriedades rurais no Paraná, São Paulo e Santa Catarina.
              </p>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-primary-foreground">Contato</h3>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  <a href={`tel:${settings.phone.replace(/\D/g, "")}`} onClick={() => trackEvent("phone_click")}>
                    {settings.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${settings.email}`} onClick={() => trackEvent("email_click")}>
                    {settings.email}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  <a href={settings.instagram} target="_blank" rel="noreferrer">@lz7energia</a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-primary-foreground">Escritórios</h3>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                {offices.map((o) => (
                  <li key={o.city}>{o.city} — {o.state}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-4 font-semibold text-primary-foreground">Área</h3>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/auth" className="hover:text-primary-foreground">Painel administrativo</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/10 py-6 text-center text-xs text-primary-foreground/60">
            © {new Date().getFullYear()} LZ7 Energia. Todos os direitos reservados.
          </div>
        </footer>
      </main>

      {/* Floating WhatsApp */}
      <a
        href={waHref(settings.whatsapp)}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackEvent("whatsapp_click", { location: "floating" })}
        aria-label="WhatsApp"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elegant transition hover:scale-110"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
          <path d="M20.52 3.48A11.9 11.9 0 0 0 12.06 0C5.5 0 .17 5.33.17 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.74 1.47h.01c6.56 0 11.89-5.33 11.89-11.9 0-3.18-1.24-6.17-3.44-8.43zM12.07 21.7h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.75.98 1-3.66-.23-.38a9.8 9.8 0 0 1-1.5-5.16c0-5.42 4.41-9.83 9.84-9.83 2.63 0 5.1 1.02 6.96 2.88a9.77 9.77 0 0 1 2.88 6.96c0 5.42-4.41 9.83-9.83 9.83zm5.4-7.35c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
        </svg>
      </a>
    </div>
  );
}

/* -------------------------------- Lead form ------------------------------- */

function LeadForm({ whatsapp }: { whatsapp: string }) {
  const [form, setForm] = useState({
    nome: "", telefone: "", email: "", cidade: "", estado: "", valor_conta: "", mensagem: "",
  });

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { error } = await supabase.from("leads").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      trackEvent("generate_lead", { location: "form" });
      trackEvent("Lead");
      toast.success("Recebemos sua solicitação! Nossa equipe entrará em contato em breve.");
      setForm({ nome: "", telefone: "", email: "", cidade: "", estado: "", valor_conta: "", mensagem: "" });
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar. Tente novamente."),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) {
      toast.error("Nome e telefone são obrigatórios.");
      return;
    }
    mutation.mutate(form);
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section id="orcamento" className="py-20 md:py-28 bg-gradient-hero">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 md:px-6 lg:grid-cols-5 lg:items-center">
        <div className="lg:col-span-2 space-y-4">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">Orçamento grátis</span>
          <h2 className="text-3xl md:text-5xl">Comece a economizar hoje</h2>
          <p className="text-lg text-muted-foreground">
            Preencha o formulário ao lado e nossa equipe entra em contato em até 24 horas com uma proposta
            personalizada.
          </p>
          <div className="space-y-3 pt-2 text-sm">
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> Análise personalizada da sua conta</div>
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> Simulação de economia real</div>
            <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> Sem compromisso</div>
          </div>
          <Button variant="outline" asChild className="mt-4 border-primary text-primary"
            onClick={() => trackEvent("whatsapp_click", { location: "form_side" })}>
            <a href={waHref(whatsapp)} target="_blank" rel="noreferrer">Prefere o WhatsApp?</a>
          </Button>
        </div>
        <Card className="lg:col-span-3 p-6 md:p-8 shadow-elegant border-primary/10">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" required value={form.nome} onChange={set("nome")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
              <Input id="telefone" required type="tel" value={form.telefone} onChange={set("telefone")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={set("email")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={form.cidade} onChange={set("cidade")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" value={form.estado} onChange={set("estado")} className="mt-1.5" placeholder="PR / SP / SC" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="valor">Valor médio da conta de luz</Label>
              <Input id="valor" value={form.valor_conta} onChange={set("valor_conta")} placeholder="Ex: R$ 500,00" className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="msg">Mensagem</Label>
              <Textarea id="msg" rows={4} value={form.mensagem} onChange={set("mensagem")} className="mt-1.5" />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={mutation.isPending}
              className="sm:col-span-2 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold shadow-elegant"
            >
              {mutation.isPending ? "Enviando..." : "Quero economizar"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="sm:col-span-2 text-xs text-muted-foreground text-center">
              Ao enviar, você concorda em ser contatado pela LZ7 Energia.
            </p>
          </form>
        </Card>
      </div>
    </section>
  );
}
