import { useEffect } from "react";
import { useSiteSettings } from "@/lib/site-settings";

/**
 * Reads visual settings (colors, radius) from site_settings and injects
 * them as CSS variables on <html>. Safe to mount at the root.
 */
export function ThemeApplier() {
  const { data: settings } = useSiteSettings();

  useEffect(() => {
    if (typeof document === "undefined" || !settings) return;
    const root = document.documentElement;

    const apply = (name: string, value: string | undefined) => {
      if (value && value.trim()) root.style.setProperty(name, value.trim());
      else root.style.removeProperty(name);
    };

    apply("--primary", settings.primary_color);
    apply("--ring", settings.primary_color);
    apply("--cta", settings.cta_color);
    apply("--background", settings.background_color);

    if (settings.border_radius && settings.border_radius.trim()) {
      const n = Number(settings.border_radius);
      if (!Number.isNaN(n)) root.style.setProperty("--radius", `${n}rem`);
    } else {
      root.style.removeProperty("--radius");
    }
  }, [
    settings?.primary_color,
    settings?.cta_color,
    settings?.background_color,
    settings?.border_radius,
  ]);

  return null;
}
