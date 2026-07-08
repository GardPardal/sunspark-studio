import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { LizChat } from "@/components/liz-chat";
import { siteSettingsQueryOptions, useResolvedSiteSettings } from "@/lib/site-settings";
import { initAllTrackers, persistFirstTouch } from "@/lib/tracking";

export const Route = createFileRoute("/captura")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
  head: () => ({
    meta: [
      { title: "Fale com a LIZ · LZ7 Energia" },
      {
        name: "description",
        content:
          "Converse com a LIZ, consultora virtual da LZ7, e descubra em minutos quanto você pode economizar com energia solar.",
      },
      { property: "og:title", content: "Fale com a LIZ · LZ7 Energia" },
      {
        property: "og:description",
        content:
          "Conversa rápida, sem formulário. A LIZ te mostra em minutos o quanto você economiza.",
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
    <main className="fixed inset-0 flex flex-col bg-background">
      <LizChat mode="capture" inline className="h-full w-full rounded-none border-0 shadow-none" />
    </main>
  );
}
