/**
 * Reconciliação e recuperação: conversas que a Liz atendeu × leads × Ploomes.
 * Modo simulação (dryRun) não grava nada nem chama o Ploomes com escrita.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeQualification, getLeadRules, isGenericName, normalizePhone } from "./lead-core.server";
import { extractFromConversation, qualifyLeadFromConversation } from "./liz-qualify.server";
import { findPloomesContacts, syncLeadToPloomes } from "./ploomes-sync.server";

export type ReconcileRow = {
  conversation_id: string;
  contact_id: string;
  phone: string | null;
  nome_perfil: string | null;
  lead_id: string | null;
  acao: "criar" | "atualizar" | "sem_dados" | "ignorar";
  status_previsto: string;
  campos_preenchidos: string[];
  pendentes: string[];
  ploomes: string;
  erro?: string;
};

export async function listLizConversations(limit = 50, offset = 0) {
  // Conversas com pelo menos 1 mensagem do cliente e 1 resposta da Liz
  const { data } = await supabaseAdmin
    .from("wa_conversations")
    .select("id, contact_id, last_message_at, status, lead_id, wa_contacts!inner(id, phone_e164, profile_name, lead_id)")
    .order("last_message_at", { ascending: false })
    .range(offset, offset + limit * 3);
  const out: Array<{ id: string; contact_id: string; phone: string | null; profile_name: string | null; lead_id: string | null }> = [];
  for (const c of data ?? []) {
    const ct = (c as any).wa_contacts;
    const { count: ai } = await supabaseAdmin.from("wa_messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id).eq("ai_generated", true);
    if (!ai) continue;
    const { count: inb } = await supabaseAdmin.from("wa_messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id).eq("direction", "inbound");
    if (!inb) continue;
    out.push({ id: c.id, contact_id: c.contact_id, phone: ct?.phone_e164 ?? null, profile_name: ct?.profile_name ?? null, lead_id: (c as any).lead_id ?? ct?.lead_id ?? null });
    if (out.length >= limit) break;
  }
  return out;
}

export async function reconcileLizLeads(opts: { dryRun: boolean; limit?: number; offset?: number; syncPloomes?: boolean }) {
  const rules = await getLeadRules();
  const convs = await listLizConversations(opts.limit ?? 30, opts.offset ?? 0);
  const rows: ReconcileRow[] = [];
  const totals = { analisadas: 0, criar: 0, atualizar: 0, sem_dados: 0, ignorar: 0, erros: 0, enviados_ploomes: 0 };

  for (const c of convs) {
    totals.analisadas++;
    const phone = normalizePhone(c.phone);
    if (!phone) {
      rows.push({ conversation_id: c.id, contact_id: c.contact_id, phone: c.phone, nome_perfil: c.profile_name, lead_id: c.lead_id, acao: "ignorar", status_previsto: "—", campos_preenchidos: [], pendentes: ["Telefone inválido"], ploomes: "—" });
      totals.ignorar++;
      continue;
    }
    try {
      if (!opts.dryRun) {
        const r = await qualifyLeadFromConversation({ conversationId: c.id, contactId: c.contact_id, phone, source: "reconciliacao" });
        if ("skipped" in r) {
          rows.push({ conversation_id: c.id, contact_id: c.contact_id, phone, nome_perfil: c.profile_name, lead_id: c.lead_id, acao: "sem_dados", status_previsto: r.skipped ?? "sem dados", campos_preenchidos: [], pendentes: [], ploomes: "—" });
          totals.sem_dados++;
          continue;
        }
        let ploomes = r.enqueued ? "enfileirado" : r.lead.ploomes_sync_status;
        if (r.enqueued && opts.syncPloomes) {
          const s = await syncLeadToPloomes(r.leadId);
          ploomes = s.ok ? `ok · contato ${s.contactId} · negócio ${s.dealId}${s.duplicates.length ? ` · ${s.duplicates.length} dup.` : ""}` : `erro: ${s.error}`;
          if (s.ok) {
            totals.enviados_ploomes++;
            await (supabaseAdmin as any).from("lead_sync_queue").update({ status: "sincronizado" }).eq("lead_id", r.leadId).in("status", ["pendente", "processando"]);
          }
        }
        rows.push({
          conversation_id: c.id, contact_id: c.contact_id, phone, nome_perfil: c.profile_name, lead_id: r.leadId,
          acao: r.created ? "criar" : "atualizar", status_previsto: r.qualification.status,
          campos_preenchidos: Object.entries(r.extraction).filter(([k, v]) => v != null && v !== false && !["confianca"].includes(k)).map(([k]) => k),
          pendentes: r.qualification.pendentes, ploomes,
        });
        if (r.created) totals.criar++; else totals.atualizar++;
        continue;
      }

      // Simulação
      const { data: msgs } = await supabaseAdmin.from("wa_messages").select("direction, body").eq("conversation_id", c.id).not("body", "is", null).order("occurred_at", { ascending: true }).limit(80);
      const ex = await extractFromConversation((msgs ?? []).map((m: any) => ({ role: m.direction === "inbound" ? "user" : "assistant", content: String(m.body) })));
      if (!ex) {
        rows.push({ conversation_id: c.id, contact_id: c.contact_id, phone, nome_perfil: c.profile_name, lead_id: c.lead_id, acao: "sem_dados", status_previsto: "extração falhou", campos_preenchidos: [], pendentes: [], ploomes: "—" });
        totals.sem_dados++;
        continue;
      }
      const { data: existing } = await supabaseAdmin.from("leads").select("*").eq("telefone_e164", phone).is("duplicado_de", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const merged: Record<string, any> = {
        ...(existing ?? {}),
        nome: existing && !isGenericName(existing.nome) ? existing.nome : ex.nome,
        cidade: existing?.cidade ?? ex.cidade,
        valor_conta_num: (existing as any)?.valor_conta_num ?? ex.valor_conta,
        padrao_eletrico: existing?.padrao_eletrico ?? ex.padrao_eletrico,
        produto_interesse: existing?.produto_interesse ?? ex.interesse,
        telefone_e164: phone,
        qualificacao_status: (existing as any)?.qualificacao_status ?? "novo",
      };
      const q = computeQualification({ id: existing?.id ?? "novo", ...merged } as any, rules, { recusou: ex.recusou_informar, humano: ex.pediu_humano, semInteresse: ex.sem_interesse, interesse: ex.interesse });
      let ploomes = existing?.ploomes_deal_id ? `já vinculado (negócio ${existing.ploomes_deal_id})` : "—";
      if (!existing?.ploomes_deal_id && (q.status === "qualificado" || q.status === "humano")) {
        const f = await findPloomesContacts({ telefone_e164: phone, email: ex.email, cpf_cnpj: ex.cpf_cnpj });
        ploomes = f.primary ? `reutilizaria contato ${f.primary.Id}${f.all.length > 1 ? ` (${f.all.length - 1} duplicado(s))` : ""}` : "criaria contato + negócio";
      }
      rows.push({
        conversation_id: c.id, contact_id: c.contact_id, phone, nome_perfil: c.profile_name, lead_id: existing?.id ?? null,
        acao: existing ? "atualizar" : "criar", status_previsto: q.status,
        campos_preenchidos: Object.entries(ex).filter(([k, v]) => v != null && v !== false && !["confianca"].includes(k)).map(([k]) => k),
        pendentes: q.pendentes, ploomes,
      });
      if (existing) totals.atualizar++; else totals.criar++;
    } catch (e) {
      totals.erros++;
      rows.push({ conversation_id: c.id, contact_id: c.contact_id, phone, nome_perfil: c.profile_name, lead_id: c.lead_id, acao: "ignorar", status_previsto: "erro", campos_preenchidos: [], pendentes: [], ploomes: "—", erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return { dryRun: opts.dryRun, totals, rows };
}

/** Duplicados internos por telefone (relatório para consolidação segura — não apaga nada). */
export async function internalDuplicateReport(limit = 100) {
  const { data } = await supabaseAdmin
    .from("leads")
    .select("id, nome, telefone_e164, origem_principal, origem, created_at, ploomes_deal_id, ploomes_contact_id, stage, duplicado_de")
    .not("telefone_e164", "is", null)
    .is("duplicado_de", null)
    .order("created_at", { ascending: true })
    .limit(5000);
  const groups = new Map<string, any[]>();
  for (const l of data ?? []) {
    const arr = groups.get(l.telefone_e164!) ?? [];
    arr.push(l);
    groups.set(l.telefone_e164!, arr);
  }
  return [...groups.entries()]
    .filter(([, v]) => v.length > 1)
    .slice(0, limit)
    .map(([phone, v]) => ({ phone, count: v.length, leads: v }));
}

