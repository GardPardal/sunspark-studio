import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowRight,
  Award,
  BatteryCharging,
  Building2,
  CheckCircle2,
  DollarSign,
  Factory,
  Home,
  Instagram,
  Leaf,
  Mail,
  MapPin,
  Menu,
  Phone,
  PiggyBank,
  ShieldCheck,
  Sprout,
  Sun,
  TrendingUp,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { siteSettingsQueryOptions, useResolvedSiteSettings, waHref, type SettingsMap } from "@/lib/site-settings";
import { initAllTrackers, trackLeadConversion, persistFirstTouch, getPersistedAttribution } from "@/lib/tracking";
import { LizChat } from "@/components/liz-chat";

type IconKey = "award" | "battery" | "building" | "dollar" | "factory" | "home" | "leaf" | "map" | "piggy" | "shield" | "sprout" | "sun" | "trend" | "users" | "wrench";
type TextItem = { title: string; text: string; icon?: IconKey };
type StatItem = { value: string; label: string };
type StepItem = { n: string; title: string; text: string };
type OfficeItem = { city: string; state: string };
type TestimonialItem = { name: string; city: string; text: string };
type FaqItem = { q: string; a: string };

type LandingContent = {
  brandName: string;
  seo: { title: string; description: string; keywords: string };
  nav: Array<{ id: string; label: string }>;
  buttons: Record<string, string>;
  hero: { badge: string; videoTitle: string; videoCaption: string; trustItems: string[] };
  about: { eyebrow: string; title: string; text: string; primaryImageAlt: string; secondaryImageAlt: string; cards: TextItem[] };
  differentiators: { eyebrow: string; title: string; items: TextItem[] };
  savings: { eyebrow: string; title: string; text: string; items: string[]; imageAlt: string };
  segments: { eyebrow: string; title: string; items: TextItem[] };
  hybrid: { eyebrow: string; titleStart: string; titleHighlight: string; text: string; items: string[]; imageAlt: string };
  numbers: { eyebrow: string; title: string; items: StatItem[] };
  process: { eyebrow: string; title: string; items: StepItem[] };
  benefits: { eyebrow: string; title: string; items: TextItem[] };
  freedom: { eyebrow: string; line1: string; line1Suffix: string; lines: string[] };
  serviceArea: { eyebrow: string; title: string; text: string; offices: OfficeItem[]; states: string[]; primaryImageAlt: string; secondaryImageAlt: string };
  testimonials: { eyebrow: string; title: string; items: TestimonialItem[] };
  faq: { eyebrow: string; title: string; items: FaqItem[] };
  form: {
    eyebrow: string;
    title: string;
    text: string;
    items: string[];
    labels: Record<"name" | "phone" | "email" | "city" | "state" | "bill" | "message", string>;
    placeholders: Record<"phone" | "state" | "bill", string>;
    consent: string;
  };
  footer: { description: string; contactTitle: string; officesTitle: string; areaTitle: string; adminLink: string; rights: string; credit: string };
  whatsappDialog: { title: string; description: string; nameLabel: string; phoneLabel: string; phonePlaceholder: string; cancel: string; submit: string; sending: string };
};

const iconMap: Record<IconKey, LucideIcon> = {
  award: Award,
  battery: BatteryCharging,
  building: Building2,
  dollar: DollarSign,
  factory: Factory,
  home: Home,
  leaf: Leaf,
  map: MapPin,
  piggy: PiggyBank,
  shield: ShieldCheck,
  sprout: Sprout,
  sun: Sun,
  trend: TrendingUp,
  users: Users,
  wrench: Wrench,
};

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
  head: ({ loaderData }) => {
    const settings = loaderData as SettingsMap | undefined;
    const content = settings ? readLandingContent(settings) : null;
    const videoId = settings ? youtubeId(settings.video_url) : null;
    const poster = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
    return {
      meta: [
        { title: content?.seo.title ?? "Site" },
        { name: "description", content: content?.seo.description ?? "" },
        { property: "og:title", content: content?.seo.title ?? "Site" },
        { property: "og:description", content: content?.seo.description ?? "" },
        { property: "og:url", content: "https://lz7energia.com.br/" },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { name: "keywords", content: content?.seo.keywords ?? "" },
        { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" },
        { name: "googlebot", content: "index,follow" },
      ],
      links: [
        { rel: "canonical", href: "https://lz7energia.com.br/" },
        { rel: "preconnect", href: "https://i.ytimg.com" },
        ...(poster ? [{ rel: "preload", as: "image", href: poster, fetchpriority: "high" }] : []),
      ],
      scripts: content && settings ? buildJsonLd(content, settings) : [],
    };
  },
  component: LandingPage,
});

