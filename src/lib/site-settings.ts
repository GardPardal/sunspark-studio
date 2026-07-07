import { createContext, createElement, useContext, type ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getPublicSiteSettings } from "@/lib/site-settings.functions";
export { DEFAULT_SETTINGS, REQUIRED_PUBLIC_SETTING_KEYS, type SettingsMap } from "@/lib/site-settings.schema";
import type { SettingsMap } from "@/lib/site-settings.schema";

export const SITE_SETTINGS_QUERY_KEY = ["site_settings"] as const;

export function siteSettingsQueryOptions() {
  return {
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: () => getPublicSiteSettings(),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  };
}

const SiteSettingsContext = createContext<UseQueryResult<SettingsMap, Error> | null>(null);

export function SiteSettingsProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings: SettingsMap | null;
}) {
  const query = useQuery({
    ...siteSettingsQueryOptions(),
    initialData: initialSettings ?? undefined,
  });

  return createElement(SiteSettingsContext.Provider, { value: query }, children);
}

export function useSiteSettings() {
  const query = useContext(SiteSettingsContext);
  if (!query) throw new Error("Configuração global do site não inicializada.");
  return query;
}

export function useResolvedSiteSettings() {
  const { data, error } = useSiteSettings();
  if (error) throw error;
  if (!data) throw new Error("Configuração global do site ainda não carregada.");
  return data;
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
