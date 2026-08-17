import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Menu, X } from "lucide-react";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate } from "./whatsapp-gate";
import { INSTITUTIONAL_LINKS, SOLUTION_LINKS } from "@/modules/site/site.shared";

/** Cabeçalho das páginas internas do portal (navegação real por rotas). */
export function PublicHeader({ logoUrl, whatsapp }: { logoUrl: string; whatsapp: string }) {
  const [open, setOpen] = useState(false);
  const [solutions, setSolutions] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const itemCls =
    "text-sm font-medium text-white/80 transition-colors hover:text-lzgreen focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lzgreen";

  return (
    <header className="sticky top-0 z-50 border-b border-navy-line/40 bg-navy-deep/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-4 px-4 md:h-20 md:px-8">
        <Link to="/" className="flex shrink-0 items-center" aria-label="LZ7 Energia — página inicial">
          <img src={logoUrl} alt="LZ7 Energia" width={130} height={44} className="h-9 w-auto md:h-11" />
        </Link>

        <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
          <Link to="/" className={itemCls}>
            Início
          </Link>
          <div className="relative" onMouseLeave={() => setSolutions(false)}>
            <button
              type="button"
              className={`${itemCls} inline-flex items-center gap-1`}
              onMouseEnter={() => setSolutions(true)}
              onClick={() => setSolutions((v) => !v)}
              aria-expanded={solutions}
            >
              Soluções <ChevronDown className="h-4 w-4" />
            </button>
            {solutions ? (
              <div className="absolute left-0 top-full z-50 w-64 rounded-xl border border-navy-line/50 bg-navy-deep p-2 shadow-xl">
                {SOLUTION_LINKS.map((s) => (
                  <Link
                    key={s.slug}
                    to={s.to}
                    onClick={() => setSolutions(false)}
                    className="block rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/5 hover:text-lzgreen"
                    activeProps={{ className: "block rounded-lg px-3 py-2 text-sm text-lzgreen bg-white/5" }}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {INSTITUTIONAL_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={itemCls} activeProps={{ className: "text-sm font-medium text-lzgreen" }}>
              {l.label}
            </Link>
          ))}
          <Link to="/contato" className={itemCls} activeProps={{ className: "text-sm font-medium text-lzgreen" }}>
            Contato
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg border border-lzgreen/50 px-4 py-2 font-display text-sm font-semibold text-lzgreen transition hover:bg-lzgreen hover:text-navy-deep"
          >
            <LogIn className="h-4 w-4" /> Entrar
          </Link>
        </nav>

        <WhatsAppGate
          whatsapp={whatsapp}
          location="header_interno"
          className="ml-auto hidden items-center gap-2 rounded-lg bg-lzgreen px-5 py-2.5 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white lg:ml-0 lg:inline-flex"
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
        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-navy-line/40 bg-navy-deep px-4 pb-8 pt-3 lg:hidden">
          <nav className="flex flex-col" aria-label="Navegação mobile">
            <Link to="/" onClick={() => setOpen(false)} className="border-b border-white/5 py-3 text-base font-medium text-white/85">
              Início
            </Link>
            <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-white/40">Soluções</p>
            {SOLUTION_LINKS.map((s) => (
              <Link
                key={s.slug}
                to={s.to}
                onClick={() => setOpen(false)}
                className="border-b border-white/5 py-3 text-base font-medium text-white/85"
              >
                {s.label}
              </Link>
            ))}
            <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-white/40">Institucional</p>
            {INSTITUTIONAL_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="border-b border-white/5 py-3 text-base font-medium text-white/85"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/contato"
              onClick={() => setOpen(false)}
              className="border-b border-white/5 py-3 text-base font-medium text-white/85"
            >
              Contato
            </Link>
          </nav>
          <WhatsAppGate
            whatsapp={whatsapp}
            location="header_interno_mobile"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-lzgreen px-5 py-3.5 font-display text-base font-semibold text-navy-deep"
          >
            Solicitar orçamento <WhatsAppIcon className="h-5 w-5" />
          </WhatsAppGate>
        </div>
      ) : null}
    </header>
  );
}
