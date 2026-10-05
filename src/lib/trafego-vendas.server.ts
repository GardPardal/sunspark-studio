// Server-only: cruzamento Meta Ads × Solar OS × Ploomes (só leitura nos três).
//
// Duas visões que se completam:
//  1. O que a Meta atribui a cada campanha/anúncio (gasto, Lead, QualifiedLead, Schedule,
//     Purchase) — possível porque os eventos de funil voltam pela CAPI com o clique (_fbc).
//  2. A verdade do CRM: leads que chegaram por anúncio (clique/UTM gravado no lead) e o
//     que viraram até a venda no Ploomes.

import { fetchAllRows } from "./fetch-all.server";

const DIA = 86400_000;
/** Campanhas da LZ7 Mob (outro produto, outro pixel) ficam fora da conta de energia solar. */
const FORA_SOLAR = /MOBILIDADE|\bMOB\b|E-?MOBILITY|ELETROPOSTO/i;
/** Lead que veio de anúncio da Meta: clique gravado ou UTM de Facebook/Instagram. */
const OR_ANUNCIO = [
  "fbclid.not.is.null",
  "fbc.not.is.null",
  "utm_source.ilike.%facebook%",
  "utm_source.ilike.%instagram%",
  "utm_source.ilike.%meta%",
  "utm_source.ilike.fb%",
  "utm_source.ilike.ig%",
].join(",");
const COLS =
  "id,nome,cidade,estado,created_at,stage,stage_updated_at,pipeline_stage_id,lead_quality,qualificacao_status,sale_value,assigned_to,ploomes_owner_id,ploomes_filial_id,origem,utm_campaign,utm_content,page_url,duplicado_de,fbclid,fbc";

export const META_VENDAS_MES = 30;

function db() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin as any);
}

/** Mês "YYYY-MM" em Brasília → intervalo ISO [de, ate). */
export function intervaloMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const de = new Date(Date.UTC(y, m - 1, 1, 3));
  const ate = new Date(Date.UTC(y, m, 1, 3));
  return {
    de: de.toISOString(),
    ate: ate.toISOString(),
    since: `${mes}-01`,
    until: new Date(ate.getTime() - DIA).toISOString().slice(0, 10),
  };
}

/* ---------------- Meta ---------------- */

export type LinhaMeta = {
  conta: string;
  campanhaId: string;
  campanha: string;
  conjunto: string;
  anuncioId: string;
  anuncio: string;
  gasto: number;
  cliques: number;
  leads: number;
  qualificados: number;
  reunioes: number;
  vendas: number;
  receita: number;
};

const soma = (acoes: any[] | undefined, teste: (t: string) => boolean, maior = true) => {
  const vals = (acoes ?? []).filter((a) => teste(a.action_type)).map((a) => Number(a.value) || 0);
  if (!vals.length) return 0;
  // vários tipos contam o mesmo evento (lead, offsite_conversion.fb_pixel_lead…): fica o maior
  return maior ? Math.max(...vals) : vals.reduce((x, y) => x + y, 0);
};

