import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAGES = ["novo", "atendimento", "nao_atendido", "venda", "faturado", "perdido"] as const;

export const listCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isConsultor } = await supabase.rpc("has_role", { _user_id: userId, _role: "consultor" });
    if (!isAdmin && !isConsultor) throw new Error("Acesso restrito ao CRM.");

    const { data, error } = await supabase
      .from("leads")
      .select(
        "id,nome,telefone,email,cidade,estado,valor_conta,mensagem,origem,utm_source,utm_campaign,gclid,fbclid,stage,sale_value,sale_notes,assigned_to,created_at,stage_updated_at",
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

    const patch: Record<string, unknown> = { stage: data.stage };
    if (data.stage === "venda" || data.stage === "faturado") {
      if (data.saleValue != null) patch.sale_value = data.saleValue;
      if (data.saleNotes != null) patch.sale_notes = data.saleNotes;
    }

    const { data: updated, error } = await supabase
      .from("leads")
      .update(patch)
      .eq("id", data.leadId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

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
          await supabaseAdmin.from("conversion_events").insert(
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
    // Only admin can (re)assign — enforce via has_role check
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Apenas administradores podem atribuir leads.");

    const { error } = await supabase
      .from("leads")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
