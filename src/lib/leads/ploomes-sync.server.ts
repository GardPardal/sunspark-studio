/**
 * Camada ÚNICA de sincronização CRM interno → Ploomes (API oficial, nunca o formulário público).
 *
 * Ordem: contato (buscar por ID salvo → telefone → CPF/CNPJ → e-mail) → criar/atualizar →
 *        negócio aberto do contato no funil de Pré-Vendas → criar/atualizar → salvar IDs.
 *
 * Nunca envia valor que o lead não tem. Campos desconhecidos ficam de fora do payload.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getLeadRules, isGenericName, logLeadEvent, maskPhone, phoneVariants } from "./lead-core.server";

const API = "https://public-api2.ploomes.com";

/** IDs reais da conta LZ7 (conferidos via API em 2026-09-08). */
export const PLOOMES = {
  pipelinePreVendas: 60000132,
  stageNovoLead: 60002860,
  stageQualificacao: 60002763,
  origins: { whatsapp: 60001180, trafegoPago: 60001315, metaAds: 10051759, site: 60001487 },
  tagTrafegoPago: 60151353,
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
    filial: { londrina: 600965622, ponta_grossa: 609092593, wenceslau_braz: 600965621 } as Record<string, number>,
    captacao: { trafegoPago: 600965618, indicacao: 600965617, prospeccao: 600965616, reativacao: 601325073, ligacaoAtiva: 609758031 },
    produto: { energiaSolar: 600963971, onGrid: 609639465, hibrido: 609639466, aumento: 610311595, assinatura: 605306688 },
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
  const txt = [lead.origem_principal, lead.origem, lead.utm_source, lead.utm_medium, lead.captacao_metodo, lead.canal]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const paid =
    /meta|facebook|instagram|\bads?\b|tr[aá]fego|paid|cpc|fbclid/.test(txt) || Boolean(lead.fbclid) || Boolean(lead.meta_lead_id);
  if (lead.ploomes_captacao_id) {
    return { contactOriginId: paid ? PLOOMES.origins.metaAds : null, captacaoId: Number(lead.ploomes_captacao_id), paid };
  }
  if (paid) return { contactOriginId: PLOOMES.origins.metaAds, captacaoId: PLOOMES.options.captacao.trafegoPago, paid };
  if (/indica/.test(txt)) return { contactOriginId: null, captacaoId: PLOOMES.options.captacao.indicacao, paid };
  if (/site|wordpress|quiz|landing|elementor|web/.test(txt)) return { contactOriginId: PLOOMES.origins.site, captacaoId: null, paid };
  if (/whats|zapi|wpp/.test(txt)) return { contactOriginId: PLOOMES.origins.whatsapp, captacaoId: null, paid };
  return { contactOriginId: null, captacaoId: null, paid };
}

/** Filial só quando a cidade é reconhecida; nunca chuta. */
export async function resolveFilialStrict(cidade: string | null, estado: string | null): Promise<number | null> {
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
  if (outNorm.includes(inNorm.slice(0, 5)) || inNorm.includes(outNorm.slice(0, 5))) return r.filialId;
  return null;
}

async function findCityId(cidade: string | null, estado: string | null): Promise<number | null> {
  if (!cidade) return null;
  const name = cidade.replace(/\s*-\s*(PR|SP)$/i, "").trim();
  if (!name) return null;
  try {
    const uf = (estado ?? "").toUpperCase();
    const filter = uf ? `Name eq '${esc(name.toUpperCase())}' and State/Short eq '${uf}'` : `Name eq '${esc(name.toUpperCase())}'`;
    const r = await pf<{ value: Array<{ Id: number }> }>(`/Cities?$filter=${encodeURIComponent(filter)}&$select=Id&$top=2`);
    return r.value?.length === 1 ? r.value[0].Id : null;
  } catch {
    return null;
  }
}

/* ---------------------------- Busca de contato ---------------------------- */

