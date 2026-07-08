import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNITS = ["londrina", "ponta_grossa", "wenceslau_braz"] as const;

/** Lista consultores por unidade (para preview antes de girar) */
export const listConsultantsByUnit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unit: z.enum(UNITS) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("coordenador")) throw new Error("Acesso restrito.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,unit,status")
      .eq("unit", data.unit)
      .eq("status", "active");
    const ids = (profiles ?? []).map((p: any) => p.id);
    const { data: rolesFilter } = await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const consultorIds = new Set((rolesFilter ?? []).filter((r: any) => r.role === "consultor").map((r: any) => r.user_id));
    return (profiles ?? [])
      .filter((p: any) => consultorIds.has(p.id))
      .map((p: any) => ({ id: p.id, name: p.full_name || p.email }));
  });

/** Conta leads disponíveis na fila comum (novos, sem dono, de tráfego) */
export const countTrafficQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: any) => r.role);
    if (!roles.includes("admin") && !roles.includes("coordenador")) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("assigned_to", null)
      .eq("stage", "novo")
      .eq("is_offline", false);
    return { count: count ?? 0 };
  });

/** Executa a roleta */
export const spinRoulette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      unit: z.enum(UNITS),
      count: z.number().int().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    // A função SQL já verifica papéis
    const { data: rows, error } = await supabase.rpc("spin_roulette", { _unit: data.unit, _count: data.count });
    if (error) throw new Error(error.message);
    return { distributed: (rows ?? []).length, rows: rows ?? [] };
  });
