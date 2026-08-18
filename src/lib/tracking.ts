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

/** ID do GA4 vindo do conector Google Analytics (fallback do painel Admin). */
export const GA4_ENV_ID: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY || "";

/** GA4 + Google Ads via gtag. */
export function initGoogle(ga4Id: string, adsId: string) {
  const win = w();
  if (!win) return;
  const measurementId = ga4Id || GA4_ENV_ID;
  const primary = measurementId || adsId;
  if (!primary) return;

  win.dataLayer = win.dataLayer || [];
  const gtag: (...args: unknown[]) => void = (...args) => { win.dataLayer!.push(args); };
  if (!win.gtag) win.gtag = gtag;

  loadScript(`gtag-${primary}`, `https://www.googletagmanager.com/gtag/js?id=${primary}`, () => {
    win.gtag!("js", new Date());
    if (measurementId) {
      const externalId = getExternalId();
      win.gtag!("config", measurementId, {
        send_page_view: true,
        // Cookie first-party mais duradouro e atribuição cross-domain estável.
        cookie_flags: "SameSite=None;Secure",
        cookie_expires: 63072000, // 2 anos
        ...(externalId ? { user_id: externalId } : {}),
      });
      if (externalId) win.gtag!("set", "user_properties", { lz7_visitor_id: externalId });
    }
    if (adsId) win.gtag!("config", adsId);
  });
}

/** Meta Pixel com Advanced Matching (external_id estável, melhora o match quality). */
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
    const externalId = getExternalId();
    win.fbq!("init", pixelId, externalId ? { external_id: externalId } : undefined);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      t[e] = function (...args: unknown[]) { (t as any).push([e, ...args]); };
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

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

const NINETY_DAYS = 60 * 60 * 24 * 90;
const ATTR_KEY = "lz7_attr";
const EXTERNAL_ID_KEY = "lz7_eid";

/**
 * ID anônimo e estável do visitante. Usado como `external_id` no Pixel e na CAPI
 * — é o parâmetro que mais aumenta o Event Match Quality da Meta.
 */
export function getExternalId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = localStorage.getItem(EXTERNAL_ID_KEY) || cookie(EXTERNAL_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().replace(/-/g, "")
          : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    }
    localStorage.setItem(EXTERNAL_ID_KEY, id);
    setCookie(EXTERNAL_ID_KEY, id, NINETY_DAYS);
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Garante que o clique do Facebook vire cookie `_fbc` de primeira parte.
 * Sem isso, quem chega por anúncio e converte depois perde a atribuição.
 */
function ensureFbc(fbclid?: string): string | undefined {
  const existing = cookie("_fbc");
  if (existing) return existing;
  if (!fbclid) return undefined;
  const value = `fb.1.${Date.now()}.${fbclid}`;
  setCookie("_fbc", value, NINETY_DAYS);
  return value;
}

export function collectAttribution() {
  if (typeof window === "undefined") return {};
  const qs = new URLSearchParams(window.location.search);
  const get = (k: string) => qs.get(k) || undefined;
  const fbclid = get("fbclid");
  const fbc = ensureFbc(fbclid);
  return {
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_term: get("utm_term"),
    utm_content: get("utm_content"),
    gclid: get("gclid") || cookie("_gcl_aw")?.split(".").pop(),
    gbraid: get("gbraid"),
    wbraid: get("wbraid"),
    fbclid,
    ttclid: get("ttclid") || cookie("ttclid"),
    fbp: cookie("_fbp"),
    fbc,
    external_id: getExternalId(),
    page_url: window.location.href.slice(0, 2000),
    referrer: document.referrer ? document.referrer.slice(0, 2000) : undefined,
    user_agent: navigator.userAgent.slice(0, 500),
  } as Record<string, string | undefined>;
}

type StoredAttribution = { ts: number; data: Record<string, string | undefined> };

function readStored(): StoredAttribution | null {
  try {
    const raw = localStorage.getItem(ATTR_KEY) ?? sessionStorage.getItem(ATTR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution | Record<string, string | undefined>;
    if (parsed && typeof parsed === "object" && "ts" in parsed && "data" in parsed) {
      const stored = parsed as StoredAttribution;
      if (Date.now() - stored.ts > NINETY_DAYS * 1000) return null;
      return stored;
    }
    // formato antigo (sessionStorage plano)
    return { ts: Date.now(), data: parsed as Record<string, string | undefined> };
  } catch {
    return null;
  }
}

/**
 * Mantém o primeiro toque (UTMs de origem) por 90 dias e atualiza os IDs de clique
 * mais recentes — que é o que Meta e Google usam para casar a conversão.
 */
export function persistFirstTouch() {
  if (typeof window === "undefined") return;
  try {
    const current = collectAttribution();
    const stored = readStored();
    const hasNewCampaign = Boolean(current.utm_source || current.fbclid || current.gclid || current.ttclid);

    const merged: Record<string, string | undefined> = hasNewCampaign
      ? { ...stored?.data, ...current }
      : { ...current, ...stored?.data, external_id: current.external_id, page_url: current.page_url };

    for (const key of Object.keys(merged)) if (!merged[key]) delete merged[key];
    if (!Object.keys(merged).length) return;

    const payload: StoredAttribution = {
      ts: hasNewCampaign || !stored ? Date.now() : stored.ts,
      data: merged,
    };
    localStorage.setItem(ATTR_KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

export function getPersistedAttribution(): Record<string, string | undefined> {
  if (typeof window === "undefined") return {};
  const stored = readStored();
  const live = collectAttribution();
  if (!stored) return live;
  // cookies (_fbp/_fbc) e página atual sempre vêm do estado vivo
  return {
    ...stored.data,
    ...Object.fromEntries(Object.entries(live).filter(([, v]) => Boolean(v))),
    utm_source: stored.data.utm_source ?? live.utm_source,
    utm_medium: stored.data.utm_medium ?? live.utm_medium,
    utm_campaign: stored.data.utm_campaign ?? live.utm_campaign,
    utm_content: stored.data.utm_content ?? live.utm_content,
    utm_term: stored.data.utm_term ?? live.utm_term,
  };
}

/** PageView em navegação SPA (o Pixel/GA4 só disparam sozinhos no load inicial). */
export function trackPageView(path?: string) {
  const win = w();
  if (!win) return;
  const location = path ? `${window.location.origin}${path}` : window.location.href;
  win.gtag?.("event", "page_view", {
    page_location: location,
    page_path: path ?? window.location.pathname,
    page_title: document.title,
  });
  win.fbq?.("track", "PageView");
  win.ttq?.page?.();
  win.dataLayer?.push({ event: "spa_page_view", page_path: path ?? window.location.pathname });
}


/** Dispara um evento avulso no Meta Pixel (com eventID opcional para dedup com a CAPI). */
export function trackMetaEvent(
  event: string,
  data?: Record<string, unknown>,
  eventId?: string,
) {
  const win = w();
  win?.fbq?.("track", event, data ?? {}, eventId ? { eventID: eventId } : undefined);
}

/** Gera um event_id único compartilhado entre Pixel e CAPI. */
export function newEventId(prefix = "lz7") {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
