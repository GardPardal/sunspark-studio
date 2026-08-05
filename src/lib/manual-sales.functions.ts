import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}
function canWrite(roles: string[]) {
  return roles.includes("admin") || roles.includes("coordenador") || roles.includes("sdr");
}
async function assertWrite(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!canWrite(roles)) throw new Error("Somente admin, coordenação ou SDR podem editar vendas manuais.");
}

/* ================= Sellers ================= */

export const listSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("sales_sellers")
      .select("id,name,unit,profile_id,active,created_at")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const sellerSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(120),
  unit: z.enum(["londrina", "ponta_grossa", "wenceslau_braz"]).nullable().optional(),
  profile_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
});

export const upsertSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sellerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertWrite(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      name: data.name,
      unit: data.unit ?? null,
      profile_id: data.profile_id ?? null,
      active: data.active,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("sales_sellers").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("sales_sellers").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertWrite(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sales_sellers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Puxa consultores ativos dos logins do sistema para a lista de vendedores. */
export const syncSellersFromConsultants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertWrite(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "consultor");
    if (rErr) throw new Error(rErr.message);
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    if (ids.length === 0) return { added: 0 };

    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email,unit,status")
      .in("id", ids)
      .eq("status", "active");
    if (pErr) throw new Error(pErr.message);

    const { data: existing, error: eErr } = await supabaseAdmin
      .from("sales_sellers")
      .select("profile_id");
    if (eErr) throw new Error(eErr.message);
    const linked = new Set((existing ?? []).map((s: { profile_id: string | null }) => s.profile_id));

    const rows = (profs ?? [])
      .filter((p: any) => !linked.has(p.id))
      .map((p: any) => ({
        name: (p.full_name ?? "").trim() || p.email,
        unit: p.unit ?? null,
        profile_id: p.id,
        active: true,
      }));
    if (rows.length === 0) return { added: 0 };

    const { error } = await supabaseAdmin.from("sales_sellers").insert(rows);
    if (error) throw new Error(error.message);
    return { added: rows.length };
  });

/* ================= Manual sales ================= */

export const listManualSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    // Paginação: o Data API corta em 1000 linhas por padrão e isso quebrava os totais mensais/anuais.
    const page = 1000;
    const all: any[] = [];
    for (let from = 0; from < 100000; from += page) {
      const { data, error } = await supabase
        .from("manual_sales")
        .select("id,seller_id,sale_date,invoiced_date,amount,city,campaign_ref,traffic_spend_id,notes,created_at")
        .order("sale_date", { ascending: false })
        .range(from, from + page - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      all.push(...rows);
      if (rows.length < page) break;
    }
    return all;
  });


const saleSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  seller_id: z.string().uuid().nullable(),
  sale_date: z.string(),
  amount: z.number().min(0),
  city: z.string().max(120).nullable().optional(),
  campaign_ref: z.string().max(200).nullable().optional(),
  traffic_spend_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertManualSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertWrite(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      seller_id: data.seller_id,
      sale_date: data.sale_date,
      amount: data.amount,
      city: data.city ?? null,
      campaign_ref: data.campaign_ref ?? null,
      traffic_spend_id: data.traffic_spend_id ?? null,
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("manual_sales").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("manual_sales").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


export const deleteManualSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertWrite(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("manual_sales").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
