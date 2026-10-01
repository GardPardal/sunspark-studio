// Server-only: números do fechamento mensal para a /apresentacao.
//
// SOMENTE LEITURA no Ploomes (GET). Regras (as mesmas do /dashhub e do financeiro):
//   - Assinado  = negócio GANHO nos funis Comerciais, pela data de ganho (FinishDate).
//   - Faturado  = negócio do funil Financeiro, não perdido, com "Data do início do
//                 contrato" (60112093) dentro do mês.
//   - Leads     = contatos com negócio criado no mês nos funis de venda, sem contar o
//                 negócio que a automação recria quando o Comercial é perdido.
//   - Origem    = etiqueta "Tráfego Interno" (quiz) > campo "Como feita a captação do Lead?".
//   - Unidade   = campo "Origem do Lead" (60047430), que na prática guarda a filial.
//   - Vendas    = Energia Solar, E-mobility e Eletroposto. Contratos de "Energia por
//                 assinatura" (sem valor) ficam à parte, fora da contagem e do ranking.
//   - Margem    = "Margem de Contribuição (%)" da proposta vendida (a proposta do negócio
//                 com o valor igual ao do contrato). Média = Σ(margem × valor) ÷ Σ valor,
//                 com 18% nas vendas sem margem registrada.

import { PLOOMES_SALES_PIPELINE_IDS } from "./ploomes-pipelines";
import { contractCode, ploomesGetAll, ploomesLocalDate } from "./ploomes-sales.server";

const COMERCIAL: Record<number, string> = {
  10017344: "Energia Solar",
  60003327: "E-mobility",
  60004664: "Energia por assinatura",
  60010175: "Eletroposto",
};
const FINANCEIRO: Record<number, string> = {
  60000841: "Energia Solar",
  60003328: "E-mobility",
};
const FIELD_CAPTACAO = 60047429;
const FIELD_FILIAL = 60047430;
const FIELD_DT_CONTRATO = 60112093;
const TAG_TRAFEGO_INTERNO = 60155001;
const TZ = "-03:00";
const PIPE_ASSINATURA = 60004664;
const FIELD_MC = 10291862; // Proposta: "Margem de Contribuição (%)" (a margem líquida da venda)
/** Margem considerada nas vendas sem margem registrada (definição da diretoria, 01/10/2026). */
const MARGEM_PADRAO = 18;

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type Venda = {
  id: number;
  titulo: string;
  cliente: string;
  valor: number;
  data: string;
  vendedor: string;
  unidade: string;
  origem: string;
  linha: string;
  kwp: number | null;
  margemPct: number | null;
};

export type Agregado = { chave: string; qtd: number; valor: number };

export type RelatorioMes = {
  mes: string; // YYYY-MM
  mesAnterior: string;
  geradoEm: string;
  fonte: string;
  leads: {
    total: number;
    anterior: number;
    porOrigem: Agregado[];
    porUnidade: Agregado[];
    porDia: number[];
  };
  assinado: {
    /** Contratos de energia por assinatura (fora da contagem de vendas). */
    assinatura: { qtd: number; valor: number };
    qtd: number;
    valor: number;
    kwp: number;
    ticket: number;
    anterior: { qtd: number; valor: number };
    porUnidade: Agregado[];
    porLinha: Agregado[];
    porOrigem: Agregado[];
    porDia: number[];
    vendas: Venda[];
  };
  faturado: {
    qtd: number;
    valor: number;
    anterior: { qtd: number; valor: number };
    porUnidade: Agregado[];
    vendas: Venda[];
  };
  historico: Array<{
    mes: string;
    assinadoQtd: number;
    assinadoValor: number;
    faturadoValor: number;
  }>;
  vendedores: Array<{ nome: string; unidade: string; qtd: number; valor: number; ticket: number }>;
  /** Todo mundo com lead, venda ou faturamento no mês no Ploomes (sem contas de integração). */
  equipe: string[];
  destaques: {
    maisVendas: { nome: string; qtd: number; valor: number }[];
    maiorValor: { nome: string; qtd: number; valor: number }[];
    /** Top 3 por contratos FATURADOS no mês (funil Financeiro), desempate pelo valor. */
    rankFaturadas: { nome: string; qtd: number; valor: number }[];
    /** Top 3 por contratos ASSINADOS no mês, desempate pelo valor. */
    rankAssinadas: { nome: string; qtd: number; valor: number }[];
    /** As 3 maiores vendas (contratos) assinadas no mês. */
    maioresVendas: { nome: string; cliente: string; valor: number; kwp: number | null }[];
  };
  prospeccao: {
    leads: number;
    leadsAnterior: number;
    porVendedor: Agregado[];
    vendas: number;
    valorVendas: number;
  };
  margem: {
    campos: string[];
    valorComMargem: number;
    valorTotal: number;
    vendasComMargem: number;
    vendasTotal: number;
    /** Margem padrão (%) usada nas vendas sem margem registrada. */
    padrao: number;
    /** Σ(margem × valor) ÷ Σ valor, com o padrão nas vendas sem margem. */
    mediaPonderada: number | null;
    /** A mesma conta só com as vendas que têm margem registrada. */
    mediaRegistradas: number | null;
    porVendedor: Array<{
      nome: string;
      media: number;
      vendas: number;
      comMargem: number;
      valor: number;
    }>;
  };
  avisos: string[];
};