type PContact = { Id: number; Name: string; Email?: string | null; CityId?: number | null; OriginId?: number | null; Phones?: Array<{ PhoneNumber: string }>; CreateDate?: string };

export async function findPloomesContacts(lead: Record<string, any>): Promise<{ primary: PContact | null; all: PContact[]; by: string }> {
  const sel = "$select=Id,Name,Email,CityId,OriginId,CreateDate&$expand=Phones($select=PhoneNumber)";
  if (lead.ploomes_contact_id) {
    try {
      const r = await pf<{ value: PContact[] }>(`/Contacts?$filter=Id eq ${Number(lead.ploomes_contact_id)}&${sel}`);
      if (r.value?.[0]) return { primary: r.value[0], all: r.value, by: "ploomes_contact_id" };
    } catch {
      /* segue para busca por telefone */
    }
  }
  const found: PContact[] = [];
  if (lead.telefone_e164) {
    for (const v of phoneVariants(lead.telefone_e164)) {
      if (!/^\d{8,15}$/.test(v)) continue;
      const r = await pf<{ value: PContact[] }>(`/Contacts?$filter=Phones/any(p: p/SearchPhoneNumber eq ${v})&${sel}&$top=20`);
      for (const c of r.value ?? []) if (!found.some((f) => f.Id === c.Id)) found.push(c);
    }
    if (found.length) return { primary: pickPrimary(found), all: found, by: "telefone" };
  }
  if (lead.cpf_cnpj) {
    const f = lead.cpf_cnpj.length > 11 ? `CNPJ eq '${lead.cpf_cnpj}'` : `CPF eq '${lead.cpf_cnpj}'`;
    try {
      const r = await pf<{ value: PContact[] }>(`/Contacts?$filter=${encodeURIComponent(f)}&${sel}&$top=5`);
      if (r.value?.length) return { primary: pickPrimary(r.value), all: r.value, by: "cpf_cnpj" };
    } catch {
      /* campo pode não existir */
    }
  }
  if (lead.email) {
    const r = await pf<{ value: PContact[] }>(`/Contacts?$filter=Email eq '${esc(lead.email)}'&${sel}&$top=5`);
    if (r.value?.length) return { primary: pickPrimary(r.value), all: r.value, by: "email" };
  }
  return { primary: null, all: [], by: "nenhum" };
}

function pickPrimary(list: PContact[]): PContact {
  // Mais antigo primeiro (é o cadastro "original"); duplicados ficam para o relatório de consolidação.
  return [...list].sort((a, b) => String(a.CreateDate ?? "").localeCompare(String(b.CreateDate ?? "")))[0];
}

type PDeal = { Id: number; Title: string; StatusId: number; PipelineId: number; StageId: number; OwnerId: number | null; CreateDate?: string };

async function findOpenDeal(contactId: number): Promise<{ deal: PDeal | null; all: PDeal[] }> {
  const r = await pf<{ value: PDeal[] }>(
    `/Deals?$filter=ContactId eq ${contactId} and StatusId eq 1&$select=Id,Title,StatusId,PipelineId,StageId,OwnerId,CreateDate&$orderby=CreateDate desc&$top=20`,
  );
  const all = r.value ?? [];
  const pre = all.find((d) => d.PipelineId === PLOOMES.pipelinePreVendas);
  return { deal: pre ?? all[0] ?? null, all };
}

/* ---------------------------- Payloads ---------------------------- */

