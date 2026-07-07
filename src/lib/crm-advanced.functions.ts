import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ================= Helpers ================= */

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}

function isCoordOrAdmin(roles: string[]) {
  return roles.includes("admin") || roles.includes("coordenador");
}

async function assertCoordOrAdmin(supabase: any, userId: string) {
  const roles = await getRoles(supabase, userId);
  if (!isCoordOrAdmin(roles)) throw new Error("Acesso restrito a coordenadores.");
  return roles;
}

/* ================= Consultores ================= */

export const listConsultants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getRoles(supabase, userId);
    if (!isCoordOrAdmin(roles) && !roles.includes("consultor")) throw new Error("Sem acesso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rolesRows } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const consultorIds = new Set(
      (rolesRows ?? []).filter((r: any) => r.role === "consultor").map((r: any) => r.user_id),
    );
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,email,full_name")
      .in("id", Array.from(consultorIds));
    return (profiles ?? []).map((p: any) => ({ id: p.id, name: p.full_name || p.email, email: p.email }));
  });

/* ================= Claim / Transfer ================= */

const claimSchema = z.object({ leadId: z.string().uuid() });

export const claimLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => claimSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getRoles(supabase, userId);
    if (!roles.includes("consultor") && !isCoordOrAdmin(roles)) throw new Error("Sem acesso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Só pega se ainda estiver sem dono
    const { data: updated, error } = await supabaseAdmin
      .from("leads")
      .update({ assigned_to: userId })
      .eq("id", data.leadId)
      .is("assigned_to", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Este lead já foi atribuído a outro consultor.");
    return { ok: true };
  });

