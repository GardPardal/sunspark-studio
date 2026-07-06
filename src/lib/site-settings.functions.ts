import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type SettingsMap } from "@/lib/site-settings";

export const getPublicSiteSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsMap> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return { ...DEFAULT_SETTINGS };
    const supabase = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.from("site_settings").select("key,value");
    if (error) return { ...DEFAULT_SETTINGS };
    const map: SettingsMap = { ...DEFAULT_SETTINGS };
    for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) {
      if (row.value != null) map[row.key] = row.value;
    }
    return map;
  },
);