function buildObservacao(lead: Record<string, any>, extra?: { conversa?: string }) {
  const ni = "Não informado";
  const fatura = lead.valor_conta_num != null ? `R$ ${Number(lead.valor_conta_num).toFixed(2).replace(".", ",")}` : ni;
  const linhas = [
    `Solar OS · Lead ${lead.id}`,
    `Origem: ${lead.origem_principal ?? lead.origem ?? ni}${lead.campanha ? ` · Campanha: ${lead.campanha}` : ""}${lead.utm_campaign && !lead.campanha ? ` · Campanha: ${lead.utm_campaign}` : ""}`,
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
    .map((m: any) => `${m.direction === "inbound" ? "Cliente" : m.ai_generated ? "Liz" : "LZ7"}: ${String(m.body).slice(0, 220)}`)
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
  const filialId = lead.ploomes_filial_id ? Number(lead.ploomes_filial_id) : await resolveFilialStrict(lead.cidade, lead.estado);
  if (filialId) put(F.filial, { ObjectValueId: filialId });
  if (captacaoId) put(F.captacao, { ObjectValueId: captacaoId });
  const produtoId =
    lead.ploomes_produto_id ? Number(lead.ploomes_produto_id) : lead.produto_interesse && /solar|on.?grid|fotovolt/i.test(lead.produto_interesse) ? PLOOMES.options.produto.energiaSolar : null;
  if (produtoId) put(F.produto, { ObjectValueId: produtoId });
  if (lead.valor_conta_num != null) put(F.gasto, { DecimalValue: Number(lead.valor_conta_num) });
  if (lead.cidade) put(F.cidadeEstado, { StringValue: `${lead.cidade}${lead.estado ? `, ${lead.estado}` : ""}` });
  if (lead.padrao_eletrico && PLOOMES.options.padrao[lead.padrao_eletrico]) put(F.padrao, { ObjectValueId: PLOOMES.options.padrao[lead.padrao_eletrico] });
  // Observação sempre atualizada (é o nosso espelho)
  props.push({ FieldId: F.observacao, FieldKey: FIELD_KEYS[F.observacao], BigStringValue: buildObservacao(lead, { conversa: await conversationExcerpt(lead) }) });
  return props;
}

/* ---------------------------- Sincronização ---------------------------- */

export type SyncOutcome =
  | { ok: true; contactId: number; dealId: number; createdContact: boolean; createdDeal: boolean; duplicates: number[] }
  | { ok: false; retry: boolean; error: string; status?: number };

export async function syncLeadToPloomes(leadId: string, opts: { dryRun?: boolean } = {}): Promise<SyncOutcome & { plan?: Record<string, unknown> }> {
  const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (!lead) return { ok: false, retry: false, error: "lead não encontrado" };
  const L = lead as Record<string, any>;
  if (L.duplicado_de) return { ok: false, retry: false, error: `lead marcado como duplicado de ${L.duplicado_de}` };
  if (!L.telefone_e164) return { ok: false, retry: false, error: "telefone inválido" };

  const rules = await getLeadRules();
  const phoneDigits = String(L.telefone_e164).replace(/\D/g, "");
  const ownerId = L.ploomes_owner_id ? Number(L.ploomes_owner_id) : rules.defaultOwnerId;
  const { contactOriginId, paid } = classifyOrigin(L);

  try {
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
      const hasPhone = (found.primary.Phones ?? []).some((p) => phoneVariants(L.telefone_e164).includes(String(p.PhoneNumber).replace(/\D/g, "")));
      if (!hasPhone) patch.Phones = [...(found.primary.Phones ?? []).map((p) => ({ PhoneNumber: p.PhoneNumber })), { PhoneNumber: phoneDigits, TypeId: 2, CountryId: 76 }];
      plan.contact_patch = patch;
      if (Object.keys(patch).length && !opts.dryRun) await pf(`/Contacts(${contactId})`, { method: "PATCH", body: patch });
    } else {
      const body: Record<string, unknown> = {
        Name: isGenericName(L.nome) ? `Não informado (${maskPhone(L.telefone_e164)})` : L.nome,
        TypeId: L.cpf_cnpj && String(L.cpf_cnpj).length > 11 ? 2 : 1,
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
        const created = await pf<{ value?: Array<{ Id: number }> }>("/Contacts", { method: "POST", body });
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
        const r = await pf<{ value: PDeal[] }>(`/Deals?$filter=Id eq ${Number(L.ploomes_deal_id)}&$select=Id,Title,StatusId,PipelineId,StageId,OwnerId`);
        if (r.value?.[0] && r.value[0].StatusId === 1) existing.deal = r.value[0];
      } catch {
        /* ignora */
      }
    }

    if (existing.deal) {
      dealId = existing.deal.Id;
      const cur = await pf<{ value: Array<{ OtherProperties: Array<{ FieldId: number; ObjectValueId?: number; DecimalValue?: number; StringValue?: string; BigStringValue?: string }> }> }>(
        `/Deals?$filter=Id eq ${dealId}&$select=Id&$expand=OtherProperties`,
      );
      const filled = new Set<number>(
        (cur.value?.[0]?.OtherProperties ?? [])
          .filter((p) => p.ObjectValueId || p.DecimalValue || (p.StringValue ?? "").trim() || (p.BigStringValue ?? "").trim())
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
        PipelineId: PLOOMES.pipelinePreVendas,
        StageId: PLOOMES.stageNovoLead,
        OtherProperties: props,
      };
      if (ownerId) body.OwnerId = ownerId;
      if (contactOriginId) body.OriginId = contactOriginId;
      if (paid) body.Tags = [{ TagId: PLOOMES.tagTrafegoPago }];
      plan.deal_create = { ...body, OtherProperties: props.map((p) => p.FieldId) };
      if (!opts.dryRun) {
        let created: any;
        try {
          created = await pf("/Deals", { method: "POST", body });
        } catch (e) {
          // Se a conta rejeitar Origin/Tags no negócio, reenvia sem eles (nunca sem os dados do cliente).
          if (e instanceof PloomesError && e.status === 400 && (body.OriginId || body.Tags)) {
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

    if (opts.dryRun) return { ok: true, contactId, dealId, createdContact: !found.primary, createdDeal: !existing.deal, duplicates, plan };

    await supabaseAdmin
      .from("leads")
      .update({
        ploomes_contact_id: contactId,
        ploomes_deal_id: dealId,
        external_source: L.external_source ?? "ploomes",
        external_id: L.external_id ?? String(contactId),
        pipeline_id: PLOOMES.pipelinePreVendas,
        pipeline_stage_id: existing.deal?.StageId ?? PLOOMES.stageNovoLead,
        ploomes_sync_status: "sincronizado",
        ploomes_synced_at: new Date().toISOString(),
        ploomes_sync_error: null,
        last_synced_at: new Date().toISOString(),
      } as never)
      .eq("id", leadId);

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
    await logLeadEvent({ lead_id: leadId, phone: L.telefone_e164, event: "sync.error", step: "ploomes", result: retry ? "vai tentar de novo" : "revisão manual", detail: { status, error: msg.slice(0, 500) } });
    return { ok: false, retry, error: msg, status };
  }
}

/* ---------------------------- Worker da fila ---------------------------- */

const BACKOFF_MIN = [1, 5, 15, 60, 240, 720];

export async function processLeadSyncQueue(limit = 10, worker = "worker") {
  const { data: items, error } = await (supabaseAdmin as any).rpc("lead_sync_claim", { _limit: limit, _worker: worker });
  if (error) throw new Error(`lead_sync_claim: ${error.message}`);
  const out = { claimed: (items ?? []).length, ok: 0, retry: 0, manual: 0, results: [] as Array<Record<string, unknown>> };
  for (const it of items ?? []) {
    const r = await syncLeadToPloomes(it.lead_id);
    if (r.ok) {
      out.ok++;
      await (supabaseAdmin as any)
        .from("lead_sync_queue")
        .update({ status: "sincronizado", last_error: null, last_response: { contactId: r.contactId, dealId: r.dealId, createdContact: r.createdContact, createdDeal: r.createdDeal, duplicates: r.duplicates }, locked_at: null, locked_by: null })
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
        .update({ ploomes_sync_status: manual ? "revisao_manual" : "erro", ploomes_sync_error: r.error.slice(0, 800), ploomes_sync_attempts: it.attempts } as never)
        .eq("id", it.lead_id);
    }
    out.results.push({ lead_id: it.lead_id, ...r });
  }
  return out;
}
