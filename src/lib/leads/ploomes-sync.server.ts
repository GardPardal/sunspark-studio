/**
 * Camada ÚNICA de sincronização CRM interno → Ploomes (API oficial, nunca o formulário público).
 *
 * Ordem: contato (buscar por ID salvo → telefone → CPF/CNPJ → e-mail) → criar/atualizar →
 *        negócio aberto do contato no funil de Pré-Vendas → criar/atualizar → salvar IDs.
 *
 * Nunca envia valor que o lead não tem. Campos desconhecidos ficam de fora do payload.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getLeadRules,
  isGenericName,
  logLeadEvent,
  maskPhone,
  phoneVariants,
} from "./lead-core.server";
import { baseMaisProxima, type BaseLZ7 } from "@/lib/geo/cobertura";

const API = "https://public-api2.ploomes.com";

/** IDs reais da conta LZ7 (conferidos via API em 2026-09-08). */
export const PLOOMES = {
  pipelinePreVendas: 60000132,
  stageNovoLead: 60002860,
  stageQualificacao: 60002763,
  /** Funil "Comercial / Energia Solar" — destino dos leads do quiz. */
  pipelineComercial: 10017344,
  stageComercialQualificacao: 10089963, // "💎 Qualificação do Lead (2D)"
  origins: { whatsapp: 60001180, trafegoPago: 60001315, metaAds: 10051759, site: 60001487 },
  tagTrafegoPago: 60151353, // Conecta (agência parceira)
  tagTrafegoInterno: 60155001, // Meta Ads / quiz operado pela própria LZ7
  fields: {
    filial: 60047430, // "Origem do Lead" (opções: filiais)
    captacao: 60047429, // "Como feita a captação do Lead?"
    produto: 60046984, // "Produto de interesse"
    gasto: 60046977, // "Gasto médio de energia?" (moeda)
    observacao: 60046839, // "Observação do Lead" (texto longo)
    cidadeEstado: 60046983, // "Cidade/Estado" (texto)
    padrao: 60001876, // "tipo do padrão requerido" (opções)
  },
  options: {
    filial: { londrina: 600965622, ponta_grossa: 609092593, wenceslau_braz: 600965621 } as Record<
      string,
      number
    >,
    captacao: {
      trafegoPago: 600965618,
      indicacao: 600965617,
      prospeccao: 600965616,
      reativacao: 601325073,
      ligacaoAtiva: 609758031,
    },
    produto: {
      energiaSolar: 600963971,
      onGrid: 609639465,
      hibrido: 609639466,
      aumento: 610311595,
      assinatura: 605306688,
    },
    padrao: { bifasico: 600005070, trifasico: 600005072 } as Record<string, number>,
  },
} as const;

/** Ploomes só grava OtherProperties quando enviamos a FieldKey (o FieldId é ignorado na escrita). Chaves reais da conta LZ7. */
const FIELD_KEYS: Record<number, string> = {
  60047430: "deal_27AEF74F-A5EC-480A-A94D-F815B652B131",
  60047429: "deal_C2222585-957A-4472-B9D7-D8A032788CCE",
  60046984: "deal_1D9171EF-BBFB-42B4-A565-021FA8607E0D",
  60046977: "deal_12288C30-0BD8-4090-9F4E-484C0D8BD5F7",
  60046839: "deal_7D82A94D-D7EE-4808-8324-63245F127387",
  60046983: "deal_5F36550E-846B-4A3B-9C52-4FA4BECA3AAD",
  60001876: "deal_7D93D845-850B-41FA-ACBE-82DF113BEF51",
};