/* ---------------- utilidades ---------------- */

function limites(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const prox = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const ant = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  return {
    de: `${mes}-01T00:00:00${TZ}`,
    ate: `${prox}-01T00:00:00${TZ}`,
    anterior: ant,
    dias: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
}

function mesesAntes(mes: string, n: number) {
  const out: string[] = [];
  let [y, m] = mes.split("-").map(Number);
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

function prop(d: any, fieldId: number) {
  return (d?.OtherProperties ?? []).find((p: any) => p?.FieldId === fieldId) ?? null;
}

function opcao(d: any, fieldId: number): string | null {
  const p = prop(d, fieldId);
  return (p?.ObjectValueName ?? p?.StringValue ?? null) || null;
}

/** "Sede Wenceslau Braz" / "Filial Londrina" → nome curto da unidade. */
function unidadeDe(d: any): string {
  const f = norm(opcao(d, FIELD_FILIAL));
  if (f.includes("wenceslau")) return "Wenceslau Braz";
  if (f.includes("londrina")) return "Londrina";
  if (f.includes("ponta grossa")) return "Ponta Grossa";
  const nome = opcao(d, FIELD_FILIAL);
  return nome ? nome.replace(/^(sede|filial)\s+/i, "") : "Sem unidade";
}

function origemDe(d: any): string {
  if ((d?.Tags ?? []).some((t: any) => Number(t?.TagId) === TAG_TRAFEGO_INTERNO))
    return "Quiz · Tráfego Interno";
  const c = opcao(d, FIELD_CAPTACAO);
  const n = norm(c);
  if (!c) return "Sem captação informada";
  if (n.includes("trafego")) return "Tráfego pago";
  if (n.includes("prospec") || n.includes("ligacao ativa")) return "Prospecção ativa";
  return c;
}

function ehProspeccao(d: any) {
  const n = norm(opcao(d, FIELD_CAPTACAO));
  return n.includes("prospec") || n.includes("ligacao ativa");
}

/** Potência no título: "(14.64 KWp)" / "(9,76 KWp)". */
function kwpDe(titulo: string): number | null {
  const m = titulo.match(/([\d.,]+)\s*kwp/i);
  if (!m) return null;
  const n = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}

function clienteDe(titulo: string, contato?: string | null) {
  const t = titulo.replace(/^Ploomes:\s*/, "");
  const partes = t.split(" - ");
  const nome = (partes.length > 1 ? partes.slice(1).join(" - ") : t).replace(
    /\s*\([^)]*kwp\)\s*$/i,
    "",
  );
  return (nome || contato || "").trim();
}

function agrega(itens: { chave: string; valor: number }[]): Agregado[] {
  const m = new Map<string, Agregado>();
  for (const i of itens) {
    const a = m.get(i.chave) ?? { chave: i.chave, qtd: 0, valor: 0 };
    a.qtd++;
    a.valor += i.valor;
    m.set(i.chave, a);
  }
  return Array.from(m.values())
    .map((a) => ({ ...a, valor: Math.round(a.valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor || b.qtd - a.qtd);
}

/* ---------------- margem ---------------- */

/**
 * Preenche margemPct de cada venda com a "Margem de Contribuição (%)" da proposta vendida:
 * entre as propostas do negócio, a de valor igual ao do contrato (até 1% de diferença;
 * empate → a mais recente). Sem proposta correspondente ou sem o campo, fica null.
 */
async function margensDasPropostas(vendas: Venda[], avisos: string[]) {
  const ids = vendas.map((v) => v.id);
  const propostas: any[] = [];
  try {
    for (let i = 0; i < ids.length; i += 15) {
      const bloco = ids.slice(i, i + 15);
      propostas.push(
        ...(await ploomesGetAll(
          `/Quotes?$filter=(${bloco.map((id) => `DealId eq ${id}`).join(" or ")})` +
            `&$select=Id,DealId,Amount,CreateDate&$expand=OtherProperties($filter=FieldId eq ${FIELD_MC})`,
        )),
      );
    }
  } catch (e) {
    avisos.push(`Margem: não deu para ler as propostas (${(e as Error).message}).`);
    return;
  }
  const porNegocio = new Map<number, any[]>();
  for (const q of propostas) {
    const k = Number(q.DealId);
    porNegocio.set(k, [...(porNegocio.get(k) ?? []), q]);
  }
  for (const v of vendas) {
    const qs = porNegocio.get(v.id) ?? [];
    const alvo = [...qs].sort(
      (a, b) =>
        Math.abs(Number(a.Amount) - v.valor) - Math.abs(Number(b.Amount) - v.valor) ||
        String(b.CreateDate).localeCompare(String(a.CreateDate)),
    )[0];
    if (!alvo || !v.valor || Math.abs(Number(alvo.Amount) - v.valor) / v.valor > 0.01) continue;
    const mc = prop(alvo, FIELD_MC)?.DecimalValue;
    if (mc != null && Number.isFinite(Number(mc))) v.margemPct = Number(mc);
  }
}

/**
 * Margem dos contratos FATURADOS: o negócio do Financeiro não tem proposta; ela fica no
 * negócio ganho do Comercial com o mesmo código de contrato no título (ex.: WB260388FCT).
 */
async function margensFaturadas(fat: Venda[], avisos: string[]) {
  const porCodigo = new Map<string, Venda[]>();
  for (const v of fat) {
    const c = contractCode(v.titulo);
    if (c) porCodigo.set(c, [...(porCodigo.get(c) ?? []), v]);
  }
  const codigos = [...porCodigo.keys()];
  const comerciais: any[] = [];
  try {
    for (let i = 0; i < codigos.length; i += 10) {
      const bloco = codigos.slice(i, i + 10);
      comerciais.push(
        ...(await ploomesGetAll(
          `/Deals?$filter=PipelineId eq 10017344 and StatusId eq 2 and (${bloco
            .map((c) => `startswith(Title,'${c}')`)
            .join(" or ")})&$select=Id,Title,Amount`,
        )),
      );
    }
  } catch (e) {
    avisos.push(
      `Margem do faturado: não deu para achar os negócios do Comercial (${(e as Error).message}).`,
    );
    return;
  }
  const proxies: { venda: Venda; proxy: Venda }[] = [];
  for (const [codigo, vendas] of porCodigo) {
    const candidatos = comerciais.filter((d) => contractCode(d.Title) === codigo);
    for (const v of vendas) {
      const d = [...candidatos].sort(
        (a, b) => Math.abs(Number(a.Amount) - v.valor) - Math.abs(Number(b.Amount) - v.valor),
      )[0];
      if (!d) continue;
      proxies.push({
        venda: v,
        proxy: { ...v, id: Number(d.Id), valor: Number(d.Amount) || v.valor },
      });
    }
  }
  await margensDasPropostas(
    proxies.map((p) => p.proxy),
    avisos,
  );
  for (const p of proxies) p.venda.margemPct = p.proxy.margemPct;
}

/** Quem não entra na equipe: contas de integração (Automação, WhatsApp...) e usuários suspensos. */
async function usuariosIntegracao(): Promise<Set<string>> {
  try {
    const us = await ploomesGetAll(`/Users?$select=Name,Integration,Suspended`, 300, 5);
    return new Set(
      us.filter((u: any) => u?.Integration || u?.Suspended).map((u: any) => norm(u.Name)),
    );
  } catch {
    return new Set(["automacao"]);
  }
}

/* ---------------- leitura ---------------- */

const SALES_FILTER = `(${PLOOMES_SALES_PIPELINE_IDS.map((id) => `PipelineId eq ${id}`).join(" or ")})`;
const COM_FILTER = `(${Object.keys(COMERCIAL)
  .map((id) => `PipelineId eq ${id}`)
  .join(" or ")})`;
const FIN_FILTER = `(${Object.keys(FINANCEIRO)
  .map((id) => `PipelineId eq ${id}`)
  .join(" or ")})`;

/** Lê com a etiqueta; se o Ploomes recusar o expand de Tags, lê de novo sem ela. */
let tagsIndisponiveis = false;
async function comTags(
  montar: (tags: string) => string,
  avisos: string[],
  top?: number,
  pages?: number,
) {
  if (!tagsIndisponiveis) {
    try {
      return await ploomesGetAll(montar("Tags($select=TagId),"), top, pages);
    } catch (e) {
      if (!/Ploomes 400/.test((e as Error).message)) throw e;
      tagsIndisponiveis = true;
    }
  }
  if (!avisos.some((a) => a.startsWith("Etiqueta")))
    avisos.push("Etiqueta Tráfego Interno não pôde ser lida; o quiz conta pela captação.");
  return ploomesGetAll(montar(""), top, pages);
}

function expandCampos(extra: number[]) {
  const ids = [FIELD_CAPTACAO, FIELD_FILIAL, ...extra];
  return `OtherProperties($filter=${ids.map((id) => `FieldId eq ${id}`).join(" or ")})`;
}

async function lerAssinados(de: string, ate: string, avisos: string[]) {
  return comTags(
    (tags) =>
      `/Deals?$filter=${COM_FILTER} and StatusId eq 2 and FinishDate ge ${de} and FinishDate lt ${ate}` +
      `&$select=Id,Title,Amount,FinishDate,PipelineId,OwnerId` +
      `&$expand=Owner($select=Name),Contact($select=Name),${tags}${expandCampos([])}`,
    avisos,
  );
}

async function lerFaturados(de: string, ate: string) {
  const r = `OtherProperties/any(p: p/FieldId eq ${FIELD_DT_CONTRATO} and p/DateTimeValue ge ${de} and p/DateTimeValue lt ${ate})`;
  return ploomesGetAll(
    `/Deals?$filter=${FIN_FILTER} and StatusId ne 3 and ${r}` +
      `&$select=Id,Title,Amount,PipelineId,OwnerId` +
      `&$expand=Owner($select=Name),Contact($select=Name),${expandCampos([FIELD_DT_CONTRATO])}`,
  );
}

async function lerNovosNegocios(de: string, ate: string, avisos: string[]) {
  return comTags(
    (tags) =>
      `/Deals?$filter=${SALES_FILTER} and CreateDate ge ${de} and CreateDate lt ${ate}` +
      `&$select=Id,ContactId,PipelineId,CreateDate` +
      `&$expand=Creator($select=Name),Owner($select=Name),${tags}${expandCampos([])}`,
    avisos,
    300,
    80,
  );
}

/** Um lead por contato: o negócio mais antigo do mês, sem os recriados pela automação. */
function leadsDoMes(negocios: any[]) {
  const porContato = new Map<number, any>();
  for (const d of negocios) {
    if (norm(d?.Creator?.Name) === "automacao") continue;
    const cid = Number(d?.ContactId);
    if (!cid) continue;
    const atual = porContato.get(cid);
    if (!atual || String(d.CreateDate) < String(atual.CreateDate)) porContato.set(cid, d);
  }
  return Array.from(porContato.values());
}

function paraVenda(d: any, data: string | null, linha: string): Venda {
  const titulo = String(d?.Title ?? "");
  const valor = Number(d?.Amount ?? 0);
  return {
    id: Number(d.Id),
    titulo,
    cliente: clienteDe(titulo, d?.Contact?.Name),
    valor,
    data: data ?? "",
    vendedor: d?.Owner?.Name ?? "Sem responsável",
    unidade: unidadeDe(d),
    origem: origemDe(d),
    linha,
    kwp: kwpDe(titulo),
    margemPct: null,
  };
}

/** Ranking por quantidade de contratos (desempate pelo valor), top 3. */
function rankPorQtd(vendas: Venda[]) {
  const m = new Map<string, { nome: string; qtd: number; valor: number }>();
  for (const v of vendas) {
    const x = m.get(v.vendedor) ?? { nome: v.vendedor, qtd: 0, valor: 0 };
    x.qtd++;
    x.valor += v.valor;
    m.set(v.vendedor, x);
  }
  return [...m.values()]
    .map((x) => ({ ...x, valor: Math.round(x.valor * 100) / 100 }))
    .sort((a, b) => b.qtd - a.qtd || b.valor - a.valor)
    .slice(0, 3);
}

const soma = (xs: { valor: number }[]) =>
  Math.round(xs.reduce((s, x) => s + x.valor, 0) * 100) / 100;

/* ---------------- relatório ---------------- */

const cache = new Map<string, { at: number; r: RelatorioMes }>();
const TTL = 10 * 60_000;

export async function relatorioMes(mes: string, forcar = false): Promise<RelatorioMes> {
  const hit = cache.get(mes);
  if (!forcar && hit && Date.now() - hit.at < TTL) return hit.r;

  const avisos: string[] = [];
  const L = limites(mes);
  const LA = limites(L.anterior);
  const hist = mesesAntes(mes, 6);
  const histDe = limites(hist[0]).de;

  const [assinadosHist, faturadosHist, novos, novosAnt] = await Promise.all([
    lerAssinados(histDe, L.ate, avisos),
    lerFaturados(histDe, L.ate),
    lerNovosNegocios(L.de, L.ate, avisos),
    lerNovosNegocios(LA.de, LA.ate, avisos),
  ]);

  // Vendas assinadas (data de ganho) e faturadas (data do início do contrato)
  const todasAssinadas = assinadosHist.map((d: any) =>
    paraVenda(d, ploomesLocalDate(d?.FinishDate), COMERCIAL[d.PipelineId] ?? "Outros"),
  );
  const assinadas = todasAssinadas.filter((v) => v.linha !== COMERCIAL[PIPE_ASSINATURA]);
  const assinaturaMes = todasAssinadas.filter(
    (v) => v.linha === COMERCIAL[PIPE_ASSINATURA] && v.data.startsWith(mes),
  );
  const faturadas = faturadosHist.map((d: any) =>
    paraVenda(
      d,
      ploomesLocalDate(prop(d, FIELD_DT_CONTRATO)?.DateTimeValue),
      FINANCEIRO[d.PipelineId] ?? "Outros",
    ),
  );
  const doMes = (vs: Venda[], m: string) => vs.filter((v) => v.data.startsWith(m));
  const assMes = doMes(assinadas, mes).sort((a, b) => b.valor - a.valor);
  const assAnt = doMes(assinadas, L.anterior);
  const fatMes = doMes(faturadas, mes).sort((a, b) => b.valor - a.valor);
  const fatAnt = doMes(faturadas, L.anterior);

  const porDia = (datas: string[]) => {
    const arr = Array(L.dias).fill(0);
    for (const d of datas) if (d.startsWith(mes)) arr[Number(d.slice(8, 10)) - 1]++;
    return arr;
  };

  // Leads
  const leads = leadsDoMes(novos);
  const robos = await usuariosIntegracao();
  const equipe = Array.from(
    new Set(
      [
        // só leads reais do mês: o negócio que a automação recria mantém o dono antigo
        ...leads.map((d: any) => d?.Owner?.Name as string | undefined),
        ...assMes.map((v) => v.vendedor),
        ...fatMes.map((v) => v.vendedor),
      ]
        .map((n) => (n ?? "").trim())
        .filter((n) => n && n !== "Sem responsável" && !robos.has(norm(n))),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const leadsAnt = leadsDoMes(novosAnt);

  // Vendedores (assinado no mês)
  const vend = new Map<
    string,
    { nome: string; unidade: Map<string, number>; qtd: number; valor: number }
  >();
  for (const v of assMes) {
    const x = vend.get(v.vendedor) ?? { nome: v.vendedor, unidade: new Map(), qtd: 0, valor: 0 };
    x.qtd++;
    x.valor += v.valor;
    x.unidade.set(v.unidade, (x.unidade.get(v.unidade) ?? 0) + 1);
    vend.set(v.vendedor, x);
  }
  const vendedores = Array.from(vend.values())
    .map((x) => ({
      nome: x.nome,
      unidade: [...x.unidade.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "",
      qtd: x.qtd,
      valor: Math.round(x.valor * 100) / 100,
      ticket: x.qtd ? Math.round(x.valor / x.qtd) : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
  const topQtd = Math.max(0, ...vendedores.map((v) => v.qtd));
  const topValor = Math.max(0, ...vendedores.map((v) => v.valor));

  // Prospecção ativa
  const prosLeads = leads.filter(ehProspeccao);
  const prosLeadsAnt = leadsAnt.filter(ehProspeccao);
  const prosVendas = assMes.filter((v) => v.origem === "Prospecção ativa");

  // Margem (regra da diretoria): Σ(margem % × valor da venda) ÷ Σ valor das vendas,
  // usando MARGEM_PADRAO nas vendas sem margem registrada na proposta vendida.
  // Base: tudo que cada vendedor FATUROU no mês (funil Financeiro).
  await margensFaturadas(fatMes, avisos);
  const comValor = fatMes.filter((v) => v.valor > 0);
  const comMargem = comValor.filter((v) => v.margemPct != null);
  const margemDe = (v: Venda) => v.margemPct ?? MARGEM_PADRAO;
  const pesoTotal = comValor.reduce((s, v) => s + v.valor, 0);
  const mediaPonderada = pesoTotal
    ? comValor.reduce((s, v) => s + margemDe(v) * v.valor, 0) / pesoTotal
    : null;
  const pesoReg = comMargem.reduce((s, v) => s + v.valor, 0);
  const mediaRegistradas = pesoReg
    ? comMargem.reduce((s, v) => s + v.margemPct! * v.valor, 0) / pesoReg
    : null;
  const margemVend = new Map<string, { soma: number; peso: number; n: number; reg: number }>();
  for (const v of comValor) {
    const x = margemVend.get(v.vendedor) ?? { soma: 0, peso: 0, n: 0, reg: 0 };
    x.soma += margemDe(v) * v.valor;
    x.peso += v.valor;
    x.n++;
    if (v.margemPct != null) x.reg++;
    margemVend.set(v.vendedor, x);
  }
  if (comValor.length && comMargem.length < comValor.length)
    avisos.push(
      `Margem: ${comMargem.length} de ${comValor.length} contratos faturados têm "Margem de Contribuição (%)" na proposta vendida; os demais entram com ${MARGEM_PADRAO}%.`,
    );

  const r: RelatorioMes = {
    mes,
    mesAnterior: L.anterior,
    geradoEm: new Date().toISOString(),
    fonte: "Ploomes (somente leitura)",
    leads: {
      total: leads.length,
      anterior: leadsAnt.length,
      porOrigem: agrega(leads.map((d) => ({ chave: origemDe(d), valor: 0 }))).sort(
        (a, b) => b.qtd - a.qtd,
      ),
      porUnidade: agrega(leads.map((d) => ({ chave: unidadeDe(d), valor: 0 }))).sort(
        (a, b) => b.qtd - a.qtd,
      ),
      porDia: porDia(leads.map((d) => ploomesLocalDate(d.CreateDate) ?? "")),
    },
    assinado: {
      assinatura: { qtd: assinaturaMes.length, valor: soma(assinaturaMes) },
      qtd: assMes.length,
      valor: soma(assMes),
      kwp: Math.round(assMes.reduce((s, v) => s + (v.kwp ?? 0), 0) * 100) / 100,
      ticket: assMes.length ? Math.round(soma(assMes) / assMes.length) : 0,
      anterior: { qtd: assAnt.length, valor: soma(assAnt) },
      porUnidade: agrega(assMes.map((v) => ({ chave: v.unidade, valor: v.valor }))),
      porLinha: agrega(assMes.map((v) => ({ chave: v.linha, valor: v.valor }))),
      porOrigem: agrega(assMes.map((v) => ({ chave: v.origem, valor: v.valor }))),
      porDia: porDia(assMes.map((v) => v.data)),
      vendas: assMes,
    },
    faturado: {
      qtd: fatMes.length,
      valor: soma(fatMes),
      anterior: { qtd: fatAnt.length, valor: soma(fatAnt) },
      porUnidade: agrega(fatMes.map((v) => ({ chave: v.unidade, valor: v.valor }))),
      vendas: fatMes,
    },
    historico: hist.map((m) => ({
      mes: m,
      assinadoQtd: doMes(assinadas, m).length,
      assinadoValor: soma(doMes(assinadas, m)),
      faturadoValor: soma(doMes(faturadas, m)),
    })),
    vendedores,
    equipe,
    destaques: {
      maisVendas: vendedores
        .filter((v) => v.qtd === topQtd && topQtd > 0)
        .map(({ nome, qtd, valor }) => ({ nome, qtd, valor })),
      maiorValor: vendedores
        .filter((v) => v.valor === topValor && topValor > 0)
        .map(({ nome, qtd, valor }) => ({ nome, qtd, valor })),
      rankFaturadas: rankPorQtd(fatMes),
      rankAssinadas: rankPorQtd(assMes),
      maioresVendas: assMes.slice(0, 3).map((v) => ({
        nome: v.vendedor,
        cliente: v.cliente || v.titulo,
        valor: v.valor,
        kwp: v.kwp,
      })),
    },
    prospeccao: {
      leads: prosLeads.length,
      leadsAnterior: prosLeadsAnt.length,
      porVendedor: agrega(
        prosLeads.map((d) => ({ chave: d?.Owner?.Name ?? "Sem responsável", valor: 0 })),
      ).sort((a, b) => b.qtd - a.qtd),
      vendas: prosVendas.length,
      valorVendas: soma(prosVendas),
    },
    margem: {
      campos: [
        "Margem de Contribuição (%) da proposta vendida, sobre os contratos faturados no mês",
      ],
      valorComMargem: soma(comMargem),
      valorTotal: soma(comValor),
      vendasComMargem: comMargem.length,
      vendasTotal: comValor.length,
      padrao: MARGEM_PADRAO,
      mediaPonderada: mediaPonderada == null ? null : Math.round(mediaPonderada * 100) / 100,
      mediaRegistradas: mediaRegistradas == null ? null : Math.round(mediaRegistradas * 100) / 100,
      porVendedor: Array.from(margemVend.entries())
        .map(([nome, x]) => ({
          nome,
          media: Math.round((x.soma / x.peso) * 100) / 100,
          vendas: x.n,
          comMargem: x.reg,
          valor: Math.round(x.peso),
        }))
        .sort((a, b) => b.valor - a.valor),
    },
    avisos,
  };
  cache.set(mes, { at: Date.now(), r });
  return r;
}
