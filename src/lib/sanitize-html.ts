/**
 * Sanitizador HTML leve (isomórfico) para o corpo dos artigos do blog.
 * Mantém apenas tags/atributos editoriais seguros.
 */

const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "code", "pre",
  "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tr", "th", "td", "hr", "span", "div", "iframe",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "loading", "width", "height"]),
  iframe: new Set(["src", "title", "width", "height", "allow", "allowfullscreen", "loading", "referrerpolicy"]),
};

/** Hosts de vídeo liberados para embed no corpo do artigo. */
const EMBED_HOSTS = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.facebook\.com\/plugins)/i;

const SAFE_URL = /^(https?:|mailto:|tel:|\/|#)/i;


function cleanAttrs(tag: string, attrString: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  if (!allowed) return "";
  const out: string[] = [];
  const re = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString))) {
    const name = m[1]!.toLowerCase();
    const value = (m[3] ?? m[4] ?? "").trim();
    if (!allowed.has(name)) continue;
    if ((name === "href" || name === "src") && !SAFE_URL.test(value)) continue;
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  if (tag === "a") {
    if (!out.some((a) => a.startsWith("rel="))) out.push('rel="noopener noreferrer"');
  }
  if (tag === "img" && !out.some((a) => a.startsWith("loading="))) out.push('loading="lazy"');
  if (tag === "iframe") {
    if (!out.some((a) => a.startsWith("loading="))) out.push('loading="lazy"');
    if (!out.some((a) => a.startsWith("allow="))) out.push('allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; web-share"');
    out.push("allowfullscreen");
  }
  return out.length ? " " + out.join(" ") : "";

}

/** Remove scripts, estilos, handlers inline e tags não permitidas. */
export function sanitizeArticleHtml(input: string): string {
  let html = String(input ?? "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<\s*(script|style|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  html = html.replace(/<\s*(script|style|object|embed|link|meta)\b[^>]*\/?>/gi, "");
  // iframes: só permanecem os de players de vídeo confiáveis
  html = html.replace(/<iframe\b([^>]*)>/gi, (all, attrs: string) => {
    const src = (attrs.match(/src\s*=\s*("([^"]*)"|'([^']*)')/i)?.[2] ?? attrs.match(/src\s*=\s*("([^"]*)"|'([^']*)')/i)?.[3] ?? "").trim();
    return EMBED_HOSTS.test(src) ? all : "<span data-blocked-embed></span>";
  });

  return html.replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (_all, close: string, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (close) return `</${tag}>`;
    const selfClosing = tag === "br" || tag === "hr" || tag === "img";
    return `<${tag}${cleanAttrs(tag, attrs)}${selfClosing ? " /" : ""}>`;
  });
}


/** Detecta se o conteúdo já é HTML (posts do Radar Editorial) ou texto simples. */
export function looksLikeHtml(content: string): boolean {
  return /<\/?(p|h2|h3|ul|ol|li|blockquote|figure|table|strong|em|br)\b/i.test(content ?? "");
}

/** Texto puro (para descrições/meta) a partir de HTML. */
export function htmlToPlainText(content: string): string {
  return String(content ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hosts cujas imagens são, na verdade, capas (posters) de vídeo. */
const VIDEO_POSTER_HOST = /(video\.glbimg\.com|\/thumb(nail)?s?\/|\/poster\/)/i;

/** Sobe a resolução de thumbs conhecidos (glbimg usa /x240/, /x360/...). */
function upscalePoster(url: string): string {
  return url.replace(/(glbimg\.com)\/x(\d{2,4})\//i, (all, host: string, w: string) =>
    Number(w) < 720 ? `${host}/x720/` : all,
  );
}

/**
 * Pós-processa o HTML já sanitizado do artigo:
 * - aumenta a resolução de capas de vídeo (evita print embaçado)
 * - transforma a capa em botão de play que abre o vídeo na fonte original
 */
export function enhanceArticleMedia(html: string, sourceUrl?: string | null): string {
  let out = String(html ?? "");
  out = out.replace(/<img\b([^>]*)>/gi, (all, attrs: string) => {
    const src = attrs.match(/src\s*=\s*"([^"]*)"/i)?.[1] ?? "";
    if (!src) return all;
    const better = upscalePoster(src);
    const tag = better === src ? all : all.replace(src, better);
    if (!VIDEO_POSTER_HOST.test(src) || !sourceUrl) return tag;
    return `<a class="video-poster" href="${sourceUrl.replace(/"/g, "&quot;")}" target="_blank" rel="nofollow noopener" aria-label="Assistir ao vídeo na fonte original">${tag}<span class="video-poster__play" aria-hidden="true"></span></a>`;
  });
  return out;
}

/** Extrai a URL da matéria original a partir do crédito de fonte. */
export function extractSourceUrl(html: string): string | null {
  const m = String(html ?? "").match(/Fonte:\s*<a[^>]*href="([^"]+)"/i);
  return m ? m[1]! : null;
}