class PloomesError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Ploomes ${status}: ${body.slice(0, 300)}`);
  }
}

async function pf<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const key = process.env.PLOOMES_USER_KEY || process.env.PLOOMES_API_KEY;
  if (!key) throw new PloomesError(0, "PLOOMES_USER_KEY não configurada");
  let lastErr: PloomesError | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: { "User-Key": key, Accept: "application/json", "Content-Type": "application/json" },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    if (res.ok) {
      try {
        return (text ? JSON.parse(text) : {}) as T;
      } catch {
        return {} as T;
      }
    }
    lastErr = new PloomesError(res.status, text);
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    throw lastErr;
  }
  throw lastErr!;
}

function esc(s: string) {
  return s.replace(/'/g, "''");
}

/* ---------------------------- Mapeamentos ---------------------------- */

export function classifyOrigin(lead: Record<string, any>): {
  contactOriginId: number | null;
  captacaoId: number | null;
  paid: boolean;
} {
  const txt = [
    lead.origem_principal,
    lead.origem,
    lead.utm_source,
    lead.utm_medium,
    lead.captacao_metodo,
    lead.canal,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const paid =
    /meta|facebook|instagram|\bads?\b|tr[aá]fego|paid|cpc|fbclid/.test(txt) ||
    Boolean(lead.fbclid) ||
    Boolean(lead.meta_lead_id);
  if (lead.ploomes_captacao_id) {
    return {
      contactOriginId: paid ? PLOOMES.origins.metaAds : null,
      captacaoId: Number(lead.ploomes_captacao_id),
      paid,
    };
  }
  if (paid)
    return {
      contactOriginId: PLOOMES.origins.metaAds,
      captacaoId: PLOOMES.options.captacao.trafegoPago,
      paid,
    };
  if (/indica/.test(txt))
    return { contactOriginId: null, captacaoId: PLOOMES.options.captacao.indicacao, paid };
  if (/site|wordpress|quiz|landing|elementor|web/.test(txt))
    return { contactOriginId: PLOOMES.origins.site, captacaoId: null, paid };
  if (/whats|zapi|wpp/.test(txt))
    return { contactOriginId: PLOOMES.origins.whatsapp, captacaoId: null, paid };
  return { contactOriginId: null, captacaoId: null, paid };
}

/** Texto de origem consolidado do lead (minúsculo, sem acento relevante). */
function originText(lead: Record<string, any>): string {
  return [
    lead.origem_principal,
    lead.origem,
    lead.utm_source,
    lead.utm_medium,
    lead.utm_campaign,
    lead.captacao_metodo,
    lead.canal,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Etiqueta do negócio:
 *  - "Tráfego Pago"    → mídia operada pela agência parceira (Conecta).
 *  - "Tráfego Interno" → quiz do site (mídia da própria LZ7).
 * Sem sinal claro, não etiqueta (nunca inventa).
 */
export function classifyTrafficTag(lead: Record<string, any>): number | null {
  // Regra da diretoria (30/09/2026): quiz = Tráfego Interno; Tráfego Pago = agência Conecta.
  // Os dois nunca se misturam e, sem sinal claro, não etiqueta (antes qualquer
  // anúncio/site virava "Tráfego Interno" por palpite).
  const txt = originText(lead);
  if (/quiz|interno/.test(txt)) return PLOOMES.tagTrafegoInterno;
  if (/conecta/.test(txt)) return PLOOMES.tagTrafegoPago;
  return null;
}

/**
 * Destino do negócio no Ploomes.
 * Leads do quiz e os cadastrados pela SDR em /sdr-leadqualified (já qualificados por ela)
 * vão para o funil "Comercial / Energia Solar", etapa "Qualificação do Lead".
 * Demais origens seguem no funil de Pré-Vendas, etapa "Novo Lead".
 */
export function classifyPipelineStage(lead: Record<string, any>): {
  pipelineId: number;
  stageId: number;
  fallbackStageId: number;
} {
  const cadastroSdr = lead.qualificado_por === "sdr" || lead.sistema_entrada === "sdr_form";
  if (cadastroSdr || /quiz/.test(originText(lead))) {
    return {
      pipelineId: PLOOMES.pipelineComercial,
      stageId: PLOOMES.stageComercialQualificacao,
      fallbackStageId: PLOOMES.stageComercialQualificacao,
    };
  }
  return {
    pipelineId: PLOOMES.pipelinePreVendas,
    stageId: PLOOMES.stageNovoLead,
    fallbackStageId: PLOOMES.stageNovoLead,
  };
}

/** Compat.: etapa dentro do funil escolhido. */
export function classifyStage(lead: Record<string, any>): number {
  return classifyPipelineStage(lead).stageId;
}

/** Filial só quando a cidade é reconhecida; nunca chuta. */
export async function resolveFilialStrict(
  cidade: string | null,
  estado: string | null,
): Promise<number | null> {
  if (!cidade) return null;
  const { resolveCityAndFilial } = await import("@/lib/ploomes.server");
  const r = resolveCityAndFilial(cidade, estado);
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s*-\s*(pr|sp)$/i, "")
      .trim();
  const inNorm = norm(cidade);
  const outNorm = norm(r.cidade);
  if (!inNorm || inNorm === "parana" || inNorm === "sao paulo") return null;
  if (outNorm.includes(inNorm.slice(0, 5)) || inNorm.includes(outNorm.slice(0, 5)))
    return r.filialId;
  return null;
}

/** Nome da cidade limpo, sem UF colada ("Londrina - PR", "Londrina/PR", "Londrina, PR"). */
export function cleanCityName(cidade: string | null | undefined): {
  name: string | null;
  uf: string | null;
} {
  const raw = (cidade ?? "").trim();
  if (!raw) return { name: null, uf: null };
  const m = raw.match(/^(.*?)[\s]*[-/,][\s]*([A-Za-z]{2})$/);
  const name = (m ? m[1] : raw).trim().replace(/\s{2,}/g, " ");
  const uf = m ? m[2].toUpperCase() : null;
  const norm = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!name || ["parana", "sao paulo", "brasil", "nao informado", "-"].includes(norm))
    return { name: null, uf };
  return { name, uf };
}

/** Busca a cidade oficial do Ploomes. Só devolve ID quando há UMA correspondência inequívoca. */
async function findCity(
  cidade: string | null,
  estado: string | null,
): Promise<{ id: number; name: string; uf: string | null } | null> {
  const { name, uf: ufFromName } = cleanCityName(cidade);
  if (!name) return null;
  const uf = (estado ?? "").trim().toUpperCase().slice(0, 2) || ufFromName || null;
  try {
    const filter = uf
      ? `Name eq '${esc(name.toUpperCase())}' and State/Short eq '${uf}'`
      : `Name eq '${esc(name.toUpperCase())}'`;
    const r = await pf<{
      value: Array<{ Id: number; Name: string; State: { Short: string } | null }>;
    }>(
      `/Cities?$filter=${encodeURIComponent(filter)}&$select=Id,Name&$expand=State($select=Short)&$top=3`,
    );
    const rows = (r.value ?? []).filter((c) => c.State?.Short); // ignora cidades avulsas sem estado
    if (rows.length !== 1) return null;
    return { id: rows[0].Id, name: rows[0].Name, uf: rows[0].State?.Short ?? uf };
  } catch {
    return null;
  }
}

async function findCityId(cidade: string | null, estado: string | null): Promise<number | null> {
  return (await findCity(cidade, estado))?.id ?? null;
}

/* ---------------------------- Busca de contato ---------------------------- */

type PContact = {
  Id: number;
  Name: string;
  Email?: string | null;
  CityId?: number | null;
  OriginId?: number | null;
  Phones?: Array<{ PhoneNumber: string }>;
  CreateDate?: string;
};

export async function findPloomesContacts(
  lead: Record<string, any>,
): Promise<{ primary: PContact | null; all: PContact[]; by: string }> {
  const sel =
    "$select=Id,Name,Email,CityId,OriginId,CreateDate&$expand=Phones($select=PhoneNumber)";
  if (lead.ploomes_contact_id) {
    try {
      const r = await pf<{ value: PContact[] }>(
        `/Contacts?$filter=Id eq ${Number(lead.ploomes_contact_id)}&${sel}`,
      );
      if (r.value?.[0]) return { primary: r.value[0], all: r.value, by: "ploomes_contact_id" };
    } catch {
      /* segue para busca por telefone */
    }
  }
  const found: PContact[] = [];
  if (lead.telefone_e164) {
    for (const v of phoneVariants(lead.telefone_e164)) {
      if (!/^\d{8,15}$/.test(v)) continue;
      const r = await pf<{ value: PContact[] }>(
        `/Contacts?$filter=Phones/any(p: p/SearchPhoneNumber eq ${v})&${sel}&$top=20`,
      );
      for (const c of r.value ?? []) if (!found.some((f) => f.Id === c.Id)) found.push(c);
    }
    if (found.length) return { primary: pickPrimary(found), all: found, by: "telefone" };
  }
  if (lead.cpf_cnpj) {
    const f =
      lead.cpf_cnpj.length > 11 ? `CNPJ eq '${lead.cpf_cnpj}'` : `CPF eq '${lead.cpf_cnpj}'`;
    try {
      const r = await pf<{ value: PContact[] }>(
        `/Contacts?$filter=${encodeURIComponent(f)}&${sel}&$top=5`,
      );
      if (r.value?.length) return { primary: pickPrimary(r.value), all: r.value, by: "cpf_cnpj" };
    } catch {
      /* campo pode não existir */
    }
  }
  if (lead.email) {
    const r = await pf<{ value: PContact[] }>(
      `/Contacts?$filter=Email eq '${esc(lead.email)}'&${sel}&$top=5`,
    );
    if (r.value?.length) return { primary: pickPrimary(r.value), all: r.value, by: "email" };
  }
  return { primary: null, all: [], by: "nenhum" };
}

function pickPrimary(list: PContact[]): PContact {
  // Mais antigo primeiro (é o cadastro "original"); duplicados ficam para o relatório de consolidação.
  return [...list].sort((a, b) =>
    String(a.CreateDate ?? "").localeCompare(String(b.CreateDate ?? "")),
  )[0];
}

type PDeal = {
  Id: number;
  Title: string;
  StatusId: number;
  PipelineId: number;
  StageId: number;
  OwnerId: number | null;
  CreateDate?: string;
};

async function findOpenDeal(contactId: number): Promise<{ deal: PDeal | null; all: PDeal[] }> {
  const r = await pf<{ value: PDeal[] }>(
    `/Deals?$filter=ContactId eq ${contactId} and StatusId eq 1&$select=Id,Title,StatusId,PipelineId,StageId,OwnerId,CreateDate&$orderby=CreateDate desc&$top=20`,
  );
  const all = r.value ?? [];
  const pre = all.find(
    (d) => d.PipelineId === PLOOMES.pipelineComercial || d.PipelineId === PLOOMES.pipelinePreVendas,
  );
  return { deal: pre ?? all[0] ?? null, all };
}

/* ---------------------------- Payloads ---------------------------- */

function buildObservacao(lead: Record<string, any>, extra?: { conversa?: string }) {
  const ni = "Não informado";
  const fatura =
    lead.valor_conta_num != null
      ? `R$ ${Number(lead.valor_conta_num).toFixed(2).replace(".", ",")}`
      : ni;
  const linhas = [
    `Solar OS · Lead ${lead.id}`,
    `Origem: ${lead.origem_principal ?? lead.origem ?? ni}${lead.campanha ? ` · Campanha: ${lead.campanha}` : ""}${lead.utm_campaign && !lead.campanha ? ` · Campanha: ${lead.utm_campaign}` : ""}`,
    lead.conjunto_anuncio || lead.anuncio
      ? `Anúncio: ${lead.anuncio ?? ni}${lead.conjunto_anuncio ? ` · Conjunto: ${lead.conjunto_anuncio}` : ""}`
      : null,
    `Canal: ${lead.canal ?? (lead.sistema_entrada === "zapi" ? "WhatsApp" : ni)} · Sistema de entrada: ${lead.sistema_entrada ?? ni}`,
    `Qualificado por: ${lead.qualificado_por ?? ni} · Status: ${lead.qualificacao_status}`,
    `Cidade: ${lead.cidade ? `${lead.cidade}${lead.estado ? ` - ${lead.estado}` : ""}` : ni}`,
    `Valor médio da fatura: ${fatura}`,
    `Tipo de ligação: ${lead.padrao_eletrico ?? ni}`,
    `Segmento: ${lead.segmento ?? ni} · Interesse: ${lead.produto_interesse ?? ni}`,
    `E-mail: ${lead.email ?? ni} · CPF/CNPJ: ${lead.cpf_cnpj ?? ni}`,
    `Fatura anexada: ${lead.fatura_url ?? ni}`,
    `Pendências: ${(lead.campos_pendentes ?? []).length ? (lead.campos_pendentes as string[]).join("; ") : "nenhuma"}`,
    lead.mensagem ? `Mensagem: ${String(lead.mensagem).slice(0, 600)}` : null,
    `Ficha: https://lz7energia.com.br/mod/leads?lead=${lead.id}`,
  ].filter(Boolean) as string[];
  if (extra?.conversa) linhas.push("", "Resumo da conversa:", extra.conversa.slice(0, 2500));
  return linhas.join("\n");
}

