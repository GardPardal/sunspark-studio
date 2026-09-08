import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertTeam(ctx: { supabase: any }) {
  const { data } = await ctx.supabase.rpc("is_sdr_or_above");
  if (!data) throw new Error("Sem permissão");
}
async function assertManager(ctx: { supabase: any }) {
  const { data } = await ctx.supabase.rpc("is_admin_or_coord");
  if (!data) throw new Error("Apenas administração/coordenação");
}

export const getLeadsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number }) => d)
  .handler(async ({ context, data }) => {
    const { data: out, error } = await context.supabase.rpc("leads_dashboard" as never, { _days: data.days ?? 30 } as never);
    if (error) throw new Error(error.message);
    return out as Record<string, any>;
  });

export const listLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { q?: string; status?: string; sync?: string; origem?: string; page?: number; pageSize?: number; sort?: string; dir?: "asc" | "desc"; onlyLiz?: boolean }) => d,
  )
  .handler(async ({ context, data }) => {
    await assertTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const page = Math.max(1, data.page ?? 1);
    const size = Math.min(100, Math.max(5, data.pageSize ?? 25));
    let q = supabaseAdmin
      .from("leads")
      .select(
        "id,nome,telefone,telefone_e164,email,cidade,estado,valor_conta,valor_conta_num,padrao_eletrico,origem,origem_principal,canal,qualificado_por,sistema_entrada,qualificacao_status,qualificacao_motivo,campos_pendentes,ploomes_sync_status,ploomes_sync_error,ploomes_contact_id,ploomes_deal_id,stage,assigned_to,created_at,updated_at,qualificado_em,ploomes_synced_at,wa_conversation_id",
        { count: "exact" },
      )
      .is("duplicado_de", null);
    if (data.q?.trim()) {
      const t = data.q.trim();
      const digits = t.replace(/\D/g, "");
      q = digits.length >= 4 ? q.or(`telefone_e164.ilike.%${digits}%,telefone.ilike.%${digits}%,nome.ilike.%${t}%`) : q.or(`nome.ilike.%${t}%,email.ilike.%${t}%,cidade.ilike.%${t}%,id.eq.${/^[0-9a-f-]{36}$/i.test(t) ? t : "00000000-0000-0000-0000-000000000000"}`);
    }
    if (data.status) q = q.eq("qualificacao_status", data.status);
    if (data.sync) q = data.sync === "erro" ? q.in("ploomes_sync_status", ["erro", "revisao_manual"]) : q.eq("ploomes_sync_status", data.sync);
    if (data.origem) q = q.eq("origem_principal", data.origem);
    if (data.onlyLiz) q = q.eq("qualificado_por", "liz");
    const sort = ["created_at", "updated_at", "nome", "cidade", "valor_conta_num", "qualificacao_status"].includes(data.sort ?? "") ? data.sort! : "created_at";
    q = q.order(sort, { ascending: data.dir === "asc", nullsFirst: false }).range((page - 1) * size, page * size - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, page, size };
  });

export const getLeadDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin.from("leads").select("*").eq("id", data.id).maybeSingle();
    if (!lead) throw new Error("Lead não encontrado");
    const L = lead as Record<string, any>;
    const [events, queue, dups] = await Promise.all([
      (supabaseAdmin as any).from("lead_events").select("*").eq("lead_id", data.id).order("created_at", { ascending: false }).limit(100),
      (supabaseAdmin as any).from("lead_sync_queue").select("*").eq("lead_id", data.id).order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("leads").select("id,nome,created_at,origem_principal").eq("duplicado_de", data.id),
    ]);
    let messages: any[] = [];
    let convId = L.wa_conversation_id as string | null;
    if (!convId && L.wa_contact_id) {
      const { data: c } = await supabaseAdmin.from("wa_conversations").select("id").eq("contact_id", L.wa_contact_id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
      convId = c?.id ?? null;
    }
    if (!convId && L.telefone_e164) {
      const { data: ct } = await supabaseAdmin.from("wa_contacts").select("id").eq("phone_e164", L.telefone_e164).limit(1).maybeSingle();
      if (ct) {
        const { data: c } = await supabaseAdmin.from("wa_conversations").select("id").eq("contact_id", ct.id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
        convId = c?.id ?? null;
      }
    }
    if (convId) {
      const { data: m } = await supabaseAdmin.from("wa_messages").select("id,direction,body,msg_type,media_url,ai_generated,occurred_at,status").eq("conversation_id", convId).order("occurred_at", { ascending: true }).limit(200);
      messages = m ?? [];
    }
    const { data: timeline } = await (supabaseAdmin as any).from("timeline_events").select("*").eq("entity_id", data.id).order("created_at", { ascending: false }).limit(50);
    return { lead: L, events: events.data ?? [], queue: queue.data ?? [], duplicates: dups.data ?? [], messages, conversationId: convId, timeline: timeline ?? [] };
  });

export const retryLeadSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; dryRun?: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertTeam(context);
    const { syncLeadToPloomes } = await import("@/lib/leads/ploomes-sync.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r0 = await syncLeadToPloomes(data.id, { dryRun: data.dryRun });
    const r = JSON.parse(JSON.stringify(r0)) as typeof r0 extends infer T ? (T extends { plan?: unknown } ? Omit<T, "plan"> & { plan?: Record<string, string | number | boolean | null> } : T) : never;
    if (!data.dryRun) {
      await (supabaseAdmin as any)
        .from("lead_sync_queue")
        .update(r.ok ? { status: "sincronizado", last_error: null } : { status: r.retry ? "pendente" : "revisao_manual", last_error: r.error })
        .eq("lead_id", data.id)
        .in("status", ["pendente", "processando", "revisao_manual"]);
      if (!r.ok) await supabaseAdmin.from("leads").update({ ploomes_sync_status: r.retry ? "erro" : "revisao_manual", ploomes_sync_error: r.error } as never).eq("id", data.id);
    }
    return r;
  });

