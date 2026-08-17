import { ChevronRight, ClipboardCheck, PencilRuler, Wrench, Zap } from "lucide-react";
import { STEPS } from "./home-content";

const icons = { clipboard: ClipboardCheck, pencil: PencilRuler, wrench: Wrench, zap: Zap } as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-[1320px] px-4 md:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-lzgreen">
            Como funciona
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-navy-deep md:text-[2.6rem]">
            Simples, rápido e sem complicação
          </h2>
          <p className="mt-3 text-base text-muted-foreground">Você economiza e o planeta agradece.</p>
        </header>

        {/* Desktop */}
        <div className="mt-12 hidden md:grid md:grid-cols-4 md:gap-5">
          {STEPS.map((step, i) => {
            const Icon = icons[step.icon];
            return (
              <div key={step.n} className="relative">
                <article className="h-full rounded-2xl border border-black/5 bg-white p-6 text-center shadow-[0_16px_40px_-34px_oklch(0.2_0.04_248)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-30px_oklch(0.2_0.04_248/0.6)]">
                  <div className="mb-4 flex items-center justify-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-lzgreen font-display text-sm font-bold text-navy-deep">
                      {step.n}
                    </span>
                    <Icon className="h-8 w-8 text-navy" strokeWidth={1.4} aria-hidden="true" />
                  </div>
                  <h3 className="font-display text-base font-bold text-navy-deep">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </article>
                {i < STEPS.length - 1 ? (
                  <span
                    className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-lzgreen md:block"
                    aria-hidden="true"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Mobile */}
        <ol className="relative mt-10 space-y-3 md:hidden">
          <span className="absolute bottom-8 left-[26px] top-8 w-px bg-black/10" aria-hidden="true" />
          {STEPS.map((step) => {
            const Icon = icons[step.icon];
            return (
              <li
                key={step.n}
                className="relative flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_-28px_oklch(0.2_0.04_248)]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lzgreen font-display text-sm font-bold text-navy-deep">
                  {step.n}
                </span>
                <Icon className="h-7 w-7 shrink-0 text-navy" strokeWidth={1.4} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-sm font-bold text-navy-deep">{step.title}</h3>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{step.text}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
