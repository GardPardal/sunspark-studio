// Server-only: espelho Ploomes → CRM do Solar OS.
//
// SOMENTE LEITURA no Ploomes (GET). Toda escrita acontece no banco do Solar OS.
//
// Por que existe (diagnóstico de 30/09/2026):
//  1. A sincronização antiga só puxava os 500 negócios atualizados mais recentes
//     (~2 dias de movimento) — negócios parados há 3+ dias nunca eram atualizados.
//  2. O vínculo lead ↔ negócio procurava o telefone "cru" (ilike nos 8 últimos
//     dígitos): "(43) 99128-8519" no site não casa com "4391288519" no Ploomes.
//     Sem casar, criava um lead duplicado e o card do site ficava em "Novos".
//  3. Um contato tem vários negócios (a automação do Ploomes recria um negócio no
//     Pré-Vendas quando o Comercial é perdido); o último processado sobrescrevia
//     a etapa do lead, que oscilava.
//  4. A origem ignorava o campo "Como feita a captação do Lead?".
//
// Regras do espelho:
//  - Por contato, o negócio "atual" é: aberto no funil mais avançado
//    (Financeiro > Comercial > Pré-Vendas); sem aberto, o ganho mais recente;
//    sem ganho, o perdido mais recente.
//  - O lead é localizado por negócio, contato ou telefone padronizado (E.164,
//    com e sem o nono dígito). Leads duplicados criados pela sincronização antiga
//    para o mesmo contato ficam marcados (duplicado_de) e somem do CRM.
//  - Lead novo só é criado para negócio em aberto (e já nasce vinculado ao
//    Ploomes, então a fila de envio ao Ploomes o ignora — nada volta para lá).

import { PLOOMES_SALES_PIPELINE_IDS } from "./ploomes-pipelines";
import { ploomesGetAll } from "./ploomes-sales.server";

const PRE = new Set([60000132, 60003544]);
const COM = new Set([10017344, 60003327, 60004664, 60010175]);
const FIN = new Set([60000841, 60003328]);
const NOVO_STAGES = new Set([60002860, 60017787]);
const TENTATIVA_STAGES = new Set([60000974, 60017788]);

const FIELD_CAPTACAO = 60047429; // "Como feita a captação do Lead?"
const FIELD_FILIAL = 60047430; // "Origem do Lead" (na prática: filial)

const SALES_FILTER = `(${PLOOMES_SALES_PIPELINE_IDS.map((id) => `PipelineId eq ${id}`).join(" or ")})`;
const DEAL_SELECT =
  "$select=Id,Title,Amount,StatusId,PipelineId,StageId,OwnerId,ContactId,CreateDate,LastUpdateDate,FinishDate" +
  "&$expand=Contact($select=Id,Name,Email;$expand=Phones($select=PhoneNumber),City($select=Name)),Owner($select=Id,Name,Email),Creator($select=Name)," +
  `OtherProperties($filter=FieldId eq ${FIELD_CAPTACAO} or FieldId eq ${FIELD_FILIAL})`;

type Stage = "novo" | "atendimento" | "nao_atendido" | "venda" | "faturado" | "perdido";

type PDeal = {
  Id: number;
  Title?: string;
  Amount?: number;
  StatusId: number;
  PipelineId: number;
  StageId: number;
  OwnerId?: number;
  ContactId?: number;
  CreateDate?: string;
  LastUpdateDate?: string;
  FinishDate?: string;
  Contact?: {
    Id: number;
    Name?: string;
    Email?: string;
    Phones?: { PhoneNumber?: string }[];
    City?: { Name?: string };
  };
  Owner?: { Id?: number; Name?: string; Email?: string };
  Creator?: { Name?: string };
  OtherProperties?: {
    FieldId: number;
    ObjectValueId?: number;
    ObjectValueName?: string;
    IntegerValue?: number;
    StringValue?: string;
  }[];
};

export type MirrorChange = {
  leadId: string;
  previousStage: string | null;
  stage: Stage;
  inserted: boolean;
  saleValue: number | null;
};

export type MirrorResult = {
  ok: boolean;
  mode: string;
  dealsRead: number;
  contacts: number;
  updated: number;
  inserted: number;
  duplicatesHidden: number;
  unchanged: number;
  changes: MirrorChange[];
  errors: string[];
};

/* ---------------- telefone (mesma regra de public.norm_phone_e164) ---------------- */

