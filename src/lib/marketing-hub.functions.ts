import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalize(s: string | null | undefined) {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export type HubRow = {
  campaign_id: string | null;
  campaign_name: string;
  spend: number;
  meta_leads: number;
  crm_leads: number;
  qualified: number;
  sales: number;
  revenue: number;
  cpl: number | null;
  cpl_qualified: number | null;
  cac: number | null;
  roas: number | null;
};

export type HubResponse = {
  from: string;
  to: string;
  totals: {
    spend: number;
    meta_leads: number;
    crm_leads: number;
    qualified: number;
    sales: number;
    revenue: number;
    cpl: number | null;
    cpl_qualified: number | null;
    cac: number | null;
    roas: number | null;
  };
  rows: HubRow[];
  unmatched_crm_campaigns: { name: string; leads: number }[];
};

export const getMarketingHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { from?: string; to?: string }) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const from = data.from ?? firstOfMonth.toISOString().slice(0, 10);
    const to = data.to ?? today.toISOString().slice(0, 10);

    const { supabase } = context;

    // Só admin/coord pode ver hub completo
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isCoord } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "coordenador",
    });
    if (!isAdmin && !isCoord) {
      throw new Error("Acesso restrito à coordenação.");
    }

    // 1) Insights por campanha
    const { data: insights } = await supabase
      .from("meta_insights_daily")
      .select("campaign_id, spend, leads")
      .gte("date", from)
      .lte("date", to);

    const campaignAgg = new Map<string, { spend: number; meta_leads: number }>();
    for (const r of insights ?? []) {
      if (!r.campaign_id) continue;
      const key = r.campaign_id;
      const cur = campaignAgg.get(key) ?? { spend: 0, meta_leads: 0 };
      cur.spend += Number(r.spend ?? 0);
      cur.meta_leads += Number(r.leads ?? 0);
      campaignAgg.set(key, cur);
    }

    // 2) Nomes das campanhas
    const campaignIds = Array.from(campaignAgg.keys());
    const { data: campaigns } = campaignIds.length
      ? await supabase.from("meta_campaigns").select("id, name").in("id", campaignIds)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map<string, string>();
    for (const c of campaigns ?? []) nameById.set(c.id, c.name ?? c.id);

    // 3) Leads no CRM no período, agrupados por utm_campaign normalizado
    const { data: leads } = await supabase
      .from("leads")
      .select("id, stage, sale_value, utm_campaign, created_at")
      .gte("created_at", `${from}T00:00:00Z`)
      .lte("created_at", `${to}T23:59:59Z`);

    const leadsByNorm = new Map<
      string,
      { originalName: string; leads: number; qualified: number; sales: number; revenue: number }
    >();
    for (const l of leads ?? []) {
      const norm = normalize(l.utm_campaign);
      const cur = leadsByNorm.get(norm) ?? {
        originalName: l.utm_campaign ?? "(sem utm_campaign)",
        leads: 0,
        qualified: 0,
        sales: 0,
        revenue: 0,
      };
      cur.leads += 1;
      if (["atendimento", "venda", "faturado"].includes(l.stage)) cur.qualified += 1;
      if (["venda", "faturado"].includes(l.stage)) {
        cur.sales += 1;
        cur.revenue += Number(l.sale_value ?? 0);
      }
      leadsByNorm.set(norm, cur);
    }

    // 4) Combina — cada campanha Meta procura leads com utm_campaign matching
    const usedNorms = new Set<string>();
    const rows: HubRow[] = [];
    for (const [id, agg] of campaignAgg) {
      const name = nameById.get(id) ?? id;
      const norm = normalize(name);
      const leadStat = leadsByNorm.get(norm);
      if (leadStat) usedNorms.add(norm);
      const crm_leads = leadStat?.leads ?? 0;
      const qualified = leadStat?.qualified ?? 0;
      const sales = leadStat?.sales ?? 0;
      const revenue = leadStat?.revenue ?? 0;
      rows.push({
        campaign_id: id,
        campaign_name: name,
        spend: agg.spend,
        meta_leads: agg.meta_leads,
        crm_leads,
        qualified,
        sales,
        revenue,
        cpl: agg.meta_leads > 0 ? agg.spend / agg.meta_leads : null,
        cpl_qualified: qualified > 0 ? agg.spend / qualified : null,
        cac: sales > 0 ? agg.spend / sales : null,
        roas: agg.spend > 0 ? revenue / agg.spend : null,
      });
    }
    rows.sort((a, b) => b.spend - a.spend);

    // 5) Campanhas do CRM sem match no Meta
    const unmatched: { name: string; leads: number }[] = [];
    for (const [norm, l] of leadsByNorm) {
      if (usedNorms.has(norm)) continue;
      unmatched.push({ name: l.originalName, leads: l.leads });
    }
    unmatched.sort((a, b) => b.leads - a.leads);

    // 6) Totais
    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    const totalMetaLeads = rows.reduce((s, r) => s + r.meta_leads, 0);
    const totalCrmLeads = rows.reduce((s, r) => s + r.crm_leads, 0);
    const totalQual = rows.reduce((s, r) => s + r.qualified, 0);
    const totalSales = rows.reduce((s, r) => s + r.sales, 0);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);

    const response: HubResponse = {
      from,
      to,
      totals: {
        spend: totalSpend,
        meta_leads: totalMetaLeads,
        crm_leads: totalCrmLeads,
        qualified: totalQual,
        sales: totalSales,
        revenue: totalRevenue,
        cpl: totalMetaLeads > 0 ? totalSpend / totalMetaLeads : null,
        cpl_qualified: totalQual > 0 ? totalSpend / totalQual : null,
        cac: totalSales > 0 ? totalSpend / totalSales : null,
        roas: totalSpend > 0 ? totalRevenue / totalSpend : null,
      },
      rows,
      unmatched_crm_campaigns: unmatched.slice(0, 20),
    };
    return response;
  });