async function lerMeta(since: string, until: string) {
  const { getMetaAccountIds, metaFetch, metaFetchAll } = await import("./meta.server");
  const token = process.env.META_SYSTEM_USER_TOKEN;
  const contas = getMetaAccountIds();
  if (!token || !contas.length)
    return { linhas: [] as LinhaMeta[], erro: "Conexão com a Meta não configurada no servidor." };
  const linhas: LinhaMeta[] = [];
  const erros: string[] = [];
  for (const act of contas) {
    try {
      const info = await metaFetch(`/${act}?fields=name`, token).catch(() => ({ name: act }));
      const ccs = await metaFetchAll(
        `/${act}/customconversions?fields=id,name&limit=100`,
        token,
      ).catch(() => []);
      const ccQualificado = new Set(
        ccs
          .filter((c: any) => /qualifiedlead|qualificad/i.test(c.name))
          .map((c: any) => `offsite_conversion.custom.${c.id}`),
      );
      const range = encodeURIComponent(JSON.stringify({ since, until }));
      const rows = await metaFetchAll(
        `/${act}/insights?level=ad&time_range=${range}&limit=500&fields=campaign_id,campaign_name,adset_name,ad_id,ad_name,spend,inline_link_clicks,actions,action_values`,
        token,
      );
      for (const r of rows) {
        if (FORA_SOLAR.test(`${r.campaign_name} ${r.adset_name}`)) continue;
        const ehLead = (t: string) =>
          t === "lead" || t === "offsite_conversion.fb_pixel_lead" || t === "onsite_web_lead";
        const ehCompra = (t: string) =>
          t === "purchase" || t === "offsite_conversion.fb_pixel_purchase" || t === "omni_purchase";
        linhas.push({
          conta: info?.name ?? act,
          campanhaId: r.campaign_id,
          campanha: r.campaign_name,
          conjunto: r.adset_name,
          anuncioId: r.ad_id,
          anuncio: r.ad_name,
          gasto: Number(r.spend) || 0,
          cliques: Number(r.inline_link_clicks) || 0,
          leads: soma(r.actions, ehLead),
          qualificados: soma(
            r.actions,
            (t) => ccQualificado.has(t) || t === "offsite_conversion.fb_pixel_custom.QualifiedLead",
          ),
          reunioes: soma(r.actions, (t) => /schedule/i.test(t)),
          vendas: soma(r.actions, ehCompra),
          receita: soma(r.action_values, ehCompra),
        });
      }
    } catch (e) {
      erros.push(`${act}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  return { linhas, erro: erros.length ? erros.join(" | ") : null };
}

/* ---------------- Solar OS + Ploomes ---------------- */

export type LeadAnuncio = {
  id: string;
  nome: string;
  cidade: string | null;
  criadoEm: string;
  etapa: string | null;
  vendedor: string;
  qualificado: boolean;
  reuniao: boolean;
  venda: boolean;
  valor: number;
  campanha: string | null;
};

function classificar(l: any, reunioes: Set<number>) {
  const venda = l.stage === "venda" || l.stage === "faturado";
  const reuniao = venda || reunioes.has(Number(l.pipeline_stage_id));
  const qualificado =
    reuniao || l.lead_quality === "qualified" || l.qualificacao_status === "qualificado";
  return { venda, reuniao, qualificado };
}

const ehMob = (l: any) => /lz7store/i.test(String(l.page_url ?? ""));

export async function cruzamentoTrafego(mes: string) {
  const { de, ate, since, until } = intervaloMes(mes);
  const sb = await db();
  const { ETAPAS_REUNIAO } = await import("./meta-funil.server");
  const { nomesResponsaveis } = await import("./auditoria-quiz.server");
  const { ploomesStageLabel } = await import("./ploomes-stages");

  const [meta, criados, compras, nomes] = await Promise.all([
    lerMeta(since, until),
    // leads que chegaram por anúncio no mês
    fetchAllRows((from, to) =>
      sb
        .from("leads")
        .select(COLS, { count: "exact" })
        .or(OR_ANUNCIO)
        .gte("created_at", de)
        .lt("created_at", ate)
        .is("duplicado_de", null)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    // vendas registradas no mês (um Purchase por lead) — o lead pode ter chegado antes
    fetchAllRows((from, to) =>
      sb
        .from("conversion_events")
        .select("lead_id,created_at,value", { count: "exact" })
        .eq("platform", "meta_capi")
        .eq("event_name", "Purchase")
        .eq("status", "ok")
        .eq("test_mode", false)
        .gte("created_at", de)
        .lt("created_at", ate)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    nomesResponsaveis(),
  ]);

  const vendedorDe = (l: any) =>
    (l.assigned_to && nomes.porPerfil.get(l.assigned_to)?.nome) ||
    (l.ploomes_owner_id && nomes.porPloomes.get(Number(l.ploomes_owner_id))) ||
    "Sem responsável";

  const leads: LeadAnuncio[] = criados
    .filter((l: any) => !ehMob(l))
    .map((l: any) => {
      const c = classificar(l, ETAPAS_REUNIAO);
      return {
        id: l.id,
        nome: l.nome ?? "(sem nome)",
        cidade: l.cidade,
        criadoEm: l.created_at,
        etapa: l.pipeline_stage_id ? ploomesStageLabel(null, l.pipeline_stage_id) : l.stage,
        vendedor: vendedorDe(l),
        ...c,
        valor: c.venda ? Number(l.sale_value) || 0 : 0,
        campanha: l.utm_campaign,
      };
    });

  // Vendas do mês vindas de anúncio: Purchase no mês + vendas no mês sem evento (fallback)
  const idsCompra = Array.from(new Set(compras.map((c: any) => c.lead_id).filter(Boolean)));
  const vendidos: any[] = [];
  for (let i = 0; i < idsCompra.length; i += 150) {
    const { data } = await sb
      .from("leads")
      .select(COLS)
      .in("id", idsCompra.slice(i, i + 150))
      .or(OR_ANUNCIO);
    vendidos.push(...(data ?? []));
  }
  const { data: semEvento } = await sb
    .from("leads")
    .select(COLS)
    .or(OR_ANUNCIO)
    .in("stage", ["venda", "faturado"])
    .gte("stage_updated_at", de)
    .lt("stage_updated_at", ate)
    .is("duplicado_de", null)
    .limit(1000);
  const vistos = new Set(vendidos.map((l) => l.id));
  for (const l of semEvento ?? []) if (!vistos.has(l.id)) vendidos.push(l);
  const dataCompra = new Map<string, string>();
  for (const c of compras)
    if (c.lead_id && !dataCompra.has(c.lead_id)) dataCompra.set(c.lead_id, c.created_at);

  const vendasMes = vendidos
    .filter((l) => !ehMob(l))
    .map((l) => ({
      id: l.id,
      nome: l.nome ?? "(sem nome)",
      cidade: l.cidade,
      vendedor: vendedorDe(l),
      valor: Number(l.sale_value) || 0,
      leadEm: l.created_at,
      vendaEm: dataCompra.get(l.id) ?? l.stage_updated_at,
      campanha: l.utm_campaign,
    }))
    .sort((a, b) => (a.vendaEm < b.vendaEm ? 1 : -1));

  // ---------- consolidação ----------
  const metaTotal = meta.linhas.reduce(
    (t, r) => ({
      gasto: t.gasto + r.gasto,
      leads: t.leads + r.leads,
      qualificados: t.qualificados + r.qualificados,
      reunioes: t.reunioes + r.reunioes,
      vendas: t.vendas + r.vendas,
      receita: t.receita + r.receita,
    }),
    { gasto: 0, leads: 0, qualificados: 0, reunioes: 0, vendas: 0, receita: 0 },
  );
  const porCampanha = new Map<string, LinhaMeta>();
  for (const r of meta.linhas) {
    const k = r.campanhaId;
    const a = porCampanha.get(k);
    if (!a) porCampanha.set(k, { ...r, anuncio: "", anuncioId: "", conjunto: "" });
    else
      for (const f of [
        "gasto",
        "cliques",
        "leads",
        "qualificados",
        "reunioes",
        "vendas",
        "receita",
      ] as const)
        a[f] += r[f];
  }

  const crm = {
    leads: leads.length,
    qualificados: leads.filter((l) => l.qualificado).length,
    reunioes: leads.filter((l) => l.reuniao).length,
    vendas: leads.filter((l) => l.venda).length,
    receita: leads.reduce((s, l) => s + l.valor, 0),
  };
  const receitaMes = vendasMes.reduce((s, v) => s + v.valor, 0);

  // ritmo para a meta
  const agora = Date.now();
  const fimMes = new Date(ate).getTime();
  const iniMes = new Date(de).getTime();
  const diasPassados = Math.max(1, Math.min(fimMes, agora) - iniMes) / DIA;
  const diasRestantes = Math.max(0, (fimMes - agora) / DIA);
  const diasMes = (fimMes - iniMes) / DIA;
  const projecao = Math.round((vendasMes.length / diasPassados) * diasMes);

  const porVendedor = new Map<
    string,
    { leads: number; reunioes: number; vendas: number; receita: number }
  >();
  for (const l of leads) {
    const v = porVendedor.get(l.vendedor) ?? { leads: 0, reunioes: 0, vendas: 0, receita: 0 };
    v.leads++;
    if (l.reuniao) v.reunioes++;
    porVendedor.set(l.vendedor, v);
  }
  for (const s of vendasMes) {
    const v = porVendedor.get(s.vendedor) ?? { leads: 0, reunioes: 0, vendas: 0, receita: 0 };
    v.vendas++;
    v.receita += s.valor;
    porVendedor.set(s.vendedor, v);
  }

  return {
    mes,
    geradoEm: new Date().toISOString(),
    metaErro: meta.erro,
    metaTotal,
    campanhas: [...porCampanha.values()].sort((a, b) => b.gasto - a.gasto),
    anuncios: meta.linhas.sort((a, b) => b.gasto - a.gasto),
    crm,
    leads: leads.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)),
    vendasMes,
    receitaMes,
    custoPorLead: crm.leads ? metaTotal.gasto / crm.leads : null,
    custoPorVenda: vendasMes.length ? metaTotal.gasto / vendasMes.length : null,
    roas: metaTotal.gasto ? receitaMes / metaTotal.gasto : null,
    taxa: {
      leadQualificado: crm.leads ? crm.qualificados / crm.leads : null,
      leadReuniao: crm.leads ? crm.reunioes / crm.leads : null,
      reuniaoVenda: crm.reunioes ? crm.vendas / crm.reunioes : null,
      leadVenda: crm.leads ? crm.vendas / crm.leads : null,
    },
    metaVendas: {
      alvo: META_VENDAS_MES,
      feitas: vendasMes.length,
      faltam: Math.max(0, META_VENDAS_MES - vendasMes.length),
      porDia:
        diasRestantes > 0 ? Math.max(0, META_VENDAS_MES - vendasMes.length) / diasRestantes : null,
      projecao,
      diasRestantes: Math.ceil(diasRestantes),
    },
    porVendedor: [...porVendedor.entries()]
      .map(([vendedor, v]) => ({ vendedor, ...v }))
      .sort((a, b) => b.vendas - a.vendas || b.reunioes - a.reunioes || b.leads - a.leads),
  };
}

export type CruzamentoTrafego = Awaited<ReturnType<typeof cruzamentoTrafego>>;
