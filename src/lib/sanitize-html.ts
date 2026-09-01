/**
 * Sanitizador HTML leve (isomórfico) para o corpo dos artigos do blog.
 * Mantém apenas tags/atributos editoriais seguros.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "blockquote",
  "code",
  "pre",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
  "span",
  "div",
  "iframe",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "loading", "width", "height"]),
  iframe: new Set([
    "src",
    "title",
    "width",
    "height",
    "allow",
    "allowfullscreen",
    "loading",
    "referrerpolicy",
  ]),
};

/** Hosts de vídeo/áudio liberados para embed no corpo do artigo. */
const EMBED_HOSTS =
  /^https:\/\/([\w-]+\.)*(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|facebook\.com\/plugins|globoplay\.globo\.com|globo\.com\/video|dailymotion\.com|tiktok\.com|open\.spotify\.com|w\.soundcloud\.com|instagram\.com|platform\.twitter\.com|x\.com|twitter\.com|players\.brightcove\.net|megaphone\.fm|anchor\.fm)/i;

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
    if (!out.some((a) => a.startsWith("allow=")))
      out.push(
        'allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; web-share"',
      );
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
    const src = (
      attrs.match(/src\s*=\s*("([^"]*)"|'([^']*)')/i)?.[2] ??
      attrs.match(/src\s*=\s*("([^"]*)"|'([^']*)')/i)?.[3] ??
      ""
    ).trim();
    return EMBED_HOSTS.test(src) ? all : "<span data-blocked-embed></span>";
  });

  return html.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (_all, close: string, rawTag: string, attrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      if (close) return `</${tag}>`;
      const selfClosing = tag === "br" || tag === "hr" || tag === "img";
      return `<${tag}${cleanAttrs(tag, attrs)}${selfClosing ? " /" : ""}>`;
    },
  );
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

const TARGET_W = 1280;

/**
 * Eleva a resolução de imagens de portais (thumbs pequenos deixam o blog "borrado").
 * Cobre glbimg, WordPress (-800x450), parâmetros de resize e CDNs de imagem comuns.
 */
export function upscaleImageUrl(input?: string | null): string {
  let url = String(input ?? "");
  if (!url) return url;

  // Globo / glbimg: /x240/, /x360/ → /x1280/  e  ...size/w=300 → w=1280
  url = url.replace(/(glbimg\.com[^ "']*?)\/x(\d{2,4})\//i, (all, head: string, w: string) =>
    Number(w) < TARGET_W ? `${head}/x${TARGET_W}/` : all,
  );
  url = url.replace(
    /([?&](?:w|width|maxwidth|max-w|fit-in\/w))=(\d{2,4})/gi,
    (all, key: string, w: string) => (Number(w) < TARGET_W ? `${key}=${TARGET_W}` : all),
  );
  url = url.replace(/([?&]h(?:eight)?)=(\d{2,4})/gi, (all, key: string, h: string) =>
    Number(h) < 720 ? `${key}=720` : all,
  );
  url = url.replace(/([?&]resize)=\d{2,4}(?:,|%2C)\d{2,4}/gi, `$1=${TARGET_W},720`);
  url = url.replace(/([?&](?:q|quality))=(\d{1,3})/gi, (all, key: string, q: string) =>
    Number(q) < 85 ? `${key}=85` : all,
  );

  // WordPress: nome-do-arquivo-800x450.jpg → nome-do-arquivo.jpg (original)
  url = url.replace(
    /-(\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp|avif))(\?|$)/i,
    (all, w: string, _h, ext: string, tail: string) =>
      Number(w) < TARGET_W ? `${ext}${tail}` : all,
  );

  // Thumbor/imgproxy: /fit-in/300x200/ ou /300x200/  → tamanho maior
  url = url.replace(/\/(?:fit-in\/)?(\d{2,4})x(\d{2,4})\//g, (all, w: string) =>
    Number(w) < 600 ? `/${TARGET_W}x720/` : all,
  );

  return url;
}

/**
 * Pós-processa o HTML já sanitizado do artigo:
 * - aumenta a resolução das imagens/capas de vídeo (evita print embaçado)
 * - transforma a capa em botão de play que abre o vídeo na fonte original
 */
export function enhanceArticleMedia(html: string, sourceUrl?: string | null): string {
  let out = String(html ?? "");
  out = out.replace(/<img\b([^>]*)>/gi, (all, attrs: string) => {
    const src = attrs.match(/src\s*=\s*"([^"]*)"/i)?.[1] ?? "";
    if (!src) return all;
    const better = upscaleImageUrl(src);
    let tag = better === src ? all : all.replace(src, better);
    if (!/decoding=/i.test(tag)) tag = tag.replace(/<img\b/i, '<img decoding="async"');
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
