import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogIn, Menu, X } from "lucide-react";
import { NAV_LINKS } from "./home-content";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate, trackEvent } from "./whatsapp-gate";
import compactLogo from "@/assets/lz7-logo-header.webp.asset.json";

function resolvedLogo(url: string) {
  return url.includes("1d68beb7-d327-4044-9f65-1fd1c55f902b") || url.endsWith("/logo.webp")
    ? compactLogo.url
    : url;
}

export function SiteHeader({
  logoUrl,
  whatsapp,
  brandName,
  activeId,
  onNavigate,
}: {
  logoUrl: string;
  whatsapp: string;
  brandName: string;
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    trackEvent("menu_click", { item: id });
    onNavigate(id);
    setOpen(false);
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid || open
          ? "bg-navy-deep/95 backdrop-blur border-b border-navy-line/40"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-4 px-4 md:h-20 md:px-8">
        <button
          type="button"
          onClick={() => go("inicio")}
          className="flex shrink-0 items-center"
          aria-label={`${brandName} — ir para o início`}
        >
          <img
            src={resolvedLogo(logoUrl)}
            alt={brandName}
            width={130}
            height={69}
            decoding="async"
            className="h-9 w-auto md:h-11"
          />
        </button>

        <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => {
            const active = activeId === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => go(link.id)}
                aria-current={active ? "page" : undefined}
                className={`relative py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lzgreen ${
                  active ? "text-lzgreen" : "text-white/80 hover:text-white"
                }`}
              >
                {link.label}
                {active ? (
                  <span className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full bg-lzgreen" />
                ) : null}
              </button>
            );
          })}
        </nav>

        <Link
          to="/auth"
          className="ml-auto hidden items-center gap-2 rounded-lg border border-lzgreen/50 px-4 py-2 font-display text-sm font-semibold text-lzgreen transition hover:bg-lzgreen hover:text-navy-deep lg:ml-0 lg:inline-flex"
        >
          <LogIn className="h-4 w-4" /> Entrar
        </Link>

        <WhatsAppGate
          whatsapp={whatsapp}
          location="header"
          className="ml-auto hidden items-center gap-2 rounded-lg bg-lzgreen px-5 py-2.5 font-display text-sm font-semibold text-navy-deep shadow-[0_8px_24px_-10px_oklch(0.7_0.19_145)] transition hover:bg-lzgreen-strong hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lzgreen lg:ml-0 lg:inline-flex"
        >
          Solicitar Orçamento <WhatsAppIcon className="h-4 w-4" />
        </WhatsAppGate>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-white lg:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-navy-line/40 bg-navy-deep px-4 pb-6 pt-3 lg:hidden">
          <nav className="flex flex-col" aria-label="Navegação mobile">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => go(link.id)}
                className={`border-b border-white/5 py-3 text-left text-base font-medium ${
                  activeId === link.id ? "text-lzgreen" : "text-white/85"
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>
          <WhatsAppGate
            whatsapp={whatsapp}
            location="header_mobile"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-lzgreen px-5 py-3.5 font-display text-base font-semibold text-navy-deep"
          >
            Solicitar orçamento <WhatsAppIcon className="h-5 w-5" />
          </WhatsAppGate>
          <Link
            to="/auth"
            onClick={() => setOpen(false)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-lzgreen/50 px-5 py-3.5 font-display text-base font-semibold text-lzgreen"
          >
            <LogIn className="h-5 w-5" /> Entrar no sistema
          </Link>
        </div>
      ) : null}
    </header>
  );
}
