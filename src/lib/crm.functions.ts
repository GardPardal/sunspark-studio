import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAGES = ["novo", "atendimento", "nao_atendido", "venda", "faturado", "perdido"] as const;

async function getOwnRoles(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function assertCrmAccess(supabase: any, userId: string) {
  const roles = await getOwnRoles(supabase, userId);
  if (
    !roles.includes("admin") &&
    !roles.includes("consultor") &&
    !roles.includes("coordenador") &&
    !roles.includes("sdr")
  ) {
    throw new Error("Acesso restrito ao CRM.");
  }
  return roles;
}

export const listCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCrmAccess(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      { data: leads, error },
      { data: profiles },
      { data: ploomesUsers },
      { data: sellers },
    ] = await Promise.all([
      supabaseAdmin
        .from("leads")
        .select(
          "id,nome,telefone,email,cidade,estado,valor_conta,mensagem,origem,produto_interesse,captacao_metodo,objetivo,padrao_eletrico,fatura_url,tipo_encaminhamento,utm_source,utm_campaign,gclid,fbclid,stage,sale_value,sale_notes,assigned_to,created_at,stage_updated_at,atendimento_deadline,atendimento_confirmado_at,is_prioridade_emergencia,is_offline,ploomes_deal_id,pipeline_id,pipeline_stage_id,last_synced_at,lead_quality",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, full_name, email"),
      supabaseAdmin.from("ploomes_users").select("ploomes_id, name, email, profile_id, seller_id"),
      supabaseAdmin.from("sales_sellers").select("id, name, profile_id, unit"),
    ]);

    if (error) throw new Error(error.message);

    const nameMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p?.id && p?.full_name) nameMap.set(p.id, p.full_name);
    }
    for (const s of sellers ?? []) {
      if (s?.id && s?.name) nameMap.set(s.id, s.name);
      if (s?.profile_id && s?.name) nameMap.set(s.profile_id, s.name);
    }
    for (const u of ploomesUsers ?? []) {
      if (u?.profile_id && u?.name) nameMap.set(u.profile_id, u.name);
      if (u?.seller_id && u?.name) nameMap.set(u.seller_id, u.name);
    }

    const mappedLeads = (leads ?? []).map((l: any) => ({
      ...l,
      assigned_name: l.assigned_to ? (nameMap.get(l.assigned_to) ?? null) : null,
    }));

    return mappedLeads;
  });

export const listCrmSellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertCrmAccess(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: sellers }, { data: pusers }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email").order("full_name"),
      supabaseAdmin.from("sales_sellers").select("id, name, profile_id, unit").eq("active", true),
      supabaseAdmin.from("ploomes_users").select("ploomes_id, name, profile_id, seller_id"),
    ]);

    const list: Array<{ id: string; name: string; email?: string | null }> = [];
    const seen = new Set<string>();

    for (const p of profiles ?? []) {
      if (p.full_name?.trim() && !seen.has(p.full_name.trim().toLowerCase())) {
        seen.add(p.full_name.trim().toLowerCase());
        list.push({ id: p.id, name: p.full_name.trim(), email: p.email });
      }
    }
    for (const s of sellers ?? []) {
      const id = s.profile_id || s.id;
      if (s.name?.trim() && !seen.has(s.name.trim().toLowerCase())) {
        seen.add(s.name.trim().toLowerCase());
        list.push({ id, name: s.name.trim() });
      }
    }
    for (const u of pusers ?? []) {
      const id = u.profile_id || u.seller_id || String(u.ploomes_id);
      if (u.name?.trim() && !seen.has(u.name.trim().toLowerCase())) {
        seen.add(u.name.trim().toLowerCase());
        list.push({ id, name: u.name.trim() });
      }
    }

    try {
      const { _internalFetchSchema } = await import("./ploomes-form.functions");
      const schema = await _internalFetchSchema();
      for (const o of schema.owners ?? []) {
        if (o.name?.trim() && !seen.has(o.name.trim().toLowerCase())) {
          seen.add(o.name.trim().toLowerCase());
          list.push({ id: o.name.trim(), name: o.name.trim() });
        }
      }
    } catch {}

    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

const updateStageSchema = z.object({
  leadId: z.string().uuid(),
  stage: z.enum(STAGES),
  saleValue: z.number().nullable().optional(),
  saleNotes: z.string().max(2000).nullable().optional(),
});

export const updateLeadStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateStageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await assertCrmAccess(supabase, userId);
    const { applyStageChange } = await import("./crm-stage.server");
    await applyStageChange(supabase, userId, roles, data);
    return { ok: true, userId };
  });

const assignSchema = z.object({
  leadId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
});

export const assignLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getOwnRoles(supabase, userId);
    if (!roles.includes("admin")) throw new Error("Apenas administradores podem atribuir leads.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("leads")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ leadId: z.string().uuid() });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await getOwnRoles(supabase, userId);
    if (!roles.includes("admin")) throw new Error("Apenas administradores podem excluir leads.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leads").delete().eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateLeadSchema = z.object({
  leadId: z.string().uuid(),
  patch: z.object({
    nome: z.string().min(1).max(200).optional(),
    telefone: z.string().min(1).max(40).optional(),
    email: z.string().email().nullable().optional(),
    cidade: z.string().max(120).nullable().optional(),
    estado: z.string().max(60).nullable().optional(),
    valor_conta: z.string().max(60).nullable().optional(),
    mensagem: z.string().max(4000).nullable().optional(),
    origem: z.string().max(80).nullable().optional(),
    produto_interesse: z.string().max(120).nullable().optional(),
    captacao_metodo: z.string().max(120).nullable().optional(),
    objetivo: z.string().max(200).nullable().optional(),
    padrao_eletrico: z.enum(["monofasico", "bifasico", "trifasico"]).nullable().optional(),
    fatura_url: z.string().max(500).nullable().optional(),
    tipo_encaminhamento: z.enum(["orcamento", "visita_tecnica"]).nullable().optional(),
    sale_value: z.number().nullable().optional(),
    sale_notes: z.string().max(2000).nullable().optional(),
  }),
});

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateLeadSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const roles = await assertCrmAccess(supabase, userId);
    const isPrivileged = roles.includes("admin") || roles.includes("coordenador");

    if (isPrivileged) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("leads")
        .update(data.patch as any)
        .eq("id", data.leadId);
      if (error) throw new Error(error.message);
    } else {
      // Consultor: RLS bloqueia edição de leads de outros
      const { data: row, error } = await supabase
        .from("leads")
        .update(data.patch as any)
        .eq("id", data.leadId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Sem permissão para editar este lead.");
    }

    // Sincroniza dados com o Ploomes de forma não-bloqueante
    try {
      const { syncLeadDataToPloomes } = await import("./ploomes.server");
      await syncLeadDataToPloomes(data.leadId, data.patch);
    } catch (e) {
      console.error("[updateLead] Ploomes sync error:", e);
    }

    return { ok: true };
  });
