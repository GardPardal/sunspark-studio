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

/** Etapa depois do clique (abriu / travou / botao) — sendBeacon sobrevive à troca para o app do WhatsApp. */
function marcarEtapa(codigo: string, etapa: "abriu" | "travou" | "botao") {
  const corpo = JSON.stringify({ codigo, etapa });
  try {
    if (
      navigator.sendBeacon?.(
        "/api/public/wa-clique",
        new Blob([corpo], { type: "application/json" }),
      )
    )
      return;
  } catch {
    /* cai no fetch */
  }
  fetch("/api/public/wa-clique", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: corpo,
    keepalive: true,
  }).catch(() => undefined);
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
  const [codigo, setCodigo] = useState<string | null>(null);
  const [travou, setTravou] = useState(false);

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
    // api.whatsapp.com direto: o wa.me faz um redirecionamento a mais dentro do navegador do Instagram/Facebook
    const destino = `https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(texto)}`;
    setLink(destino);
    setCodigo(codigo);

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
    // a página some (visibilitychange) quando o app do WhatsApp abre por cima; se seguir visível 4 s depois
    // do redirecionamento, o cliente ficou parado aqui e o botão vira o destaque
    let abriu = false;
    const sumiu = () => {
      if (document.visibilityState === "hidden" && !abriu) {
        abriu = true;
        marcarEtapa(codigo, "abriu");
      }
    };
    document.addEventListener("visibilitychange", sumiu);
    const ir = () => {
      window.location.replace(destino);
      setTimeout(() => {
        if (!abriu && document.visibilityState === "visible") {
          setTravou(true);
          marcarEtapa(codigo, "travou");
        }
      }, 4000);
    };
    const pronto = fetch("/api/public/wa-clique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corpo,
      keepalive: true,
    }).catch(() => undefined);
    // abre o WhatsApp assim que o clique for gravado (ou em 1,2 s, o que vier primeiro)
    Promise.race([pronto, new Promise((r) => setTimeout(r, 1200))]).then(ir);
    return () => document.removeEventListener("visibilitychange", sumiu);
  }, []);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
      <p className="font-display text-2xl font-bold">LZ7 Energia</p>
      <p className="text-lg">
        {travou
          ? "Toque no botão para falar com a gente"
          : "Abrindo o WhatsApp para o seu orçamento…"}
      </p>
      {link && (
        <a
          href={link}
          onClick={() => codigo && marcarEtapa(codigo, "botao")}
          className={`rounded-full bg-[#25D366] font-semibold text-white shadow-lg ${travou ? "animate-pulse px-10 py-5 text-xl" : "px-6 py-3"}`}
        >
          Abrir o WhatsApp
        </a>
      )}
      <p className="max-w-sm text-sm text-muted-foreground">
        A mensagem já vai pronta: é só tocar em enviar ➤ no WhatsApp.
      </p>
    </main>
  );
}
