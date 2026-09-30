import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SALES_LEADS_OR_FILTER } from "@/lib/ploomes-pipelines";

export type SellerFicha = {
  nome: string;
  unidade: string;
  anoVendas: number;
  anoValor: number;
  mesAtualVendas: number;
  media6Meses: number;
  emNegociacao: number;
  valorNegociacao: number;
  mudo30Dias: number;
  tarefasVencidas: number;
  cumprimentoAgenda: number | null;
  discPerfil: string | null;
  severidade: "ok" | "warn" | "crit" | "sup";
  historicoMensal: number[];
};

export type MetaCampanha = {
  nome: string;
  regiao: string;
  gasto: number;
  leads: number;
  cpl: number;
  vendas: number;
  conversao: number;
};

export type AlertaSupervisao = {
  vendedor: string;
  unidade: string;
  titulo: string;
  severidade: "crit" | "warn" | "info";
  detalhe: string;
  acaoSugerida: string | null;
  discPerfil: string | null;
};

export type ExecutiveBIResponse = {
  isExecutive: boolean;
  periodLabel: string;
  userPersonal: {
    assignedLeads: number;
    myWonSalesMonth: number;
    myWonSalesYear: number;
    myWonValueYear: number;
    myNegotiationValue: number;
    myRankPosition: number;
  };
  summary: {
    leadsTotal: number;
    leadsNovosHoje: number;
    leadsQuiz: number;
    leadsSdr: number;
    leadsTrafego: number;
    leadsProspeccao: number;
    leadsIndicacao: number;
    vendasPeriodoQtd: number;
    vendasPeriodoValor: number;
    vendasMesQtd: number;
    vendasMesValor: number;
    vendasAnoQtd: number;
    vendasAnoValor: number;
    faturadoMesValor: number;
    faturadoAnoValor: number;
    faturadoPeriodoValor: number;
    ticketMedio: number;
    taxaConversaoGeral: number;
    conversaoTrafego: number;
    /** Sem fonte de dados no sistema ainda — null exibe "—". */
    obrasEntreguesAno: number | null;
    filaObras: number | null;
    metaSpend: number;
    metaLeads: number;
    metaCpl: number;
    valorEmNegociacao: number;
  };
  monthlySales: Array<{
    mes: string;
    mesNome: string;
    vendasQtd: number;
    vendasValor: number;
    entreguesQtd: number;
  }>;
  originsBreakdown: Array<{
    origem: string;
    leads: number;
    vendas: number;
    conversao: number;
  }>;
  unitsBreakdown: Array<{
    unidade: string;
    unidadeCurta: string;
    leads: number;
    vendas: number;
    valor: number;
    tempoRespostaMediana: number;
  }>;
  recentLeads: Array<{
    id: string;
    nome: string;
    telefone: string | null;
    cidade: string | null;
    origem: string;
    stage: string;
    sale_value: number | null;
    assigned_name: string | null;
    created_at: string;
  }>;
  sellersFichas: SellerFicha[];
  metaCampanhas: MetaCampanha[];
  supervisorAlerts: AlertaSupervisao[];
};

const filterSchema = z
  .object({
    period: z.enum(["hoje", "7d", "mes", "30d", "ano", "tudo", "custom"]).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    unit: z.string().optional(),
    origin: z.string().optional(),
  })
  .optional();

/* ---------- Datas no fuso de Brasília (UTC-3, sem horário de verão) ---------- */
// O Worker roda em UTC: sem esse ajuste "Hoje" e "Mês Atual" viram o dia/mês
// errado entre 21h e 0h.
const BR_OFFSET_MS = 3 * 3600_000;
const DAY_MS = 86_400_000;
const MES_NOMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function brParts(d: Date) {
  const b = new Date(d.getTime() - BR_OFFSET_MS);
  return { y: b.getUTCFullYear(), m: b.getUTCMonth(), d: b.getUTCDate() };
}
function brMidnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) + BR_OFFSET_MS);
}
function brDateKey(d: Date) {
  return new Date(d.getTime() - BR_OFFSET_MS).toISOString().slice(0, 10);
}
function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return brMidnight(y, (m || 1) - 1, d || 1);
}