const transferSchema = z.object({
  leadId: z.string().uuid(),
  toUserId: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

export const transferLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => transferSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCoordOrAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin.from("leads").select("assigned_to").eq("id", data.leadId).single();
    const fromUser = lead?.assigned_to ?? null;

    const { error: updErr } = await supabaseAdmin
      .from("leads")
      .update({ assigned_to: data.toUserId })
      .eq("id", data.leadId);
    if (updErr) throw new Error(updErr.message);

    await supabaseAdmin.from("lead_transfers").insert({
      lead_id: data.leadId,
      from_user: fromUser,
      to_user: data.toUserId,
      performed_by: userId,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

/* ================= Leads offline ================= */

const offlineSchema = z.object({
  nome: z.string().min(1).max(200),
  telefone: z.string().min(6).max(40),
  email: z.string().email().max(255).optional().nullable(),
  cidade: z.string().max(120).optional().nullable(),
  estado: z.string().max(60).optional().nullable(),
  valor_conta: z.string().max(60).optional().nullable(),
  origem: z.string().max(80).optional().nullable(),
  produto_interesse: z.string().max(120).optional().nullable(),
  captacao_metodo: z.string().max(120).optional().nullable(),
  mensagem: z.string().max(2000).optional().nullable(),
});

export const createOfflineLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => offlineSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getRoles(supabase, userId);
    if (!roles.includes("consultor") && !isCoordOrAdmin(roles)) throw new Error("Sem acesso.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .insert({
        nome: data.nome,
        telefone: data.telefone,
        email: data.email ?? null,
        cidade: data.cidade ?? null,
        estado: data.estado ?? null,
        valor_conta: data.valor_conta ?? null,
        origem: data.origem ?? "Offline",
        produto_interesse: data.produto_interesse ?? null,
        captacao_metodo: data.captacao_metodo ?? null,
        mensagem: data.mensagem ?? null,
        is_offline: true,
        created_by: userId,
        assigned_to: userId,
        stage: "atendimento" as any,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Espelhar para o Ploomes (best-effort, não bloqueia o create)
    try {
      const { pushLeadToPloomesInternal } = await import("@/lib/ploomes.server");
      await pushLeadToPloomesInternal(inserted.id);
    } catch (_e) {
      // já é logado dentro da função; segue o baile
    }

    return { ok: true, id: inserted.id };
  });

/* ================= Cadência ================= */

export const listCadenceSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as { supabase: any };
    const { data, error } = await supabase
      .from("cadence_steps")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const cadenceStepSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  day_offset: z.number().int().min(0).max(365),
  channel: z.enum(["whatsapp", "ligacao", "email", "presencial"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  ordem: z.number().int().min(0).max(999),
  active: z.boolean(),
});

export const upsertCadenceStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cadenceStepSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getRoles(supabase, userId);
    if (!roles.includes("admin")) throw new Error("Apenas admin edita cadência.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      day_offset: data.day_offset,
      channel: data.channel,
      title: data.title,
      description: data.description ?? null,
      ordem: data.ordem,
      active: data.active,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("cadence_steps").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("cadence_steps").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCadenceStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getRoles(supabase, userId);
    if (!roles.includes("admin")) throw new Error("Apenas admin edita cadência.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("cadence_steps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeadCadenceTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as { supabase: any };
    const { data: tasks, error } = await supabase
      .from("lead_cadence_tasks")
      .select("*")
      .eq("lead_id", data.leadId)
      .order("due_at", { ascending: true });
    if (error) throw new Error(error.message);
    return tasks ?? [];
  });

export const completeCadenceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      taskId: z.string().uuid(),
      notes: z.string().max(1000).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("lead_cadence_tasks")
      .update({ completed_at: new Date().toISOString(), completed_by: userId, notes: data.notes ?? null })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ================= Tráfego pago ================= */

export const listTrafficSpend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCoordOrAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("traffic_spend")
      .select("*")
      .order("spend_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const spendSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  spend_date: z.string(),
  channel: z.string().min(1).max(60),
  campaign: z.string().max(200).optional().nullable(),
  amount: z.number().min(0),
  notes: z.string().max(500).optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  status: z.enum(["active", "paused", "ended", "draft"]).default("active"),
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  leads_count: z.number().int().min(0).default(0),
  objective: z.string().max(120).optional().nullable(),
  platform_url: z.string().max(500).optional().nullable(),
});

export const upsertTrafficSpend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => spendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCoordOrAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      spend_date: data.spend_date,
      channel: data.channel,
      campaign: data.campaign ?? null,
      amount: data.amount,
      notes: data.notes ?? null,
      start_date: data.start_date ?? data.spend_date,
      end_date: data.end_date ?? null,
      status: data.status ?? "active",
      impressions: data.impressions ?? 0,
      clicks: data.clicks ?? 0,
      leads_count: data.leads_count ?? 0,
      objective: data.objective ?? null,
      platform_url: data.platform_url ?? null,
      updated_at: new Date().toISOString(),
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("traffic_spend").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("traffic_spend").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteTrafficSpend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCoordOrAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("traffic_spend").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ================= BI agregado ================= */

const biSchema = z.object({
  from: z.string(),
  to: z.string(),
}).partial();

export const getBiMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => biSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCoordOrAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const to = data.to ? new Date(data.to) : new Date();
    const from = data.from ? new Date(data.from) : new Date(to.getTime() - 30 * 86400_000);
    const fromISO = from.toISOString();
    const toISO = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).toISOString();

    const [{ data: leads = [] }, { data: spend = [] }, { data: profiles = [] }, { data: rolesRows = [] }] =
      await Promise.all([
        supabaseAdmin
          .from("leads")
          .select("id,stage,sale_value,assigned_to,gclid,fbclid,utm_source,utm_campaign,origem,created_at")
          .gte("created_at", fromISO)
          .lte("created_at", toISO),
        supabaseAdmin
          .from("traffic_spend")
          .select("*")
          .gte("spend_date", fromISO.slice(0, 10))
          .lte("spend_date", toISO.slice(0, 10)),
        supabaseAdmin.from("profiles").select("id,full_name,email"),
        supabaseAdmin.from("user_roles").select("user_id,role"),
      ]);

    const consultorSet = new Set(
      (rolesRows ?? []).filter((r: any) => r.role === "consultor").map((r: any) => r.user_id),
    );
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || p.email]));

    const totalSpend = (spend ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const totalLeads = leads?.length ?? 0;
    const vendas = (leads ?? []).filter((l: any) => l.stage === "venda" || l.stage === "faturado");
    const faturados = (leads ?? []).filter((l: any) => l.stage === "faturado");
    const totalVendido = vendas.reduce((s: number, l: any) => s + Number(l.sale_value || 0), 0);
    const totalFaturado = faturados.reduce((s: number, l: any) => s + Number(l.sale_value || 0), 0);

    // Métricas agregadas de campanhas (impressões/cliques/leads lançados manualmente)
    const totalImpressions = (spend ?? []).reduce((s: number, r: any) => s + Number(r.impressions || 0), 0);
    const totalClicks = (spend ?? []).reduce((s: number, r: any) => s + Number(r.clicks || 0), 0);
    const totalCampaignLeads = (spend ?? []).reduce((s: number, r: any) => s + Number(r.leads_count || 0), 0);
    const activeCampaigns = (spend ?? []).filter((r: any) => r.status === "active").length;
    const pausedCampaigns = (spend ?? []).filter((r: any) => r.status === "paused").length;

    // CPL: prioriza leads reportados pela plataforma; cai para leads do CRM
    const cplBase = totalCampaignLeads || totalLeads;
    const cpl = cplBase ? totalSpend / cplBase : 0;
    const cpc = totalClicks ? totalSpend / totalClicks : 0;
    const ctr = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;
    const cac = vendas.length ? totalSpend / vendas.length : 0;
    const roas = totalSpend ? totalFaturado / totalSpend : 0;
    const ticket = vendas.length ? totalVendido / vendas.length : 0;

    // Série diária
    const days: Record<string, { date: string; leads: number; vendas: number; faturado: number; spend: number }> = {};
    const ensure = (d: string) => (days[d] ||= { date: d, leads: 0, vendas: 0, faturado: 0, spend: 0 });
    for (const l of leads ?? []) {
      const d = String(l.created_at).slice(0, 10);
      ensure(d).leads += 1;
      if (l.stage === "venda" || l.stage === "faturado") ensure(d).vendas += Number(l.sale_value || 0);
      if (l.stage === "faturado") ensure(d).faturado += Number(l.sale_value || 0);
    }
    for (const s of spend ?? []) {
      ensure(String(s.spend_date)).spend += Number(s.amount || 0);
    }
    const timeseries = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));

    // Leads por canal
    const bySource: Record<string, number> = {};
    for (const l of leads ?? []) {
      const src = l.gclid
        ? "Google Ads"
        : l.fbclid
          ? "Meta Ads"
          : l.utm_source || l.origem || "Orgânico";
      bySource[src] = (bySource[src] || 0) + 1;
    }
    const bySourceArr = Object.entries(bySource).map(([name, value]) => ({ name, value }));

    // Ranking por consultor
    const perConsultor: Record<
      string,
      { userId: string; name: string; leads: number; vendas: number; faturado: number; valor: number }
    > = {};
    for (const l of leads ?? []) {
      if (!l.assigned_to || !consultorSet.has(l.assigned_to)) continue;
      const row = (perConsultor[l.assigned_to] ||= {
        userId: l.assigned_to,
        name: nameById.get(l.assigned_to) ?? "—",
        leads: 0,
        vendas: 0,
        faturado: 0,
        valor: 0,
      });
      row.leads += 1;
      if (l.stage === "venda" || l.stage === "faturado") row.vendas += 1;
      if (l.stage === "faturado") row.faturado += 1;
      if (l.stage === "venda" || l.stage === "faturado") row.valor += Number(l.sale_value || 0);
    }

    return {
      kpis: {
        totalSpend,
        totalLeads,
        vendas: vendas.length,
        faturados: faturados.length,
        totalVendido,
        totalFaturado,
        cpl,
        cac,
        roas,
        ticket,
        totalImpressions,
        totalClicks,
        totalCampaignLeads,
        activeCampaigns,
        pausedCampaigns,
        cpc,
        ctr,
      },
      timeseries,
      bySource: bySourceArr,
      perConsultor: Object.values(perConsultor).sort((a, b) => b.valor - a.valor),
      campaigns: spend ?? [],
      range: { from: fromISO, to: toISO },
    };
  });
