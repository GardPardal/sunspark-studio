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
