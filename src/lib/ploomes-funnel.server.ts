// Server-only: funil comercial (Energia Solar) direto do Ploomes.
// Espelha exatamente o painel de relatórios que a diretoria enxerga:
//  - Novos leads .......... negócios criados no pipeline no período
//  - Apresentações ........ campo "Data que o negócio entrou na etapa Apresentaçao"
//  - Negociações .......... campo "Data que o negocio entrou na etapa Negociacao/Fechamento"
//  - Vendas efetuadas ..... negócios ganhos com data de fechamento no período
const PLOOMES_API = "https://public-api2.ploomes.com";

export const SOLAR_PIPELINE_ID = 10017344;
export const FIELD_CAPTACAO = 60047429; // "Como feita a captação do Lead?"
export const FIELD_DT_APRESENTACAO = 60144095;
export const FIELD_DT_NEGOCIACAO = 60144097;

export const ORIGENS = [
  { id: 600965618, label: "Tráfego pago" },
  { id: 600965616, label: "Prospecção" },
  { id: 600965617, label: "Indicação" },
  { id: 600965619, label: "Ação comercial" },
  { id: 600965620, label: "Feira" },
  { id: 601325073, label: "Reativação" },
  { id: 601332767, label: "Aumento de sistema" },
  { id: 609758031, label: "Ligação ativa" },
] as const;

function key() {
  const k = process.env["PLOOMES_USER_KEY"] || process.env["PLOOMES_API_KEY"];
  if (!k) throw new Error("Integração Ploomes não configurada.");
  return k;
}

