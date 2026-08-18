import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";

type Props = { title: string; url?: string; className?: string };

function buildUrl(url?: string) {
  if (url) return url;
  if (typeof window !== "undefined") return window.location.href;
  return "https://lz7energia.com.br/blog";
}

/** Barra de compartilhamento das matérias (WhatsApp, redes, copiar link e share nativo). */
export function ShareBar({ title, url, className }: Props) {
  const [href, setHref] = useState(() => buildUrl(url));
  const [copied, setCopied] = useState(false);
  const [canNative, setCanNative] = useState(false);

  useEffect(() => {
    setHref(buildUrl(url));
    setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, [url]);

  const t = encodeURIComponent(title);
  const u = encodeURIComponent(href);

  const links = [
    { label: "WhatsApp", href: `https://api.whatsapp.com/send?text=${t}%20${u}`, tone: "bg-[#25D366]/12 text-[#0f7a3d]" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, tone: "bg-[#1877F2]/12 text-[#1155b8]" },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, tone: "bg-foreground/8 text-foreground" },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, tone: "bg-[#0A66C2]/12 text-[#0a5299]" },
    { label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, tone: "bg-[#229ED9]/12 text-[#1a7ba8]" },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível */
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url: href });
    } catch {
      /* usuário cancelou */
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compartilhar</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition hover:brightness-95 ${l.tone}`}
        >
          {l.label}
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:border-lzgreen/60 hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Link copiado" : "Copiar link"}
      </button>
      {canNative ? (
        <button
          type="button"
          onClick={nativeShare}
          className="inline-flex items-center gap-1.5 rounded-full bg-lzgreen px-3 py-1.5 text-xs font-semibold text-navy-deep transition hover:brightness-110"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          Enviar
        </button>
      ) : null}
    </div>
  );
}
