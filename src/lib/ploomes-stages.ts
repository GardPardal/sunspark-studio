/**
 * Etapas dos funis de venda do Ploomes (id → nome), para o CRM mostrar a etapa
 * exata do negócio. Lidos do Ploomes em 30/09/2026 (somente leitura).
 */
export const PLOOMES_STAGE_NAMES: Record<number, string> = {
  // Pré Vendas / Energia Solar
  60002860: "Novo Lead - Dia 0",
  60000974: "Tentativas de Contato",
  60002763: "Qualificação",
  60003248: "Reunião Agendada",
  // Comercial / Energia Solar
  10089963: "Qualificação do Lead",
  10088276: "Apresentação",
  10088281: "Negociação/Fechamento",
  10089962: "Contrato",
  // Financeiro / Energia Solar
  60005879: "Financeiro · Classificação",
  60005880: "Financeiro · Financiamento",
  60005881: "Financeiro · Confirmação de pagamento",
  60006049: "Financeiro · Saldo remanescente",
  // Pré Vendas / E-mobility
  60017787: "Novo Lead - Dia 0",
  60017788: "Tentativas de Contato",
  60017789: "Qualificação",
  60017790: "Reunião Agendada",
  // Comercial / E-mobility
  60016819: "Qualificação do Lead",
  60016820: "Apresentação",
  60016821: "Negociação/Fechamento",
  60016822: "Contrato",
  // Financeiro / E-mobility
  60016824: "Financeiro · Classificação",
  60016825: "Financeiro · Financiamento",
  60016826: "Financeiro · Confirmação de pagamento",
  60016827: "Financeiro · Saldo remanescente",
  // Comercial / Energia por assinatura
  60022629: "Qualificação do Lead",
  60022630: "Apresentação/Negociação",
  60022632: "Termo de adesão",
  // Comercial / Eletroposto
  60047350: "Qualificação do Lead",
  60047351: "Apresentação/Negociação",
  60063435: "Negociação/Fechamento",
  60047352: "Contrato",
};

export const PLOOMES_PIPELINE_NAMES: Record<number, string> = {
  60000132: "Pré Vendas",
  10017344: "Comercial",
  60000841: "Financeiro",
  60003544: "Pré Vendas · E-mobility",
  60003327: "Comercial · E-mobility",
  60003328: "Financeiro · E-mobility",
  60004664: "Energia por assinatura",
  60010175: "Eletroposto",
};

/** "Comercial · Negociação/Fechamento" a partir dos ids gravados no lead. */
export function ploomesStageLabel(pipelineId?: number | null, stageId?: number | null) {
  const stage = stageId ? PLOOMES_STAGE_NAMES[Number(stageId)] : null;
  if (!stage) return null;
  const pipe = pipelineId ? PLOOMES_PIPELINE_NAMES[Number(pipelineId)] : null;
  return pipe && !stage.startsWith("Financeiro") ? `${pipe} · ${stage}` : stage;
}
