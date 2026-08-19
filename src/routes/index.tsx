import heroSm from "@/assets/hero-casa-solar-768.webp.asset.json";
import heroMd from "@/assets/hero-casa-solar-672.webp.asset.json";
import heroLg from "@/assets/hero-casa-solar-1280.webp.asset.json";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { siteSettingsQueryOptions, useResolvedSiteSettings, type SettingsMap } from "@/lib/site-settings";
import { persistFirstTouch, scheduleAllTrackers } from "@/lib/tracking";
import { SiteHeader } from "@/components/site/site-header";
import { HomeHero } from "@/components/site/home-hero";
import { BenefitStrip } from "@/components/site/benefit-strip";
import { HowItWorks } from "@/components/site/how-it-works";
import { InstitutionalSection } from "@/components/site/institutional";
import { SavingsSimulator } from "@/components/site/savings-simulator";
import { Brands } from "@/components/site/brands";
import { SiteFooter } from "@/components/site/site-footer";
import { MobileStickyCTA } from "@/components/site/mobile-sticky-cta";
import { NAV_LINKS } from "@/components/site/home-content";
import { trackEvent } from "@/components/site/whatsapp-gate";
import { CitiesLinks } from "@/components/site/cities-links";

const SEO_TITLE = "LZ7 Energia — Energia solar no Paraná com até 95% de economia";
const SEO_DESCRIPTION =
  "Energia solar residencial, comercial, rural e industrial no Paraná e São Paulo. Projeto personalizado, instalação própria e até 95% de economia na conta de luz.";

export const Route = createFileRoute("/")({
  // O site institucional é servido no domínio raiz; no subdomínio do app a raiz vai para o sistema.
  beforeLoad: ({ location }) => {
    const host =
      typeof window !== "undefined" ? window.location.hostname : (location.href.match(/^https?:\/\/([^/]+)/)?.[1] ?? "");
    if (host.startsWith("app.")) {
      throw redirect({ to: "/hoje" });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(siteSettingsQueryOptions()),

  head: ({ loaderData }) => {
    const settings = loaderData as SettingsMap | undefined;
    return {
      meta: [
        { title: SEO_TITLE },
        { name: "description", content: SEO_DESCRIPTION },
        { property: "og:title", content: SEO_TITLE },
        { property: "og:description", content: SEO_DESCRIPTION },
        { property: "og:url", content: "https://lz7energia.com.br/" },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: SEO_TITLE },
        { name: "twitter:description", content: SEO_DESCRIPTION },
        {
          name: "keywords",
          content: "energia solar, painel solar, energia fotovoltaica, Londrina, Paraná, LZ7 Energia",
        },
        { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1" },
      ],
      links: [
        { rel: "canonical", href: "https://lz7energia.com.br/" },
        {
          rel: "preload",
          as: "image",
          href: heroMd.url,
          imageSrcSet: `${heroMd.url} 672w, ${heroSm.url} 768w, ${heroLg.url} 1280w`,
          imageSizes: "(max-width: 1023px) 100vw, 768px",
          fetchPriority: "high",
        } as unknown as { rel: string; href: string },
      ],
      scripts: settings ? buildJsonLd(settings) : [],
    };
  },
  component: HomePage,
});

function buildJsonLd(settings: SettingsMap) {
  const logo = settings.logo_url?.startsWith("http")
    ? settings.logo_url
    : `https://lz7energia.com.br${settings.logo_url ?? ""}`;
  return [
    {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": "https://lz7energia.com.br/#organization",
        name: "LZ7 Energia",
        url: "https://lz7energia.com.br/",
        logo,
        email: settings.email,
        telephone: settings.phone,
        sameAs: [settings.instagram].filter(Boolean),
        description: SEO_DESCRIPTION,
      }),
    },
    {
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "@id": "https://lz7energia.com.br/#business",
        name: "LZ7 Energia",
        image: logo,
        url: "https://lz7energia.com.br/",
        telephone: settings.phone,
        email: settings.email,
        priceRange: "$$",
        areaServed: [
          { "@type": "State", name: "Paraná" },
          { "@type": "State", name: "São Paulo" },
        ],
        address: {
          "@type": "PostalAddress",
          addressLocality: "Londrina",
          addressRegion: "PR",
          addressCountry: "BR",
        },
        aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "450" },
      }),
    },
  ];
}

function HomePage() {
  const settings = useResolvedSiteSettings();
  const [activeId, setActiveId] = useState<string>("inicio");

  useEffect(() => {
    persistFirstTouch();
  }, []);

  useEffect(() => {
    return scheduleAllTrackers({
      gtm_id: settings.gtm_id,
      ga4_measurement_id: settings.ga4_measurement_id,
      google_ads_id: settings.google_ads_id,
      meta_pixel_id: settings.meta_pixel_id,
      tiktok_pixel_id: settings.tiktok_pixel_id,
    });
  }, [
    settings.gtm_id,
    settings.ga4_measurement_id,
    settings.google_ads_id,
    settings.meta_pixel_id,
    settings.tiktok_pixel_id,
  ]);

  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.id);
    const onScroll = () => {
      let current = "inicio";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) current = id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-white text-foreground">
      <SiteHeader
        logoUrl={settings.logo_url}
        whatsapp={settings.whatsapp}
        brandName="LZ7 Energia"
        activeId={activeId}
        onNavigate={scrollTo}
      />

      <main>
        <HomeHero
          whatsapp={settings.whatsapp}
          onSecondary={() => {
            trackEvent("cta_click", { location: "hero_especialista" });
            scrollTo("solucoes");
          }}
        />
        <BenefitStrip />
        <HowItWorks />
        <InstitutionalSection
          videoUrl={settings.video_url}
          whatsapp={settings.whatsapp}
          onHistory={() => scrollTo("sobre")}
        />
        <SavingsSimulator whatsapp={settings.whatsapp} />
        <CitiesLinks />
        <Brands />
      </main>

      <SiteFooter
        logoUrl={settings.logo_url}
        brandName="LZ7 Energia"
        whatsapp={settings.whatsapp}
        phone={settings.phone}
        email={settings.email}
        instagram={settings.instagram}
        address="Londrina - PR"
      />

      <MobileStickyCTA whatsapp={settings.whatsapp} />
    </div>
  );
}
