import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  return (globalThis as RuntimeGlobals).process?.env?.[name];
}

function configured(names: readonly string[]): string | undefined {
  for (const n of names) {
    const v = runtimeEnv(n)?.trim();
    if (v) return v;
  }
  return undefined;
}

function projectUrl(): string {
  const url = configured(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL não configurado");
  return url;
}

function publishableKey(): string {
  const key = configured([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ]);
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY não configurado");
  return key;
}

/** Cliente que roda com a identidade verificada do usuário (RLS aplicada). */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("Token OAuth ausente");
  return createClient<Database>(projectUrl(), publishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