function readLandingContent(settings: SettingsMap): LandingContent {
  try {
    const parsed = JSON.parse(settings.landing_content_json) as LandingContent;
    if (!parsed.brandName || !parsed.hero || !parsed.form || !parsed.footer) throw new Error("invalid");
    return parsed;
  } catch {
    throw new Error("Conteúdo visual do site inválido no banco de dados.");
  }
}

function buildJsonLd(content: LandingContent, settings: SettingsMap) {
  const offices = content.serviceArea.offices;
  const states = content.serviceArea.states;
  return [
    {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": "https://lz7energia.com.br/#business",
        name: content.brandName,
        image: settings.logo_url?.startsWith("http") ? settings.logo_url : `https://lz7energia.com.br${settings.logo_url}`,
        url: "https://lz7energia.com.br/",
        telephone: settings.phone,
        email: settings.email,
        areaServed: states.map((name) => ({ "@type": "State", name })),
        address: offices.map((office) => ({ "@type": "PostalAddress", addressLocality: office.city, addressRegion: office.state, addressCountry: "BR" })),
        sameAs: [settings.instagram],
        description: content.seo.description,
      }),
    },
    {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: content.faq.items.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      }),
    },
  ];
}

function trackEvent(name: string, data?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: name, ...data });
  if (typeof w.fbq === "function") w.fbq("track", name, data);
}

function youtubeId(url: string): string | null {
  const match = url.match(/(?:\/embed\/|youtu\.be\/|v=|shorts\/)([\w-]{6,})/);
  return match ? match[1] : null;
}

function YouTubeFacade({ url, title, onPlay }: { url: string; title: string; onPlay?: () => void }) {
  const [active, setActive] = useState(false);
  const id = youtubeId(url);
  if (!id) throw new Error("Vídeo configurado inválido.");
  const poster = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-primary shadow-elegant">
      {active ? (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => { setActive(true); onPlay?.(); }} className="group relative h-full w-full" aria-label={title}>
          <img src={poster} alt={title} loading="eager" fetchPriority="high" decoding="async" width={480} height={360} className="h-full w-full object-cover" />
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/25 transition group-hover:bg-foreground/35">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-elegant">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center mb-14">
      <span className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</span>
      <h2 className="mt-2 text-3xl md:text-5xl font-bold">{title}</h2>
    </div>
  );
}

function IconCard({ item }: { item: TextItem }) {
  const Icon = iconMap[item.icon ?? "sun"];
  return (
    <Card className="group h-full p-7 border-primary/10 transition hover:shadow-elegant hover:border-primary/30 hover:-translate-y-1">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
      <p className="text-muted-foreground">{item.text}</p>
    </Card>
  );
}

