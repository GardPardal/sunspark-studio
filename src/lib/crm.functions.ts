import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAGES = ["novo", "atendimento", "nao_atendido", "venda", "faturado", "perdido"] as const;

async function getOwnRoles(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function assertCrmAccess(supabase: any, userId: string) {
  const roles = await getOwnRoles(supabase, userId);
  if (!roles.includes("admin") && !roles.includes("consultor") && !roles.includes("coordenador")) {
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

    const { data, error } = await supabaseAdmin
      .from("leads")
      .select(
        "id,nome,telefone,email,cidade,estado,valor_conta,mensagem,origem,produto_interesse,captacao_metodo,utm_source,utm_campaign,gclid,fbclid,stage,sale_value,sale_notes,assigned_to,created_at,stage_updated_at",
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
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
    const isPrivileged = roles.includes("admin") || roles.includes("coordenador");

    const patch: Record<string, unknown> = { stage: data.stage };
    if (data.stage === "venda" || data.stage === "faturado") {
      if (data.saleValue != null) patch.sale_value = data.saleValue;
      if (data.saleNotes != null) patch.sale_notes = data.saleNotes;
    }

    let updated: any;
    if (isPrivileged) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("leads").update(patch as any).eq("id", data.leadId).select("*").single();
      if (error) throw new Error(error.message);
      updated = row;
    } else {
      // Consultor: só pode mover leads que já são dele (bloqueia claim direto da fila comum).
      // Leads da fila comum (tráfego) devem ser distribuídos pela roleta SDR.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: current } = await supabaseAdmin
        .from("leads").select("assigned_to,is_offline").eq("id", data.leadId).single();
      if (!current) throw new Error("Lead não encontrado.");
      if (current.assigned_to !== userId) {
        throw new Error("Você só pode mover leads que já foram atribuídos a você. Leads de tráfego são distribuídos pela roleta SDR da coordenação.");
      }
      const { data: row, error } = await supabase
        .from("leads").update(patch as any).eq("id", data.leadId).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Este lead não é seu.");
      updated = row;
    }

    // Fire conversions for meaningful transitions
    if (["atendimento", "venda", "faturado"].includes(data.stage)) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settingsRows } = await supabaseAdmin.from("site_settings").select("key,value");
        const settings: Record<string, string> = {};
        for (const r of settingsRows ?? []) settings[r.key] = r.value ?? "";

        const { dispatchStageConversions } = await import("./conversions.server");
        const results = await dispatchStageConversions(
          {
            id: updated.id,
            email: updated.email,
            telefone: updated.telefone,
            cidade: updated.cidade,
            estado: updated.estado,
            gclid: updated.gclid,
            fbp: updated.fbp,
            fbc: updated.fbc,
            user_agent: updated.user_agent,
            page_url: updated.page_url,
          },
          data.stage,
          data.saleValue ?? undefined,
          settings,
        );

        if (results.length) {
          const { supabaseAdmin: sa2 } = await import("@/integrations/supabase/client.server");
          await sa2.from("conversion_events").insert(
            results.map((r) => ({
              lead_id: updated.id,
              event_name: data.stage,
              platform: r.platform,
              status: r.status,
              value: data.saleValue ?? null,
              response: r.response as any,
            })),
          );
        }
      } catch (e) {
        console.error("conversion dispatch failed", e);
      }
    }

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
      const { error } = await supabaseAdmin.from("leads").update(data.patch as any).eq("id", data.leadId);
      if (error) throw new Error(error.message);
    } else {
      // Consultor: RLS bloqueia edição de leads de outros
      const { data: row, error } = await supabase.from("leads").update(data.patch as any).eq("id", data.leadId).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Sem permissão para editar este lead.");
    }
    return { ok: true };
  });