/**
 * Consolida duplicados internos: mantém o mais antigo com vínculo Ploomes (ou o mais antigo),
 * marca os demais com `duplicado_de` e copia dados faltantes. Nada é apagado.
 */
export async function consolidateInternalDuplicates(opts: { dryRun: boolean; limit?: number }) {
  const groups = await internalDuplicateReport(opts.limit ?? 500);
  let merged = 0;
  const plan: Array<{ phone: string; keep: string; mark: string[] }> = [];
  for (const g of groups) {
    const sorted = [...g.leads].sort((a, b) => Number(Boolean(b.ploomes_deal_id)) - Number(Boolean(a.ploomes_deal_id)) || String(a.created_at).localeCompare(String(b.created_at)));
    const keep = sorted[0];
    const others = sorted.slice(1);
    plan.push({ phone: g.phone, keep: keep.id, mark: others.map((o) => o.id) });
    if (opts.dryRun) continue;
    const { data: full } = await supabaseAdmin.from("leads").select("*").in("id", [keep.id, ...others.map((o) => o.id)]);
    const keepRow: any = (full ?? []).find((r: any) => r.id === keep.id);
    const patch: Record<string, unknown> = {};
    for (const o of (full ?? []).filter((r: any) => r.id !== keep.id) as any[]) {
      for (const k of ["email", "cidade", "estado", "valor_conta", "valor_conta_num", "cpf_cnpj", "padrao_eletrico", "segmento", "produto_interesse", "fatura_url", "ploomes_deal_id", "ploomes_contact_id", "wa_contact_id", "wa_conversation_id", "utm_source", "utm_medium", "utm_campaign", "campanha", "assigned_to"]) {
        if ((keepRow[k] == null || keepRow[k] === "") && o[k] != null && patch[k] === undefined) patch[k] = o[k];
      }
      if (isGenericName(keepRow.nome) && !isGenericName(o.nome) && !patch.nome) patch.nome = o.nome;
    }
    if (Object.keys(patch).length) await supabaseAdmin.from("leads").update(patch as never).eq("id", keep.id);
    await supabaseAdmin.from("leads").update({ duplicado_de: keep.id } as never).in("id", others.map((o) => o.id));
    await (supabaseAdmin as any).from("lead_events").insert({ lead_id: keep.id, phone_masked: g.phone.replace(/\d(?=\d{4})/g, "*"), event: "lead.merged", step: "consolidacao", result: `${others.length} duplicado(s) marcados`, detail: { marked: others.map((o) => o.id), patch: Object.keys(patch) } });
    merged += others.length;
  }
  return { dryRun: opts.dryRun, groups: groups.length, merged, plan };
}

