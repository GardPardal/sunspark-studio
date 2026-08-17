/** Adapters de descoberta de pautas — server-only. Sem execução de conteúdo remoto. */

import { createHash } from "crypto";

export type DiscoveredItem = {
  url: string;
  titulo: string;
  resumo?: string;
  autor?: string;
  publicado_em?: string | null;
};

const UA = "LZ7EnergiaRadarBot/1.0 (+https://lz7energia.com.br/blog/politica-editorial)";
const TIMEOUT_MS = 12_000;

/** Bloqueia SSRF: só http(s) público, sem localhost/rede privada/metadata. */
export function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("URL inválida");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Protocolo não permitido");
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1"
  ) {
    throw new Error("Destino não permitido");
  }
  return u;
}

export function urlHash(url: string): string {
  return createHash("sha1").update(url.split("#")[0]!.replace(/\/$/, "")).digest("hex");
}

async function safeFetch(url: string, accept: string): Promise<string> {
  assertSafeUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept },
      redirect: "follow",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return text.slice(0, 900_000);
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Remove qualquer HTML — nunca renderizamos conteúdo remoto. */
export function stripHtml(s: string): string {
  return decodeEntities(
    s
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]!).trim() : undefined;
}

/** RSS 2.0 e Atom. */
export async function rssAdapter(feedUrl: string, limit = 30): Promise<DiscoveredItem[]> {
  const xml = await safeFetch(feedUrl, "application/rss+xml, application/atom+xml, application/xml, text/xml, */*");
  const blocks = [
    ...xml.split(/<item[\s>]/i).slice(1).map((b) => `<item ${b}`),
    ...xml.split(/<entry[\s>]/i).slice(1).map((b) => `<entry ${b}`),
  ];
  const items: DiscoveredItem[] = [];
  for (const block of blocks.slice(0, limit * 2)) {
    const titulo = stripHtml(tag(block, "title") ?? "");
    let url = tag(block, "link") ?? "";
    if (!url || /^\s*$/.test(url)) {
      const m = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      url = m?.[1] ?? "";
    }
    url = url.trim();
    if (!titulo || !/^https?:\/\//.test(url)) continue;
    const resumo = stripHtml(tag(block, "description") ?? tag(block, "summary") ?? "").slice(0, 700);
    const dateRaw = tag(block, "pubDate") ?? tag(block, "updated") ?? tag(block, "published") ?? tag(block, "dc:date");
    const d = dateRaw ? new Date(dateRaw) : null;
    items.push({
      url,
      titulo: titulo.slice(0, 300),
      resumo,
      autor: stripHtml(tag(block, "author") ?? tag(block, "dc:creator") ?? "").slice(0, 120) || undefined,
      publicado_em: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
    });
    if (items.length >= limit) break;
  }
  return items;
}

/** Sitemap XML (usa <lastmod> como data e o slug como título provisório). */
export async function sitemapAdapter(sitemapUrl: string, limit = 30): Promise<DiscoveredItem[]> {
  const xml = await safeFetch(sitemapUrl, "application/xml, text/xml, */*");
  const blocks = xml.split(/<url[\s>]/i).slice(1);
  const items: DiscoveredItem[] = [];
  for (const b of blocks) {
    const url = (tag(b, "loc") ?? "").trim();
    if (!/^https?:\/\//.test(url)) continue;
    const lastmod = tag(b, "lastmod");
    const d = lastmod ? new Date(lastmod) : null;
    const slug = url.split("?")[0]!.replace(/\/$/, "").split("/").pop() ?? "";
    const titulo = slug.replace(/[-_]+/g, " ").replace(/\.\w+$/, "").trim();
    if (titulo.length < 8) continue;
    items.push({
      url,
      titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1),
      publicado_em: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
    });
  }
  items.sort((a, b) => (b.publicado_em ?? "").localeCompare(a.publicado_em ?? ""));
  return items.slice(0, limit);
}

/** Página pública de notícias: extrai links + textos âncora (fallback controlado). */
export async function genericNewsAdapter(pageUrl: string, limit = 30): Promise<DiscoveredItem[]> {
  const html = await safeFetch(pageUrl, "text/html,*/*");
  const base = new URL(pageUrl);
  const seen = new Set<string>();
  const items: DiscoveredItem[] = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,400}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1]!;
    const label = stripHtml(m[2] ?? "");
    if (label.length < 25 || label.length > 220) continue;
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (!abs.startsWith("http") || seen.has(abs)) continue;
    if (new URL(abs).hostname !== base.hostname) continue;
    seen.add(abs);
    items.push({ url: abs, titulo: label.slice(0, 300), publicado_em: null });
    if (items.length >= limit) break;
  }
  return items;
}

/** Adapters oficiais: hoje reutilizam RSS/página, isolados para evoluir sem afetar os demais. */
export async function aneelAdapter(url: string, limit = 30): Promise<DiscoveredItem[]> {
  try {
    return await rssAdapter(url, limit);
  } catch {
    return genericNewsAdapter(url, limit);
  }
}

export async function mmeAdapter(url: string, limit = 30): Promise<DiscoveredItem[]> {
  try {
    return await rssAdapter(url, limit);
  } catch {
    return genericNewsAdapter(url, limit);
  }
}

export type AdapterName = "rssAdapter" | "sitemapAdapter" | "genericNewsAdapter" | "aneelAdapter" | "mmeAdapter";

export async function runAdapter(name: string, url: string, limit = 30): Promise<DiscoveredItem[]> {
  switch (name) {
    case "sitemapAdapter":
      return sitemapAdapter(url, limit);
    case "genericNewsAdapter":
      return genericNewsAdapter(url, limit);
    case "aneelAdapter":
      return aneelAdapter(url, limit);
    case "mmeAdapter":
      return mmeAdapter(url, limit);
    default:
      return rssAdapter(url, limit);
  }
}

/** Texto público de uma página, apenas para apuração (sem burlar paywall). */
export async function fetchPublicText(url: string, maxChars = 6000): Promise<string> {
  const html = await safeFetch(url, "text/html,*/*");
  return stripHtml(html).slice(0, maxChars);
}
