import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { REQUIRED_PUBLIC_SETTING_KEYS, type SettingsMap } from "@/lib/site-settings.schema";

export const getPublicSiteSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsMap> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Configuração do backend indisponível.");
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          "cache-control": "no-store",
          pragma: "no-cache",
        },
      },
    });
    const { data, error } = await supabase.from("site_settings").select("key,value");
    if (error) throw new Error("Não foi possível carregar as configurações atuais do site.");
    const map: SettingsMap = {};
    for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
      if (row.value != null) map[row.key] = row.value;
    }

    const missing = REQUIRED_PUBLIC_SETTING_KEYS.filter((settingKey) => !map[settingKey]?.trim());
    if (missing.length) {
      throw new Error(`Configuração do site incompleta: ${missing.join(", ")}.`);
    }

    return map;
  },
);
