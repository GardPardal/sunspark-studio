import { useState } from "react";
import { ChevronDown, HelpCircle, Sparkles } from "lucide-react";
import { HOME_FAQS } from "./home-content";
import { WhatsAppGate } from "./whatsapp-gate";
import { WhatsAppIcon } from "./icons";

export function HomeFaq({ whatsapp }: { whatsapp?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (i: number) => {
    setOpenIdx((curr) => (curr === i ? null : i));
  };

  return (
    <section
      id="faq"
      className="py-16 md:py-24 bg-slate-50/70 dark:bg-card/40 border-t border-border/50"
    >
      <div className="mx-auto max-w-[1280px] px-4 md:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1 text-xs font-bold text-primary mb-3">
            <Sparkles className="h-3.5 w-3.5" /> Dúvidas Frequentes
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            Perguntas Frequentes sobre Energia Solar
          </h2>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Tudo o que você precisa saber sobre economia, financiamento, garantias e homologação da
            sua usina solar.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {HOME_FAQS.map((faq, i) => {
            const isOpen = openIdx === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border transition-all overflow-hidden ${
                  isOpen
                    ? "bg-card border-primary/40 shadow-sm"
                    : "bg-card/80 border-border/70 hover:border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base sm:text-lg font-bold text-foreground flex items-center gap-2.5">
                    <HelpCircle className="h-5 w-5 text-primary shrink-0" />
                    {faq.q}
                  </span>
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center bg-secondary/80 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-primary bg-primary/10" : ""
                    }`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-sm sm:text-base text-muted-foreground leading-relaxed border-t border-border/40 font-normal">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {whatsapp && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Ficou com alguma dúvida específica para o seu imóvel?
            </p>
            <WhatsAppGate
              whatsapp={whatsapp}
              location="faq_duvidas"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lzgreen hover:bg-lzgreen-strong text-navy-deep px-6 text-sm font-bold shadow-md transition"
            >
              <WhatsAppIcon className="h-4 w-4" /> Falar com um Especialista Agora
            </WhatsAppGate>
          </div>
        )}
      </div>
    </section>
  );
}
