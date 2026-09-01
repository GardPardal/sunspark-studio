import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Mail, MapPin, Phone } from "lucide-react";
import { siteSettingsQueryOptions, useResolvedSiteSettings } from "@/lib/site-settings";
import { listUnits } from "@/modules/site/public.functions";
import { PublicLayout, PageHero, Section } from "@/components/site/public-layout";
import { ContactForm } from "@/components/site/site-forms";
import { WhatsAppGate } from "@/components/site/whatsapp-gate";
import { WhatsAppIcon } from "@/components/site/icons";

const TITLE = "Fale com a LZ7 Energia — Contato, orçamento e suporte";
const DESCRIPTION =
  "Fale com a equipe LZ7 Energia: orçamento de energia solar, suporte a clientes, financeiro, parcerias e carreiras.";
const URL = "https://lz7energia.com.br/contato";

const unitsQuery = { queryKey: ["site_units"], queryFn: () => listUnits(), staleTime: 5 * 60_000 };

export const Route = createFileRoute("/contato")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
      context.queryClient.ensureQueryData(unitsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const settings = useResolvedSiteSettings();
  const { data: units } = useSuspenseQuery(unitsQuery);

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Contato"
        title="Fale com a LZ7 Energia"
        subtitle="Escolha o assunto e sua mensagem vai direto para a área responsável."
        breadcrumbs={[{ label: "Contato" }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
            <h2 className="font-display text-xl font-bold">Envie sua mensagem</h2>
            <div className="mt-5">
              <ContactForm />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted/30 p-6">
              <h2 className="font-display text-lg font-bold">Canais diretos</h2>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a
                    href={`tel:${settings.phone.replace(/\D/g, "")}`}
                    className="flex items-center gap-2 hover:text-lzgreen-strong"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" /> {settings.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${settings.email}`}
                    className="flex items-center gap-2 break-all hover:text-lzgreen-strong"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" /> {settings.email}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" /> Londrina - PR
                </li>
              </ul>
              <WhatsAppGate
                whatsapp={settings.whatsapp}
                location="contato_pagina"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lzgreen px-6 py-3 font-display text-sm font-semibold text-navy-deep transition hover:bg-lzgreen-strong hover:text-white"
              >
                Falar no WhatsApp <WhatsAppIcon className="h-4 w-4" />
              </WhatsAppGate>
            </div>

            {units.length ? (
              <div className="rounded-2xl border border-border bg-white p-6">
                <h2 className="font-display text-lg font-bold">Unidades</h2>
                <ul className="mt-4 space-y-4">
                  {units.map((u) => (
                    <li key={u.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <p className="font-display text-sm font-semibold">{u.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[u.address, u.city, u.state].filter(Boolean).join(", ")}
                      </p>
                      {u.phone ? <p className="text-sm text-muted-foreground">{u.phone}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </Section>
    </PublicLayout>
  );
}
