/**
 * Camada de leitura/normalização da visão "Clientes".
 * Não altera nenhuma tabela — apenas lê `leads`, `lead_cadence_tasks`,
 * `agenda_appointments` e `timeline_events` já existentes, sempre pelo
 * client do usuário (RLS aplicada).
 */

export const STAGE_LABEL: Record<string, string> = {
  novo: "Novo",
  atendimento: "Em atendimento",
  nao_atendido: "Não atendido",
  venda: "Venda",
  faturado: "Faturado",
  perdido: "Perdido",
};

/** Sub-etapas comerciais derivadas das interações registradas (timeline). */
export const OUTCOMES = [
  { key: "interessado", label: "Cliente interessado", stage: "atendimento", next: "Fazer follow-up", days: 2 },
  { key: "sem_resposta", label: "Sem resposta", stage: "nao_atendido", next: "Tentar novo contato", days: 1 },
  { key: "enviar_proposta", label: "Enviar proposta", stage: "atendimento", next: "Enviar proposta", days: 1 },
  { key: "proposta", label: "Proposta enviada", stage: "atendimento", next: "Retomar negociação", days: 3 },
  { key: "agendar_visita", label: "Agendar visita", stage: "atendimento", next: "Confirmar visita", days: 1 },
  { key: "negociacao", label: "Negociação", stage: "atendimento", next: "Fechar negociação", days: 2 },
  { key: "venda", label: "Venda realizada", stage: "venda", next: "Acompanhar faturamento", days: 7 },
  { key: "nao_interessado", label: "Não interessado", stage: "perdido", next: null, days: null },
  { key: "outro", label: "Outro", stage: null, next: "Definir próximo passo", days: 2 },
] as const;

export type OutcomeKey = (typeof OUTCOMES)[number]["key"];

export function outcomeByKey(key: string) {
  return OUTCOMES.find((o) => o.key === key) ?? null;
}

export type ClienteRow = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  valor_conta: string | null;
  origem: string | null;
  stage: string;
  substage: string | null;
  assigned_to: string | null;
  created_at: string;
  stage_updated_at: string | null;
  atendimento_deadline: string | null;
  atendimento_confirmado_at: string | null;
  is_prioridade_emergencia: boolean;
  last_contact_at: string | null;
  next_action: string | null;
  next_action_at: string | null;
  urgency: number;
};

const LEAD_COLS =
  "id,nome,telefone,email,cidade,estado,valor_conta,mensagem,origem,produto_interesse,stage,sale_value,sale_notes,assigned_to,created_at,updated_at,stage_updated_at,atendimento_deadline,atendimento_confirmado_at,is_prioridade_emergencia,utm_source,utm_campaign,lead_quality";

export { LEAD_COLS };

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

/** Filtros da tela Clientes → predicado sobre a linha já enriquecida. */
export function matchesFilter(row: ClienteRow, filter: string): boolean {
  switch (filter) {
    case "todos":
      return true;
    case "novos":
      return row.stage === "novo";
    case "atendimento":
      return row.stage === "atendimento";
    case "followup":
      return row.stage === "atendimento" && (row.substage === "interessado" || row.substage === "sem_resposta" || !row.substage);
    case "proposta":
      return row.substage === "proposta" || row.substage === "enviar_proposta";
    case "negociacao":
      return row.substage === "negociacao";
    case "venda":
      return row.stage === "venda";
    case "faturado":
      return row.stage === "faturado";
    case "perdido":
      return row.stage === "perdido";
    case "nao_atendido":
      return row.stage === "nao_atendido";
    default:
      return true;
  }
}

export const CLIENT_FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "novos", label: "Novos" },
  { key: "atendimento", label: "Em atendimento" },
  { key: "followup", label: "Follow-up" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "venda", label: "Venda" },
  { key: "faturado", label: "Faturados" },
  { key: "perdido", label: "Perdidos" },
  { key: "nao_atendido", label: "Não atendidos" },
] as const;
