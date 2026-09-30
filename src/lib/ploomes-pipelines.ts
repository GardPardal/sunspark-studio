/**
 * Funis do Ploomes que representam o caminho de venda (lead → contrato → pagamento).
 * Negócios de outros funis (Obras, Homologação, Compras, RH, Marketing, Licitação...)
 * não são leads: repetem o mesmo cliente em etapas operacionais.
 */
export const PLOOMES_SALES_PIPELINE_IDS = [
  60000132, // Pré Vendas / Energia Solar
  10017344, // Comercial / Energia Solar
  60000841, // Financeiro / Energia Solar
  60003544, // Pré Vendas / E-mobility
  60003327, // Comercial / E-mobility
  60003328, // Financeiro / E-mobility
  60004664, // Comercial / Energia por assinatura
  60010175, // Comercial / Eletroposto
] as const;

const SALES_SET = new Set<number>(PLOOMES_SALES_PIPELINE_IDS);

export function isSalesPipeline(pipelineId: number | null | undefined) {
  return pipelineId == null || SALES_SET.has(Number(pipelineId));
}

/**
 * Filtro para consultas de leads: mantém leads do site/SDR (sem funil) e leads de
 * funis de venda; esconde registros criados a partir de funis operacionais.
 */
export const SALES_LEADS_OR_FILTER = `pipeline_id.is.null,pipeline_id.in.(${PLOOMES_SALES_PIPELINE_IDS.join(",")})`;