export const traceLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q: string }) => d)
  .handler(async ({ context, data }) => {
    await assertTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone } = await import("@/lib/leads/lead-core.server");
    const t = data.q.trim();
    const isId = /^[0-9a-f-]{36}$/i.test(t);
    const phone = isId ? null : normalizePhone(t);
    const leadsQ = isId ? supabaseAdmin.from("leads").select("*").eq("id", t) : supabaseAdmin.from("leads").select("*").eq("telefone_e164", phone ?? "—").order("created_at", { ascending: false });
    const { data: leads } = await leadsQ.limit(10);
    const contactsQ = phone ? supabaseAdmin.from("wa_contacts").select("id,phone_e164,profile_name,lead_id,created_at,last_inbound_at").eq("phone_e164", phone) : supabaseAdmin.from("wa_contacts").select("id,phone_e164,profile_name,lead_id,created_at,last_inbound_at").eq("lead_id", t);
    const { data: contacts } = await contactsQ.limit(10);
    const contactIds = (contacts ?? []).map((c) => c.id);
    const { data: convs } = contactIds.length ? await supabaseAdmin.from("wa_conversations").select("id,contact_id,status,last_message_at,created_at,lead_id").in("contact_id", contactIds).order("last_message_at", { ascending: false }).limit(10) : { data: [] as any[] };
    const leadIds = (leads ?? []).map((l) => l.id);
    const { data: events } = leadIds.length ? await (supabaseAdmin as any).from("lead_events").select("*").in("lead_id", leadIds).order("created_at", { ascending: false }).limit(100) : { data: [] };
    const { data: queue } = leadIds.length ? await (supabaseAdmin as any).from("lead_sync_queue").select("*").in("lead_id", leadIds).order("created_at", { ascending: false }).limit(20) : { data: [] };
    const convIds = (convs ?? []).map((c: any) => c.id);
    const { data: lastMsgs } = convIds.length ? await supabaseAdmin.from("wa_messages").select("id,conversation_id,direction,body,occurred_at,ai_generated").in("conversation_id", convIds).order("occurred_at", { ascending: false }).limit(15) : { data: [] as any[] };
    const { data: wa_events } = phone ? await supabaseAdmin.from("wa_events").select("id,provider_event_id,event_kind,process_status,received_at,error").order("received_at", { ascending: false }).limit(300) : { data: [] as any[] };
    const digits = phone?.replace(/\D/g, "") ?? "";
    const matchingEvents = (wa_events ?? []).filter((e: any) => digits && JSON.stringify(e).includes(digits.slice(-8))).slice(0, 10);
    return { phone, leads: leads ?? [], contacts: contacts ?? [], conversations: convs ?? [], events: events ?? [], queue: queue ?? [], lastMessages: lastMsgs ?? [], webhookEvents: matchingEvents };
  });

export const getLeadRulesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context);
    const { getLeadRules } = await import("@/lib/leads/lead-core.server");
    return getLeadRules();
  });

export const saveLeadRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { minFatura: number; exigirFatura: boolean; defaultOwnerId: number | null }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = [
      { key: "leads:min_fatura", value: String(Math.max(0, Number(data.minFatura) || 0)) },
      { key: "leads:exigir_fatura", value: data.exigirFatura ? "true" : "false" },
      { key: "ploomes:default_owner_id", value: data.defaultOwnerId ? String(data.defaultOwnerId) : "" },
    ];
    for (const r of rows) {
      const { error } = await supabaseAdmin.from("site_settings").upsert({ ...r, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const runLeadReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dryRun: boolean; limit?: number; offset?: number; syncPloomes?: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context);
    const { reconcileLizLeads } = await import("@/lib/leads/reconcile.server");
    return reconcileLizLeads({ dryRun: data.dryRun, limit: Math.min(40, data.limit ?? 20), offset: data.offset ?? 0, syncPloomes: data.syncPloomes });
  });

export const getDuplicateReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sinceISO?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context);
    const { internalDuplicateReport, ploomesDuplicateReport } = await import("@/lib/leads/reconcile.server");
    const [internal, ploomes] = await Promise.all([internalDuplicateReport(200), ploomesDuplicateReport(data.sinceISO ?? "2026-08-01T00:00:00Z")]);
    return { internal, ploomes };
  });

export const consolidateDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dryRun: boolean }) => d)
  .handler(async ({ context, data }) => {
    await assertManager(context);
    const { consolidateInternalDuplicates } = await import("@/lib/leads/reconcile.server");
    return consolidateInternalDuplicates({ dryRun: data.dryRun });
  });

export const processQueueNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeam(context);
    const { processLeadSyncQueue } = await import("@/lib/leads/ploomes-sync.server");
    const out = await processLeadSyncQueue(10, "painel");
    return { claimed: out.claimed, ok: out.ok, retry: out.retry, manual: out.manual };
  });

export const listQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = (supabaseAdmin as any).from("lead_sync_queue").select("*, leads(nome,telefone_e164,origem_principal)").order("updated_at", { ascending: false }).limit(100);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows } = await q;
    return rows ?? [];
  });
