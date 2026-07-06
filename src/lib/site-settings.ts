import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SettingsMap = Record<string, string>;

export const DEFAULT_SETTINGS: SettingsMap = {
  whatsapp: "5543996172509",
  phone: "(43) 99617-2509",
  email: "contato@lz7energia.com.br",
  instagram: "https://instagram.com/lz7energia",
  video_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  hero_title: "Economize até 95% na sua conta de energia com energia solar",
  hero_subtitle:
    "Projetos personalizados de energia solar fotovoltaica para residências, empresas e propriedades rurais no Paraná, São Paulo e Santa Catarina.",
};

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site_settings"],
    queryFn: async (): Promise<SettingsMap> => {
      const { data, error } = await supabase.from("site_settings").select("key,value");
      if (error) throw error;
      const map: SettingsMap = { ...DEFAULT_SETTINGS };
      for (const row of data ?? []) {
        if (row.value != null) map[row.key] = row.value;
      }
      return map;
    },
    staleTime: 60_000,
  });
}

export function waHref(whatsapp: string, message = "Olá! Gostaria de solicitar um orçamento de energia solar.") {
  const clean = whatsapp.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
