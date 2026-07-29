import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdminOrCoord(supabase: any, userId: string) {
  const [{ data: a }, { data: c }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "coordenador" }),
  ]);
  if (!a && !c) throw new Error("Acesso restrito.");
}

export type CampaignAlert = {
  campaign_id: string;
  campaign_name: string;
  severity: "critical" | "warning" | "info";
  kind: string;
  o_que: string;
  por_que: string;
  impacto: string;
  acao: string;
  ganho_estimado_brl: number | null;
};

export type DiagnosticoResp = {
  from: string;
  to: string;
  alerts: CampaignAlert[];
  summary: { critical: number; warning: number; info: number };
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const runCampaignDiagnostico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticoResp> => {
    const { supabase, userId } = context;
    await assertAdminOrCoord(supabase, userId);

    const to = new Date();
    const from = new Date(to.getTime() - 14 * 86400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const { data: insights } = await supabase
      .from("meta_insights_daily")
      .select("date, campaign_id, spend, impressions, reach, frequency, clicks, ctr, leads, purchase_value")
      .gte("date", iso(from))
      .lte("date", iso(to));

    const { data: campaigns } = await supabase.from("meta_campaigns").select("id, name, effective_status");
    const nameById = new Map((campaigns ?? []).map((c: any) => [c.id, c.name ?? c.id]));

    // aggregate last7 vs prev7
    const now = Date.now();
    const perCamp = new Map<string, {
      spend14: number; leads14: number; revenue14: number; clicks14: number; impr14: number;
      freqMax: number;
      spend7: number; revenue7: number;
      spendPrev7: number; revenuePrev7: number;
    }>();

    for (const r of insights ?? []) {
      const cid = r.campaign_id;
      if (!cid) continue;
      const rec = perCamp.get(cid) ?? {
        spend14: 0, leads14: 0, revenue14: 0, clicks14: 0, impr14: 0, freqMax: 0,
        spend7: 0, revenue7: 0, spendPrev7: 0, revenuePrev7: 0,
      };
      const d = new Date(r.date).getTime();
      const ageDays = (now - d) / 86400_000;
      rec.spend14 += Number(r.spend ?? 0);
      rec.leads14 += Number(r.leads ?? 0);
      rec.revenue14 += Number(r.purchase_value ?? 0);
      rec.clicks14 += Number(r.clicks ?? 0);
      rec.impr14 += Number(r.impressions ?? 0);
      rec.freqMax = Math.max(rec.freqMax, Number(r.frequency ?? 0));
      if (ageDays <= 7) {
        rec.spend7 += Number(r.spend ?? 0);
        rec.revenue7 += Number(r.purchase_value ?? 0);
      } else {
        rec.spendPrev7 += Number(r.spend ?? 0);
        rec.revenuePrev7 += Number(r.purchase_value ?? 0);
      }
      perCamp.set(cid, rec);
    }

    const alerts: CampaignAlert[] = [];
    for (const [cid, r] of perCamp) {
      const name = String(nameById.get(cid) ?? cid);
      const ctr = r.impr14 > 0 ? (r.clicks14 / r.impr14) * 100 : 0;

      // Frequência alta
      if (r.freqMax > 3) {
        alerts.push({
          campaign_id: cid, campaign_name: name, severity: r.freqMax > 5 ? "critical" : "warning",
          kind: "saturacao",
          o_que: `Frequência atingiu ${r.freqMax.toFixed(1)}x`,
          por_que: "Público está vendo o mesmo criativo muitas vezes; CPM tende a subir e CTR a cair.",
          impacto: `Gasto acumulado ${brl(r.spend14)} nos últimos 14 dias sob risco de saturação.`,
          acao: "Renovar criativos, expandir públicos ou dividir por interesses.",
          ganho_estimado_brl: Math.round(r.spend7 * 0.15),
        });
      }

      // CTR baixo
      if (r.spend14 > 200 && ctr > 0 && ctr < 0.8) {
        alerts.push({
          campaign_id: cid, campaign_name: name, severity: "warning",
          kind: "criativo_fraco",
          o_que: `CTR de ${ctr.toFixed(2)}% (abaixo de 0,8%)`,
          por_que: "Criativo/copy não está engajando o público.",
          impacto: `${brl(r.spend14)} gastos com baixo engajamento.`,
          acao: "Testar novos ganchos/copy; usar prova social; simplificar a chamada.",
          ganho_estimado_brl: Math.round(r.spend14 * 0.2),
        });
      }

      // ROAS em queda semana vs semana
      const roas7 = r.spend7 > 0 ? r.revenue7 / r.spend7 : 0;
      const roasPrev = r.spendPrev7 > 0 ? r.revenuePrev7 / r.spendPrev7 : 0;
      if (roasPrev > 1 && roas7 > 0) {
        const dropPct = ((roasPrev - roas7) / roasPrev) * 100;
        if (dropPct > 30) {
          alerts.push({
            campaign_id: cid, campaign_name: name, severity: dropPct > 60 ? "critical" : "warning",
            kind: "roas_queda",
            o_que: `ROAS caiu ${dropPct.toFixed(0)}% (de ${roasPrev.toFixed(2)}x para ${roas7.toFixed(2)}x)`,
            por_que: "Perda de eficiência na conversão comparado à semana anterior.",
            impacto: `Receita semanal caiu de ${brl(r.revenuePrev7)} para ${brl(r.revenue7)}.`,
            acao: "Revisar segmentação, checar sazonalidade e revalidar ofertas.",
            ganho_estimado_brl: Math.round(r.revenuePrev7 - r.revenue7),
          });
        }
      }

      // Campanhas com gasto e zero leads
      if (r.spend7 > 150 && r.leads14 === 0) {
        alerts.push({
          campaign_id: cid, campaign_name: name, severity: "critical",
          kind: "zero_leads",
          o_que: "Gastou nos últimos 7 dias sem gerar leads registrados",
          por_que: "Ou o pixel não está disparando, ou a campanha realmente não converte.",
          impacto: `${brl(r.spend7)} sem retorno mensurável.`,
          acao: "Verificar Pixel/CAPI, revisar oferta, considerar pausar campanha.",
          ganho_estimado_brl: Math.round(r.spend7),
        });
      }
    }

    alerts.sort((a, b) => {
      const rank = { critical: 0, warning: 1, info: 2 } as const;
      return rank[a.severity] - rank[b.severity];
    });

    const summary = { critical: 0, warning: 0, info: 0 };
    for (const a of alerts) summary[a.severity]++;

    return { from: iso(from), to: iso(to), alerts, summary };
  });
