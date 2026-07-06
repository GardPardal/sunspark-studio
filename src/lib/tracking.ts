/**
 * Tracking utilities — GTM, GA4, Google Ads, Meta Pixel, TikTok Pixel.
 * Scripts loaded on demand com base nos IDs configurados no painel Admin.
 */

type W = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  _fbq?: unknown;
  ttq?: {
    (...args: unknown[]): void;
    methods?: string[];
    setAndDefer?: (t: unknown, e: string) => void;
    instance?: (id: string) => unknown;
    load?: (id: string) => void;
    page?: () => void;
    track?: (name: string, data?: unknown, opts?: unknown) => void;
    _i?: Record<string, unknown>;
    _u?: string;
    _t?: number;
    _o?: number;
  };
  TiktokAnalyticsObject?: string;
  __lz7_tracking_loaded?: Record<string, boolean>;
};

function w(): W | null {
  return typeof window === "undefined" ? null : (window as W);
}

function loadScript(id: string, src: string, onload?: () => void) {
  const win = w();
  if (!win) return;
  win.__lz7_tracking_loaded = win.__lz7_tracking_loaded || {};
  if (win.__lz7_tracking_loaded[id]) {
    onload?.();
    return;
  }
  win.__lz7_tracking_loaded[id] = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  if (onload) s.onload = onload;
  document.head.appendChild(s);
}

/** Google Tag Manager container (opcional). */
export function initGTM(gtmId: string) {
  const win = w();
  if (!win || !gtmId) return;
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  loadScript(`gtm-${gtmId}`, `https://www.googletagmanager.com/gtm.js?id=${gtmId}`);
}

/** GA4 + Google Ads via gtag. */
export function initGoogle(ga4Id: string, adsId: string) {
  const win = w();
  if (!win) return;
  const primary = ga4Id || adsId;
  if (!primary) return;

  win.dataLayer = win.dataLayer || [];
  const gtag: (...args: unknown[]) => void = (...args) => { win.dataLayer!.push(args); };
  if (!win.gtag) win.gtag = gtag;

  loadScript(`gtag-${primary}`, `https://www.googletagmanager.com/gtag/js?id=${primary}`, () => {
    win.gtag!("js", new Date());
    if (ga4Id) win.gtag!("config", ga4Id, { send_page_view: true });
    if (adsId) win.gtag!("config", adsId);
  });
}

/** Meta Pixel. */
export function initMetaPixel(pixelId: string) {
  const win = w();
  if (!win || !pixelId) return;
  if (!win.fbq) {
    const n = function (this: unknown, ...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n as any).callMethod ? (n as any).callMethod(...args) : (n as any).queue.push(args);
    } as unknown as W["fbq"] & { push?: unknown; loaded?: boolean; version?: string; queue?: unknown[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n as any).push = n; (n as any).loaded = true; (n as any).version = "2.0"; (n as any).queue = [];
    win.fbq = n; win._fbq = n;
  }
  loadScript(`fbq-${pixelId}`, "https://connect.facebook.net/en_US/fbevents.js", () => {
    win.fbq!("init", pixelId);
    win.fbq!("track", "PageView");
  });
}

/** TikTok Pixel. */
export function initTikTokPixel(pixelId: string) {
  const win = w();
  if (!win || !pixelId) return;
  if (!win.ttq) {
    win.TiktokAnalyticsObject = "ttq";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ttq: any = function (...args: unknown[]) { ttq.push(args); };
    ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
    ttq.setAndDefer = (t: Record<string, unknown>, e: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      t[e] = function (...args: unknown[]) { (t as any).push([e].concat(args as unknown[])); };
    };
    for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
    ttq.instance = function (id: string) {
      const inst = ttq._i?.[id] || [];
      for (const m of ttq.methods) ttq.setAndDefer(inst, m);
      return inst;
    };
    ttq._i = {}; ttq._i[pixelId] = []; ttq._i[pixelId]._u = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._t = Date.now(); ttq._o = ttq._o || {};
    win.ttq = ttq;
  }
  loadScript(
    `ttq-${pixelId}`,
    `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${pixelId}&lib=ttq`,
    () => { win.ttq?.page?.(); },
  );
}

/** Boot all trackers based on settings. */
export function initAllTrackers(settings: {
  gtm_id?: string;
  ga4_measurement_id?: string;
  google_ads_id?: string;
  meta_pixel_id?: string;
  tiktok_pixel_id?: string;
}) {
  if (settings.gtm_id) initGTM(settings.gtm_id);
  initGoogle(settings.ga4_measurement_id || "", settings.google_ads_id || "");
  initMetaPixel(settings.meta_pixel_id || "");
  initTikTokPixel(settings.tiktok_pixel_id || "");
}

/** Client-side lead conversion (Ads + Meta + TikTok pixels). */
export function trackLeadConversion(opts: {
  adsId?: string;
  adsLabel?: string;
  value?: number;
  currency?: string;
  eventId?: string;
}) {
  const win = w();
  if (!win) return;
  const value = opts.value ?? 1;
  const currency = opts.currency ?? "BRL";

  win.gtag?.("event", "generate_lead", { currency, value });
  if (opts.adsId && opts.adsLabel) {
    win.gtag?.("event", "conversion", {
      send_to: `${opts.adsId}/${opts.adsLabel}`,
      value, currency, transaction_id: opts.eventId ?? "",
    });
  }
  win.fbq?.("track", "Lead", { value, currency }, opts.eventId ? { eventID: opts.eventId } : undefined);
  win.ttq?.track?.("SubmitForm", { value, currency, contents: [{ content_name: "solar_lead" }] }, { event_id: opts.eventId });
}

function cookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export function collectAttribution() {
  if (typeof window === "undefined") return {};
  const qs = new URLSearchParams(window.location.search);
  const get = (k: string) => qs.get(k) || undefined;
  const fbclid = get("fbclid");
  const fbc = cookie("_fbc") || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_term: get("utm_term"),
    utm_content: get("utm_content"),
    gclid: get("gclid") || cookie("_gcl_aw")?.split(".").pop(),
    fbclid,
    ttclid: get("ttclid") || cookie("ttclid"),
    fbp: cookie("_fbp"),
    fbc,
    page_url: window.location.href.slice(0, 2000),
    referrer: document.referrer ? document.referrer.slice(0, 2000) : undefined,
    user_agent: navigator.userAgent.slice(0, 500),
  };
}

export function persistFirstTouch() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem("lz7_attr")) return;
    const attr = collectAttribution();
    if (Object.values(attr).some(Boolean)) sessionStorage.setItem("lz7_attr", JSON.stringify(attr));
  } catch { /* ignore */ }
}

export function getPersistedAttribution(): Record<string, string | undefined> {
  if (typeof window === "undefined") return {};
  try {
    const stored = sessionStorage.getItem("lz7_attr");
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return collectAttribution();
}
