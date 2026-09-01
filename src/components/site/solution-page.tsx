import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { getSolution } from "@/modules/site/public.functions";
import { SOLUTION_DEFAULTS, type SolutionSlug } from "@/modules/site/site.shared";
import { PublicLayout, PageHero, Section, FaqList } from "./public-layout";
import { QuoteForm } from "./site-forms";
import { WhatsAppGate } from "./whatsapp-gate";
import { WhatsAppIcon } from "./icons";
import { useResolvedSiteSettings } from "@/lib/site-settings";

export function solutionQueryOptions(slug: SolutionSlug) {
  return {
    queryKey: ["site_solution", slug],
    queryFn: () => getSolution({ data: { slug } }),
    staleTime: 5 * 60_000,
  };
}

export function resolveSolution(slug: SolutionSlug, row: Record<string, any> | null | undefined) {
  const base = SOLUTION_DEFAULTS[slug];
  const benefits: string[] =
    Array.isArray(row?.benefits) && row!.benefits.length
      ? row!.benefits
          .map((b: any) => (typeof b === "string" ? b : (b?.title ?? "")))
          .filter(Boolean)
      : base.benefits;
  const faqs =
    Array.isArray(row?.faqs) && row!.faqs.length
      ? row!.faqs
          .map((f: any) => ({ q: f?.q ?? f?.question ?? "", a: f?.a ?? f?.answer ?? "" }))
          .filter((f: any) => f.q && f.a)
      : base.faqs;
  return {
    name: row?.name || base.name,
    headline: row?.headline || base.headline,
    subheadline: row?.subheadline || base.subheadline,
    intro: row?.intro || base.intro,
    heroImage: row?.hero_image_url || null,
    videoUrl: row?.video_url || null,
    whatsappMessage: row?.whatsapp_message || `Olá! Tenho interesse em ${base.name}.`,
    benefits,
    faqs: faqs as Array<{ q: string; a: string }>,
    sections: Array.isArray(row?.sections) ? row!.sections : [],
  };
}

export function SolutionPage({ slug }: { slug: SolutionSlug }) {
  const settings = useResolvedSiteSettings();
  const { data } = useSuspenseQuery(solutionQueryOptions(slug));
  const s = resolveSolution(slug, data);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Soluções LZ7"
        title={s.headline}
        subtitle={s.subheadline}
        breadcrumbs={[{ label: s.name }]}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="#orcamento"
            className="inline-flex items-center justify-center rounded-xl bg-lzgreen px-6 py-3.5 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white"
          >
            Solicitar orçamento
          </a>
          <WhatsAppGate
            whatsapp={settings.whatsapp}
            location={`solucao_${slug}`}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 font-display text-sm font-semibold text-white transition hover:border-lzgreen hover:text-lzgreen"
          >
            Falar no WhatsApp <WhatsAppIcon className="h-4 w-4" />
          </WhatsAppGate>
        </div>
      </PageHero>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-display text-2xl font-bold md:text-3xl">
              Como funciona a {s.name.toLowerCase()}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{s.intro}</p>

            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {s.benefits.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 rounded-xl border border-border bg-white p-4"
                >
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lzgreen/15 text-lzgreen-strong">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium">{b}</span>
                </li>
              ))}
            </ul>

            {s.sections.length ? (
              <div className="mt-10 space-y-6">
                {s.sections.map((sec: any, i: number) => (
                  <div key={i} className="rounded-2xl border border-border bg-muted/30 p-6">
                    {sec?.title ? (
                      <h3 className="font-display text-lg font-semibold">{sec.title}</h3>
                    ) : null}
                    {sec?.text ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {sec.text}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div id="orcamento" className="scroll-mt-24">
            <div className="rounded-2xl border border-border bg-white p-6 shadow-sm lg:sticky lg:top-28">
              <h2 className="font-display text-xl font-bold">Peça seu orçamento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Resposta rápida de um especialista da LZ7, sem compromisso.
              </p>
              <div className="mt-5">
                <QuoteForm origem={`site_solucao_${slug}`} produto={s.name} compact />
              </div>
            </div>
          </div>
        </div>
      </Section>

      {s.faqs.length ? (
        <Section tone="muted" title="Perguntas frequentes">
          <FaqList faqs={s.faqs} />
        </Section>
      ) : null}

      <Section>
        <div className="rounded-2xl bg-navy-deep px-6 py-10 text-center text-white md:px-12">
          <h2 className="font-display text-2xl font-bold md:text-3xl">Pronto para economizar?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70">
            Veja projetos que já entregamos ou fale agora com um especialista.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/projetos"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3 font-display text-sm font-semibold text-white transition hover:border-lzgreen hover:text-lzgreen"
            >
              Ver projetos
            </Link>
            <WhatsAppGate
              whatsapp={settings.whatsapp}
              location={`solucao_cta_${slug}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-lzgreen px-6 py-3 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white"
            >
              Falar com especialista <WhatsAppIcon className="h-4 w-4" />
            </WhatsAppGate>
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
