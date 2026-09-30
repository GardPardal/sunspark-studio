// Server-only: camada "ao vivo" da Sala de Comando (/dashhub).
//
// O pacote em hub_dados é gravado pelo Claude do dono de tempos em tempos. Aqui
// recalculamos, direto das fontes, a parte que tem fonte automática — com as
// MESMAS regras do pacote (conferidas contra o snapshot de 11/09/2026):
//   - H.mes.vend       vendas por mês = negócios ganhos no funil Comercial /
//                      Energia Solar, pela data de ganho (Ploomes, somente GET)
//   - H.fichas[]       ano, vlrano, ago (= mês corrente), jul (= mês anterior),
//                      hist (jan..mês corrente) e med6 (média dos 6 meses
//                      anteriores ao corrente), por vendedor
//   - MA               Meta Ads acumulado desde o início do período do pacote
//                      (meta_insights_daily), só se o banco reproduzir o pacote
// O resto (obras/ANEEL, DISC, mercado, agenda, carteira) continua vindo do pacote
// e a página informa a data dele.

import {
  PLOOMES_COMMERCIAL_PIPELINE_ID,
  ploomesGetAll,
  ploomesLocalDate,
} from "./ploomes-sales.server";

type Dados = Record<string, any>;

export type LiveInfo = {
  ao_vivo: boolean;
  corte: string;
  gerado_em: string;
  base_snapshot: string | null;
  campos_ao_vivo: string[];
  campos_do_pacote: string[];
  avisos: string[];
};

const HISTORY_START = "2025-01-01";
const MESES_LONGOS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Data de hoje no fuso de Brasília (YYYY-MM-DD). */
export function hojeBR() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

function addDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mesesAte(corte: string) {
  const out: string[] = [];
  let [y, m] = HISTORY_START.split("-").map(Number);
  const [cy, cm] = corte.split("-").map(Number);
  while (y < cy || (y === cy && m <= cm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const diaLongo = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} de ${MESES_LONGOS[m - 1]} de ${y}`;
};

/* ---------------- caches (por isolate do Worker) ---------------- */

type WonDeal = { amount: number; date: string; owner: string };
let wonCache: { at: number; rows: WonDeal[] } | null = null;
const WON_TTL_MS = 2 * 60_000;

async function ganhosComerciais(): Promise<WonDeal[]> {
  if (wonCache && Date.now() - wonCache.at < WON_TTL_MS) return wonCache.rows;
  const raw = await ploomesGetAll(
    `/Deals?$filter=PipelineId eq ${PLOOMES_COMMERCIAL_PIPELINE_ID} and StatusId eq 2 and FinishDate ge ${HISTORY_START}T00:00:00-03:00` +
      `&$select=Id,Amount,FinishDate&$expand=Owner($select=Name)`,
  );
  const rows: WonDeal[] = [];
  for (const d of raw) {
    const date = ploomesLocalDate(d?.FinishDate);
    if (!date) continue;
    rows.push({ amount: Number(d?.Amount ?? 0), date, owner: d?.Owner?.Name ?? "" });
  }
  wonCache = { at: Date.now(), rows };
  return rows;
}

const resultCache = new Map<string, { at: number; dados: Dados; info: LiveInfo }>();

/* ---------------- base do pacote ---------------- */

/** Pacote atual (hub_dados) ou, para datas passadas, a versão do histórico daquela data. */
async function carregaBase(corte: string, hoje: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: atual, error } = await db
    .from("hub_dados")
    .select("dados, atualizado_em")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const dadosAtual = (atual?.dados ?? {}) as Dados;
  const snapAtual: string | null = dadosAtual?.H?.snapshot ?? null;

  if (corte >= hoje || !snapAtual || snapAtual <= corte) {
    return { dados: dadosAtual, app: dadosAtual.APP };
  }

  // Data passada: a versão mais recente do histórico com snapshot até a data.
  const { data: versoes } = await db
    .from("hub_dados_hist")
    .select("id, snap:dados->H->>snapshot")
    .order("id", { ascending: false })
    .limit(500);
  const alvo = ((versoes ?? []) as { id: number; snap: string | null }[])
    .filter((v) => v.snap && v.snap <= corte)
    .sort((a, b) => (a.snap! < b.snap! ? 1 : a.snap! > b.snap! ? -1 : b.id - a.id))[0];
  if (!alvo) return { dados: dadosAtual, app: dadosAtual.APP };
  const { data: row } = await db
    .from("hub_dados_hist")
    .select("dados")
    .eq("id", alvo.id)
    .maybeSingle();
  // O painel (APP) é sempre o atual: só os números vêm da versão antiga.
  return { dados: (row?.dados ?? dadosAtual) as Dados, app: dadosAtual.APP };
}

/** Datas que o filtro pode mostrar com o pacote daquela época. */
export async function listaSnapshots(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const [{ data: atual }, { data: versoes }] = await Promise.all([
    db.from("hub_dados").select("snap:dados->H->>snapshot").eq("id", 1).maybeSingle(),
    db.from("hub_dados_hist").select("snap:dados->H->>snapshot").limit(1000),
  ]);
  const set = new Set<string>();
  if (atual?.snap) set.add(atual.snap);
  for (const v of versoes ?? []) if (v?.snap) set.add(v.snap);
  return Array.from(set).sort();
}

/* ---------------- Meta Ads ---------------- */

async function metaAcumulado(baseMA: any, corte: string, hoje: string, avisos: string[]) {
  if (!baseMA?.de_iso || !baseMA?.dia_iso) return null;
  const ate = corte >= hoje ? addDias(hoje, -1) : corte;
  if (ate < baseMA.de_iso) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { fetchAllRows } = await import("./fetch-all.server");
  const db = supabaseAdmin as any;
  const rows = await fetchAllRows((from, to) =>
    db
      .from("meta_insights_daily")
      .select("date,campaign_id,spend,leads", { count: "exact" })
      .gte("date", baseMA.de_iso)
      .lte("date", ate)
      .order("id")
      .range(from, to),
  );
  // Trava: o banco precisa reproduzir o período que o pacote já publicou.
  const noPacote = rows.filter((r: any) => r.date <= baseMA.dia_iso);
  const gPacote = noPacote.reduce((s: number, r: any) => s + Number(r.spend || 0), 0);
  const ref = Number(baseMA.g || 0);
  if (!(ref > 0) || Math.abs(gPacote - ref) / ref > 0.1) {
    avisos.push(
      `Meta Ads mantido do pacote: o banco tem R$ ${Math.round(gPacote)} no período publicado, o pacote R$ ${Math.round(ref)}.`,
    );
    return null;
  }
  const { data: camps } = await db.from("meta_campaigns").select("id,name");
  const nome = new Map<string, string>(((camps ?? []) as any[]).map((c) => [c.id, c.name]));
  const porCamp = new Map<string, { g: number; l: number }>();
  const dias = new Set<string>();
  for (const r of rows as any[]) {
    dias.add(r.date);
    const k = r.campaign_id ?? "sem-campanha";
    const c = porCamp.get(k) ?? { g: 0, l: 0 };
    c.g += Number(r.spend || 0);
    c.l += Number(r.leads || 0);
    porCamp.set(k, c);
  }
  const unidade = (n: string) => {
    const x = norm(n);
    if (x.includes("ponta grossa")) return "Filial Ponta Grossa";
    if (x.includes("londrina")) return "Filial Londrina";
    if (x.includes("wenceslau")) return "Sede Wenceslau Braz";
    return null;
  };
  const camp = Array.from(porCamp.entries())
    .map(([id, c]) => {
      const n = nome.get(id) ?? `campanha sem nome (#${String(id).slice(-6)})`;
      return { g: Math.round(c.g * 100) / 100, l: c.l, n, u: unidade(n) };
    })
    .sort((a, b) => b.g - a.g);
  const ultimo = Array.from(dias).sort().pop() ?? ate;
  return {
    ...baseMA,
    g: Math.round(camp.reduce((s, c) => s + c.g, 0) * 100) / 100,
    l: camp.reduce((s, c) => s + c.l, 0),
    camp,
    dias: dias.size,
    dia: diaLongo(ultimo),
    dia_iso: ultimo,
  };
}

/* ---------------- montagem ---------------- */

/**
 * Pacote da /dashhub com a camada ao vivo aplicada.
 * `corte` = dia de referência (YYYY-MM-DD); hoje = ao vivo.
 */