/* ---------- Unidades e origens ---------- */
const UNIT_KEYS = ["wenceslau_braz", "londrina", "ponta_grossa", "representantes"] as const;
type UnitKey = (typeof UNIT_KEYS)[number];
const UNIT_INFO: Record<UnitKey, { nome: string; curta: string }> = {
  wenceslau_braz: { nome: "Sede Wenceslau Braz", curta: "W. Braz" },
  londrina: { nome: "Filial Londrina", curta: "Londrina" },
  ponta_grossa: { nome: "Filial Ponta Grossa", curta: "Ponta Grossa" },
  representantes: { nome: "Representantes Comerciais", curta: "Representantes" },
};

function norm(s: string | null | undefined) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function unitFromText(s: string | null | undefined): UnitKey | null {
  const n = norm(s);
  if (!n) return null;
  if (n.includes("wenceslau")) return "wenceslau_braz";
  if (n.includes("londrina")) return "londrina";
  if (n.includes("ponta")) return "ponta_grossa";
  if (n.includes("represent") || n.includes("comercial externo")) return "representantes";
  return null;
}

type OriginKey = "trafego" | "prospeccao" | "indicacao" | "quiz" | "feiras" | "outros";
const ORIGIN_LABEL: Record<OriginKey, string> = {
  trafego: "Tráfego Pago (Meta/Google)",
  prospeccao: "Prospecção Ativa (PAP)",
  indicacao: "Indicação de Clientes",
  quiz: "Quiz Solar LZ7",
  feiras: "Feiras & Ações Comerciais",
  outros: "Outras Origens",
};

function classifyOrigin(l: any): OriginKey {
  const o = norm(l.origem);
  if (norm(l.captacao_metodo).includes("quiz") || o.includes("quiz")) return "quiz";
  if (
    l.fbclid ||
    l.gclid ||
    o.includes("trafego") ||
    o.includes("meta") ||
    o.includes("anuncio") ||
    o.includes("facebook") ||
    o.includes("instagram") ||
    o.includes("google")
  )
    return "trafego";
  if (o.includes("prospec") || o.includes("pap")) return "prospeccao";
  if (o.includes("indica")) return "indicacao";
  if (o.includes("feira") || o.includes("acao")) return "feiras";
  return "outros";
}

const WON = new Set(["venda", "faturado"]);
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const sum = (arr: any[], f: (x: any) => number) => arr.reduce((s, x) => s + f(x), 0);
const brlShortSrv = (n: number) =>
  n >= 1_000_000
    ? `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M`
    : n >= 1000
      ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`
      : `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

function median(values: number[]) {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  const m = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round(m * 10) / 10;
}

/**
 * BI executivo da tela "Hoje". Todos os números vêm do banco:
 * leads (CRM), manual_sales (vendas/faturamento), meta_insights_daily (tráfego),
 * sales_sellers (consultores) e lead_cadence_tasks (tarefas vencidas).
 * Indicadores sem fonte de dados (obras) retornam null — a tela mostra "—".
 */
