import { CheckCircle2, Star, User } from "lucide-react";
import heroImage from "@/assets/hero-casa-solar-1280.webp.asset.json";
import heroImageSm from "@/assets/hero-casa-solar-768.webp.asset.json";
import { HERO, TRUST } from "./home-content";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate, trackEvent } from "./whatsapp-gate";

export function HomeHero({
  whatsapp,
  onSecondary,
}: {
  whatsapp: string;
  onSecondary: () => void;
}) {
  return (
    <section id="inicio" className="relative bg-navy-deep text-white">
      {/* imagem: fundo à direita no desktop, bloco abaixo do texto no mobile */}
      <div className="absolute inset-y-0 right-0 hidden w-[52%] lg:block">
        <img
          src={heroImage.url}
          alt="Residência moderna com painéis solares instalados no telhado ao entardecer"
          width={1600}
          height={1200}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-deep via-navy-deep/70 to-transparent" />
        <div
          className="absolute inset-y-0 left-0 w-40 bg-navy-deep"
          style={{ clipPath: "ellipse(100% 75% at 0% 50%)" }}
          aria-hidden="true"
        />
      </div>

      <div className="relative mx-auto max-w-[1320px] px-4 pb-10 pt-24 md:px-8 md:pb-16 md:pt-28 lg:grid lg:min-h-[640px] lg:grid-cols-2 lg:items-center lg:gap-10 lg:pb-24 lg:pt-32">
        <div className="max-w-xl">
          <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-lzgreen">
            {HERO.eyebrow}
          </p>
          <h1 className="mt-3 font-display text-[2.15rem] font-extrabold leading-[1.06] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            {HERO.titleStart}
            <span className="text-lzgreen">{HERO.titleHighlight}</span>
            {HERO.titleEnd}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/75 md:text-lg">
            {HERO.subtitle}
          </p>

          <ul className="mt-7 hidden grid-cols-2 gap-x-6 gap-y-3 md:grid lg:grid-cols-4 lg:gap-x-4">
            {HERO.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-[13px] leading-snug text-white/70">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lzgreen" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <WhatsAppGate
              whatsapp={whatsapp}
              location="hero"
              className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-lzgreen px-7 font-display text-base font-semibold text-navy-deep shadow-[0_16px_40px_-18px_oklch(0.7_0.19_145)] transition hover:bg-lzgreen-strong hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lzgreen"
            >
              <WhatsAppIcon className="h-5 w-5" /> Quero meu orçamento
            </WhatsAppGate>
            <button
              type="button"
              onClick={() => {
                trackEvent("cta_click", { location: "hero_secondary" });
                onSecondary();
              }}
              className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl border border-white/25 px-7 font-display text-base font-semibold text-white transition hover:border-white/60 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lzgreen"
            >
              <User className="h-5 w-5" aria-hidden="true" /> Falar com especialista
            </button>
          </div>

          {/* imagem mobile */}
          <div className="mt-8 overflow-hidden rounded-2xl lg:hidden">
            <img
              src={heroImage.url}
              alt="Residência moderna com painéis solares instalados no telhado ao entardecer"
              width={1600}
              height={1200}
              fetchPriority="high"
              decoding="async"
              className="aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
            />
          </div>

          <TrustMetrics />
        </div>
      </div>
    </section>
  );
}

function TrustMetrics() {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 lg:mt-9 lg:border-0 lg:bg-transparent lg:p-0">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:flex lg:flex-nowrap lg:items-center lg:gap-6">
        <div className="flex items-center gap-2 lg:block">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-extrabold">{TRUST.rating}</span>
            <span className="flex" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} className="h-4 w-4 fill-lzgreen text-lzgreen" />
              ))}
            </span>
          </div>
          <span className="text-xs leading-tight text-white/60">{TRUST.ratingLabel}</span>
        </div>
        {TRUST.metrics.map((metric) => (
          <div key={metric.value} className="lg:shrink-0 lg:border-l lg:border-white/15 lg:pl-6">
            <p className="whitespace-nowrap font-display text-2xl font-extrabold text-white">{metric.value}</p>
            <p className="whitespace-nowrap text-xs text-white/60">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
