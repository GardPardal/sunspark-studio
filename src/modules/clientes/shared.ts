/** Constantes e tipos da visão "Clientes" — seguros para o bundle do cliente. */

export const STAGE_LABEL: Record<string, string> = {
  novo: "Novo",
  atendimento: "Em atendimento",
  nao_atendido: "Não atendido",
  venda: "Venda",
  faturado: "Faturado",
  perdido: "Perdido",
};

/** Resultados possíveis de uma interação (linguagem do vendedor). */
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
      return (
        row.stage === "atendimento" &&
        (row.substage === "interessado" || row.substage === "sem_resposta" || !row.substage)
      );
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
