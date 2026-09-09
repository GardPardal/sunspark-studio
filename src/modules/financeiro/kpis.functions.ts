import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrCoord(supabase: any, userId: string) {
  const [{ data: a }, { data: c }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a && !c) throw new Error("Acesso restrito.");
}

export type FinKpis = {
  from: string;
  to: string;
  receita: number;
  vendas: number;
  ticket_medio: number | null;
  gasto_ads: number;
  cac: number | null;
  roas: number | null;
  margem_estimada_brl: number;
  margem_pct: number;
  ltv_estimado: number | null;
  vendas_por_unidade: Array<{ unit: string; total: number; count: number }>;
  /** Origem dos números principais: "ploomes" (mesmos critérios do /dashhub) ou "interno". */
  fonte: "ploomes" | "interno";
  /** Números oficiais no mesmo critério do painel da diretoria (/dashhub). */
  oficial: {
    leads: number;
    apresentacoes: number;
    negociacoes: number;
    vendas: number;
    receita: number;
    ticket_medio: number | null;
    faturadas: number;
    faturado_valor: number;
    taxa_geral: number;
    gerado_em: string;
  } | null;
  /** Números do CRM interno + vendas manuais (mantidos como conferência). */
  interno: { receita: number; vendas: number };
  aviso: string | null;
};

export const getFinanceKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { from?: string; to?: string; margemPct?: number }) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        margemPct: z.number().min(0).max(100).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }): Promise<FinKpis> => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const from = data.from ?? first.toISOString().slice(0, 10);
    const to = data.to ?? today.toISOString().slice(0, 10);
    const margemPct = data.margemPct ?? 25;

    const [insights, leads, manualSales, sellers] = await Promise.all([
      supabase.from("meta_insights_daily").select("spend").gte("date", from).lte("date", to),
      supabase
        .from("leads")
        .select("sale_value, stage, cidade, stage_updated_at")
        .in("stage", ["venda", "faturado"])
        .gte("stage_updated_at", `${from}T00:00:00Z`)
        .lte("stage_updated_at", `${to}T23:59:59Z`),
      supabase
        .from("manual_sales")
        .select("amount, seller_id, sale_date, city")
        .gte("sale_date", from)
        .lte("sale_date", to),
      supabase.from("sales_sellers").select("id, name, unit"),
    ]);

    const gasto = (insights.data ?? []).reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
    const crmRevenue = (leads.data ?? []).reduce(
      (s: number, l: any) => s + Number(l.sale_value ?? 0),
      0,
    );
    const crmCount = (leads.data ?? []).length;
    const manualRevenue = (manualSales.data ?? []).reduce(
      (s: number, r: any) => s + Number(r.amount ?? 0),
      0,
    );
    const manualCount = (manualSales.data ?? []).length;
    const internoReceita = crmRevenue + manualRevenue;
    const internoVendas = crmCount + manualCount;

    // Números oficiais: mesmos critérios do painel /dashhub —
    // venda = negócio ganho no funil Energia Solar por data de fechamento;
    // faturado = negócio ganho no funil Financeiro pela data de início do contrato.
    let oficial: FinKpis["oficial"] = null;
    let aviso: string | null = null;
    try {
      const { getSolarFunnel } = await import("@/lib/ploomes-funnel.server");
      const f = await getSolarFunnel(from, to, null);
      oficial = {
        leads: f.leads,
        apresentacoes: f.apresentacoes,
        negociacoes: f.negociacoes,
        vendas: f.vendas,
        receita: f.faturamento,
        ticket_medio: f.ticketMedio > 0 ? f.ticketMedio : null,
        faturadas: f.faturadas,
        faturado_valor: f.faturadoValor,
        taxa_geral: f.taxaGeral,
        gerado_em: f.geradoEm,
      };
    } catch (e) {
      aviso = `Não foi possível ler o CRM agora — exibindo números internos. (${
        e instanceof Error ? e.message : String(e)
      })`;
    }

    const fonte: FinKpis["fonte"] = oficial ? "ploomes" : "interno";
    const receita = oficial ? oficial.receita : internoReceita;
    const vendas = oficial ? oficial.vendas : internoVendas;
    const ticket = vendas > 0 ? receita / vendas : null;

    const sellerById = new Map((sellers.data ?? []).map((s: any) => [s.id, s]));
    const unitAgg = new Map<string, { total: number; count: number }>();
    const push = (unit: string | null, amount: number) => {
      const u = unit ?? "sem_unidade";
      const cur = unitAgg.get(u) ?? { total: 0, count: 0 };
      cur.total += amount;
      cur.count += 1;
      unitAgg.set(u, cur);
    };
    for (const l of leads.data ?? []) {
      const c = (l.cidade ?? "").toString().toLowerCase();
      let unit = "sem_unidade";
      if (c.includes("londrina")) unit = "londrina";
      else if (c.includes("ponta") || c.includes("grossa")) unit = "ponta_grossa";
      else if (c.includes("wenceslau")) unit = "wenceslau_braz";
      push(unit, Number(l.sale_value ?? 0));
    }
    for (const s of manualSales.data ?? []) {
      const seller: any = s.seller_id ? sellerById.get(s.seller_id) : null;
      push(seller?.unit ?? null, Number(s.amount ?? 0));
    }

    return {
      from,
      to,
      receita,
      vendas,
      ticket_medio: ticket,
      gasto_ads: gasto,
      cac: vendas > 0 ? gasto / vendas : null,
      roas: gasto > 0 ? receita / gasto : null,
      margem_estimada_brl: receita * (margemPct / 100),
      margem_pct: margemPct,
      ltv_estimado: ticket,
      vendas_por_unidade: Array.from(unitAgg.entries())
        .map(([unit, v]) => ({ unit, ...v }))
        .sort((a, b) => b.total - a.total),
    };
  });