/** Duplicados no Ploomes por telefone entre contatos criados recentemente (relatório, sem apagar). */
export async function ploomesDuplicateReport(sinceISO: string) {
  const key = process.env.PLOOMES_USER_KEY;
  if (!key) return { error: "PLOOMES_USER_KEY ausente", groups: [] as any[] };
  const url = `https://public-api2.ploomes.com/Contacts?$filter=CreateDate ge ${sinceISO}&$select=Id,Name,CreateDate,CityId&$expand=Phones($select=PhoneNumber),Deals($select=Id,StatusId,PipelineId;$filter=StatusId eq 1)&$top=300&$orderby=CreateDate desc`;
  const res = await fetch(url, { headers: { "User-Key": key } });
  if (!res.ok) return { error: `Ploomes ${res.status}`, groups: [] as any[] };
  const j = (await res.json()) as { value: any[] };
  const groups = new Map<string, any[]>();
  for (const c of j.value ?? []) {
    for (const p of c.Phones ?? []) {
      const e = normalizePhone(p.PhoneNumber);
      if (!e) continue;
      const arr = groups.get(e) ?? [];
      if (!arr.some((x) => x.Id === c.Id)) arr.push({ Id: c.Id, Name: c.Name, CreateDate: c.CreateDate, deals: (c.Deals ?? []).map((d: any) => d.Id) });
      groups.set(e, arr);
    }
  }
  return {
    since: sinceISO,
    groups: [...groups.entries()].filter(([, v]) => v.length > 1).map(([phone, contacts]) => ({ phone: phone.replace(/\d(?=\d{4})/g, "*"), phone_e164: phone, contacts })),
  };
}