export function normPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) {
    return d.length >= 8 && d.length <= 15 ? "+" + d : null;
  }
  const ddd = d.slice(2, 4);
  let rest = d.slice(4);
  if (rest.length === 8 && "6789".includes(rest[0])) rest = "9" + rest;
  return `+55${ddd}${rest}`;
}

/* ---------------- regras de negócio ---------------- */

function stageOf(d: PDeal): Stage {
  const won = d.StatusId === 2;
  const lost = d.StatusId === 3;
  if (FIN.has(d.PipelineId)) return won ? "faturado" : lost ? "perdido" : "venda";
  if (COM.has(d.PipelineId)) return won ? "venda" : lost ? "perdido" : "atendimento";
  // Pré-Vendas
  if (lost) return "perdido";
  if (won) return "atendimento"; // seguiu para o Comercial
  if (NOVO_STAGES.has(d.StageId)) return "novo";
  if (TENTATIVA_STAGES.has(d.StageId)) return "nao_atendido";
  return "atendimento";
}

const pipeRank = (d: PDeal) => (FIN.has(d.PipelineId) ? 3 : COM.has(d.PipelineId) ? 2 : 1);
const ts = (s?: string) => (s ? Date.parse(s) || 0 : 0);

/** Negócio que representa o contato agora. */
export function currentDeal(deals: PDeal[]): PDeal | null {
  if (!deals.length) return null;
  const open = deals.filter((d) => d.StatusId === 1);
  if (open.length) {
    return open.sort(
      (a, b) => pipeRank(b) - pipeRank(a) || ts(b.LastUpdateDate) - ts(a.LastUpdateDate),
    )[0];
  }
  const won = deals.filter((d) => d.StatusId === 2);
  const pool = won.length ? won : deals;
  return pool.sort(
    (a, b) =>
      pipeRank(b) - pipeRank(a) ||
      ts(b.FinishDate ?? b.LastUpdateDate) - ts(a.FinishDate ?? a.LastUpdateDate),
  )[0];
}

function prop(d: PDeal, fieldId: number) {
  return (d.OtherProperties ?? []).find((p) => p.FieldId === fieldId) ?? null;
}

/* ---------------- leitura do Ploomes ---------------- */

async function dealsOfContacts(contactIds: number[]): Promise<PDeal[]> {
  const out: PDeal[] = [];
  for (let i = 0; i < contactIds.length; i += 25) {
    const chunk = contactIds.slice(i, i + 25);
    const rows = await ploomesGetAll(
      `/Deals?$filter=(${chunk.map((id) => `ContactId eq ${id}`).join(" or ")}) and ${SALES_FILTER}&${DEAL_SELECT}`,
    );
    out.push(...rows);
  }
  return out;
}

async function lerNegocios(
  mode: "full" | "incremental" | "contacts",
  opts: { since?: string; contactIds?: number[] },
): Promise<PDeal[]> {
  if (mode === "contacts") return dealsOfContacts(opts.contactIds ?? []);

  if (mode === "incremental") {
    const since = opts.since ?? new Date(Date.now() - 60 * 60_000).toISOString();
    const changed: PDeal[] = await ploomesGetAll(
      `/Deals?$filter=${SALES_FILTER} and LastUpdateDate ge ${since}&$select=Id,ContactId`,
    );
    const contactIds = Array.from(
      new Set(changed.map((d) => Number(d.ContactId)).filter((n) => n > 0)),
    );
    // Todos os negócios desses contatos: um negócio antigo aberto pode ser o "atual".
    return dealsOfContacts(contactIds);
  }

  // full: todos os negócios abertos + os fechados nos últimos 60 dias
  const closedSince = new Date(Date.now() - 60 * 86400000).toISOString();
  const [open, recentClosed] = await Promise.all([
    ploomesGetAll(`/Deals?$filter=${SALES_FILTER} and StatusId eq 1&${DEAL_SELECT}`, 300, 200),
    ploomesGetAll(
      `/Deals?$filter=${SALES_FILTER} and StatusId ne 1 and LastUpdateDate ge ${closedSince}&${DEAL_SELECT}`,
      300,
      100,
    ),
  ]);
  const byId = new Map<number, PDeal>();
  for (const d of [...open, ...recentClosed]) byId.set(d.Id, d);
  return Array.from(byId.values());
}

/* ---------------- espelho ---------------- */

const LEAD_MIRROR_COLS =
  "id,nome,telefone,telefone_e164,email,cidade,stage,stage_updated_at,assigned_to,sale_value,pipeline_id,pipeline_stage_id,ploomes_deal_id,ploomes_contact_id,ploomes_owner_id,ploomes_captacao_id,ploomes_filial_id,captacao_metodo,origem,external_source,external_id,duplicado_de,created_at";

