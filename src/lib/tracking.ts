/**
 * Tracking utilities — Google Analytics 4, Google Ads, Meta Pixel.
 * Loads scripts on demand based on IDs configured no painel.
 */

type W = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  _fbq?: unknown;
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

/** Load GA4 + Google Ads through a single gtag boot. */
export function initGoogle(ga4Id: string, adsId: string) {
  const win = w();
  if (!win) return;
  const primary = ga4Id || adsId;
  if (!primary) return;

  win.dataLayer = win.dataLayer || [];
  const gtag: (...args: unknown[]) => void = (...args) => {
    win.dataLayer!.push(args);
  };
  if (!win.gtag) win.gtag = gtag;

  loadScript(`gtag-${primary}`, `https://www.googletagmanager.com/gtag/js?id=${primary}`, () => {
    win.gtag!("js", new Date());
    if (ga4Id) win.gtag!("config", ga4Id, { send_page_view: true });
    if (adsId) win.gtag!("config", adsId);
  });
}

/** Load Meta Pixel. */
export function initMetaPixel(pixelId: string) {
  const win = w();
  if (!win || !pixelId) return;
  if (!win.fbq) {
    // Minimal Meta Pixel bootstrap
    const n = function (this: unknown, ...args: unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n as any).callMethod ? (n as any).callMethod(...args) : (n as any).queue.push(args);
    } as unknown as W["fbq"] & { push?: unknown; loaded?: boolean; version?: string; queue?: unknown[] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n as any).push = n;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n as any).loaded = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n as any).version = "2.0";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (n as any).queue = [];
    win.fbq = n;
    win._fbq = n;
  }
  loadScript(`fbq-${pixelId}`, "https://connect.facebook.net/en_US/fbevents.js", () => {
    win.fbq!("init", pixelId);
    win.fbq!("track", "PageView");
  });
}

/** Fire lead conversion events across GA4, Google Ads and Meta Pixel. */
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

  // GA4 recommended event
  win.gtag?.("event", "generate_lead", { currency, value });

  // Google Ads conversion
  if (opts.adsId && opts.adsLabel) {
    win.gtag?.("event", "conversion", {
      send_to: `${opts.adsId}/${opts.adsLabel}`,
      value,
      currency,
      transaction_id: opts.eventId ?? "",
    });
  }

  // Meta Pixel Lead
  win.fbq?.("track", "Lead", { value, currency }, opts.eventId ? { eventID: opts.eventId } : undefined);
}

/** Read a first-party cookie value. */
function cookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Snapshot of query params + attribution cookies for lead attribution. */
export function collectAttribution() {
  if (typeof window === "undefined") return {};
  const qs = new URLSearchParams(window.location.search);
  const get = (k: string) => qs.get(k) || undefined;

  const fbclid = get("fbclid");
  // Build _fbc if fbclid present but cookie missing (Meta CAPI-friendly format)
  const fbc =
    cookie("_fbc") ||
    (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);

  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_term: get("utm_term"),
    utm_content: get("utm_content"),
    gclid: get("gclid") || cookie("_gcl_aw")?.split(".").pop(),
    fbclid,
    fbp: cookie("_fbp"),
    fbc,
    page_url: window.location.href.slice(0, 2000),
    referrer: document.referrer ? document.referrer.slice(0, 2000) : undefined,
    user_agent: navigator.userAgent.slice(0, 500),
  };
}

/** Persist first-touch attribution so it survives internal navigation. */
export function persistFirstTouch() {
  if (typeof window === "undefined") return;
  try {
    const stored = sessionStorage.getItem("lz7_attr");
    if (stored) return;
    const attr = collectAttribution();
    if (Object.values(attr).some(Boolean)) {
      sessionStorage.setItem("lz7_attr", JSON.stringify(attr));
    }
  } catch {
    /* ignore */
  }
}

export function getPersistedAttribution(): Record<string, string | undefined> {
  if (typeof window === "undefined") return {};
  try {
    const stored = sessionStorage.getItem("lz7_attr");
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return collectAttribution();
}
