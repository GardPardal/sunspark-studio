import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sun, ShieldCheck, Zap } from "lucide-react";
import { LizChat } from "@/components/liz-chat";
import { siteSettingsQueryOptions, useResolvedSiteSettings } from "@/lib/site-settings";
import {
  initAllTrackers,
  persistFirstTouch,
} from "@/lib/tracking";

export const Route = createFileRoute("/captura")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
  head: () => ({
    meta: [
      { title: "Descubra sua economia com energia solar · LZ7 Energia" },
      {
        name: "description",
        content:
          "Converse com a LIZ, nossa consultora virtual, e descubra em minutos quanto você pode economizar instalando energia solar com a LZ7.",
      },
      { property: "og:title", content: "Simule sua economia com a LIZ · LZ7 Energia" },
      {
        property: "og:description",
        content:
          "Conversa rápida, sem formulário. A LIZ te mostra em minutos o quanto você economiza com energia solar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex,follow" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
    ],
  }),
  component: CapturaPage,
});

function CapturaPage() {
  const settings = useResolvedSiteSettings();

  useEffect(() => {
    persistFirstTouch();
  }, []);

  useEffect(() => {
    initAllTrackers({
      gtm_id: settings.gtm_id,
      ga4_measurement_id: settings.ga4_measurement_id,
      google_ads_id: settings.google_ads_id,
      meta_pixel_id: settings.meta_pixel_id,
      tiktok_pixel_id: settings.tiktok_pixel_id,
    });
  }, [
    settings.gtm_id,
    settings.ga4_measurement_id,
    settings.google_ads_id,
    settings.meta_pixel_id,
    settings.tiktok_pixel_id,
  ]);

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="w-full border-b border-border/60 bg-primary">
        <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-4">
          <img
            src={settings.logo_url}
            alt="LZ7 Energia"
            className="h-9 w-auto"
            width={110}
            height={36}
          />
        </div>
      </header>

      <section className="mx-auto max-w-lg px-4 pt-6 pb-4 sm:pt-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <Sun className="h-3.5 w-3.5" /> Simulação em minutos
          </div>
          <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Fale com a <span className="text-primary">LIZ</span> e descubra sua economia
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Conversa rápida, sem formulário chato. Em minutos você entende quanto pode economizar.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-lg px-4 pb-6">
        <LizChat mode="capture" inline />
      </section>

      <section className="mx-auto max-w-lg px-4 pb-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <Perk icon={Zap} title="Sem custo">
            Simulação e visita técnica gratuitas.
          </Perk>
          <Perk icon={ShieldCheck} title="Seus dados seguros">
            LGPD. Nada de spam.
          </Perk>
          <Perk icon={Sun} title="+2.000 clientes">
            LZ7 atendendo PR, SP e SC.
          </Perk>
        </div>
      </section>
    </main>
  );
}

function Perk({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sun;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