async function inChunks<T>(values: T[], size: number, fn: (chunk: T[]) => Promise<any[]>) {
  const out: any[] = [];
  for (let i = 0; i < values.length; i += size) out.push(...(await fn(values.slice(i, i + size))));
  return out;
}

export async function mirrorPloomes(
  mode: "full" | "incremental" | "contacts",
  opts: { since?: string; contactIds?: number[] } = {},
): Promise<MirrorResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const runStart = new Date().toISOString();
  const errors: string[] = [];

  const deals = await lerNegocios(mode, opts);
  const byContact = new Map<number, PDeal[]>();
  for (const d of deals) {
    const cid = Number(d.ContactId ?? d.Contact?.Id);
    if (!cid) continue;
    const list = byContact.get(cid) ?? [];
    list.push(d);
    byContact.set(cid, list);
  }
  const contactIds = Array.from(byContact.keys());
  const result: MirrorResult = {
    ok: true,
    mode,
    dealsRead: deals.length,
    contacts: contactIds.length,
    updated: 0,
    inserted: 0,
    duplicatesHidden: 0,
    unchanged: 0,
    changes: [],
    errors,
  };
  if (!contactIds.length) return result;

  // Responsáveis: Ploomes → perfil do Solar OS (ploomes_users, e-mail ou nome)
  const [{ data: pusers }, { data: profiles }] = await Promise.all([
    db.from("ploomes_users").select("ploomes_id,profile_id,name"),
    db.from("profiles").select("id,email,full_name"),
  ]);
  const marks = new RegExp("[\\u0300-\\u036f]", "g");
  const normTxt = (s?: string | null) =>
    (s ?? "").normalize("NFD").replace(marks, "").toLowerCase().trim();
  const profileByPloomes = new Map<number, string>();
  for (const u of pusers ?? [])
    if (u.profile_id) profileByPloomes.set(Number(u.ploomes_id), u.profile_id);
  const profileByEmail = new Map<string, string>();
  const profileByName = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.email) profileByEmail.set(normTxt(p.email), p.id);
    if (p.full_name) profileByName.set(normTxt(p.full_name), p.id);
  }
  const ownerProfile = (d: PDeal) =>
    (d.OwnerId && profileByPloomes.get(Number(d.OwnerId))) ||
    (d.Owner?.Email && profileByEmail.get(normTxt(d.Owner.Email))) ||
    (d.Owner?.Name && profileByName.get(normTxt(d.Owner.Name))) ||
    null;

  // Negócio atual e telefones de cada contato
  const current = new Map<number, PDeal>();
  const phonesOf = new Map<number, string[]>();
  for (const [cid, list] of byContact) {
    const cur = currentDeal(list);
    if (cur) current.set(cid, cur);
    const phones = new Set<string>();
    for (const d of list)
      for (const p of d.Contact?.Phones ?? []) {
        const e = normPhoneE164(p.PhoneNumber);
        if (e) phones.add(e);
      }
    phonesOf.set(cid, Array.from(phones));
  }

  // Leads candidatos (em lote): por negócio, contato e telefone
  const allDealIds = deals.map((d) => d.Id);
  const allPhones = Array.from(new Set(Array.from(phonesOf.values()).flat()));
  const [byDeal, byContactId, byExternal, byPhone] = await Promise.all([
    inChunks(allDealIds, 150, async (c) => {
      const { data } = await db.from("leads").select(LEAD_MIRROR_COLS).in("ploomes_deal_id", c);
      return data ?? [];
    }),
    inChunks(contactIds, 150, async (c) => {
      const { data } = await db.from("leads").select(LEAD_MIRROR_COLS).in("ploomes_contact_id", c);
      return data ?? [];
    }),
    inChunks(contactIds.map(String), 150, async (c) => {
      const { data } = await db
        .from("leads")
        .select(LEAD_MIRROR_COLS)
        .eq("external_source", "ploomes")
        .in("external_id", c);
      return data ?? [];
    }),
    inChunks(allPhones, 150, async (c) => {
      const { data } = await db.from("leads").select(LEAD_MIRROR_COLS).in("telefone_e164", c);
      return data ?? [];
    }),
  ]);

  const leadById = new Map<string, any>();
  for (const l of [...byDeal, ...byContactId, ...byExternal, ...byPhone]) leadById.set(l.id, l);
  const dealToContact = new Map<number, number>();
  for (const d of deals) dealToContact.set(d.Id, Number(d.ContactId ?? d.Contact?.Id));
  const phoneToContacts = new Map<string, number[]>();
  for (const [cid, phones] of phonesOf)
    for (const p of phones) phoneToContacts.set(p, [...(phoneToContacts.get(p) ?? []), cid]);

  // Cada lead pertence a um contato, pela chave mais forte.
  const leadsOfContact = new Map<number, any[]>();
  for (const l of leadById.values()) {
    let cid: number | null = null;
    if (l.ploomes_deal_id && dealToContact.has(Number(l.ploomes_deal_id)))
      cid = dealToContact.get(Number(l.ploomes_deal_id))!;
    else if (l.ploomes_contact_id && byContact.has(Number(l.ploomes_contact_id)))
      cid = Number(l.ploomes_contact_id);
    else if (l.external_source === "ploomes" && byContact.has(Number(l.external_id)))
      cid = Number(l.external_id);
    else if (l.telefone_e164) {
      const cands = phoneToContacts.get(l.telefone_e164) ?? [];
      // telefone compartilhado por mais de um contato: ambíguo, não vincula
      if (
        cands.length === 1 &&
        !(l.ploomes_contact_id && Number(l.ploomes_contact_id) !== cands[0])
      )
        cid = cands[0];
    }
    if (!cid) continue;
    leadsOfContact.set(cid, [...(leadsOfContact.get(cid) ?? []), l]);
  }

  const upserts: any[] = [];
  const inserts: any[] = [];
  const toAtendimento: string[] = [];
  const keepers: { id: string; nomes: (string | null | undefined)[]; cidade: string | null }[] = [];
  const now = Date.now();

  for (const [cid, d] of current) {
    const stage = stageOf(d);
    const captacao = prop(d, FIELD_CAPTACAO);
    const filial = prop(d, FIELD_FILIAL);
    const captacaoNome = captacao?.ObjectValueName ?? captacao?.StringValue ?? null;
    const captacaoId = captacao?.ObjectValueId ?? captacao?.IntegerValue ?? null;
    const amount = Number(d.Amount ?? 0);
    const owner = ownerProfile(d);
    const stageDate =
      d.StatusId !== 1 ? (d.FinishDate ?? d.LastUpdateDate) : (d.LastUpdateDate ?? d.CreateDate);

    const todos = leadsOfContact.get(cid) ?? [];
    let leads = todos.filter((l) => !l.duplicado_de);
    // Só sobraram duplicatas: reativa uma (criar outra bateria na chave única external_source+external_id).
    if (!leads.length && todos.length) leads = [todos[0]];
    if (!leads.length) {
      const recente = ts(d.CreateDate) > now - 90 * 86400000;
      // Só negócio em aberto vira lead novo; Pré-Vendas antigo parado não inunda o CRM,
      // e negócio recriado pela automação (reciclagem de perdido) não é lead novo.
      const reciclado = PRE.has(d.PipelineId) && normTxt(d.Creator?.Name) === "automacao";
      if (d.StatusId !== 1 || (PRE.has(d.PipelineId) && !recente) || reciclado) continue;
      const phone = d.Contact?.Phones?.find((p) => p.PhoneNumber)?.PhoneNumber ?? "";
      inserts.push({
        nome: (d.Title || d.Contact?.Name || "Lead Ploomes").slice(0, 200),
        telefone: phone,
        email: d.Contact?.Email ?? null,
        cidade: d.Contact?.City?.Name ?? null,
        origem: captacaoNome ?? "Ploomes",
        captacao_metodo: captacaoNome,
        ploomes_captacao_id: captacaoId,
        ploomes_filial_id: filial?.ObjectValueId ?? null,
        stage,
        stage_updated_at: stageDate ?? null,
        assigned_to: owner,
        ploomes_owner_id: d.OwnerId ?? null,
        sale_value: amount > 0 ? amount : null,
        pipeline_id: d.PipelineId,
        pipeline_stage_id: d.StageId,
        ploomes_deal_id: d.Id,
        ploomes_contact_id: cid,
        external_source: "ploomes",
        external_id: String(cid),
        created_at: d.CreateDate ?? new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      });
      continue;
    }

    // Lead que fica: o original (site/SDR, com a atribuição de marketing), senão o já
    // ligado a este negócio, senão ao contato, senão o mais antigo. Os leads criados
    // pela sincronização antiga (external_source = ploomes) viram duplicatas.
    const maisAntigo = (xs: any[]) =>
      [...xs].sort((a, b) => ts(a.created_at) - ts(b.created_at))[0];
    const originais = leads.filter((l) => l.external_source !== "ploomes");
    const keeper =
      (originais.length ? maisAntigo(originais) : null) ??
      leads.find((l) => Number(l.ploomes_deal_id) === d.Id) ??
      leads.find((l) => Number(l.ploomes_contact_id) === cid) ??
      maisAntigo(leads);

    const next = {
      ...keeper,
      stage,
      pipeline_id: d.PipelineId,
      pipeline_stage_id: d.StageId,
      ploomes_deal_id: d.Id,
      ploomes_contact_id: cid,
      ploomes_owner_id: d.OwnerId ?? keeper.ploomes_owner_id ?? null,
      // Vale o responsável do Ploomes. Sem login no Solar OS, assigned_to fica vazio e
      // o CRM mostra o nome pelo ploomes_owner_id (antes ficava o responsável antigo).
      assigned_to: d.OwnerId ? owner : (keeper.assigned_to ?? null),
      sale_value: amount > 0 ? amount : keeper.sale_value,
      cidade: keeper.cidade || d.Contact?.City?.Name || null,
      captacao_metodo: captacaoNome ?? keeper.captacao_metodo,
      ploomes_captacao_id: captacaoId ?? keeper.ploomes_captacao_id,
      ploomes_filial_id: filial?.ObjectValueId ?? keeper.ploomes_filial_id,
      // external_source/external_id ficam como estão: chave única no banco.
      duplicado_de: null,
      stage_updated_at:
        keeper.stage !== stage ? (stageDate ?? keeper.stage_updated_at) : keeper.stage_updated_at,
    };
    const campos = [
      "stage",
      "pipeline_id",
      "pipeline_stage_id",
      "ploomes_deal_id",
      "ploomes_contact_id",
      "ploomes_owner_id",
      "assigned_to",
      "sale_value",
      "cidade",
      "captacao_metodo",
      "ploomes_captacao_id",
      "ploomes_filial_id",
      "duplicado_de",
    ];
    const mudou = campos.some((k) => String(next[k] ?? "") !== String(keeper[k] ?? ""));
    if (mudou) {
      upserts.push(next);
      if (keeper.stage !== stage) {
        result.changes.push({
          leadId: keeper.id,
          previousStage: keeper.stage ?? null,
          stage,
          inserted: false,
          saleValue: amount > 0 ? amount : null,
        });
        if (stage === "atendimento") toAtendimento.push(keeper.id);
      }
    } else {
      result.unchanged++;
    }

    // Demais leads do mesmo contato (mesmo telefone/contato/negócio) somem do CRM.
    for (const l of leads) {
      if (l.id === keeper.id) continue;
      upserts.push({ ...l, duplicado_de: keeper.id });
      result.duplicatesHidden++;
    }
    keepers.push({ id: keeper.id, nomes: [keeper.nome, d.Contact?.Name], cidade: next.cidade });
  }

  // Cadastro repetido com telefone diferente (ex.: a pessoa preencheu o site duas vezes
  // e digitou outro número): mesmo nome completo + mesma cidade de um cliente já
  // espelhado, sem vínculo com o Ploomes → vira duplicata (reversível, nada é apagado).
  const nomeCidade = (nome?: string | null, cidade?: string | null) => {
    const n = normTxt(nome).replace(/\s+/g, " ");
    const c = normTxt(cidade);
    return n.split(" ").length >= 2 && c ? `${n}|${c}` : null;
  };
  const keeperByNome = new Map<string, string | null>();
  for (const k of keepers)
    for (const nome of new Set(k.nomes.map((n) => nomeCidade(n, k.cidade)))) {
      if (!nome) continue;
      const prev = keeperByNome.get(nome);
      // mesmo nome+cidade em dois clientes diferentes: ambíguo, não mexe
      keeperByNome.set(nome, prev === undefined || prev === k.id ? k.id : null);
    }
  const nomesBusca = new Set<string>();
  for (const k of keepers)
    for (const n of k.nomes) {
      const t = (n ?? "").trim().replace(/\s+/g, " ");
      if (!t) continue;
      nomesBusca.add(t);
      nomesBusca.add(t.toUpperCase());
      nomesBusca.add(t.toLowerCase());
      nomesBusca.add(t.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()));
    }
  const porNome = await inChunks(Array.from(nomesBusca), 150, async (c) => {
    const { data } = await db
      .from("leads")
      .select(LEAD_MIRROR_COLS)
      .in("nome", c)
      .is("duplicado_de", null)
      .is("ploomes_deal_id", null)
      .is("ploomes_contact_id", null);
    return data ?? [];
  });
  const jaTratados = new Set(upserts.map((u) => u.id));
  for (const l of porNome) {
    if (leadById.has(l.id) || jaTratados.has(l.id) || l.external_source === "ploomes") continue;
    const key = nomeCidade(l.nome, l.cidade);
    const alvo = key ? keeperByNome.get(key) : null;
    if (!alvo || alvo === l.id) continue;
    upserts.push({ ...l, duplicado_de: alvo });
    jaTratados.add(l.id);
    result.duplicatesHidden++;
  }

  // Gravação em lote (upsert por id atualiza só as colunas enviadas)
  const COLS = LEAD_MIRROR_COLS.split(",").filter(
    (c) => c !== "telefone_e164" && c !== "created_at",
  );
  const now2 = new Date().toISOString();
  const rows = upserts.map((r) => {
    const o: Record<string, unknown> = { last_synced_at: now2 };
    for (const c of COLS) o[c] = r[c] ?? null;
    return o;
  });
  let gravados = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await db.from("leads").upsert(chunk, { onConflict: "id" });
    if (error) errors.push(`atualizar leads: ${error.message}`);
    else gravados += chunk.length;
  }
  result.updated = Math.max(gravados - result.duplicatesHidden, 0);

  for (let i = 0; i < inserts.length; i += 200) {
    const { data, error } = await db
      .from("leads")
      .insert(inserts.slice(i, i + 200))
      .select("id,stage,sale_value");
    if (error) {
      errors.push(`criar leads: ${error.message}`);
      continue;
    }
    for (const l of data ?? []) {
      result.inserted++;
      result.changes.push({
        leadId: l.id,
        previousStage: null,
        stage: l.stage,
        inserted: true,
        saleValue: l.sale_value ?? null,
      });
    }
  }

  // O gatilho de cadência cria tarefas quando o lead entra em "atendimento".
  // Para negócios conduzidos no Ploomes isso só gerava "tarefas vencidas" falsas:
  // remove apenas as tarefas recém-criadas por este espelho.
  if (toAtendimento.length) {
    for (let i = 0; i < toAtendimento.length; i += 150) {
      await db
        .from("lead_cadence_tasks")
        .delete()
        .in("lead_id", toAtendimento.slice(i, i + 150))
        .is("completed_at", null)
        .gte("created_at", runStart);
    }
  }

  if (errors.length) result.ok = false;
  return result;
}

