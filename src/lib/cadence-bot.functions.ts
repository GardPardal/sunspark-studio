import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Retorna tarefas de cadência do usuário logado — atrasadas e do dia */
export const getMyCadenceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Leads do consultor
    const { data: myLeads } = await supabaseAdmin
      .from("leads")
      .select("id,nome,stage")
      .eq("assigned_to", userId)
      .in("stage", ["atendimento", "nao_atendido"]);
    const leadIds = (myLeads ?? []).map((l: any) => l.id);
    const nameById = new Map((myLeads ?? []).map((l: any) => [l.id, l.nome]));

    if (!leadIds.length) return { overdue: [], today: [], stats: { overdue: 0, today: 0, totalOpen: 0 } };

    const nowISO = new Date().toISOString();
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

    const { data: tasks } = await supabaseAdmin
      .from("lead_cadence_tasks")
      .select("id,lead_id,title,channel,due_at,completed_at")
      .in("lead_id", leadIds)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(200);

    const overdue: any[] = [];
    const today: any[] = [];
    for (const t of tasks ?? []) {
      const enriched = { ...t, lead_nome: nameById.get(t.lead_id) };
      if (new Date(t.due_at).getTime() < Date.now()) overdue.push(enriched);
      else if (new Date(t.due_at) <= endOfDay) today.push(enriched);
    }

    return {
      overdue,
      today,
      stats: { overdue: overdue.length, today: today.length, totalOpen: (tasks ?? []).length },
    };
  });
