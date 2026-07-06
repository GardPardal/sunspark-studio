import { useQuery } from "@tanstack/react-query";
import { getPublicSiteSettings } from "@/lib/site-settings.functions";

export type SettingsMap = Record<string, string>;

export const DEFAULT_SETTINGS: SettingsMap = {
  whatsapp: "5543996172509",
  phone: "(43) 99617-2509",
  email: "contato@lz7energia.com.br",
  instagram: "https://instagram.com/lz7energia",
  video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  hero_title: "Economize até 90% na sua conta de energia",
  hero_subtitle:
    "Transforme sua conta de luz em investimento com um projeto de energia solar desenvolvido por especialistas. Atendemos residências, empresas, indústrias e propriedades rurais.",

  // ---------- Tracking IDs (público — carregados no frontend) ----------
  gtm_id: "",
  ga4_measurement_id: "",
  google_ads_id: "",
  google_ads_conversion_label: "",
  google_ads_sale_label: "",
  google_ads_faturado_label: "",
  meta_pixel_id: "",
  meta_test_event_code: "",
  tiktok_pixel_id: "",

  // ---------- Aparência (tema visual) ----------
  logo_url: "",
  primary_color: "",
  cta_color: "",
  background_color: "",
  border_radius: "",
};

export const SITE_SETTINGS_QUERY_KEY = ["site_settings"] as const;

export function siteSettingsQueryOptions() {
  return {
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: () => getPublicSiteSettings(),
    staleTime: 60_000,
  };
}

export function useSiteSettings() {
  return useQuery(siteSettingsQueryOptions());
}

export function buildThemeCss(settings: SettingsMap): string {
  const vars: string[] = [];
  if (settings.primary_color?.trim()) {
    vars.push(`--primary:${settings.primary_color.trim()}`);
    vars.push(`--ring:${settings.primary_color.trim()}`);
  }
  if (settings.cta_color?.trim()) vars.push(`--cta:${settings.cta_color.trim()}`);
  if (settings.background_color?.trim())
    vars.push(`--background:${settings.background_color.trim()}`);
  if (settings.border_radius?.trim()) {
    const n = Number(settings.border_radius);
    if (!Number.isNaN(n)) vars.push(`--radius:${n}rem`);
  }
  if (!vars.length) return "";
  return `:root{${vars.join(";")}}`;
}


export function waHref(whatsapp: string, message = "Olá! Gostaria de solicitar um orçamento de energia solar.") {
  const clean = whatsapp.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
