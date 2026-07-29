import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateText } from "ai";

async function assertAdminOrCoord(supabase: any, userId: string) {
  const [{ data: a }, { data: c }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a && !c) throw new Error("Acesso restrito.");
}

export type Insight = {
  o_que: string;
  por_que: string;
  impacto: string;
  acao: string;
  prioridade: "alta" | "media" | "baixa";
  ganho_estimado_brl: number | null;
  categoria: "marketing" | "comercial" | "operacional" | "financeiro";
};

export type InsightResponse = {
  generated_at: string;
  bundle_summary: string;
  insights: Insight[];
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InsightResponse> => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente.");

    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const [insights, leads, sales, campaigns] = await Promise.all([
      supabase.from("meta_insights_daily").select("date, campaign_id, spend, leads, purchase_value, impressions, clicks").gte("date", iso(from)),
      supabase.from("leads").select("id, stage, sale_value, utm_campaign, cidade, created_at, stage_updated_at").gte("created_at", from.toISOString()),
      supabase.from("manual_sales").select("amount, sale_date, city").gte("sale_date", iso(from)),
      supabase.from("meta_campaigns").select("id, name, effective_status"),
    ]);

    const totalSpend = (insights.data ?? []).reduce((s: number, r: any) => s + Number(r.spend ?? 0), 0);
    const totalMetaLeads = (insights.data ?? []).reduce((s: number, r: any) => s + Number(r.leads ?? 0), 0);
    const totalCrmLeads = (leads.data ?? []).length;
    const qualified = (leads.data ?? []).filter((l: any) => ["atendimento", "venda", "faturado"].includes(l.stage)).length;
    const crmSales = (leads.data ?? []).filter((l: any) => ["venda", "faturado"].includes(l.stage));
    const crmRevenue = crmSales.reduce((s: number, l: any) => s + Number(l.sale_value ?? 0), 0);
    const manualRevenue = (sales.data ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
    const totalRevenue = crmRevenue + manualRevenue;
    const totalSalesN = crmSales.length + (sales.data ?? []).length;

    // top 5 campaigns by spend
    const perCamp = new Map<string, { spend: number; leads: number; revenue: number }>();
    for (const r of insights.data ?? []) {
      if (!r.campaign_id) continue;
      const cur = perCamp.get(r.campaign_id) ?? { spend: 0, leads: 0, revenue: 0 };
      cur.spend += Number(r.spend ?? 0);
      cur.leads += Number(r.leads ?? 0);
      cur.revenue += Number(r.purchase_value ?? 0);
      perCamp.set(r.campaign_id, cur);
    }
    const nameById = new Map((campaigns.data ?? []).map((c: any) => [c.id, c.name]));
    const topCamps = Array.from(perCamp.entries())
      .sort((a, b) => b[1].spend - a[1].spend)
      .slice(0, 5)
      .map(([id, v]) => ({ name: nameById.get(id) ?? id, ...v, roas: v.spend > 0 ? v.revenue / v.spend : 0 }));

    // funnel by stage
    const stageCount: Record<string, number> = {};
    for (const l of leads.data ?? []) stageCount[l.stage] = (stageCount[l.stage] ?? 0) + 1;

    // city distribution
    const cityCount: Record<string, number> = {};
    for (const l of leads.data ?? []) {
      const c = (l.cidade ?? "sem-cidade").toString().slice(0, 40);
      cityCount[c] = (cityCount[c] ?? 0) + 1;
    }
    const topCities = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const bundle = {
      periodo: `${iso(from)} → ${iso(to)}`,
      marketing: {
        gasto_total: totalSpend,
        leads_meta: totalMetaLeads,
        leads_crm: totalCrmLeads,
        qualificados: qualified,
        vendas: totalSalesN,
        receita_total: totalRevenue,
        cpl_meta: totalMetaLeads > 0 ? totalSpend / totalMetaLeads : null,
        cpl_qualificado: qualified > 0 ? totalSpend / qualified : null,
        cac: totalSalesN > 0 ? totalSpend / totalSalesN : null,
        roas: totalSpend > 0 ? totalRevenue / totalSpend : null,
        top_campanhas: topCamps,
      },
      comercial: {
        funil_por_stage: stageCount,
        top_cidades: topCities,
        vendas_manuais_brl: manualRevenue,
      },
    };

    const bundleStr = JSON.stringify(bundle, null, 2);

    const system = `Você é um analista sênior de marketing e comercial da LZ7 Energia (energia solar).
Analise dados agregados reais dos últimos 30 dias e produza insights ACIONÁVEIS.
Nunca invente números fora do bundle. Só use os valores fornecidos.
Retorne JSON puro (sem markdown, sem \`\`\`) no formato:
{
  "bundle_summary": "1 parágrafo curto sobre o momento",
  "insights": [
    {
      "o_que": "...",
      "por_que": "...",
      "impacto": "...",
      "acao": "...",
      "prioridade": "alta|media|baixa",
      "ganho_estimado_brl": number|null,
      "categoria": "marketing|comercial|operacional|financeiro"
    }
  ]
}
Entregue entre 4 e 7 insights, ordenados por prioridade.`;

    const provider = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: provider("google/gemini-3.6-flash"),
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Bundle:\n${bundleStr}` },
      ],
    });

    let parsed: { bundle_summary?: string; insights?: Insight[] } = {};
    try {
      const clean = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        bundle_summary: "Não foi possível interpretar a resposta do modelo. Mostrando bundle bruto.",
        insights: [{
          o_que: "Resposta do modelo em formato inesperado",
          por_que: "A IA respondeu texto livre.",
          impacto: "Sem impacto operacional.",
          acao: "Tentar novamente. Se persistir, revisar prompt.",
          prioridade: "baixa" as const,
          ganho_estimado_brl: null,
          categoria: "operacional" as const,
        }],
      };
    }

    return {
      generated_at: new Date().toISOString(),
      bundle_summary: parsed.bundle_summary ?? "",
      insights: (parsed.insights ?? []).slice(0, 10),
    };
  });

export const getInsightsBundlePreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);
    const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const { count: leadsCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", from);
    const { count: metaRows } = await supabase.from("meta_insights_daily").select("id", { count: "exact", head: true }).gte("date", from);
    return { leadsCount: leadsCount ?? 0, metaRows: metaRows ?? 0, periodo: from };
  });

// Helper for outros módulos
export const _brl = brl;
