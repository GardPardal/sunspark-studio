import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { FOOTER } from "./home-content";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate } from "./whatsapp-gate";

export function SiteFooter({
  logoUrl,
  brandName,
  whatsapp,
  phone,
  email,
  instagram,
  address,
  onNavigate,
}: {
  logoUrl: string;
  brandName: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  address: string;
  onNavigate: (id: string) => void;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy-deep text-white">
      <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <img src={logoUrl} alt={brandName} width={130} height={44} loading="lazy" className="h-10 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">{FOOTER.description}</p>
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
          </div>

          {FOOTER.columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-display text-sm font-bold">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link}>
                    <button
                      type="button"
                      onClick={() => onNavigate("solucoes")}
                      className="text-left text-sm text-white/60 transition hover:text-lzgreen"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="font-display text-sm font-bold">Atendimento</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li>
                <a href={`tel:${phone.replace(/\D/g, "")}`} className="flex items-center gap-2 transition hover:text-lzgreen">
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
                <a href={`mailto:${email}`} className="flex items-center gap-2 break-all transition hover:text-lzgreen">
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
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-5 text-xs text-white/50 md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {year} {brandName}. Todos os direitos reservados.</p>
          <div className="flex gap-5">
            <a href="/politica-de-privacidade" className="transition hover:text-lzgreen">Política de Privacidade</a>
            <a href="/termos-de-uso" className="transition hover:text-lzgreen">Termos de Uso</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
