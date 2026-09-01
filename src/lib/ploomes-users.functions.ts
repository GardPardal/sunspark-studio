import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { _internalFetchSchema } from "./ploomes-form.functions";

export type PloomesUserRow = {
  ploomes_id: number;
  name: string;
  email: string | null;
  active: boolean;
  profile_id: string | null;
  seller_id: string | null;
  unit: "londrina" | "ponta_grossa" | "wenceslau_braz" | null;
  source: string;
  last_seen_at: string;
  updated_at: string;
};

function norm(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}
async function assertManage(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!roles.some((r) => ["admin", "coordenador", "sdr"].includes(r))) {
    throw new Error("Somente admin, coordenação ou SDR podem gerenciar responsáveis.");
  }
}

/** Lista responsáveis do Ploomes já sincronizados, com vínculos resolvidos. */
export const listPloomesUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const [{ data: users, error }, { data: profiles }, { data: sellers }] = await Promise.all([
      supabase
        .from("ploomes_users")
        .select(
          "ploomes_id,name,email,active,profile_id,seller_id,unit,source,last_seen_at,updated_at",
        )
        .order("name", { ascending: true }),
      supabase.from("profiles").select("id,full_name,email,unit,status").order("full_name"),
      supabase.from("sales_sellers").select("id,name,unit,active").order("name"),
    ]);
    if (error) throw new Error(error.message);
    return {
      users: (users ?? []) as PloomesUserRow[],
      profiles: (profiles ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
        unit: string | null;
        status: string;
      }>,
      sellers: (sellers ?? []) as Array<{
        id: string;
        name: string;
        unit: string | null;
        active: boolean;
      }>,
    };
  });

/**
 * Sincroniza os responsáveis cadastrados no Ploomes para o nosso sistema.
 * Fonte primária: formulário público do Ploomes (sempre disponível).
 * Complemento: API /Users quando houver chave configurada (traz e-mail e status).
 * Faz o auto-vínculo com logins (profiles) e vendedores (ranking) por nome/e-mail.
 */
export const syncPloomesUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ createSellers: z.boolean().default(true) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertManage(supabase, userId);
    const { runPloomesUsersSync } = await import("./ploomes-users.server");
    return runPloomesUsersSync(data.createSellers);
  });

/** Atualiza o vínculo/estado de um responsável manualmente. */
export const updatePloomesUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ploomes_id: z.number(),
        profile_id: z.string().uuid().nullable().optional(),
        seller_id: z.string().uuid().nullable().optional(),
        unit: z.enum(["londrina", "ponta_grossa", "wenceslau_braz"]).nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertManage(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.profile_id !== undefined) patch["profile_id"] = data.profile_id;
    if (data.seller_id !== undefined) patch["seller_id"] = data.seller_id;
    if (data.unit !== undefined) patch["unit"] = data.unit;
    if (data.active !== undefined) patch["active"] = data.active;
    const { error } = await supabaseAdmin
      .from("ploomes_users")
      .update(patch)
      .eq("ploomes_id", data.ploomes_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Opções de responsável para formulários (SDR etc.), já sincronizadas. */
export const listResponsavelOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data } = await supabase
      .from("ploomes_users")
      .select("ploomes_id,name,active")
      .eq("active", true)
      .order("name", { ascending: true });
    const rows = (data ?? []) as Array<{ ploomes_id: number; name: string }>;
    if (rows.length > 0) return rows.map((r) => ({ value: r.ploomes_id, name: r.name }));
    const schema = await _internalFetchSchema();
    return schema.owners;
  });
