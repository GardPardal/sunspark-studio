import { useEffect, useRef, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useResolvedSiteSettings } from "@/lib/site-settings";
import { initAllTrackers, persistFirstTouch, trackPageView } from "@/lib/tracking";
import { PublicHeader } from "./public-header";
import { SiteFooter } from "./site-footer";
import { MobileStickyCTA } from "./mobile-sticky-cta";

/** Layout padrão das páginas internas do portal público. */
export function PublicLayout({ children }: { children: ReactNode }) {
  const settings = useResolvedSiteSettings();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const firstPathRef = useRef<string | null>(null);

  useEffect(() => {
    persistFirstTouch();
  }, [pathname]);

  useEffect(() => {
    initAllTrackers({
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

  // PageView em navegação interna (SPA): os pixels só disparam sozinhos no load inicial.
  useEffect(() => {
    if (firstPathRef.current === null) {
      firstPathRef.current = pathname;
      return;
    }
    if (firstPathRef.current === pathname) return;
    firstPathRef.current = pathname;
    trackPageView(pathname);
  }, [pathname]);


  return (
    <div className="flex min-h-screen flex-col bg-white text-foreground">
      <PublicHeader logoUrl={settings.logo_url} whatsapp={settings.whatsapp} />
      <main className="flex-1">{children}</main>
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

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string; params?: Record<string, string> }> }) {
  return (
    <nav aria-label="Você está aqui" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-white/60">
      <Link to="/" className="transition hover:text-lzgreen">
        Início
      </Link>
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          {item.to ? (
            <Link to={item.to as never} params={item.params as never} className="transition hover:text-lzgreen">
              {item.label}
            </Link>
          ) : (
            <span className="text-white/85">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  breadcrumbs,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; to?: string; params?: Record<string, string> }>;
  children?: ReactNode;
}) {
  return (
    <section className="bg-navy-deep text-white">
      <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-16">
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        {eyebrow ? (
          <p className="mb-3 inline-flex rounded-full border border-lzgreen/40 bg-lzgreen/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lzgreen">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-3xl font-display text-3xl font-bold leading-tight md:text-5xl">{title}</h1>
        {subtitle ? <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">{subtitle}</p> : null}
        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </section>
  );
}

export function Section({
  title,
  description,
  children,
  tone = "light",
  id,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  tone?: "light" | "muted";
  id?: string;
}) {
  return (
    <section id={id} className={tone === "muted" ? "bg-muted/40" : "bg-white"}>
      <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-16">
        {title ? <h2 className="font-display text-2xl font-bold md:text-3xl">{title}</h2> : null}
        {description ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p> : null}
        <div className={title || description ? "mt-8" : ""}>{children}</div>
      </div>
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function FaqList({ faqs }: { faqs: Array<{ q: string; a: string }> }) {
  if (!faqs.length) return null;
  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
      {faqs.map((f) => (
        <details key={f.q} className="group px-5 py-4">
          <summary className="cursor-pointer list-none font-display text-base font-semibold marker:hidden">
            <span className="flex items-center justify-between gap-4">
              {f.q}
              <ChevronRight className="h-4 w-4 shrink-0 transition group-open:rotate-90" aria-hidden="true" />
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
