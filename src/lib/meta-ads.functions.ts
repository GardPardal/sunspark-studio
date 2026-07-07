import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => r === "admin" || r === "coordenador")) {
    throw new Error("Somente administradores ou coordenadores.");
  }
}

/* ---------------- Teste conexão ---------------- */

export const testMetaConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    try {
      const { metaFetch, requireMetaConfig } = await import("@/lib/meta.server");
      const { token, accountId } = requireMetaConfig();
      const acc = await metaFetch(
        `/${accountId}?fields=id,name,currency,timezone_name,account_status`,
        token,
      );
      return { ok: true, id: acc.id, name: acc.name, currency: acc.currency };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  });

/* ---------------- Rodar sync manual ---------------- */

export const runMetaEntitiesSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { syncMetaEntities } = await import("@/lib/meta.server");
    return syncMetaEntities();
  });

export const runMetaInsightsSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(90).default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { syncMetaInsights } = await import("@/lib/meta.server");
    return syncMetaInsights(data.days);
  });

/* ---------------- Consultas para dashboards ---------------- */

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getMetaOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // KPIs agregados
    const { data: rows, error } = await supabaseAdmin
      .from("meta_insights_daily")
      .select("date, spend, impressions, reach, clicks, leads, purchases, purchase_value")
      .gte("date", data.from)
      .lte("date", data.to);
    if (error) throw new Error(error.message);

    const totals = (rows ?? []).reduce(
      (acc: any, r: any) => {
        acc.spend += Number(r.spend) || 0;
        acc.impressions += Number(r.impressions) || 0;
        acc.reach += Number(r.reach) || 0;
        acc.clicks += Number(r.clicks) || 0;
        acc.leads += Number(r.leads) || 0;
        acc.purchases += Number(r.purchases) || 0;
        acc.revenue += Number(r.purchase_value) || 0;
        return acc;
      },
      { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, purchases: 0, revenue: 0 },
    );

    const derived = {
      ctr: totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0,
      cpl: totals.leads ? totals.spend / totals.leads : 0,
      cpa: totals.purchases ? totals.spend / totals.purchases : 0,
      roas: totals.spend ? totals.revenue / totals.spend : 0,
      roi: totals.spend ? (totals.revenue - totals.spend) / totals.spend : 0,
      frequency: totals.reach ? totals.impressions / totals.reach : 0,
    };

    // Série diária
    const byDay = new Map<string, any>();
    for (const r of rows ?? []) {
      const d = r.date as string;
      const cur = byDay.get(d) ?? { date: d, spend: 0, impressions: 0, clicks: 0, leads: 0, revenue: 0 };
      cur.spend += Number(r.spend) || 0;
      cur.impressions += Number(r.impressions) || 0;
      cur.clicks += Number(r.clicks) || 0;
      cur.leads += Number(r.leads) || 0;
      cur.revenue += Number(r.purchase_value) || 0;
      byDay.set(d, cur);
    }
    const daily = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

    return { totals, derived, daily };
  });

const rankingSchema = rangeSchema.extend({
  level: z.enum(["campaign", "adset", "ad"]).default("campaign"),
  orderBy: z.enum(["spend", "leads", "cpl", "roas", "clicks", "ctr", "purchases", "revenue"]).default("spend"),
  limit: z.number().int().min(1).max(100).default(20),
});

export const getMetaRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rankingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const idCol = data.level === "campaign" ? "campaign_id" : data.level === "adset" ? "adset_id" : "ad_id";

    const { data: rowsRaw, error } = await supabaseAdmin
      .from("meta_insights_daily")
      .select(`${idCol}, spend, impressions, reach, clicks, leads, purchases, purchase_value`)
      .gte("date", data.from)
      .lte("date", data.to)
      .not(idCol, "is", null);
    if (error) throw new Error(error.message);
    const rows = (rowsRaw ?? []) as any[];

    // Nomes das entidades
    const nameTable = data.level === "campaign" ? "meta_campaigns" : data.level === "adset" ? "meta_adsets" : "meta_ads";
    const ids = [...new Set(rows.map((r: any) => r[idCol]).filter(Boolean))] as string[];
    const namesMap = new Map<string, string>();
    if (ids.length) {
      const { data: nameRows } = await supabaseAdmin.from(nameTable).select("id, name").in("id", ids);
      for (const n of (nameRows ?? []) as any[]) namesMap.set(n.id, n.name);
    }

    const grouped = new Map<string, any>();
    for (const r of rows) {
      const key = r[idCol] as string;
      const g = grouped.get(key) ?? { id: key, name: namesMap.get(key) ?? key, spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue: 0 };
      g.spend += Number(r.spend) || 0;
      g.impressions += Number(r.impressions) || 0;
      g.clicks += Number(r.clicks) || 0;
      g.leads += Number(r.leads) || 0;
      g.purchases += Number(r.purchases) || 0;
      g.revenue += Number(r.purchase_value) || 0;
      grouped.set(key, g);
    }
    const enriched = Array.from(grouped.values()).map((g) => ({
      ...g,
      ctr: g.impressions ? (g.clicks / g.impressions) * 100 : 0,
      cpl: g.leads ? g.spend / g.leads : 0,
      roas: g.spend ? g.revenue / g.spend : 0,
    }));
    enriched.sort((a, b) => (Number(b[data.orderBy]) || 0) - (Number(a[data.orderBy]) || 0));
    return enriched.slice(0, data.limit);
  });

export const getMetaSyncState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: state } = await supabaseAdmin.from("meta_sync_state").select("*");
    const { data: accs } = await supabaseAdmin.from("meta_ad_accounts").select("*");
    return { state: state ?? [], accounts: accs ?? [] };
  });