function LandingPage() {
  const settings = useResolvedSiteSettings();
  const content = useMemo(() => readLandingContent(settings), [settings]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { persistFirstTouch(); }, []);

  useEffect(() => {
    initAllTrackers({
      gtm_id: settings.gtm_id,
      ga4_measurement_id: settings.ga4_measurement_id,
      google_ads_id: settings.google_ads_id,
      meta_pixel_id: settings.meta_pixel_id,
      tiktok_pixel_id: settings.tiktok_pixel_id,
    });
  }, [settings.gtm_id, settings.ga4_measurement_id, settings.google_ads_id, settings.meta_pixel_id, settings.tiktok_pixel_id]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 z-50 w-full border-b border-border/50 bg-primary/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <a href="#top" className="flex items-center gap-2" aria-label={content.brandName}>
            <img src={settings.logo_url} alt={content.brandName} className="h-10 w-auto" width={120} height={40} />
          </a>
          <nav className="hidden items-center gap-8 md:flex">
            {content.nav.map((link) => (
              <button key={link.id} onClick={() => { trackEvent("menu_click", { item: link.id }); scrollTo(link.id); }} className="text-sm font-medium text-primary-foreground/80 transition hover:text-primary-foreground">
                {link.label}
              </button>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth" className="text-sm font-medium text-primary-foreground/90 hover:text-primary-foreground border border-primary-foreground/30 rounded-md px-4 py-2 transition">
              {content.buttons.adminLogin}
            </Link>
            <Button onClick={() => { trackEvent("cta_click", { location: "header" }); scrollTo("orcamento"); }} className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
              {content.buttons.requestQuote}
            </Button>
          </div>
          <button className="md:hidden text-primary-foreground" onClick={() => setMenuOpen(!menuOpen)} aria-label={content.buttons.adminLoginMobile}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen ? (
          <div className="md:hidden border-t border-primary-foreground/10 bg-primary px-4 py-4 space-y-3">
            {content.nav.map((link) => (
              <button key={link.id} onClick={() => scrollTo(link.id)} className="block w-full text-left text-primary-foreground">
                {link.label}
              </button>
            ))}
            <Link to="/auth" className="block w-full text-center text-primary-foreground border border-primary-foreground/30 rounded-md px-4 py-2">
              {content.buttons.adminLoginMobile}
            </Link>
            <Button onClick={() => scrollTo("orcamento")} className="w-full bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">
              {content.buttons.requestQuote}
            </Button>
          </div>
        ) : null}
      </header>

      <main id="top">
        {settings.custom_block_top_html?.trim() ? <div dangerouslySetInnerHTML={{ __html: settings.custom_block_top_html }} /> : null}

        <section className="relative overflow-hidden bg-gradient-hero pt-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-4 pb-12 md:px-6 md:pt-6 md:pb-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:pt-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <Sun className="h-3.5 w-3.5" /> {content.hero.badge}
              </span>
              <h1 className="text-[2rem] font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-[3.25rem] lg:text-6xl">{settings.hero_title}</h1>
              <p className="max-w-xl text-base text-muted-foreground md:text-lg">{settings.hero_subtitle}</p>
              <div className="grid grid-cols-1 gap-3 pt-1 sm:inline-grid sm:auto-cols-max sm:grid-flow-col">
                <Button size="lg" onClick={() => { trackEvent("cta_click", { location: "hero" }); scrollTo("orcamento"); }} className="h-12 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold shadow-elegant px-6">
                  {content.buttons.heroQuote} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <WhatsAppGate whatsapp={settings.whatsapp} dialog={content.whatsappDialog} location="hero" size="lg" variant="outline" className="h-12 border-primary text-primary hover:bg-primary/5 font-semibold px-6">
                  {content.buttons.whatsapp}
                </WhatsAppGate>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-3 text-sm text-muted-foreground">
                {content.hero.trustItems.map((item) => <span key={item} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-primary" /> {item}</span>)}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }} className="space-y-3">
              <YouTubeFacade url={settings.video_url} title={content.hero.videoTitle} onPlay={() => trackEvent("video_view")} />
              <p className="text-center text-sm font-medium text-muted-foreground">{content.hero.videoCaption}</p>
            </motion.div>
          </div>
        </section>

        <section id="sobre" className="py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2 lg:items-center">
            <div className="relative">
              <img src={settings.section_image_about_primary} alt={content.about.primaryImageAlt} loading="lazy" width={800} height={500} className="rounded-2xl object-cover shadow-elegant aspect-[4/3] w-full" />
              <img src={settings.section_image_about_secondary} alt={content.about.secondaryImageAlt} loading="lazy" width={300} height={200} className="absolute -bottom-8 -right-4 hidden w-1/2 rounded-2xl border-4 border-background shadow-elegant md:block aspect-[4/3] object-cover" />
            </div>
            <div className="space-y-6">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">{content.about.eyebrow}</span>
              <h2 className="text-3xl md:text-5xl font-bold">{content.about.title}</h2>
              <p className="text-lg text-muted-foreground">{content.about.text}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {content.about.cards.map((card) => {
                  const Icon = iconMap[card.icon ?? "sun"];
                  return <Card key={card.title} className="p-5 border-primary/10"><Icon className="h-5 w-5 text-primary mb-2" /><h3 className="font-semibold text-base mb-1">{card.title}</h3><p className="text-sm text-muted-foreground">{card.text}</p></Card>;
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28 bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <SectionTitle eyebrow={content.differentiators.eyebrow} title={content.differentiators.title} />
            <div className="grid gap-6 md:grid-cols-3">{content.differentiators.items.map((item, i) => <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, delay: i * 0.08 }}><IconCard item={item} /></motion.div>)}</div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">{content.savings.eyebrow}</span>
              <h2 className="text-3xl md:text-5xl font-bold">{content.savings.title}</h2>
              <p className="text-lg text-muted-foreground">{content.savings.text}</p>
              <ul className="space-y-3">{content.savings.items.map((item) => <li key={item} className="flex items-start gap-3"><CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" /><span className="text-foreground">{item}</span></li>)}</ul>
              <Button size="lg" onClick={() => { trackEvent("cta_click", { location: "economize" }); scrollTo("orcamento"); }} className="bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">{content.buttons.economize} <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
            <img src={settings.section_image_savings} alt={content.savings.imageAlt} loading="lazy" width={1200} height={900} className="rounded-2xl object-cover shadow-elegant aspect-[4/3] w-full" />
          </div>
        </section>

        <section id="segmentos" className="py-20 md:py-28 bg-secondary/40"><div className="mx-auto max-w-7xl px-4 md:px-6"><SectionTitle eyebrow={content.segments.eyebrow} title={content.segments.title} /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{content.segments.items.map((item, i) => <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }}><IconCard item={item} /></motion.div>)}</div></div></section>

        <section className="py-20 md:py-28 bg-gradient-dark text-primary-foreground">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2 lg:items-center">
            <div><span className="inline-flex items-center gap-2 rounded-full bg-cta/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cta"><BatteryCharging className="h-3.5 w-3.5" /> {content.hybrid.eyebrow}</span><h2 className="mt-4 text-4xl md:text-6xl font-bold">{content.hybrid.titleStart} <span className="text-cta">{content.hybrid.titleHighlight}</span></h2><p className="mt-6 text-lg text-primary-foreground/80">{content.hybrid.text}</p><div className="mt-8 grid grid-cols-3 gap-4">{content.hybrid.items.map((item) => <div key={item} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-4 text-center"><div className="text-sm font-semibold">{item}</div></div>)}</div><Button size="lg" onClick={() => { trackEvent("cta_click", { location: "hibrido" }); scrollTo("orcamento"); }} className="mt-8 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold">{content.buttons.hybrid} <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
            <img src={settings.section_image_hybrid} alt={content.hybrid.imageAlt} loading="lazy" width={1200} height={900} className="rounded-2xl object-cover shadow-elegant aspect-[4/3] w-full" />
          </div>
        </section>

        <section className="py-20 md:py-28"><div className="mx-auto max-w-7xl px-4 md:px-6"><SectionTitle eyebrow={content.numbers.eyebrow} title={content.numbers.title} /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{content.numbers.items.map((item, i) => <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="rounded-2xl border border-primary/10 bg-card p-8 text-center shadow-soft"><div className="font-display text-4xl md:text-5xl font-bold text-primary">{item.value}</div><div className="mt-2 text-sm text-muted-foreground">{item.label}</div></motion.div>)}</div></div></section>
        <section id="como-funciona" className="py-20 md:py-28 bg-secondary/40"><div className="mx-auto max-w-7xl px-4 md:px-6"><SectionTitle eyebrow={content.process.eyebrow} title={content.process.title} /><div className="grid gap-6 md:grid-cols-5">{content.process.items.map((item, i) => <motion.div key={item.n} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }} className="relative rounded-2xl border border-primary/10 bg-card p-6 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-display font-bold">{item.n}</div><h3 className="mt-4 font-semibold">{item.title}</h3><p className="mt-2 text-sm text-muted-foreground">{item.text}</p></motion.div>)}</div></div></section>
        <section id="beneficios" className="py-20 md:py-28"><div className="mx-auto max-w-7xl px-4 md:px-6"><SectionTitle eyebrow={content.benefits.eyebrow} title={content.benefits.title} /><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{content.benefits.items.map((item, i) => <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.4, delay: i * 0.04 }}><IconCard item={item} /></motion.div>)}</div></div></section>

        <section className="py-20 md:py-28 bg-gradient-dark text-primary-foreground"><div className="mx-auto max-w-4xl px-4 md:px-6 text-center"><span className="text-sm font-semibold uppercase tracking-widest text-cta">{content.freedom.eyebrow}</span><h2 className="mt-4 text-4xl md:text-6xl font-bold leading-tight"><span className="text-cta">{content.freedom.line1}</span> {content.freedom.line1Suffix}</h2><div className="mt-8 space-y-2 text-xl md:text-2xl text-primary-foreground/85 font-display font-semibold">{content.freedom.lines.map((line, index) => <p key={line} className={index === content.freedom.lines.length - 1 ? "text-cta" : undefined}>{line}</p>)}</div><Button size="lg" onClick={() => { trackEvent("cta_click", { location: "liberdade" }); scrollTo("orcamento"); }} className="mt-10 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold shadow-elegant">{content.buttons.freedom} <ArrowRight className="ml-2 h-4 w-4" /></Button></div></section>

        <section id="atendimento" className="py-20 md:py-28"><div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-6 lg:grid-cols-2 lg:items-center"><div><span className="text-sm font-semibold uppercase tracking-widest text-primary">{content.serviceArea.eyebrow}</span><h2 className="mt-2 text-3xl md:text-5xl font-bold">{content.serviceArea.title}</h2><p className="mt-4 text-lg text-muted-foreground">{content.serviceArea.text}</p><div className="mt-8 space-y-3">{content.serviceArea.offices.map((office) => <div key={`${office.city}-${office.state}`} className="flex items-center gap-4 rounded-xl border border-primary/10 bg-card p-4"><MapPin className="h-5 w-5 text-primary" /><div><div className="font-semibold">{office.city}</div><div className="text-sm text-muted-foreground">{office.state}</div></div></div>)}</div><div className="mt-6 flex flex-wrap gap-2">{content.serviceArea.states.map((state) => <span key={state} className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">{state}</span>)}</div></div><div className="grid grid-cols-2 gap-4"><img src={settings.section_image_area_primary} alt={content.serviceArea.primaryImageAlt} loading="lazy" width={400} height={500} className="rounded-2xl object-cover shadow-soft aspect-[4/5]" /><img src={settings.section_image_area_secondary} alt={content.serviceArea.secondaryImageAlt} loading="lazy" width={400} height={500} className="mt-8 rounded-2xl object-cover shadow-soft aspect-[4/5]" /></div></div></section>
        <section className="py-20 md:py-28 bg-secondary/40"><div className="mx-auto max-w-7xl px-4 md:px-6"><SectionTitle eyebrow={content.testimonials.eyebrow} title={content.testimonials.title} /><div className="grid gap-6 md:grid-cols-3">{content.testimonials.items.map((item, i) => <motion.div key={item.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}><Card className="h-full p-7 border-primary/10"><div className="mb-3 flex text-cta">★★★★★</div><p className="italic text-foreground">“{item.text}”</p><div className="mt-4"><div className="font-semibold">{item.name}</div><div className="text-sm text-muted-foreground">{item.city}</div></div></Card></motion.div>)}</div></div></section>
        <section id="faq" className="py-20 md:py-28"><div className="mx-auto max-w-3xl px-4 md:px-6"><div className="mb-10 text-center"><span className="text-sm font-semibold uppercase tracking-widest text-primary">{content.faq.eyebrow}</span><h2 className="mt-2 text-3xl md:text-5xl font-bold">{content.faq.title}</h2></div><Accordion type="single" collapsible className="w-full">{content.faq.items.map((item, i) => <AccordionItem key={item.q} value={`item-${i}`}><AccordionTrigger className="text-left font-semibold">{item.q}</AccordionTrigger><AccordionContent className="text-muted-foreground">{item.a}</AccordionContent></AccordionItem>)}</Accordion></div></section>

        <LeadForm content={content} whatsapp={settings.whatsapp} adsId={settings.google_ads_id} adsLabel={settings.google_ads_conversion_label} />
        {settings.custom_block_bottom_html?.trim() ? <div dangerouslySetInnerHTML={{ __html: settings.custom_block_bottom_html }} /> : null}

        <footer className="bg-gradient-dark text-primary-foreground"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 md:px-6 md:grid-cols-4"><div><img src={settings.logo_url} alt={content.brandName} width={144} height={48} className="h-12 w-auto" /><p className="mt-4 text-sm text-primary-foreground/70">{content.footer.description}</p></div><div><h3 className="mb-4 font-semibold text-primary-foreground">{content.footer.contactTitle}</h3><ul className="space-y-2 text-sm text-primary-foreground/70"><li className="flex items-center gap-2"><Phone className="h-4 w-4" /><a href={`tel:${settings.phone.replace(/\D/g, "")}`} onClick={() => trackEvent("phone_click")}>{settings.phone}</a></li><li className="flex items-center gap-2"><Mail className="h-4 w-4" /><a href={`mailto:${settings.email}`} onClick={() => trackEvent("email_click")}>{settings.email}</a></li><li className="flex items-center gap-2"><Instagram className="h-4 w-4" /><a href={settings.instagram} target="_blank" rel="noreferrer">{settings.instagram.replace(/^https?:\/\//, "")}</a></li></ul></div><div><h3 className="mb-4 font-semibold text-primary-foreground">{content.footer.officesTitle}</h3><ul className="space-y-2 text-sm text-primary-foreground/70">{content.serviceArea.offices.map((office) => <li key={`${office.city}-${office.state}`}>{office.city} — {office.state}</li>)}</ul></div><div><h3 className="mb-4 font-semibold text-primary-foreground">{content.footer.areaTitle}</h3><ul className="space-y-2 text-sm text-primary-foreground/70"><li><Link to="/auth" className="hover:text-primary-foreground">{content.footer.adminLink}</Link></li></ul></div></div><div className="border-t border-primary-foreground/10 py-6 text-center text-xs text-primary-foreground/60"><p>© {new Date().getFullYear()} {content.brandName}. {content.footer.rights}</p><p className="mt-2">{content.footer.credit}</p></div></footer>
      </main>

      <WhatsAppGate whatsapp={settings.whatsapp} dialog={content.whatsappDialog} location="floating" aria-label={content.buttons.whatsapp} asIconButton className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-cta text-cta-foreground shadow-elegant transition hover:scale-110">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden><path d="M20.52 3.48A11.9 11.9 0 0 0 12.06 0C5.5 0 .17 5.33.17 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.32-1.66a11.9 11.9 0 0 0 5.74 1.47h.01c6.56 0 11.89-5.33 11.89-11.9 0-3.18-1.24-6.17-3.44-8.43zM12.07 21.7h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.75.98 1-3.66-.23-.38a9.8 9.8 0 0 1-1.5-5.16c0-5.42 4.41-9.83 9.84-9.83 2.63 0 5.1 1.02 6.96 2.88a9.77 9.77 0 0 1 2.88 6.96c0 5.42-4.41 9.83-9.83 9.83zm5.4-7.35c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.42.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" /></svg>
      </WhatsAppGate>
    </div>
  );
}

const leadSchema = z.object({
  nome: z.string().trim().min(2).max(200),
  telefone: z.string().trim().min(8).max(30).regex(/[0-9]/),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  cidade: z.string().trim().max(120).optional().or(z.literal("")),
  estado: z.string().trim().max(60).optional().or(z.literal("")),
  valor_conta: z.string().trim().max(60).optional().or(z.literal("")),
  mensagem: z.string().trim().max(2000).optional().or(z.literal("")),
});

type LeadFormData = z.infer<typeof leadSchema>;

function LeadForm({ content, whatsapp, adsId, adsLabel }: { content: LandingContent; whatsapp: string; adsId?: string; adsLabel?: string }) {
  const [form, setForm] = useState<LeadFormData>({ nome: "", telefone: "", email: "", cidade: "", estado: "", valor_conta: "", mensagem: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({});
  const mutation = useMutation({
    mutationFn: async (payload: LeadFormData) => {
      const attribution = getPersistedAttribution();
      const eventId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const { error } = await supabase.from("leads").insert({ nome: payload.nome.trim(), telefone: payload.telefone.trim(), email: payload.email?.trim() || null, cidade: payload.cidade?.trim() || null, estado: payload.estado?.trim() || null, valor_conta: payload.valor_conta?.trim() || null, mensagem: payload.mensagem?.trim() || null, origem: attribution.utm_source || "landing_page", utm_source: attribution.utm_source ?? null, utm_medium: attribution.utm_medium ?? null, utm_campaign: attribution.utm_campaign ?? null, utm_term: attribution.utm_term ?? null, utm_content: attribution.utm_content ?? null, gclid: attribution.gclid ?? null, fbclid: attribution.fbclid ?? null, fbp: attribution.fbp ?? null, fbc: attribution.fbc ?? null, page_url: attribution.page_url ?? null, referrer: attribution.referrer ?? null, user_agent: attribution.user_agent ?? null });
      if (error) throw error;
      return { eventId };
    },
    onSuccess: ({ eventId }) => { trackLeadConversion({ adsId, adsLabel, value: 50, currency: "BRL", eventId }); trackEvent("generate_lead", { location: "form", event_id: eventId }); toast.success(content.form.text); setForm({ nome: "", telefone: "", email: "", cidade: "", estado: "", valor_conta: "", mensagem: "" }); setErrors({}); },
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = (e: React.FormEvent) => { e.preventDefault(); const result = leadSchema.safeParse(form); if (!result.success) { const fieldErrors: Partial<Record<keyof LeadFormData, string>> = {}; for (const issue of result.error.issues) { const key = issue.path[0] as keyof LeadFormData; if (!fieldErrors[key]) fieldErrors[key] = issue.message; } setErrors(fieldErrors); return; } setErrors({}); mutation.mutate(result.data); };
  const set = (key: keyof LeadFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const value = e.target.value; setForm((current) => ({ ...current, [key]: value })); if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined })); };
  const fieldClass = (key: keyof LeadFormData) => `mt-1.5 ${errors[key] ? "border-destructive focus-visible:ring-destructive" : ""}`;
  return <section id="orcamento" className="py-20 md:py-28 bg-gradient-hero" aria-labelledby="orcamento-titulo"><div className="mx-auto grid max-w-6xl gap-10 px-4 md:px-6 lg:grid-cols-5 lg:items-center"><div className="lg:col-span-2 space-y-4"><span className="text-sm font-semibold uppercase tracking-widest text-primary">{content.form.eyebrow}</span><h2 id="orcamento-titulo" className="text-3xl md:text-5xl font-bold">{content.form.title}</h2><p className="text-lg text-muted-foreground">{content.form.text}</p><div className="space-y-3 pt-2 text-sm">{content.form.items.map((item) => <div key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-primary" /> {item}</div>)}</div><WhatsAppGate whatsapp={whatsapp} dialog={content.whatsappDialog} location="form_side" variant="outline" className="mt-4 border-primary text-primary">{content.buttons.preferWhatsapp}</WhatsAppGate></div><Card className="lg:col-span-3 p-6 md:p-8 shadow-elegant border-primary/10"><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate><div className="sm:col-span-2"><Label htmlFor="nome">{content.form.labels.name}</Label><Input id="nome" name="name" autoComplete="name" required value={form.nome} onChange={set("nome")} className={fieldClass("nome")} aria-invalid={!!errors.nome} /></div><div><Label htmlFor="telefone">{content.form.labels.phone}</Label><Input id="telefone" name="tel" type="tel" inputMode="tel" autoComplete="tel" required placeholder={content.form.placeholders.phone} value={form.telefone} onChange={set("telefone")} className={fieldClass("telefone")} aria-invalid={!!errors.telefone} /></div><div><Label htmlFor="email">{content.form.labels.email}</Label><Input id="email" name="email" type="email" inputMode="email" value={form.email} onChange={set("email")} className={fieldClass("email")} aria-invalid={!!errors.email} /></div><div><Label htmlFor="cidade">{content.form.labels.city}</Label><Input id="cidade" name="address-level2" autoComplete="address-level2" value={form.cidade} onChange={set("cidade")} className="mt-1.5" /></div><div><Label htmlFor="estado">{content.form.labels.state}</Label><Input id="estado" name="address-level1" autoComplete="address-level1" value={form.estado} onChange={set("estado")} className="mt-1.5" placeholder={content.form.placeholders.state} /></div><div className="sm:col-span-2"><Label htmlFor="valor">{content.form.labels.bill}</Label><Input id="valor" inputMode="decimal" value={form.valor_conta} onChange={set("valor_conta")} placeholder={content.form.placeholders.bill} className="mt-1.5" /></div><div className="sm:col-span-2"><Label htmlFor="msg">{content.form.labels.message}</Label><Textarea id="msg" rows={4} value={form.mensagem} onChange={set("mensagem")} className="mt-1.5" /></div><Button type="submit" size="lg" disabled={mutation.isPending} className="sm:col-span-2 bg-cta text-cta-foreground hover:bg-cta/90 font-semibold shadow-elegant">{mutation.isPending ? content.buttons.submittingLead : content.buttons.submitLead} <ArrowRight className="ml-2 h-4 w-4" /></Button><p className="sm:col-span-2 text-xs text-muted-foreground text-center">{content.form.consent}</p></form></Card></div></section>;
}

function WhatsAppGate({ whatsapp, dialog, location, children, className, variant, size, asIconButton, ...rest }: { whatsapp: string; dialog: LandingContent["whatsappDialog"]; location: string; children: React.ReactNode; className?: string; variant?: "default" | "outline" | "ghost" | "secondary" | "destructive" | "link"; size?: "default" | "sm" | "lg" | "icon"; asIconButton?: boolean; "aria-label"?: string }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [sending, setSending] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); const digits = telefone.replace(/\D/g, ""); if (nome.trim().length < 2 || digits.length < 8) return; setSending(true); try { const attribution = getPersistedAttribution(); const eventId = `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; const { error } = await supabase.from("leads").insert({ nome: nome.trim(), telefone: telefone.trim(), origem: `whatsapp_${location}`, utm_source: attribution.utm_source ?? null, utm_medium: attribution.utm_medium ?? null, utm_campaign: attribution.utm_campaign ?? null, utm_term: attribution.utm_term ?? null, utm_content: attribution.utm_content ?? null, gclid: attribution.gclid ?? null, fbclid: attribution.fbclid ?? null, fbp: attribution.fbp ?? null, fbc: attribution.fbc ?? null, page_url: attribution.page_url ?? null, referrer: attribution.referrer ?? null, user_agent: attribution.user_agent ?? null }); if (error) throw error; trackLeadConversion({ value: 50, currency: "BRL", eventId }); trackEvent("generate_lead", { location: `whatsapp_${location}`, event_id: eventId }); trackEvent("whatsapp_click", { location }); window.open(waHref(whatsapp, `${dialog.description} ${nome.trim()}`), "_blank", "noopener,noreferrer"); setOpen(false); setNome(""); setTelefone(""); } catch (err) { const msg = err instanceof Error ? err.message : dialog.description; toast.error(msg); } finally { setSending(false); } };
  const trigger = asIconButton ? <button type="button" onClick={() => setOpen(true)} className={className} aria-label={rest["aria-label"]}>{children}</button> : <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>{children}</Button>;
  return <>{trigger}<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{dialog.title}</DialogTitle><DialogDescription>{dialog.description}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-3"><div><Label htmlFor="wa-nome">{dialog.nameLabel}</Label><Input id="wa-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus className="mt-1.5" /></div><div><Label htmlFor="wa-tel">{dialog.phoneLabel}</Label><Input id="wa-tel" type="tel" inputMode="tel" placeholder={dialog.phonePlaceholder} value={telefone} onChange={(e) => setTelefone(e.target.value)} className="mt-1.5" /></div><DialogFooter className="gap-2 sm:gap-2"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>{dialog.cancel}</Button><Button type="submit" disabled={sending} className="bg-cta text-cta-foreground hover:bg-cta/90">{sending ? dialog.sending : dialog.submit}</Button></DialogFooter></form></DialogContent></Dialog></>;
}