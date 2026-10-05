// Server-only: eventos de funil que a etapa "macro" do CRM não enxerga.
//
// O CRM resume o Ploomes em poucas etapas (novo / atendimento / venda / faturado), então
// "Reunião Agendada" e "Apresentação" viravam só "atendimento" e a Meta nunca recebia o
// evento de visita (Schedule). Aqui a decisão usa a etapa exata do Ploomes gravada no lead
// (pipeline_stage_id). Cada evento sai uma única vez por lead (ver `jaEnviadoMeta`).

/** Etapas que significam reunião/visita com o consultor marcada ou já feita. */
export const ETAPAS_REUNIAO = new Set<number>([
  // Pré Vendas
  60003248, // Reunião Agendada (Energia Solar)
  60017790, // Reunião Agendada (E-mobility)
  // Comercial — apresentação em diante
  10088276, // Apresentação
  10088281, // Negociação/Fechamento
  10089962, // Contrato
  60016820, // Apresentação (E-mobility)
  60016821, // Negociação/Fechamento (E-mobility)
  60016822, // Contrato (E-mobility)
  60022630, // Apresentação/Negociação (Energia por assinatura)
  60022632, // Termo de adesão
  60047351, // Apresentação/Negociação (Eletroposto)
  60063435, // Negociação/Fechamento (Eletroposto)
  60047352, // Contrato (Eletroposto)
]);

/** Só leads recentes: evento de funil de lead antigo não ensina nada sobre os anúncios de hoje. */
const JANELA_DIAS = 120;

export async function enviarEtapasDoFunil(lead: Record<string, any>) {
  if (!lead?.id || !lead.telefone) return { enviados: [] as string[] };
  const criado = Date.parse(lead.created_at ?? "");
  if (criado && Date.now() - criado > JANELA_DIAS * 86400_000) return { enviados: [] };

  const fezReuniao =
    ETAPAS_REUNIAO.has(Number(lead.pipeline_stage_id)) ||
    lead.stage === "venda" ||
    lead.stage === "faturado";
  if (!fezReuniao) return { enviados: [] };

  const { jaEnviadoMeta, leadParaConversao } = await import("./conversions.server");
  if (await jaEnviadoMeta(lead.id, "Schedule")) return { enviados: [] };

  const { dispatchEvent } = await import("./conversion-events.service");
  const r = await dispatchEvent({
    event: "Schedule",
    lead: leadParaConversao(lead),
    timelineOnLeadId: lead.id,
  });
  return { enviados: r.ok ? ["Schedule"] : [], erro: r.ok ? undefined : r.error };
}
