import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Configuração de Conversões Meta CAPI (Ploomes → Meta)
// - Nomes dos eventos custom por etapa (novo/atendimento/venda/faturado)
// - Pixel ID e Test Event Code
// Valores ficam em `site_settings` (chaves: meta_event_*, meta_pixel_id,
// meta_test_event_code). O webhook do Ploomes lê essas chaves e injeta
// no CAPI a cada card criado/atualizado.
// ============================================================

const KEYS = [
  "meta_pixel_id",
  "meta_test_event_code",
  "meta_event_novo",
  "meta_event_atendimento",
  "meta_event_venda",
  "meta_event_faturado",
] as const;

async function assertAdminOrCoord(supabase: any, userId: string) {
  const [{ data: a }, { data: c }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a && !c) throw new Error("Acesso restrito a admin/coordenação.");
}

export type ConversionsConfig = Record<(typeof KEYS)[number], string>;

export const getConversionsConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversionsConfig> => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);
    const { data } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", KEYS as unknown as string[]);
    const out = {} as ConversionsConfig;
    for (const k of KEYS) out[k] = "";
    for (const r of (data ?? []) as Array<{ key: string; value: string | null }>) {
      if ((KEYS as readonly string[]).includes(r.key)) {
        out[r.key as keyof ConversionsConfig] = r.value ?? "";
      }
    }
    return out;
  });

export const saveConversionsConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<ConversionsConfig>) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);
    const rows = (KEYS as readonly string[])
      .filter((k) => (data as any)[k] !== undefined)
      .map((k) => ({
        key: k,
        value: String((data as any)[k] ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      }));
    if (rows.length) {
      const { error } = await supabase
        .from("site_settings")
        .upsert(rows, { onConflict: "key" });
      if (error) throw error;
    }
    return { ok: true, saved: rows.length };
  });
