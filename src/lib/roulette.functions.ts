import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNITS = ["londrina", "ponta_grossa", "wenceslau_braz"] as const;
const ALLOWED = ["admin", "coordenador", "sdr"];

async function assertSdr(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ALLOWED.includes(r))) throw new Error("Acesso restrito à SDR/coordenação.");
}

/** Lista consultores por unidade (para preview antes de girar) */
export const listConsultantsByUnit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unit: z.enum(UNITS) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as { supabase: any; userId: string };
    await assertSdr(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,unit,status")
      .eq("unit", data.unit)
      .eq("status", "active");
    const ids = (profiles ?? []).map((p: any) => p.id);
    const { data: rolesFilter } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const consultorIds = new Set(
      (rolesFilter ?? []).filter((r: any) => r.role === "consultor").map((r: any) => r.user_id),
    );
    return (profiles ?? [])
      .filter((p: any) => consultorIds.has(p.id))
      .map((p: any) => ({ id: p.id, name: p.full_name || p.email }));
  });

/** Conta leads na fila comum (orçamento) e na fila de visita técnica */
export const countTrafficQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as { supabase: any; userId: string };
    await assertSdr(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [orc, visita] = await Promise.all([
      supabaseAdmin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("assigned_to", null)
        .eq("stage", "novo")
        .eq("is_offline", false)
        .or("tipo_encaminhamento.is.null,tipo_encaminhamento.eq.orcamento"),
      supabaseAdmin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .is("assigned_to", null)
        .eq("stage", "novo")
        .eq("tipo_encaminhamento", "visita_tecnica"),
    ]);
    return { count: orc.count ?? 0, visitaCount: visita.count ?? 0 };
  });

/** Roleta comum (orçamento) */
export const spinRoulette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ unit: z.enum(UNITS), count: z.number().int().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: rows, error } = await supabase.rpc("spin_roulette", { _unit: data.unit, _count: data.count });
    if (error) throw new Error(error.message);
    return { distributed: (rows ?? []).length, rows: rows ?? [] };
  });

/** Roleta de visita técnica */
export const spinVisitaTecnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ unit: z.enum(UNITS), count: z.number().int().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: rows, error } = await supabase.rpc("spin_visita_tecnica", { _unit: data.unit, _count: data.count });
    if (error) throw new Error(error.message);
    return { distributed: (rows ?? []).length, rows: rows ?? [] };
  });

/** Reatribui manualmente um lead a outro consultor */
export const reassignLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ leadId: z.string().uuid(), toUser: z.string().uuid(), reason: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { error } = await supabase.rpc("reassign_lead", {
      _lead_id: data.leadId,
      _to_user: data.toUser,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
