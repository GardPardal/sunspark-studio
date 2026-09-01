/**
 * Regra única de mudança de etapa do lead.
 * Extraído de crm.functions.ts SEM alteração de comportamento, para que a nova
 * tela Clientes (registro de interação) use exatamente o mesmo caminho.
 */

export type StageInput = {
  leadId: string;
  stage: "novo" | "atendimento" | "nao_atendido" | "venda" | "faturado" | "perdido";
  saleValue?: number | null;
  saleNotes?: string | null;
};

export async function applyStageChange(
  supabase: any,
  userId: string,
  roles: string[],
  data: StageInput,
) {
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
      .from("leads")
      .update(patch as any)
      .eq("id", data.leadId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    updated = row;
  } else {
    // Consultor: só pode mover leads que já são dele (bloqueia claim direto da fila comum).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin
      .from("leads")
      .select("assigned_to,is_offline")
      .eq("id", data.leadId)
      .single();
    if (!current) throw new Error("Lead não encontrado.");
    if (current.assigned_to !== userId) {
      throw new Error(
        "Você só pode mover leads que já foram atribuídos a você. Leads de tráfego são distribuídos pela roleta SDR da coordenação.",
      );
    }
    const { data: row, error } = await supabase
      .from("leads")
      .update(patch as any)
      .eq("id", data.leadId)
      .select("*")
      .maybeSingle();
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

  return updated;
}