async function conversationExcerpt(lead: Record<string, any>): Promise<string | undefined> {
  if (!lead.wa_conversation_id) return undefined;
  const { data } = await supabaseAdmin
    .from("wa_messages")
    .select("direction, body, occurred_at, ai_generated")
    .eq("conversation_id", lead.wa_conversation_id)
    .not("body", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(20);
  if (!data?.length) return undefined;
  return [...data]
    .reverse()
    .map(
      (m: any) =>
        `${m.direction === "inbound" ? "Cliente" : m.ai_generated ? "Liz" : "LZ7"}: ${String(m.body).slice(0, 220)}`,
    )
    .join("\n");
}

async function buildDealOtherProperties(lead: Record<string, any>, existingFieldIds: Set<number>) {
  const F = PLOOMES.fields;
  const props: Array<Record<string, unknown>> = [];
  const put = (fieldId: number, value: Record<string, unknown>) => {
    if (existingFieldIds.has(fieldId)) return; // não sobrescreve o que o time já preencheu
    // Campos de opção: o Ploomes só grava quando recebe IntegerValue (validado em produção); ObjectValueId sozinho é ignorado.
    const v = "ObjectValueId" in value ? { ...value, IntegerValue: value.ObjectValueId } : value;
    props.push({ FieldId: fieldId, FieldKey: FIELD_KEYS[fieldId], ...v });
  };
  const { captacaoId } = classifyOrigin(lead);
  const filialId = lead.ploomes_filial_id
    ? Number(lead.ploomes_filial_id)
    : await resolveFilialStrict(lead.cidade, lead.estado);
  if (filialId) put(F.filial, { ObjectValueId: filialId });
  if (captacaoId) put(F.captacao, { ObjectValueId: captacaoId });
  const produtoId = lead.ploomes_produto_id
    ? Number(lead.ploomes_produto_id)
    : lead.produto_interesse && /solar|on.?grid|fotovolt/i.test(lead.produto_interesse)
      ? PLOOMES.options.produto.energiaSolar
      : null;
  if (produtoId) put(F.produto, { ObjectValueId: produtoId });
  if (lead.valor_conta_num != null) put(F.gasto, { DecimalValue: Number(lead.valor_conta_num) });
  // Cidade/Estado: nome limpo + UF confirmada no cadastro oficial de cidades do Ploomes.
  // Sem cidade informada pelo cliente, o campo fica em branco (nunca chuta).
  const cidadeInfo = cleanCityName(lead.cidade);
  if (cidadeInfo.name) {
    const official = await findCity(lead.cidade, lead.estado);
    const uf =
      official?.uf ??
      (String(lead.estado ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 2) ||
        cidadeInfo.uf) ??
      null;
    put(F.cidadeEstado, { StringValue: `${cidadeInfo.name}${uf ? ` - ${uf}` : ""}` });
  }

  if (lead.padrao_eletrico && PLOOMES.options.padrao[lead.padrao_eletrico])
    put(F.padrao, { ObjectValueId: PLOOMES.options.padrao[lead.padrao_eletrico] });
  // Observação sempre atualizada (é o nosso espelho)
  props.push({
    FieldId: F.observacao,
    FieldKey: FIELD_KEYS[F.observacao],
    BigStringValue: buildObservacao(lead, { conversa: await conversationExcerpt(lead) }),
  });
  return props;
}

/* ---------------------- Quiz do site: SOMENTE CRIAÇÃO ---------------------- */

/**
 * Regras do lead que entra pelo quiz (definidas pela diretoria em 2026-09-30):
 *  1. Nunca edita nem apaga nada no Ploomes (nenhum PATCH/DELETE em contato ou negócio que já existe).
 *  2. Só sobe o lead: funil "Comercial / Energia Solar", etapa "💎 Qualificação do Lead",
 *     etiqueta "Tráfego Interno", produto "Energia Solar", captação "Tráfego pago".
 *     A etiqueta nunca é "Tráfego Pago" (essa identifica a agência Conecta).
 *     Responsável: vendedor da roleta da unidade mais próxima (ROLETA_QUIZ, 08/10/2026);
 *     cidade não reconhecida, unidade com todos penalizados, híbrido "só quero saber valores"
 *     ou quiz rápido (linha de volume) fica com a Stephany.
 *  3. Contato já existe (mesmo telefone) → reaproveita sem alterar nada nele.
 *     Já tem negócio ABERTO no Comercial / Energia Solar → não cria outro, só vincula no CRM.
 *  4. Campos só com o que o cliente respondeu. Faixa de gasto não vira valor exato:
 *     vai na observação (o campo moeda fica para o time).
 */
export const QUIZ_RULES = {
  ownerId: 60022664, // Stephany Martins (conferido via API /Users em 2026-09-30)
  pipelineId: PLOOMES.pipelineComercial,
  stageId: PLOOMES.stageComercialQualificacao,
  /** Quiz = Tráfego Interno (mídia da LZ7). NUNCA "Tráfego pago", que é a agência Conecta. */
  tagId: PLOOMES.tagTrafegoInterno,
  originId: PLOOMES.origins.site,
  produtoId: PLOOMES.options.produto.energiaSolar,
} as const;

/**
 * Roleta de vendedores do quiz, na ordem definida pela diretoria em 08/10/2026.
 * O lead vai para a unidade mais próxima da cidade (linha reta) e, dentro dela,
 * para quem vem depois do último que recebeu; no fim da fila volta ao primeiro.
 */
export const ROLETA_QUIZ: Record<BaseLZ7, number[]> = {
  londrina: [
    60022710, // Maycom Cristian
    60021972, // Guilherme Luis
    60028430, // Mycaela Silva
    60031649, // Victor Hugo Victorino
  ],
  wenceslau_braz: [
    60002525, // Eduarda Juraski (Duda)
    60030345, // Alessandra Gomes
    60033605, // Taciano Monteiro
  ],
  ponta_grossa: [
    60031584, // Kamily Meira
    60033059, // Rodrigo Costa
  ],
};

/** Nome de cada vendedor da roleta (para telas e avisos). */
export const NOMES_ROLETA: Record<number, string> = {
  60022710: "Maycom",
  60021972: "Guilherme",
  60028430: "Mycaela",
  60031649: "Victor Hugo",
  60002525: "Duda",
  60030345: "Alessandra",
  60033605: "Taciano",
  60031584: "Kamily",
  60033059: "Rodrigo",
};

/** Evento que guarda a vez da roleta (detail: { base, owner_id }). */
export const ROLETA_EVENT = "quiz.roleta";

/**
 * Penalidade da roleta (supervisão, 08/10/2026): quem tem 3 ou mais leads de tráfego pago
 * parados em "Qualificação do Lead" sem interação há mais de 3 dias fica 5 dias sem receber.
 */
export const ROLETA_PENALIDADE = { abandonados: 3, diasParado: 3, diasFora: 5 } as const;

/** Evento da penalidade (detail: { owner_id, base, ate, deals }). */
export const ROLETA_PENALIDADE_EVENT = "quiz.roleta.penalidade";

const DIA_MS = 86_400_000;

/** Vendedores da fila que estão fora da roleta agora; aplica a penalidade a quem passou do limite. */
export type LeadParado = { dealId: number; nome: string; dias: number };

/**
 * Leads de tráfego pago abertos em "Qualificação do Lead" sem interação há mais de
 * ROLETA_PENALIDADE.diasParado dias, por vendedor. Sem interação nenhuma conta da criação.
 */
export async function leadsParadosPorVendedor(
  vendedores: number[],
): Promise<Map<number, LeadParado[]>> {
  const agora = Date.now();
  const filter =
    `StatusId eq 1 and PipelineId eq ${PLOOMES.pipelineComercial}` +
    ` and StageId eq ${PLOOMES.stageComercialQualificacao} and OwnerId in (${vendedores.join(",")})`;
  const r = await pf<{
    value: Array<{
      Id: number;
      Title: string;
      OwnerId: number;
      CreateDate: string;
      LastInteractionRecord?: { CreateDate: string } | null;
      OtherProperties?: Array<{ FieldId: number; IntegerValue?: number | null }>;
    }>;
  }>(
    `/Deals?$filter=${encodeURIComponent(filter)}&$select=Id,Title,OwnerId,CreateDate` +
      `&$expand=LastInteractionRecord($select=CreateDate),OtherProperties($filter=FieldId eq ${PLOOMES.fields.captacao};$select=FieldId,IntegerValue)&$top=500`,
  );
  const parados = new Map<number, LeadParado[]>();
  for (const d of r.value ?? []) {
    const pago = d.OtherProperties?.some(
      (o) =>
        o.FieldId === PLOOMES.fields.captacao &&
        o.IntegerValue === PLOOMES.options.captacao.trafegoPago,
    );
    const dias = (agora - Date.parse(d.LastInteractionRecord?.CreateDate ?? d.CreateDate)) / DIA_MS;
    if (pago && dias > ROLETA_PENALIDADE.diasParado)
      parados.set(d.OwnerId, [
        ...(parados.get(d.OwnerId) ?? []),
        { dealId: d.Id, nome: d.Title, dias: Math.floor(dias) },
      ]);
  }
  return parados;
}

/** Penalidades em vigor: vendedor → data em que volta para a roleta. */
export async function penalidadesAtivas(vendedores: number[]): Promise<Map<number, string>> {
  const agora = Date.now();
  const { data } = await (supabaseAdmin as any)
    .from("lead_events")
    .select("detail")
    .eq("event", ROLETA_PENALIDADE_EVENT)
    .gte("created_at", new Date(agora - ROLETA_PENALIDADE.diasFora * DIA_MS).toISOString());
  const out = new Map<number, string>();
  for (const ev of data ?? []) {
    const id = Number(ev.detail?.owner_id);
    const ate = String(ev.detail?.ate ?? "");
    if (
      vendedores.includes(id) &&
      Date.parse(ate) > agora &&
      !(Date.parse(out.get(id) ?? "") > Date.parse(ate))
    )
      out.set(id, ate);
  }
  return out;
}

/** Próximo da fila depois do último que recebeu (sem olhar penalidade). */
export async function ultimoDaRoleta(base: BaseLZ7): Promise<number | null> {
  const { data } = await (supabaseAdmin as any)
    .from("lead_events")
    .select("detail")
    .eq("event", ROLETA_EVENT)
    .eq("detail->>base", base)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.detail?.owner_id ? Number(data.detail.owner_id) : null;
}

async function penalizadosNaFila(
  base: BaseLZ7,
  fila: number[],
  dryRun: boolean,
): Promise<Set<number>> {
  const agora = Date.now();
  const fora = new Set<number>((await penalidadesAtivas(fila)).keys());
  const avaliar = fila.filter((id) => !fora.has(id));
  if (!avaliar.length) return fora;
  let parados: Map<number, LeadParado[]>;
  try {
    parados = await leadsParadosPorVendedor(avaliar);
  } catch {
    return fora; // Ploomes fora do ar: não penaliza ninguém por falta de dado
  }
  for (const [ownerId, leads] of parados) {
    if (leads.length < ROLETA_PENALIDADE.abandonados) continue;
    const ids = leads.map((l) => l.dealId);
    fora.add(ownerId);
    if (dryRun) continue;
    const ate = new Date(agora + ROLETA_PENALIDADE.diasFora * DIA_MS).toISOString();
    await logLeadEvent({
      event: ROLETA_PENALIDADE_EVENT,
      step: "roleta",
      result: `${ownerId} fora da roleta ${base} até ${ate.slice(0, 10)}: ${ids.length} leads parados`,
      detail: { owner_id: ownerId, base, ate, deals: ids },
    });
  }
  return fora;
}

/**
 * Próximo vendedor da roleta para a cidade do lead, pulando os penalizados.
 * null quando a cidade não é reconhecida; vendedor=false quando a unidade inteira está penalizada
 * (o lead fica com a Stephany e a vez não anda).
 */
async function proximoDaRoleta(
  cidade: string | null,
  estado: string | null,
  dryRun = false,
): Promise<{ base: BaseLZ7; ownerId: number; vendedor: boolean; pulados: number[] } | null> {
  const c = cleanCityName(cidade);
  const base = baseMaisProxima(
    c.name,
    String(estado ?? "")
      .trim()
      .slice(0, 2) || c.uf,
  );
  if (!base) return null;
  const fila = ROLETA_QUIZ[base];
  const ultimo = fila.indexOf(Number(await ultimoDaRoleta(base)));
  const fora = await penalizadosNaFila(base, fila, dryRun);
  const pulados: number[] = [];
  for (let k = 1; k <= fila.length; k++) {
    const id = fila[(ultimo + k) % fila.length];
    if (!fora.has(id)) return { base, ownerId: id, vendedor: true, pulados };
    pulados.push(id);
  }
  return { base, ownerId: QUIZ_RULES.ownerId, vendedor: false, pulados };
}

/** Tipo de contato no Ploomes: 1 = Empresa, 2 = Pessoa. */
const CONTACT_TYPE = { empresa: 1, pessoa: 2 } as const;

export function isQuizLead(lead: Record<string, any>): boolean {
  return /quiz/.test(originText(lead));
}

/** Evento gravado pelo /api/public/lead quando o lead envia o quiz (vale também para quem já existia). */
export const QUIZ_EVENT = "quiz.enviado";

/**
 * O lead passou pelo quiz? Olha a origem e, para quem já existia no CRM antes do quiz
 * (o cadastro por telefone não sobrescreve origem/mensagem), o evento QUIZ_EVENT.
 */
export async function leadCameFromQuiz(lead: Record<string, any>): Promise<boolean> {
  if (isQuizLead(lead)) return true;
  if (!lead.id) return false;
  const { count } = await (supabaseAdmin as any)
    .from("lead_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id)
    .eq("event", QUIZ_EVENT);
  return (count ?? 0) > 0;
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Respostas do quiz a partir da mensagem ("• Padrão de entrada: Bifásico (110 e 220)"). */
export function quizAnswers(mensagem: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of String(mensagem ?? "").split(/\r?\n/)) {
    const m = line.match(/^\s*[•*-]\s*([^:]+):\s*(.+)$/);
    if (m) out[semAcento(m[1])] = m[2].trim();
  }
  return out;
}

function quizPadrao(resp: Record<string, string>): number | null {
  const p = semAcento(resp["padrao de entrada"] ?? "");
  if (p.startsWith("bifasico")) return PLOOMES.options.padrao.bifasico;
  if (p.startsWith("trifasico")) return PLOOMES.options.padrao.trifasico;
  return null; // monofásico não tem opção no Ploomes; "não sei" fica em branco
}

function quizObservacao(L: Record<string, any>) {
  const cidade = L.cidade ? `${L.cidade}${L.estado ? `/${L.estado}` : ""}` : "Não informada";
  const respostas = String(L.mensagem ?? "")
    .split(/\r?\n/)
    .filter((l) => /^\s*[•*-]/.test(l))
    .join("\n");
  return [
    "Lead do quiz do site (cadastro automático do Solar OS).",
    `Cidade: ${cidade}`,
    respostas || null,
    L.utm_campaign ? `Campanha: ${L.utm_campaign}` : null,
    L.utm_content
      ? `Anúncio: ${L.utm_content}${L.utm_term ? ` · Conjunto: ${L.utm_term}` : ""}`
      : null,
    L.utm_source ? `Fonte: ${L.utm_source}${L.utm_medium ? ` / ${L.utm_medium}` : ""}` : null,
    `Ficha: https://lz7energia.com.br/mod/leads?lead=${L.id}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function quizDealProperties(L: Record<string, any>, base: BaseLZ7 | null) {
  const F = PLOOMES.fields;
  const resp = quizAnswers(L.mensagem);
  const props: Array<Record<string, unknown>> = [];
  const opt = (fieldId: number, id: number) =>
    props.push({ FieldKey: FIELD_KEYS[fieldId], IntegerValue: id });
  // Quiz do híbrido: quem topou o investimento (à vista ou financiado) vira produto "Híbrido".
  const invest = resp["investimento no hibrido"];
  const querHibrido = invest && /^(À vista|Financiado)/.test(invest);
  opt(F.produto, querHibrido ? PLOOMES.options.produto.hibrido : QUIZ_RULES.produtoId);
  opt(F.captacao, PLOOMES.options.captacao.trafegoPago);
  // Unidade = a mesma da roleta (mais próxima), para vendedor e filial nunca divergirem.
  const filialId = base
    ? PLOOMES.options.filial[base]
    : await resolveFilialStrict(L.cidade, L.estado);
  if (filialId) opt(F.filial, filialId);
  const padrao = quizPadrao(resp);
  if (padrao) opt(F.padrao, padrao);
  const cidadeInfo = cleanCityName(L.cidade);
  if (cidadeInfo.name) {
    const uf =
      String(L.estado ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 2) || cidadeInfo.uf;
    props.push({
      FieldKey: FIELD_KEYS[F.cidadeEstado],
      StringValue: `${cidadeInfo.name}${uf ? ` - ${uf}` : ""}`,
    });
  }
  props.push({ FieldKey: FIELD_KEYS[F.observacao], BigStringValue: quizObservacao(L) });
  return props;
}

/**
 * Sobe um lead do quiz para o Ploomes seguindo QUIZ_RULES. Só faz GET e POST;
 * a única escrita depois do POST é devolver o responsável da roleta no negócio
 * que acabou de ser criado aqui, se a distribuição automática do Ploomes trocar.
 */
async function syncQuizLead(
  L: Record<string, any>,
  dryRun: boolean,
): Promise<{
  contactId: number;
  dealId: number;
  createdContact: boolean;
  createdDeal: boolean;
  duplicates: number[];
  pipelineId: number;
  stageId: number;
  ownerId: number;
  plan: Record<string, unknown>;
}> {
  // Lead que já existia antes do quiz: respostas e cidade vêm do evento do quiz.
  if (!/^\s*[•*-]/m.test(String(L.mensagem ?? "")) && L.id) {
    const { data: ev } = await (supabaseAdmin as any)
      .from("lead_events")
      .select("detail")
      .eq("lead_id", L.id)
      .eq("event", QUIZ_EVENT)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const d = (ev?.detail ?? {}) as Record<string, string | null>;
    L = {
      ...L,
      mensagem: d.mensagem ?? L.mensagem,
      cidade: L.cidade ?? d.cidade ?? null,
      estado: L.estado ?? d.estado ?? null,
    };
  }
  const phoneDigits = String(L.telefone_e164).replace(/\D/g, "");
  const contactOriginId = QUIZ_RULES.originId;
  const plan: Record<string, unknown> = { regra: "quiz: somente criação" };
  // Híbrido "só quero saber valores" e quiz rápido (linha de volume): a SDR qualifica antes;
  // não gasta a vez nem penaliza vendedor.
  const resp = quizAnswers(L.mensagem);
  const paraSdr =
    /^Por enquanto/i.test(resp["investimento no hibrido"] ?? "") ||
    /^Rapido/i.test(semAcento(resp["versao do quiz"] ?? ""));
  const roleta = paraSdr ? null : await proximoDaRoleta(L.cidade, L.estado, dryRun);
  const ownerId = roleta?.ownerId ?? QUIZ_RULES.ownerId;
  plan.roleta =
    roleta ??
    (paraSdr
      ? "quiz rápido ou híbrido só valores: fica com a Stephany"
      : "cidade não reconhecida: fica com a Stephany");

  // 1) Contato: reaproveita o existente SEM alterar; senão cria.
  const found = await findPloomesContacts(L);
  const duplicates = found.all.filter((c) => c.Id !== found.primary?.Id).map((c) => c.Id);
  plan.found_by = found.by;
  let contactId = found.primary?.Id ?? 0;
  let createdContact = false;
  if (!found.primary) {
    const body: Record<string, unknown> = {
      Name: isGenericName(L.nome) ? `Não informado (${maskPhone(L.telefone_e164)})` : L.nome,
      TypeId: CONTACT_TYPE.pessoa,
      Phones: [{ PhoneNumber: phoneDigits, TypeId: 2, CountryId: 76 }],
      OwnerId: ownerId,
      Register: `solaros:${L.id}`,
      Note: quizObservacao(L),
    };
    if (L.email) body.Email = L.email;
    const cityId = await findCityId(L.cidade, L.estado);
    if (cityId) body.CityId = cityId;
    if (contactOriginId) body.OriginId = contactOriginId;
    plan.contact_create = body;
    if (!dryRun) {
      const created = await pf<{ value?: Array<{ Id: number }> }>("/Contacts", {
        method: "POST",
        body,
      });
      contactId = created.value?.[0]?.Id ?? (created as any).Id;
      if (!contactId) throw new PloomesError(500, "Ploomes não retornou o ID do contato");
      createdContact = true;
    }
  }

  // 2) Negócio: já existe aberto no Comercial / Energia Solar → só vincula.
  if (contactId) {
    const { all } = await findOpenDeal(contactId);
    const aberto = all.find((d) => d.PipelineId === QUIZ_RULES.pipelineId);
    if (aberto) {
      plan.deal_existente = aberto.Id;
      return {
        contactId,
        dealId: aberto.Id,
        createdContact,
        createdDeal: false,
        duplicates,
        pipelineId: aberto.PipelineId,
        stageId: aberto.StageId,
        ownerId: aberto.OwnerId ?? QUIZ_RULES.ownerId,
        plan,
      };
    }
  }

  const body: Record<string, unknown> = {
    Title: isGenericName(L.nome) ? `Lead ${maskPhone(L.telefone_e164)}` : L.nome,
    ContactId: contactId,
    PipelineId: QUIZ_RULES.pipelineId,
    StageId: QUIZ_RULES.stageId,
    OwnerId: ownerId,
    OtherProperties: await quizDealProperties(L, roleta?.base ?? null),
  };
  body.OriginId = contactOriginId;
  // Sempre "Tráfego Interno": é a etiqueta que identifica o quiz no Ploomes.
  body.Tags = [{ TagId: QUIZ_RULES.tagId }];
  plan.deal_create = { ...body, OtherProperties: (body.OtherProperties as unknown[]).length };
  if (dryRun)
    return {
      contactId,
      dealId: 0,
      createdContact: !found.primary,
      createdDeal: true,
      duplicates,
      pipelineId: QUIZ_RULES.pipelineId,
      stageId: QUIZ_RULES.stageId,
      ownerId,
      plan,
    };

  let created: any;
  try {
    created = await pf("/Deals", { method: "POST", body });
  } catch (e) {
    // Conta recusou a Origem: reenvia sem ela, mantendo a etiqueta "Tráfego Interno".
    // Só em último caso cria sem a etiqueta (melhor que perder o lead) e registra o aviso.
    // Nunca muda funil, etapa ou responsável.
    if (!(e instanceof PloomesError && e.status === 400)) throw e;
    delete body.OriginId;
    try {
      created = await pf("/Deals", { method: "POST", body });
    } catch (e2) {
      if (!(e2 instanceof PloomesError && e2.status === 400)) throw e2;
      delete body.Tags;
      plan.aviso = "negócio criado SEM a etiqueta Tráfego Interno (Ploomes recusou a etiqueta)";
      created = await pf("/Deals", { method: "POST", body });
    }
  }
  const dealId: number = created.value?.[0]?.Id ?? created.Id;
  if (!dealId) throw new PloomesError(500, "Ploomes não retornou o ID do negócio");

  // A distribuição automática do Ploomes pode trocar o responsável logo após a criação.
  // Confere e, só se mudou, devolve para o vendedor da roleta — apenas neste negócio recém-criado.
  try {
    const chk = await pf<{ value: Array<{ OwnerId: number | null }> }>(
      `/Deals?$filter=Id eq ${dealId}&$select=Id,OwnerId`,
    );
    if (chk.value?.[0] && chk.value[0].OwnerId !== ownerId)
      await pf(`/Deals(${dealId})`, { method: "PATCH", body: { OwnerId: ownerId } });
  } catch {
    /* melhor esforço */
  }
  // Passa a vez da roleta só depois do negócio criado (lead perdido não consome a vez).
  if (roleta?.vendedor)
    await logLeadEvent({
      lead_id: L.id,
      phone: L.telefone_e164,
      event: ROLETA_EVENT,
      step: "ploomes",
      result: `roleta ${roleta.base} → ${roleta.ownerId}`,
      external_ids: { ploomes_deal_id: dealId },
      detail: { base: roleta.base, owner_id: roleta.ownerId },
    });

  return {
    contactId,
    dealId,
    createdContact,
    createdDeal: true,
    duplicates,
    pipelineId: QUIZ_RULES.pipelineId,
    stageId: QUIZ_RULES.stageId,
    ownerId,
    plan,
  };
}

/* ---------------------------- Sincronização ---------------------------- */

export type SyncOutcome =
  | {
      ok: true;
      contactId: number;
      dealId: number;
      createdContact: boolean;
      createdDeal: boolean;
      duplicates: number[];
    }
  | { ok: false; retry: boolean; error: string; status?: number };

export async function syncLeadToPloomes(
  leadId: string,
  opts: { dryRun?: boolean } = {},
): Promise<SyncOutcome & { plan?: Record<string, unknown> }> {
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, retry: false, error: "lead não encontrado" };
  const L = lead as Record<string, any>;
  if (L.duplicado_de)
    return { ok: false, retry: false, error: `lead marcado como duplicado de ${L.duplicado_de}` };
  if (!L.telefone_e164) return { ok: false, retry: false, error: "telefone inválido" };

  const rules = await getLeadRules();
  const phoneDigits = String(L.telefone_e164).replace(/\D/g, "");
  const ownerId = L.ploomes_owner_id ? Number(L.ploomes_owner_id) : rules.defaultOwnerId;
  const { contactOriginId } = classifyOrigin(L);
  const trafficTagId = classifyTrafficTag(L);
  const { pipelineId, stageId, fallbackStageId } = classifyPipelineStage(L);

  // Trava por lead (compare-and-set no banco): duas execuções simultâneas do mesmo lead
  // (fila + chamada direta, ou dois webhooks) criavam contato/negócio em duplicidade no Ploomes.
  let locked = false;
  if (!opts.dryRun) {
    const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: lockRows } = await supabaseAdmin
      .from("leads")
      .update({ ploomes_sync_lock_at: new Date().toISOString() } as never)
      .eq("id", leadId)
      .or(`ploomes_sync_lock_at.is.null,ploomes_sync_lock_at.lt.${staleBefore}`)
      .select("id");
    if (!lockRows?.length) {
      return {
        ok: false,
        retry: true,
        error: "sincronização deste lead já em andamento (trava de 2 min)",
      };
    }
    locked = true;
  }
  const releaseLock = async () => {
    if (!locked) return;
    locked = false;
    await supabaseAdmin
      .from("leads")
      .update({ ploomes_sync_lock_at: null } as never)
      .eq("id", leadId);
  };

  try {
    // Quiz do site: regra própria, somente criação (ver QUIZ_RULES).
    if (await leadCameFromQuiz(L)) {
      const q = await syncQuizLead(L, Boolean(opts.dryRun));
      if (opts.dryRun) {
        const { plan, pipelineId: _p, stageId: _s, ownerId: _o, ...rest } = q;
        return { ok: true, ...rest, plan };
      }
      await supabaseAdmin
        .from("leads")
        .update({
          ploomes_contact_id: q.contactId,
          ploomes_deal_id: q.dealId,
          ploomes_owner_id: q.createdDeal ? q.ownerId : (L.ploomes_owner_id ?? null),
          external_source: L.external_source ?? "ploomes",
          external_id: L.external_id ?? String(q.contactId),
          pipeline_id: q.pipelineId,
          pipeline_stage_id: q.stageId,
          ploomes_sync_status: "sincronizado",
          ploomes_synced_at: new Date().toISOString(),
          ploomes_sync_error: null,
          last_synced_at: new Date().toISOString(),
          ploomes_sync_lock_at: null,
        } as never)
        .eq("id", leadId);
      locked = false;
      await logLeadEvent({
        lead_id: leadId,
        phone: L.telefone_e164,
        event: "sync.ok",
        source: L.origem_principal,
        step: "ploomes",
        result: `quiz · ${q.createdContact ? "contato criado" : "contato existente (sem alteração)"} · ${q.createdDeal ? "negócio criado no Comercial/Qualificação" : "negócio aberto já existia (sem alteração)"}`,
        external_ids: {
          ploomes_contact_id: q.contactId,
          ploomes_deal_id: q.dealId,
          duplicates: q.duplicates,
        },
        detail: q.plan,
      });
      return {
        ok: true,
        contactId: q.contactId,
        dealId: q.dealId,
        createdContact: q.createdContact,
        createdDeal: q.createdDeal,
        duplicates: q.duplicates,
      };
    }

    // 1) Contato
    const found = await findPloomesContacts(L);
    const duplicates = found.all.filter((c) => c.Id !== found.primary?.Id).map((c) => c.Id);
    let contactId: number;
    let createdContact = false;
    const plan: Record<string, unknown> = { found_by: found.by, duplicates };

    if (found.primary) {
      contactId = found.primary.Id;
      const patch: Record<string, unknown> = {};
      if (isGenericName(found.primary.Name) && !isGenericName(L.nome)) patch.Name = L.nome;
      if (!found.primary.Email && L.email) patch.Email = L.email;
      if (!found.primary.CityId) {
        const cityId = await findCityId(L.cidade, L.estado);
        if (cityId) patch.CityId = cityId;
      }
      if (!found.primary.OriginId && contactOriginId) patch.OriginId = contactOriginId;
      const hasPhone = (found.primary.Phones ?? []).some((p) =>
        phoneVariants(L.telefone_e164).includes(String(p.PhoneNumber).replace(/\D/g, "")),
      );
      if (!hasPhone)
        patch.Phones = [
          ...(found.primary.Phones ?? []).map((p) => ({ PhoneNumber: p.PhoneNumber })),
          { PhoneNumber: phoneDigits, TypeId: 2, CountryId: 76 },
        ];
      plan.contact_patch = patch;
      if (Object.keys(patch).length && !opts.dryRun)
        await pf(`/Contacts(${contactId})`, { method: "PATCH", body: patch });
    } else {
      const body: Record<string, unknown> = {
        Name: isGenericName(L.nome) ? `Não informado (${maskPhone(L.telefone_e164)})` : L.nome,
        // 1 = Empresa (CNPJ), 2 = Pessoa (antes estava invertido)
        TypeId:
          L.cpf_cnpj && String(L.cpf_cnpj).length > 11 ? CONTACT_TYPE.empresa : CONTACT_TYPE.pessoa,
        Phones: [{ PhoneNumber: phoneDigits, TypeId: 2, CountryId: 76 }],
        Register: `solaros:${L.id}`,
      };
      if (L.email) body.Email = L.email;
      if (L.cpf_cnpj) body[String(L.cpf_cnpj).length > 11 ? "CNPJ" : "CPF"] = L.cpf_cnpj;
      const cityId = await findCityId(L.cidade, L.estado);
      if (cityId) body.CityId = cityId;
      if (contactOriginId) body.OriginId = contactOriginId;
      if (ownerId) body.OwnerId = ownerId;
      plan.contact_create = body;
      if (opts.dryRun) {
        contactId = 0;
      } else {
        const created = await pf<{ value?: Array<{ Id: number }> }>("/Contacts", {
          method: "POST",
          body,
        });
        contactId = created.value?.[0]?.Id ?? (created as any).Id;
        if (!contactId) throw new PloomesError(500, "Ploomes não retornou o ID do contato");
        createdContact = true;
      }
    }

    // 2) Negócio
    let dealId = 0;
    let createdDeal = false;
    const existing = contactId ? await findOpenDeal(contactId) : { deal: null, all: [] };
    if (L.ploomes_deal_id && !existing.all.some((d) => d.Id === Number(L.ploomes_deal_id))) {
      // negócio salvo pode estar fechado; ainda assim é "o" negócio deste lead salvo por nós
      try {
        const r = await pf<{ value: PDeal[] }>(
          `/Deals?$filter=Id eq ${Number(L.ploomes_deal_id)}&$select=Id,Title,StatusId,PipelineId,StageId,OwnerId`,
        );
        if (r.value?.[0] && r.value[0].StatusId === 1) existing.deal = r.value[0];
      } catch {
        /* ignora */
      }
    }

    if (existing.deal) {
      dealId = existing.deal.Id;
      const cur = await pf<{
        value: Array<{
          OtherProperties: Array<{
            FieldId: number;
            ObjectValueId?: number;
            DecimalValue?: number;
            StringValue?: string;
            BigStringValue?: string;
          }>;
        }>;
      }>(`/Deals?$filter=Id eq ${dealId}&$select=Id&$expand=OtherProperties`);
      const filled = new Set<number>(
        (cur.value?.[0]?.OtherProperties ?? [])
          .filter(
            (p) =>
              p.ObjectValueId ||
              p.DecimalValue ||
              (p.StringValue ?? "").trim() ||
              (p.BigStringValue ?? "").trim(),
          )
          .map((p) => p.FieldId),
      );
      const props = await buildDealOtherProperties(L, filled);
      const patch: Record<string, unknown> = { OtherProperties: props };
      if (!existing.deal.OwnerId && ownerId) patch.OwnerId = ownerId;
      plan.deal_patch = { id: dealId, fields: props.map((p) => p.FieldId) };
      if (!opts.dryRun) await pf(`/Deals(${dealId})`, { method: "PATCH", body: patch });
    } else {
      const props = await buildDealOtherProperties(L, new Set());
      const body: Record<string, unknown> = {
        Title: isGenericName(L.nome) ? `Lead ${maskPhone(L.telefone_e164)}` : L.nome,
        ContactId: contactId,
        PipelineId: pipelineId,
        StageId: stageId,
        OtherProperties: props,
      };
      if (ownerId) body.OwnerId = ownerId;
      if (contactOriginId) body.OriginId = contactOriginId;
      if (trafficTagId) body.Tags = [{ TagId: trafficTagId }];
      plan.deal_create = { ...body, OtherProperties: props.map((p) => p.FieldId) };
      if (!opts.dryRun) {
        let created: any;
        try {
          created = await pf("/Deals", { method: "POST", body });
        } catch (e) {
          // Se a conta rejeitar a etapa (checklist pendente), cai para a etapa de entrada do mesmo funil.
          if (
            e instanceof PloomesError &&
            e.status === 400 &&
            /checklist|stage/i.test(e.body) &&
            body.StageId !== fallbackStageId
          ) {
            body.StageId = fallbackStageId;
            created = await pf("/Deals", { method: "POST", body });
          } else if (
            e instanceof PloomesError &&
            e.status === 400 &&
            (body.OriginId || body.Tags)
          ) {
            // Se a conta rejeitar Origin/Tags no negócio, reenvia sem eles (nunca sem os dados do cliente).
            delete body.OriginId;
            delete body.Tags;
            created = await pf("/Deals", { method: "POST", body });
          } else throw e;
        }
        dealId = created.value?.[0]?.Id ?? created.Id;
        if (!dealId) throw new PloomesError(500, "Ploomes não retornou o ID do negócio");
        createdDeal = true;
      }
    }

    if (opts.dryRun)
      return {
        ok: true,
        contactId,
        dealId,
        createdContact: !found.primary,
        createdDeal: !existing.deal,
        duplicates,
        plan,
      };

    // Reforço de responsável: a distribuição automática do funil no Ploomes
    // pode sobrescrever o OwnerId logo após a criação. Reaplica o responsável
    // configurado (padrão: Stephany Martins, SDR) ao final do sync.
    if (ownerId && dealId) {
      try {
        await pf(`/Deals(${dealId})`, { method: "PATCH", body: { OwnerId: ownerId } });
      } catch {
        /* melhor esforço — não derruba o sync por causa do reforço */
      }
    }

    await supabaseAdmin
      .from("leads")
      .update({
        ploomes_contact_id: contactId,
        ploomes_deal_id: dealId,
        external_source: L.external_source ?? "ploomes",
        external_id: L.external_id ?? String(contactId),
        pipeline_id: existing.deal?.PipelineId ?? pipelineId,
        pipeline_stage_id: existing.deal?.StageId ?? stageId,
        ploomes_sync_status: "sincronizado",
        ploomes_synced_at: new Date().toISOString(),
        ploomes_sync_error: null,
        last_synced_at: new Date().toISOString(),
        ploomes_sync_lock_at: null,
      } as never)
      .eq("id", leadId);
    locked = false;

    await logLeadEvent({
      lead_id: leadId,
      phone: L.telefone_e164,
      event: "sync.ok",
      source: L.origem_principal,
      step: "ploomes",
      result: `${createdContact ? "contato criado" : "contato reutilizado"} · ${createdDeal ? "negócio criado" : "negócio atualizado"}${duplicates.length ? ` · ${duplicates.length} duplicado(s) no Ploomes` : ""}`,
      external_ids: { ploomes_contact_id: contactId, ploomes_deal_id: dealId, duplicates },
      detail: { found_by: found.by },
    });
    return { ok: true, contactId, dealId, createdContact, createdDeal, duplicates };
  } catch (e) {
    const status = e instanceof PloomesError ? e.status : undefined;
    const retry = !status || status === 429 || status >= 500;
    const msg = e instanceof Error ? e.message : String(e);
    await logLeadEvent({
      lead_id: leadId,
      phone: L.telefone_e164,
      event: "sync.error",
      step: "ploomes",
      result: retry ? "vai tentar de novo" : "revisão manual",
      detail: { status, error: msg.slice(0, 500) },
    });
    return { ok: false, retry, error: msg, status };
  } finally {
    await releaseLock();
  }
}

/* ---------------------------- Worker da fila ---------------------------- */

const BACKOFF_MIN = [1, 5, 15, 60, 240, 720];

export async function processLeadSyncQueue(limit = 10, worker = "worker") {
  const { data: items, error } = await (supabaseAdmin as any).rpc("lead_sync_claim", {
    _limit: limit,
    _worker: worker,
  });
  if (error) throw new Error(`lead_sync_claim: ${error.message}`);
  const out = {
    claimed: (items ?? []).length,
    ok: 0,
    retry: 0,
    manual: 0,
    results: [] as Array<Record<string, unknown>>,
  };
  for (const it of items ?? []) {
    const r = await syncLeadToPloomes(it.lead_id);
    if (r.ok) {
      out.ok++;
      await (supabaseAdmin as any)
        .from("lead_sync_queue")
        .update({
          status: "sincronizado",
          last_error: null,
          last_response: {
            contactId: r.contactId,
            dealId: r.dealId,
            createdContact: r.createdContact,
            createdDeal: r.createdDeal,
            duplicates: r.duplicates,
          },
          locked_at: null,
          locked_by: null,
        })
        .eq("id", it.id);
    } else {
      const exhausted = it.attempts >= it.max_attempts;
      const manual = !r.retry || exhausted;
      if (manual) out.manual++;
      else out.retry++;
      const delayMin = BACKOFF_MIN[Math.min(it.attempts - 1, BACKOFF_MIN.length - 1)];
      await (supabaseAdmin as any)
        .from("lead_sync_queue")
        .update({
          status: manual ? "revisao_manual" : "pendente",
          last_error: r.error.slice(0, 800),
          last_response: { status: r.status ?? null },
          next_attempt_at: new Date(Date.now() + delayMin * 60_000).toISOString(),
          locked_at: null,
          locked_by: null,
        })
        .eq("id", it.id);
      await supabaseAdmin
        .from("leads")
        .update({
          ploomes_sync_status: manual ? "revisao_manual" : "erro",
          ploomes_sync_error: r.error.slice(0, 800),
          ploomes_sync_attempts: it.attempts,
        } as never)
        .eq("id", it.lead_id);
    }
    out.results.push({ lead_id: it.lead_id, ...r });
  }
  return out;
}
