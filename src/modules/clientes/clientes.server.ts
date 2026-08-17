/**
 * Camada de leitura/normalização da visão "Clientes".
 * Não altera nenhuma tabela — apenas lê `leads`, `lead_cadence_tasks`,
 * `agenda_appointments` e `timeline_events` já existentes, sempre pelo
 * client do usuário (RLS aplicada).
 */

export {
  STAGE_LABEL,
  OUTCOMES,
  CLIENT_FILTERS,
  outcomeByKey,
  matchesFilter,
  type OutcomeKey,
  type ClienteRow,
} from "./shared";

import { outcomeByKey, type ClienteRow } from "./shared";

export const LEAD_COLS =
  "id,nome,telefone,email,cidade,estado,valor_conta,mensagem,origem,produto_interesse,stage,sale_value,sale_notes,assigned_to,created_at,updated_at,stage_updated_at,atendimento_deadline,atendimento_confirmado_at,is_prioridade_emergencia,utm_source,utm_campaign,lead_quality";

/** Última interação registrada por lead (usada para sub-etapa e "último contato"). */
export async function lastInteractions(supabase: any, leadIds: string[]) {
  const map = new Map<string, { ts: string; outcome: string | null; title: string }>();
  if (!leadIds.length) return map;
  const { data } = await supabase
    .from("timeline_events")
    .select("entity_id,ts,kind,title,payload")
    .eq("entity_type", "lead")
    .in("entity_id", leadIds)
    .order("ts", { ascending: false })
    .limit(1000);
  for (const ev of data ?? []) {
    if (map.has(ev.entity_id)) continue;
    map.set(ev.entity_id, {
      ts: ev.ts,
      outcome: ev?.payload?.outcome ?? null,
      title: ev.title,
    });
  }
  return map;
}

/** Próxima tarefa de cadência aberta por lead. */
export async function openTasks(supabase: any, leadIds: string[]) {
  const map = new Map<string, { id: string; title: string; due_at: string; channel: string | null }>();
  if (!leadIds.length) return map;
  const { data } = await supabase
    .from("lead_cadence_tasks")
    .select("id,lead_id,title,channel,due_at,completed_at")
    .in("lead_id", leadIds)
    .is("completed_at", null)
    .order("due_at", { ascending: true })
    .limit(1000);
  for (const t of data ?? []) {
    if (!map.has(t.lead_id)) map.set(t.lead_id, { id: t.id, title: t.title, due_at: t.due_at, channel: t.channel });
  }
  return map;
}

/** Próximo compromisso por lead. */
export async function nextAppointments(supabase: any, leadIds: string[]) {
  const map = new Map<string, { id: string; title: string; starts_at: string; type: string }>();
  if (!leadIds.length) return map;
  const { data } = await supabase
    .from("agenda_appointments")
    .select("id,lead_id,title,type,starts_at,status")
    .in("lead_id", leadIds)
    .eq("status", "agendado")
    .gte("starts_at", new Date(Date.now() - 3600_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(1000);
  for (const a of data ?? []) {
    if (a.lead_id && !map.has(a.lead_id)) map.set(a.lead_id, a);
  }
  return map;
}

/** Regra única de "próxima ação recomendada" — legível pelo consultor. */
export function computeNextAction(
  lead: any,
  ctx: {
    task?: { title: string; due_at: string } | null;
    appt?: { title: string; starts_at: string } | null;
    interaction?: { ts: string; outcome: string | null } | null;
  },
): { next_action: string | null; next_action_at: string | null; urgency: number } {
  const now = Date.now();

  if (lead.stage === "novo") {
    const dl = lead.atendimento_deadline ? new Date(lead.atendimento_deadline).getTime() : null;
    const late = dl != null && dl < now;
    return {
      next_action: late ? "Atender agora (atrasado)" : "Fazer o primeiro contato",
      next_action_at: lead.atendimento_deadline ?? lead.created_at,
      urgency: late ? 100 : 90,
    };
  }

  if (ctx.appt) {
    const t = new Date(ctx.appt.starts_at).getTime();
    const soon = t - now < 24 * 3600_000;
    return {
      next_action: `Confirmar: ${ctx.appt.title}`,
      next_action_at: ctx.appt.starts_at,
      urgency: soon ? 80 : 40,
    };
  }

  if (ctx.task) {
    const due = new Date(ctx.task.due_at).getTime();
    const late = due < now;
    return {
      next_action: ctx.task.title,
      next_action_at: ctx.task.due_at,
      urgency: late ? 85 : 60,
    };
  }

  const o = ctx.interaction?.outcome ? outcomeByKey(ctx.interaction.outcome) : null;
  if (o?.next) {
    return { next_action: o.next, next_action_at: ctx.interaction?.ts ?? null, urgency: 55 };
  }

  if (lead.stage === "nao_atendido") return { next_action: "Tentar novo contato", next_action_at: null, urgency: 70 };
  if (lead.stage === "atendimento") return { next_action: "Fazer follow-up", next_action_at: null, urgency: 50 };
  if (lead.stage === "venda") return { next_action: "Acompanhar faturamento", next_action_at: null, urgency: 20 };
  return { next_action: null, next_action_at: null, urgency: 0 };
}

/** Enriquece leads com sub-etapa, último contato e próxima ação. */
export async function enrichLeads(supabase: any, leads: any[]): Promise<ClienteRow[]> {
  const ids = leads.map((l) => l.id);
  const [inter, tasks, appts] = await Promise.all([
    lastInteractions(supabase, ids),
    openTasks(supabase, ids),
    nextAppointments(supabase, ids),
  ]);

  return leads.map((l) => {
    const interaction = inter.get(l.id) ?? null;
    const task = tasks.get(l.id) ?? null;
    const appt = appts.get(l.id) ?? null;
    const na = computeNextAction(l, { task, appt, interaction });
    return {
      ...l,
      substage: interaction?.outcome ?? null,
      last_contact_at: interaction?.ts ?? null,
      ...na,
    } as ClienteRow;
  });
}