/* ---------------- execução incremental automática ---------------- */

const LAST_RUN_KEY = "ploomes:mirror_last_run";
const LOCK_KEY = "ploomes:mirror_lock";

async function setSetting(key: string, value: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  await (supabaseAdmin as any)
    .from("site_settings")
    .upsert({ key, value, updated_at: now }, { onConflict: "key" });
}

/** Registra uma rodada concluída (a próxima incremental parte daqui). */
export async function markMirrorRun(startedAt: string) {
  await setSetting(LAST_RUN_KEY, startedAt);
}

/**
 * Roda o espelho incremental se o último tiver mais de `minMinutes`.
 * Usado quando alguém abre o CRM (não há agendador para isso).
 * A marca de "última rodada" só avança quando a rodada termina: se for
 * interrompida, a próxima refaz o mesmo intervalo.
 */
export async function mirrorIfStale(minMinutes = 10): Promise<MirrorResult | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: rows } = await db
    .from("site_settings")
    .select("key,value")
    .in("key", [LAST_RUN_KEY, LOCK_KEY]);
  const get = (k: string) => {
    const v = (rows ?? []).find((r: any) => r.key === k)?.value;
    return v ? Date.parse(String(v)) || 0 : 0;
  };
  const last = get(LAST_RUN_KEY);
  const lock = get(LOCK_KEY);
  if (last && Date.now() - last < minMinutes * 60_000) return null;
  if (lock && Date.now() - lock < 2 * 60_000) return null; // outra tela já está rodando
  const startedAt = new Date().toISOString();
  await setSetting(LOCK_KEY, startedAt);
  // Sem histórico: olha as últimas 24 h; com histórico, sobrepõe 5 min.
  const since = new Date((last || Date.now() - 24 * 3600_000) - 5 * 60_000).toISOString();
  const r = await mirrorPloomes("incremental", { since });
  if (r.ok) await markMirrorRun(startedAt);
  return r;
}
