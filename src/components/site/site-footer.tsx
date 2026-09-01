import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { FOOTER } from "./home-content";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate } from "./whatsapp-gate";
import { NewsletterForm } from "./site-forms";
import { INSTITUTIONAL_LINKS, LEGAL_LINKS, SOLUTION_LINKS } from "@/modules/site/site.shared";
import { CIDADES } from "@/lib/local-seo";
import compactLogo from "@/assets/lz7-logo-header.webp.asset.json";

export function SiteFooter({
  logoUrl,
  brandName,
  whatsapp,
  phone,
  email,
  instagram,
  address,
}: {
  logoUrl: string;
  brandName: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  address: string;
}) {
  const year = new Date().getFullYear();
  const linkCls = "text-left text-sm text-white/60 transition hover:text-lzgreen";

  return (
    <footer className="bg-navy-deep text-white">
      <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <img
              src={
                !logoUrl ||
                logoUrl.includes("1d68beb7-d327-4044-9f65-1fd1c55f902b") ||
                logoUrl.endsWith("/logo.webp") ||
                logoUrl.includes("lz7-logo-header")
                  ? "/lz7-logo.png"
                  : logoUrl
              }
              alt={brandName}
              width={130}
              height={69}
              loading="lazy"
              decoding="async"
              className="h-10 w-auto object-contain"
            />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              {FOOTER.description}
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href={instagram || "#"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram da LZ7 Energia"
                className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white/70 transition hover:border-lzgreen hover:text-lzgreen"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white/40">
                <Facebook className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 text-white/40">
                <Youtube className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-6">
              <p className="font-display text-sm font-bold">Receba nossos conteúdos</p>
              <div className="mt-3">
                <NewsletterForm dark />
              </div>
            </div>
          </div>

          <nav aria-label="Soluções">
            <h2 className="font-display text-sm font-bold">Soluções</h2>
            <ul className="mt-4 space-y-2.5">
              {SOLUTION_LINKS.map((s) => (
                <li key={s.slug}>
                  <Link to={s.to} className={linkCls}>
                    {s.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Institucional">
            <h2 className="font-display text-sm font-bold">Institucional</h2>
            <ul className="mt-4 space-y-2.5">
              {INSTITUTIONAL_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className={linkCls}>
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/unidades" className={linkCls}>
                  Nossas unidades
                </Link>
              </li>
              <li>
                <Link to="/energia-solar" className={linkCls}>
                  Cidades atendidas
                </Link>
              </li>

              <li>
                <Link to="/contato" className={linkCls}>
                  Contato
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="font-display text-sm font-bold">Atendimento</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li>
                <a
                  href={`tel:${phone.replace(/\D/g, "")}`}
                  className="flex items-center gap-2 transition hover:text-lzgreen"
                >
                  <Phone className="h-4 w-4 shrink-0" aria-hidden="true" /> {phone}
                </a>
              </li>
              <li>
                <WhatsAppGate
                  whatsapp={whatsapp}
                  location="footer_link"
                  className="flex items-center gap-2 transition hover:text-lzgreen"
                >
                  <WhatsAppIcon className="h-4 w-4 shrink-0" /> WhatsApp
                </WhatsAppGate>
              </li>
              <li>
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 break-all transition hover:text-lzgreen"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" /> {email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /> {address}
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-sm font-bold">Fale conosco</h2>
            <p className="mt-4 text-sm text-white/60">Atendimento rápido pelo WhatsApp</p>
            <WhatsAppGate
              whatsapp={whatsapp}
              location="footer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lzgreen px-6 py-3 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white"
            >
              WhatsApp <WhatsAppIcon className="h-4 w-4" />
            </WhatsAppGate>
            <Link
              to="/contato"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-6 py-3 font-display text-sm font-semibold text-white/80 transition hover:border-lzgreen hover:text-lzgreen"
            >
              Formulário de contato
            </Link>
          </div>
        </div>

        <nav aria-label="Cidades atendidas" className="mt-12 border-t border-white/10 pt-6">
          <h2 className="font-display text-sm font-bold">Energia solar por cidade</h2>
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
            {CIDADES.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/energia-solar/$cidade"
                  params={{ cidade: c.slug }}
                  className="transition hover:text-lzgreen"
                >
                  Energia solar em {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-5 text-xs text-white/50 md:flex-row md:items-center md:justify-between md:px-8">
          <p>
            © {year} {brandName}. Todos os direitos reservados.
          </p>
          <div className="flex gap-5">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="transition hover:text-lzgreen">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
