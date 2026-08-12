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

/**
 * Faturamento efetivo = negócio do funil Financeiro / Energia Solar.
 *
 * ATENÇÃO: NÃO usar FinishDate desse funil — ele só é preenchido quando o
 * saldo remanescente é liquidado (às vezes meses depois), o que jogava
 * contratos faturados em abril para agosto. A data correta de faturamento é
 * o campo "Data do início do contrato" (60112093); na falta dele, a data de
 * criação do negócio financeiro.
 */
const FINANCEIRO_PIPELINE_ID = 60000841;
const FIELD_DT_CONTRATO = 60112093;

function faturadoEmOf(d: any): string {
  const p = (d.OtherProperties ?? []).find((x: any) => x?.FieldId === FIELD_DT_CONTRATO);
  return p?.DateTimeValue ?? d?.CreateDate ?? d?.FinishDate;
}

async function getFaturadas(from: string, to: string): Promise<FunnelSale[]> {
  const out: FunnelSale[] = [];
  let skip = 0;
  const range =
    `(OtherProperties/any(p: p/FieldId eq ${FIELD_DT_CONTRATO} and p/DateTimeValue ge ${from} and p/DateTimeValue lt ${to})` +
    ` or (CreateDate ge ${from} and CreateDate lt ${to}))`;
  for (;;) {
    const r = await api("/Deals", {
      $filter: `PipelineId eq ${FINANCEIRO_PIPELINE_ID} and StatusId eq 2 and ${range}`,
      $select: "Id,Title,Amount,FinishDate,CreateDate,OwnerId,CreatorId,PipelineId",
      $expand: "Owner($select=Name),Creator($select=Name),OtherProperties",
      $top: 200,
      $skip: skip,
      $orderby: "CreateDate",
    });
    const rows: any[] = r.value ?? [];
    for (const d of rows) {
      const faturadoEm = faturadoEmOf(d);
      // o campo de data do contrato pode estar fora do período mesmo quando o
      // negócio foi criado dentro dele — a data do contrato manda.
      if (Date.parse(faturadoEm) < Date.parse(from) || Date.parse(faturadoEm) >= Date.parse(to))
        continue;
      const prop = (d.OtherProperties ?? []).find((p: any) => p.FieldId === FIELD_CAPTACAO);
      const origem = ORIGENS.find((o) => o.id === prop?.IntegerValue)?.label ?? null;
      out.push({
        id: d.Id,
        title: d.Title ?? "—",
        amount: Number(d.Amount ?? 0),
        finishDate: faturadoEm,
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

  // Faturamento: busca do início do período até hoje (o contrato pode ser
  // faturado depois), para conseguir marcar as vendas já faturadas.
  const nowIso = new Date().toISOString();
  const wideTo = Date.parse(nowIso) > Date.parse(to) ? nowIso : to;
  const faturadasAll = await getFaturadas(from, wideTo);

  // Cruza contrato (título normalizado) entre venda no funil e faturamento.
  const byTitle = new Map<string, FunnelSale>();
  for (const f of faturadasAll) {
    const k = norm(f.title);
    if (k && !byTitle.has(k)) byTitle.set(k, f);
  }
  const vendaByTitle = new Map<string, FunnelSale>();
  for (const v of vendasDetalhe) {
    const k = norm(v.title);
    const f = byTitle.get(k);
    if (f) {
      v.faturada = true;
      v.faturadoEm = f.finishDate;
    }
    if (k && !vendaByTitle.has(k)) vendaByTitle.set(k, v);
  }

  // Aba "Faturadas": respeita o período e o filtro de origem aplicados.
  const origemLabel = origemId ? (ORIGENS.find((o) => o.id === origemId)?.label ?? null) : null;
  const faturadasDetalhe = faturadasAll
    .filter((f) => Date.parse(f.finishDate) < Date.parse(to))
    .map((f) => {
      const v = vendaByTitle.get(norm(f.title));
      return { ...f, origem: f.origem ?? v?.origem ?? null };
    })
    .filter((f) => (origemLabel ? f.origem === origemLabel : true));

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