export const getExecutiveBI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => filterSchema.parse(d))
  .handler(async ({ data, context }): Promise<ExecutiveBIResponse> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchAllRows } = await import("@/lib/fetch-all.server");
    const db = supabaseAdmin as any;

    const period = data?.period || "ano";
    const unitFilter = data?.unit && data.unit !== "todas" ? unitFromText(data.unit) : null;

    // 1) Intervalo de datas
    const now = new Date();
    const { y, m, d } = brParts(now);
    const todayStart = brMidnight(y, m, d);
    let filterStart: Date;
    let filterEnd: Date = now;
    let periodLabel: string;

    if (period === "hoje") {
      filterStart = todayStart;
      periodLabel = "Hoje";
    } else if (period === "7d") {
      filterStart = new Date(now.getTime() - 7 * DAY_MS);
      periodLabel = "Últimos 7 Dias";
    } else if (period === "mes") {
      filterStart = brMidnight(y, m, 1);
      periodLabel = "Mês Atual";
    } else if (period === "30d") {
      filterStart = new Date(now.getTime() - 30 * DAY_MS);
      periodLabel = "Últimos 30 Dias";
    } else if (period === "tudo") {
      filterStart = new Date(Date.UTC(2000, 0, 1));
      periodLabel = "Todo o Período";
    } else if (period === "custom" && data?.startDate) {
      filterStart = parseDateKey(data.startDate);
      if (data.endDate) filterEnd = new Date(parseDateKey(data.endDate).getTime() + DAY_MS - 1);
      const days = Math.max(Math.ceil((filterEnd.getTime() - filterStart.getTime()) / DAY_MS), 1);
      periodLabel = `Período (${days} dias)`;
    } else {
      filterStart = brMidnight(y, 0, 1);
      periodLabel = `Ano ${y}`;
    }

    const startISO = filterStart.toISOString();
    const endISO = filterEnd.toISOString();
    const startKey = brDateKey(filterStart);
    const endKey = brDateKey(filterEnd);
    const yearKey = `${y}-01-01`;
    const todayKey = brDateKey(now);
    const monthKey = brDateKey(brMidnight(y, m, 1));
    const sixMonthsKey = brDateKey(brMidnight(y, m - 6, 1));
    const salesFromKey = [startKey, yearKey, sixMonthsKey].sort()[0];

    const LEAD_COLS =
      "id,nome,telefone,cidade,stage,sale_value,origem,gclid,fbclid,utm_source,utm_campaign,captacao_metodo,assigned_to,created_at,atendimento_confirmado_at";

    // Obras direto do Ploomes (somente leitura; sem chave ou com erro → "—" na tela)
    const worksPromise = import("@/lib/ploomes-sales.server")
      .then((m) => m.getPloomesWorksMetrics(y, unitFilter))
      .catch(() => null);

    // 2) Consultas em paralelo, todas paginadas (o backend corta em 1000 linhas)
    const [
      { data: rolesData },
      periodLeadsAll,
      openLeadsAll,
      sales,
      { data: sellers },
      cityMap,
      insights,
      { data: campaigns },
      overdueTasks,
      { count: myLeadsCount },
      myWonLeads,
    ] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      fetchAllRows((from, to) =>
        db
          .from("leads")
          .select(LEAD_COLS, { count: "exact" })
          .or(SALES_LEADS_OR_FILTER)
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        db
          .from("leads")
          .select("id,sale_value,assigned_to,cidade,stage,stage_updated_at,created_at", {
            count: "exact",
          })
          .or(SALES_LEADS_OR_FILTER)
          .in("stage", ["atendimento", "nao_atendido"])
          .order("id")
          .range(from, to),
      ),
      fetchAllRows((from, to) =>
        db
          .from("manual_sales")
          .select("id,seller_id,sale_date,invoiced_date,amount,branch", { count: "exact" })
          .or(`sale_date.gte.${salesFromKey},invoiced_date.gte.${salesFromKey}`)
          .order("id")
          .range(from, to),
      ),
      db.from("sales_sellers").select("id,name,profile_id,unit,active"),
      fetchAllRows((from, to) =>
        db
          .from("city_unit_map")
          .select("cidade_norm,unit", { count: "exact" })
          .order("cidade_norm")
          .range(from, to),
      ).catch(() => [] as any[]),
      fetchAllRows((from, to) =>
        db
          .from("meta_insights_daily")
          .select("campaign_id,spend,leads", { count: "exact" })
          .gte("date", startKey)
          .lte("date", endKey)
          .order("id")
          .range(from, to),
      ).catch(() => [] as any[]),
      db.from("meta_campaigns").select("id,name"),
      fetchAllRows((from, to) =>
        db
          .from("lead_cadence_tasks")
          .select("lead_id", { count: "exact" })
          .is("completed_at", null)
          .lt("due_at", now.toISOString())
          .order("id")
          .range(from, to),
      ).catch(() => [] as any[]),
      db
        .from("leads")
        .select("id", { count: "exact", head: true })
        .or(SALES_LEADS_OR_FILTER)
        .eq("assigned_to", userId),
      fetchAllRows((from, to) =>
        db
          .from("leads")
          .select("id,sale_value,stage_updated_at,created_at", { count: "exact" })
          .or(SALES_LEADS_OR_FILTER)
          .eq("assigned_to", userId)
          .in("stage", ["venda", "faturado"])
          .order("id")
          .range(from, to),
      ),
    ]);

    const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
    const isExecutive =
      roles.includes("admin") ||
      roles.includes("coordenador") ||
      roles.includes("desenvolvedor") ||
      roles.includes("diretoria") ||
      roles.includes("sdr");

    // 3) Mapas auxiliares
    const cityUnit = new Map<string, UnitKey>(
      (cityMap as any[]).map((c) => [c.cidade_norm, c.unit as UnitKey]),
    );
    const leadUnit = (l: any): UnitKey | null => cityUnit.get(norm(l.cidade)) ?? null;
    const sellerList = (sellers ?? []) as any[];
    const sellerById = new Map(sellerList.map((s) => [s.id, s]));
    const sellerByProfile = new Map(
      sellerList.filter((s) => s.profile_id).map((s) => [s.profile_id, s]),
    );
    const sellerOfLead = (assignedTo: string | null) =>
      assignedTo ? (sellerByProfile.get(assignedTo) ?? sellerById.get(assignedTo) ?? null) : null;
    const saleUnit = (s: any): UnitKey | null =>
      unitFromText(s.branch) ?? (s.seller_id ? (sellerById.get(s.seller_id)?.unit ?? null) : null);

    const periodLeads = unitFilter
      ? periodLeadsAll.filter((l: any) => leadUnit(l) === unitFilter)
      : periodLeadsAll;
    const openLeads = unitFilter
      ? openLeadsAll.filter((l: any) => leadUnit(l) === unitFilter)
      : openLeadsAll;
    const salesF = unitFilter ? sales.filter((s: any) => saleUnit(s) === unitFilter) : sales;

    const saleKey = (s: any) => (s.sale_date ? String(s.sale_date).slice(0, 10) : null);
    const invKey = (s: any) => (s.invoiced_date ? String(s.invoiced_date).slice(0, 10) : null);
    const between = (k: string | null, a: string, b: string) => !!k && k >= a && k <= b;
    const amount = (s: any) => Number(s.amount || 0);

    // 4) Leads por origem
    const originCount: Record<OriginKey, { leads: number; vendas: number }> = {
      trafego: { leads: 0, vendas: 0 },
      prospeccao: { leads: 0, vendas: 0 },
      indicacao: { leads: 0, vendas: 0 },
      quiz: { leads: 0, vendas: 0 },
      feiras: { leads: 0, vendas: 0 },
      outros: { leads: 0, vendas: 0 },
    };
    let leadsSdr = 0;
    let leadsWon = 0;
    let leadsNovosHoje = 0;
    const todayISO = todayStart.toISOString();
    for (const l of periodLeads as any[]) {
      const k = classifyOrigin(l);
      originCount[k].leads++;
      if (WON.has(l.stage)) {
        originCount[k].vendas++;
        leadsWon++;
      }
      if (norm(l.origem).includes("sdr")) leadsSdr++;
      if (l.created_at >= todayISO) leadsNovosHoje++;
    }
    const leadsTotal = periodLeads.length;

    const originsBreakdown = (Object.keys(originCount) as OriginKey[])
      .filter(
        (k) =>
          originCount[k].leads > 0 || ["trafego", "prospeccao", "indicacao", "quiz"].includes(k),
      )
      .map((k) => ({
        origem: ORIGIN_LABEL[k],
        leads: originCount[k].leads,
        vendas: originCount[k].vendas,
        conversao: pct(originCount[k].vendas, originCount[k].leads),
      }));

    // 5) Vendas e faturamento (manual_sales: sale_date = venda, invoiced_date = faturado)
    const soldInPeriod = salesF.filter((s: any) => between(saleKey(s), startKey, endKey));
    const soldYear = salesF.filter((s: any) => between(saleKey(s), yearKey, todayKey));
    const soldMonth = salesF.filter((s: any) => between(saleKey(s), monthKey, todayKey));
    const invPeriod = salesF.filter((s: any) => between(invKey(s), startKey, endKey));
    const invYear = salesF.filter((s: any) => between(invKey(s), yearKey, todayKey));
    const invMonth = salesF.filter((s: any) => between(invKey(s), monthKey, todayKey));

    const vendasPeriodoQtd = soldInPeriod.length;
    const vendasPeriodoValor = sum(soldInPeriod, amount);
    const ticketMedio =
      vendasPeriodoQtd > 0 ? Math.round(vendasPeriodoValor / vendasPeriodoQtd) : 0;

    const works = await worksPromise;

    const monthlySales = Array.from({ length: m + 1 }, (_, i) => {
      const prefix = `${y}-${String(i + 1).padStart(2, "0")}`;
      const sold = salesF.filter((s: any) => saleKey(s)?.startsWith(prefix));
      return {
        mes: prefix,
        mesNome: MES_NOMES[i],
        vendasQtd: sold.length,
        vendasValor: sum(sold, amount),
        // Obras concluídas no mês (funil Projetos e Obras do Ploomes)
        entreguesQtd: works?.entreguesPorMes[i] ?? 0,
      };
    });

    // 6) Unidades
    const unitsBreakdown = UNIT_KEYS.filter((u) => !unitFilter || u === unitFilter).map((u) => {
      const uLeads = (periodLeads as any[]).filter((l) => leadUnit(l) === u);
      const uSales = soldInPeriod.filter((s: any) => saleUnit(s) === u);
      const respostas = uLeads
        .filter((l) => l.atendimento_confirmado_at)
        .map(
          (l) =>
            (new Date(l.atendimento_confirmado_at).getTime() - new Date(l.created_at).getTime()) /
            60_000,
        )
        .filter((v) => v >= 0);
      return {
        unidade: UNIT_INFO[u].nome,
        unidadeCurta: UNIT_INFO[u].curta,
        leads: uLeads.length,
        vendas: uSales.length,
        valor: sum(uSales, amount),
        tempoRespostaMediana: median(respostas),
      };
    });

    // 7) Meta Ads (insights são por anúncio/dia — somar é seguro)
    const campaignName = new Map(((campaigns ?? []) as any[]).map((c) => [c.id, c.name]));
    const campAgg = new Map<string, { gasto: number; leads: number }>();
    for (const r of insights as any[]) {
      if (!r.campaign_id) continue;
      const cur = campAgg.get(r.campaign_id) ?? { gasto: 0, leads: 0 };
      cur.gasto += Number(r.spend || 0);
      cur.leads += Number(r.leads || 0);
      campAgg.set(r.campaign_id, cur);
    }
    const crmByCampaign = new Map<string, { leads: number; vendas: number }>();
    for (const l of periodLeadsAll as any[]) {
      if (!l.utm_campaign) continue;
      const k = norm(l.utm_campaign);
      const cur = crmByCampaign.get(k) ?? { leads: 0, vendas: 0 };
      cur.leads++;
      if (WON.has(l.stage)) cur.vendas++;
      crmByCampaign.set(k, cur);
    }
    const metaCampanhas: MetaCampanha[] = Array.from(campAgg.entries())
      .map(([id, agg]) => {
        const nome = campaignName.get(id) ?? id;
        const crm = crmByCampaign.get(norm(nome));
        const unit = unitFromText(nome);
        return {
          nome,
          regiao: unit ? UNIT_INFO[unit].curta : "—",
          gasto: Math.round(agg.gasto * 100) / 100,
          leads: agg.leads,
          cpl: agg.leads > 0 ? Math.round((agg.gasto / agg.leads) * 100) / 100 : 0,
          vendas: crm?.vendas ?? 0,
          conversao: pct(crm?.vendas ?? 0, crm?.leads ?? 0),
        };
      })
      .filter((c) => c.gasto > 0 || c.leads > 0)
      .sort((a, b) => b.gasto - a.gasto);
    const metaSpend = Math.round(sum(metaCampanhas, (c) => c.gasto) * 100) / 100;
    const metaLeads = sum(metaCampanhas, (c) => c.leads);
    const metaCpl = metaLeads > 0 ? Math.round((metaSpend / metaLeads) * 100) / 100 : 0;

    // 8) Pipeline em negociação
    const emAtendimento = (openLeads as any[]).filter((l) => l.stage === "atendimento");
    const valorEmNegociacao = sum(emAtendimento, (l) => Number(l.sale_value || 0));

    // 9) Ficha dos consultores
    const overdueByLead = new Map<string, number>();
    for (const t of overdueTasks as any[]) {
      overdueByLead.set(t.lead_id, (overdueByLead.get(t.lead_id) ?? 0) + 1);
    }
    const thirtyDaysAgo = now.getTime() - 30 * DAY_MS;
    const sellersFichas: SellerFicha[] = sellerList
      .filter((s) => s.active && (!unitFilter || s.unit === unitFilter))
      .map((s) => {
        const mySales = sales.filter((v: any) => v.seller_id === s.id);
        const ano = mySales.filter((v: any) => between(saleKey(v), yearKey, todayKey));
        const mes = mySales.filter((v: any) => between(saleKey(v), monthKey, todayKey));
        const seis = mySales.filter((v: any) => {
          const k = saleKey(v);
          return !!k && k >= sixMonthsKey && k < monthKey;
        });
        const myOpen = (openLeadsAll as any[]).filter(
          (l) => sellerOfLead(l.assigned_to)?.id === s.id,
        );
        const negoc = myOpen.filter((l) => l.stage === "atendimento");
        const mudo = myOpen.filter(
          (l) => new Date(l.stage_updated_at ?? l.created_at).getTime() < thirtyDaysAgo,
        ).length;
        const tarefas = sum(myOpen, (l) => overdueByLead.get(l.id) ?? 0);
        const media6Meses = Math.round((seis.length / 6) * 10) / 10;
        const semVendaNoMes = mes.length === 0 && media6Meses >= 1 && d >= 15;
        const severidade: SellerFicha["severidade"] =
          semVendaNoMes || mudo >= 10 || tarefas >= 40
            ? "crit"
            : mudo >= 3 || tarefas >= 10 || mes.length < media6Meses * 0.5
              ? "warn"
              : "ok";
        return {
          nome: s.name,
          unidade: s.unit ? (UNIT_INFO[s.unit as UnitKey]?.nome ?? s.unit) : "—",
          anoVendas: ano.length,
          anoValor: sum(ano, amount),
          mesAtualVendas: mes.length,
          media6Meses,
          emNegociacao: negoc.length,
          valorNegociacao: sum(negoc, (l) => Number(l.sale_value || 0)),
          mudo30Dias: mudo,
          tarefasVencidas: tarefas,
          cumprimentoAgenda: null,
          discPerfil: null,
          severidade,
          historicoMensal: Array.from({ length: m + 1 }, (_, i) => {
            const prefix = `${y}-${String(i + 1).padStart(2, "0")}`;
            return mySales.filter((v: any) => saleKey(v)?.startsWith(prefix)).length;
          }),
        };
      })
      .sort((a, b) => b.anoValor - a.anoValor);

    // 10) Alertas de supervisão derivados das fichas reais
    const supervisorAlerts: AlertaSupervisao[] = sellersFichas
      .filter((f) => f.severidade === "crit" || f.severidade === "warn")
      .map((f) => {
        const problemas: string[] = [];
        let acao = "Acompanhar a carteira do consultor nesta semana.";
        if (f.mesAtualVendas === 0 && f.media6Meses >= 1) {
          problemas.push(`Sem vendas no mês (média ${f.media6Meses.toFixed(1)}/mês)`);
          acao = "Alinhar plano de fechamento para as propostas em aberto.";
        }
        if (f.mudo30Dias > 0) {
          problemas.push(`${f.mudo30Dias} negócio(s) sem avanço há +30 dias`);
          acao = "Priorizar contato com os negócios parados há mais de 30 dias.";
        }
        if (f.tarefasVencidas > 0) {
          problemas.push(`${f.tarefasVencidas} tarefa(s) vencida(s)`);
          acao = "Revisar e zerar as tarefas vencidas da cadência com o consultor.";
        }
        if (!problemas.length) problemas.push("Vendas do mês abaixo da média dos últimos 6 meses");
        return {
          vendedor: f.nome,
          unidade: f.unidade,
          titulo: problemas.join(" · "),
          severidade: f.severidade === "crit" ? ("crit" as const) : ("warn" as const),
          detalhe: `${f.emNegociacao} negócio(s) em atendimento (${brlShortSrv(f.valorNegociacao)}) · ${f.anoVendas} venda(s) no ano.`,
          acaoSugerida: acao,
          discPerfil: f.discPerfil,
        };
      })
      .sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "crit" ? -1 : 1));

    // 11) Leads recentes (reais, limitados para não travar a renderização)
    const recentLeads = (periodLeads as any[]).slice(0, 200).map((l) => {
      let orig = l.origem || "Orgânico";
      if (classifyOrigin(l) === "quiz") orig = "Quiz Solar";
      else if (l.fbclid) orig = "Meta Ads";
      else if (l.gclid) orig = "Google Ads";
      const seller = sellerOfLead(l.assigned_to);
      return {
        id: l.id,
        nome: l.nome || "Lead sem nome",
        telefone: l.telefone ?? null,
        cidade: l.cidade ?? null,
        origem: orig,
        stage: l.stage || "novo",
        sale_value: l.sale_value ? Number(l.sale_value) : null,
        assigned_name: seller?.name ?? null,
        created_at: l.created_at,
      };
    });

    // 12) Métricas pessoais
    const wonDate = (l: any) => l.stage_updated_at ?? l.created_at;
    const myWonYear = (myWonLeads as any[]).filter(
      (l) => wonDate(l) >= brMidnight(y, 0, 1).toISOString(),
    );
    const myWonPeriod = (myWonLeads as any[]).filter(
      (l) => wonDate(l) >= startISO && wonDate(l) <= endISO,
    );
    const myNegotiationValue = sum(
      (openLeadsAll as any[]).filter((l) => l.assigned_to === userId && l.stage === "atendimento"),
      (l) => Number(l.sale_value || 0),
    );
    const myRankIdx = sellersFichas.findIndex(
      (f) => sellerList.find((s) => s.name === f.nome)?.profile_id === userId,
    );

    return {
      isExecutive,
      periodLabel,
      userPersonal: {
        assignedLeads: myLeadsCount ?? 0,
        myWonSalesMonth: myWonPeriod.length,
        myWonSalesYear: myWonYear.length,
        myWonValueYear: sum(myWonYear, (l) => Number(l.sale_value || 0)),
        myNegotiationValue,
        myRankPosition: myRankIdx >= 0 ? myRankIdx + 1 : 0,
      },
      summary: {
        leadsTotal,
        leadsNovosHoje,
        leadsQuiz: originCount.quiz.leads,
        leadsSdr,
        leadsTrafego: originCount.trafego.leads,
        leadsProspeccao: originCount.prospeccao.leads,
        leadsIndicacao: originCount.indicacao.leads,
        vendasPeriodoQtd,
        vendasPeriodoValor,
        vendasMesQtd: soldMonth.length,
        vendasMesValor: sum(soldMonth, amount),
        vendasAnoQtd: soldYear.length,
        vendasAnoValor: sum(soldYear, amount),
        faturadoMesValor: sum(invMonth, amount),
        faturadoAnoValor: sum(invYear, amount),
        faturadoPeriodoValor: sum(invPeriod, amount),
        ticketMedio,
        taxaConversaoGeral: pct(leadsWon, leadsTotal),
        conversaoTrafego: pct(originCount.trafego.vendas, originCount.trafego.leads),
        obrasEntreguesAno: works?.entreguesAno ?? null,
        filaObras: works?.fila ?? null,
        metaSpend,
        metaLeads,
        metaCpl,
        valorEmNegociacao,
      },
      monthlySales,
      originsBreakdown,
      unitsBreakdown,
      recentLeads,
      sellersFichas,
      metaCampanhas,
      supervisorAlerts,
    };
  });
