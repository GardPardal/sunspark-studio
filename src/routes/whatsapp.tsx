import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { siteSettingsQueryOptions, useResolvedSiteSettings } from "@/lib/site-settings";
import { getExternalId, initAllTrackers, persistFirstTouch } from "@/lib/tracking";

/**
 * Página-ponte dos anúncios de WhatsApp (campanha de Leads com destino Site).
 * O clique do anúncio cai aqui; guardamos fbclid/_fbc/_fbp/IP/navegador com um código curto e abrimos o
 * WhatsApp com a mensagem "… (cód. 7K2QX)". O "Lead" só vai para a Meta quando a SDR cadastra o contato
 * (extensão → formulário): conversa fria nunca conta como lead.
 *
 * Parâmetros: n = número do WhatsApp (padrão: SDR), t = texto da mensagem, + UTMs e ad_id/adset_id/campaign_id.
 */
const NUMERO_PADRAO = "554399760685";
const TEXTO_PADRAO = "Olá! Quero um orçamento de energia solar.";
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function novoCodigo() {
  const a = new Uint32Array(5);
  crypto.getRandomValues(a);
  return [...a].map((x) => ALFABETO[x % ALFABETO.length]).join("");
}

function cookie(nome: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${nome}=`))
    ?.split("=")[1];
}

export const Route = createFileRoute("/whatsapp")({
  loader: ({ context }) => context.queryClient.ensureQueryData(siteSettingsQueryOptions()),
  head: () => ({
    meta: [
      { title: "Abrindo o WhatsApp · LZ7 Energia" },
      {
        name: "description",
        content: "Fale com a LZ7 Energia pelo WhatsApp e receba seu orçamento de energia solar.",
      },
      { property: "og:title", content: "Fale com a LZ7 Energia no WhatsApp" },
      { property: "og:description", content: "Orçamento de energia solar pelo WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PaginaPonte,
});

function PaginaPonte() {
  const settings = useResolvedSiteSettings();
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    initAllTrackers({
      gtm_id: settings.gtm_id,
      ga4_measurement_id: settings.ga4_measurement_id,
      google_ads_id: settings.google_ads_id,
      meta_pixel_id: settings.meta_pixel_id,
      tiktok_pixel_id: settings.tiktok_pixel_id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistFirstTouch();
    const q = new URLSearchParams(window.location.search);
    const codigo = novoCodigo();
    const agora = Date.now();
    const fbclid = q.get("fbclid") || undefined;
    const fbc = cookie("_fbc") || (fbclid ? `fb.1.${agora}.${fbclid}` : undefined);
    let fbp = cookie("_fbp");
    if (!fbp) {
      // mesmo formato do Pixel; fica no domínio para o navegador do cliente ser reconhecido depois
      fbp = `fb.1.${agora}.${Math.floor(Math.random() * 1e10)}`;
      document.cookie = `_fbp=${fbp}; max-age=${90 * 86400}; path=/; SameSite=Lax`;
    }
    const numero = (q.get("n") || NUMERO_PADRAO).replace(/\D/g, "");
    const texto = `${q.get("t") || TEXTO_PADRAO} (cód. ${codigo})`;
    const destino = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
    setLink(destino);

    const corpo = JSON.stringify({
      codigo,
      fbclid,
      fbc,
      fbp,
      visitor_id: getExternalId(),
      page_url: window.location.href,
      referrer: document.referrer || undefined,
      utm_source: q.get("utm_source") || undefined,
      utm_medium: q.get("utm_medium") || undefined,
      utm_campaign: q.get("utm_campaign") || undefined,
      utm_content: q.get("utm_content") || undefined,
      utm_term: q.get("utm_term") || undefined,
      ad_id: q.get("ad_id") || undefined,
      adset_id: q.get("adset_id") || undefined,
      campaign_id: q.get("campaign_id") || undefined,
    });
    const ir = () => window.location.replace(destino);
    const pronto = fetch("/api/public/wa-clique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corpo,
      keepalive: true,
    }).catch(() => undefined);
    // abre o WhatsApp assim que o clique for gravado (ou em 1,2 s, o que vier primeiro)
    Promise.race([pronto, new Promise((r) => setTimeout(r, 1200))]).then(ir);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
      <p className="font-display text-2xl font-bold">LZ7 Energia</p>
      <p className="text-lg">Abrindo o WhatsApp para o seu orçamento…</p>
      {link && (
        <a
          href={link}
          className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg"
        >
          Abrir o WhatsApp
        </a>
      )}
      <p className="max-w-sm text-sm text-muted-foreground">
        Se o WhatsApp não abrir sozinho, toque no botão acima. A mensagem já vai pronta: é só
        enviar.
      </p>
    </main>
  );
}