async function api(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const res = await fetch(`${PLOOMES_API}${path}?${qs.toString()}`, {
    cache: "no-store",
    headers: { "User-Key": key(), Accept: "application/json", "Cache-Control": "no-cache" },
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

async function count(filter: string): Promise<number> {
  const r = await api("/Deals", { $filter: filter, $top: 0, $count: "true" });
  return Number(r["@odata.count"] ?? 0);
}

function origemFilter(origemId?: number | null) {
  return origemId
    ? ` and OtherProperties/any(p: p/FieldId eq ${FIELD_CAPTACAO} and p/IntegerValue eq ${origemId})`
    : "";
}

function dateFieldFilter(fieldId: number, from: string, to: string) {
  return `OtherProperties/any(p: p/FieldId eq ${fieldId} and p/DateTimeValue ge ${from} and p/DateTimeValue lt ${to})`;
}

/** Converte YYYY-MM-DD (data local BR) em ISO com offset -03:00. */
function iso(d: string, endExclusive = false) {
  if (!endExclusive) return `${d}T00:00:00-03:00`;
  const base = new Date(`${d}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return `${base.toISOString().slice(0, 10)}T00:00:00-03:00`;
}


export type FunnelSale = {
  id: number;
  title: string;
  amount: number;
  finishDate: string;
  ownerName: string | null;
  creatorName: string | null;
  origem: string | null;
  /** true quando existe um negócio ganho no funil Financeiro para o mesmo contrato */
  faturada?: boolean;
  /** data em que o contrato foi faturado (funil Financeiro) */
  faturadoEm?: string | null;
};

export type FunnelResult = {
  from: string;
  to: string;
  origemId: number | null;
  leads: number;
  apresentacoes: number;
  negociacoes: number;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  taxaApresentacao: number;
  taxaNegociacao: number;
  taxaFechamento: number;
  taxaGeral: number;
  porOrigem: Array<{ origem: string; leads: number; vendas: number; valor: number }>;
  vendasDetalhe: FunnelSale[];
  faturadas: number;
  faturadoValor: number;
  faturadasDetalhe: FunnelSale[];
  geradoEm: string;
};

const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Negócios ganhos no funil Financeiro (faturamento efetivo) no período. */
async function getFaturadas(from: string, to: string, origemId?: number | null): Promise<FunnelSale[]> {
  const out: FunnelSale[] = [];
  let skip = 0;
  for (;;) {
    const r = await api("/Deals", {
      $filter: `StatusId eq 2 and FinishDate ge ${from} and FinishDate lt ${to}`,
      $select: "Id,Title,Amount,FinishDate,OwnerId,CreatorId,PipelineId",
      $expand: "Owner($select=Name),Creator($select=Name),Pipeline($select=Name),OtherProperties",
      $top: 200,
      $skip: skip,
      $orderby: "FinishDate",
    });
    const rows: any[] = r.value ?? [];
    for (const d of rows) {
      if (!norm(d?.Pipeline?.Name).startsWith("financeiro")) continue;
      const prop = (d.OtherProperties ?? []).find((p: any) => p.FieldId === FIELD_CAPTACAO);
      const origem = ORIGENS.find((o) => o.id === prop?.IntegerValue)?.label ?? null;
      if (origemId && prop?.IntegerValue !== origemId) continue;
      out.push({
        id: d.Id,
        title: d.Title ?? "—",
        amount: Number(d.Amount ?? 0),
        finishDate: d.FinishDate,
        ownerName: d.Owner?.Name ?? null,
        creatorName: d.Creator?.Name ?? null,
        origem,
      });
    }
    if (rows.length < 200) break;
    skip += 200;
  }
  return out;
}


export async function getSolarFunnel(
  fromDate: string,
  toDate: string,
  origemId?: number | null,
): Promise<FunnelResult> {
  const from = iso(fromDate);
  const to = iso(toDate, true);
  const org = origemFilter(origemId);
  const pipe = `PipelineId eq ${SOLAR_PIPELINE_ID}`;

  // Etapas usam os campos de data do CRM (sem travar pipeline: o negócio pode
  // migrar de funil depois da apresentação — é assim que a diretoria enxerga).
  const [leads, apresentacoes, negociacoes] = await Promise.all([
    count(`${pipe} and CreateDate ge ${from} and CreateDate lt ${to}${org}`),
    count(`${dateFieldFilter(FIELD_DT_APRESENTACAO, from, to)}${org}`),
    count(`${dateFieldFilter(FIELD_DT_NEGOCIACAO, from, to)}${org}`),
  ]);


  // Vendas ganhas no período (paginado, com valores e responsáveis)
  const wonFilter = `${pipe} and StatusId eq 2 and FinishDate ge ${from} and FinishDate lt ${to}${org}`;
  const vendasDetalhe: FunnelSale[] = [];
  let skip = 0;
  for (;;) {
    const r = await api("/Deals", {
      $filter: wonFilter,
      $select: "Id,Title,Amount,FinishDate,OwnerId,CreatorId",
      $expand: "Owner($select=Name),Creator($select=Name),OtherProperties",
      $top: 200,
      $skip: skip,
      $orderby: "FinishDate",
    });
    const rows: any[] = r.value ?? [];
    for (const d of rows) {
      const prop = (d.OtherProperties ?? []).find((p: any) => p.FieldId === FIELD_CAPTACAO);
      const origem = ORIGENS.find((o) => o.id === prop?.IntegerValue)?.label ?? null;
      vendasDetalhe.push({
        id: d.Id,
        title: d.Title ?? "—",
        amount: Number(d.Amount ?? 0),
        finishDate: d.FinishDate,
        ownerName: d.Owner?.Name ?? null,
        creatorName: d.Creator?.Name ?? null,
        origem,
      });
    }
    if (rows.length < 200) break;
    skip += 200;
  }

  const vendas = vendasDetalhe.length;
  const faturamento = vendasDetalhe.reduce((s, v) => s + v.amount, 0);

  // Quebra por origem (somente quando não há filtro de origem aplicado)
  const porOrigem: FunnelResult["porOrigem"] = [];
  if (!origemId) {
    for (const o of ORIGENS) {
      const f = origemFilter(o.id);
      const l = await count(`${pipe} and CreateDate ge ${from} and CreateDate lt ${to}${f}`);
      const vs = vendasDetalhe.filter((v) => v.origem === o.label);
      if (l === 0 && vs.length === 0) continue;
      porOrigem.push({
        origem: o.label,
        leads: l,
        vendas: vs.length,
        valor: vs.reduce((s, v) => s + v.amount, 0),
      });
    }
    porOrigem.sort((a, b) => b.leads - a.leads);
  }

  const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

  const faturadasDetalhe = await getFaturadas(from, to, origemId);

  return {
    from: fromDate,
    to: toDate,
    origemId: origemId ?? null,
    leads,
    apresentacoes,
    negociacoes,
    vendas,
    faturamento,
    ticketMedio: vendas > 0 ? faturamento / vendas : 0,
    taxaApresentacao: pct(apresentacoes, leads),
    taxaNegociacao: pct(negociacoes, apresentacoes),
    taxaFechamento: pct(vendas, negociacoes),
    taxaGeral: pct(vendas, leads),
    porOrigem,
    vendasDetalhe,
    faturadas: faturadasDetalhe.length,
    faturadoValor: faturadasDetalhe.reduce((s, v) => s + v.amount, 0),
    faturadasDetalhe,
    geradoEm: new Date().toISOString(),
  };
}