export async function montaDashhub(corteParam?: string | null) {
  const hoje = hojeBR();
  const corte =
    corteParam && /^\d{4}-\d{2}-\d{2}$/.test(corteParam) && corteParam < hoje ? corteParam : hoje;
  const aoVivo = corte === hoje;

  const cacheKey = corte;
  const ttl = aoVivo ? WON_TTL_MS : 30 * 60_000;
  const hit = resultCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttl) return { dados: hit.dados, live: hit.info };

  const { dados: base, app } = await carregaBase(corte, hoje);
  const dados: Dados = structuredClone({ ...base, APP: app });
  const avisos: string[] = [];
  const camposAoVivo: string[] = [];

  const H = (dados.H ??= {});
  H.snapshot = corte;
  H.ontem = addDias(corte, -1);

  const meses = mesesAte(corte);
  const mesAtual = meses[meses.length - 1];
  const anoAtual = corte.slice(0, 4);
  // 6 meses anteriores ao corrente (mesma regra do med6 do pacote)
  const seisAntes = meses.slice(-7, -1);

  try {
    const ganhos = (await ganhosComerciais()).filter((g) => g.date <= corte);

    // Vendas por mês
    H.mes ??= {};
    const vend: Record<string, { q: number; v: number }> = {};
    for (const m of meses) vend[m] = { q: 0, v: 0 };
    for (const g of ganhos) {
      const m = g.date.slice(0, 7);
      if (!vend[m]) continue;
      vend[m].q++;
      vend[m].v += g.amount;
    }
    for (const m of meses) vend[m].v = Math.round(vend[m].v);
    H.mes.vend = vend;
    camposAoVivo.push("vendas por mês");

    // Fichas dos vendedores
    const porDono = new Map<string, WonDeal[]>();
    for (const g of ganhos) {
      const k = norm(g.owner);
      const list = porDono.get(k) ?? [];
      list.push(g);
      porDono.set(k, list);
    }
    const mesesAno = meses.filter((m) => m.startsWith(anoAtual));
    for (const f of (H.fichas ?? []) as any[]) {
      const mine = porDono.get(norm(f.n)) ?? [];
      const doMes = (m: string) => mine.filter((g) => g.date.startsWith(m));
      const noAno = mine.filter((g) => g.date.startsWith(anoAtual));
      f.ano = noAno.length;
      f.vlrano = Math.round(noAno.reduce((s, g) => s + g.amount, 0));
      f.hist = mesesAno.map((m) => doMes(m).length);
      f.ago = doMes(mesAtual).length; // no pacote, "ago" = mês corrente
      f.jul = meses.length > 1 ? doMes(meses[meses.length - 2]).length : 0; // mês anterior
      const seis = seisAntes.map((m) => doMes(m).length);
      f.med6 = seis.length
        ? Math.round((seis.reduce((s, n) => s + n, 0) / seis.length) * 10) / 10
        : 0;
    }
    camposAoVivo.push("vendas por vendedor");
  } catch (e) {
    avisos.push(
      `Vendas mantidas do pacote (Ploomes indisponível: ${e instanceof Error ? e.message : e}).`,
    );
  }

  // Obras vêm do pacote (série da ANEEL): garante as chaves dos meses para o painel
  // não somar "undefined", sem inventar número para mês que o pacote não tem.
  H.mes ??= {};
  H.mes.ent ??= {};
  const semObras: string[] = [];
  for (const m of meses) {
    if (typeof H.mes.ent[m] !== "number") {
      H.mes.ent[m] = 0;
      semObras.push(m);
    }
  }
  if (semObras.length) avisos.push(`Obras sem dado no pacote para: ${semObras.join(", ")}.`);

  try {
    const ma = await metaAcumulado(dados.MA, corte, hoje, avisos);
    if (ma) {
      dados.MA = ma;
      camposAoVivo.push("Meta Ads");
    }
  } catch (e) {
    avisos.push(`Meta Ads mantido do pacote (${e instanceof Error ? e.message : e}).`);
  }

  const info: LiveInfo = {
    ao_vivo: aoVivo,
    corte,
    gerado_em: new Date().toISOString(),
    base_snapshot: base?.H?.snapshot ?? null,
    campos_ao_vivo: camposAoVivo,
    campos_do_pacote: [
      "obras entregues",
      "carteira em negociação",
      "esfriando / paradas",
      "agenda e aderência",
      "DISC",
      "mercado (ANEEL)",
    ],
    avisos,
  };
  dados.LIVE = info;
  resultCache.set(cacheKey, { at: Date.now(), dados, info });
  return { dados, live: info };
}
