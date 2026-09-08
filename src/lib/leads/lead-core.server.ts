/**
 * Núcleo da Central de Leads — fonte oficial.
 *
 * Fluxo: Fonte → ingestLead (normaliza + deduplica + grava) → computeQualification →
 *        (se for a hora certa) lead_enqueue_sync → worker → Ploomes.
 *
 * Regras invioláveis:
 *  - NUNCA inventar dado. Campo não informado fica null e entra em `campos_pendentes`.
 *  - Dedupe por telefone normalizado (E.164) + CPF/CNPJ + e-mail + contato WhatsApp, de forma atômica (RPC).
 *  - A origem original nunca é substituída por "Liz"; Liz é `qualificado_por`.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PadraoEletrico = "monofasico" | "bifasico" | "trifasico";
export type Segmento = "residencial" | "comercial" | "industrial" | "rural";

export type LeadInput = {
  nome?: string | null;
  telefone: string;
  email?: string | null;
  cpf_cnpj?: string | null;
  cidade?: string | null;
  estado?: string | null;
  valor_conta?: string | number | null;
  padrao_eletrico?: PadraoEletrico | null;
  segmento?: Segmento | null;
  produto_interesse?: string | null;
  mensagem?: string | null;
  fatura_url?: string | null;
  /** Origem original (Meta Ads, Site, WhatsApp orgânico, Indicação, Manual...). */
  origem_principal?: string | null;
  /** Compat. com o campo antigo `origem`. */
  origem?: string | null;
  canal?: string | null;
  qualificado_por?: string | null;
  sistema_entrada?: string | null;
  campanha?: string | null;
  conjunto_anuncio?: string | null;
  anuncio?: string | null;
  meta_lead_id?: string | null;
  form_id?: string | null;
  wa_contact_id?: string | null;
  wa_conversation_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  fbclid?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  page_url?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
  captacao_metodo?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  created_by?: string | null;
  ploomes_filial_id?: number | null;
  ploomes_captacao_id?: number | null;
  ploomes_produto_id?: number | null;
  ploomes_owner_id?: number | null;
};

export type QualificationStatus =
  | "novo"
  | "em_qualificacao"
  | "qualificado"
  | "pendente"
  | "humano"
  | "desqualificado";

export type LeadRow = Record<string, any> & { id: string };

/* ------------------------------------------------------------------ */
/* Normalização                                                        */
/* ------------------------------------------------------------------ */

/** Telefone BR → E.164 (+55DDD9XXXXXXXX). Retorna null quando inválido. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, "").replace(/^0+/, "");
  if (!d) return null;
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) {
    return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  }
  const ddd = d.slice(2, 4);
  let rest = d.slice(4);
  if (rest.length === 8 && /^[6-9]/.test(rest)) rest = `9${rest}`;
  return `+55${ddd}${rest}`;
}

/** Variações do mesmo número para busca em sistemas externos (com/sem 9, com/sem 55). */
export function phoneVariants(e164: string): string[] {
  const d = e164.replace(/\D/g, "");
  const out = new Set<string>([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") {
    out.add(`55${d.slice(2, 4)}${d.slice(5)}`); // sem o 9
  }
  if (d.startsWith("55")) {
    out.add(d.slice(2));
    if (d.length === 13 && d[4] === "9") out.add(`${d.slice(2, 4)}${d.slice(5)}`);
  }
  return [...out];
}

export function maskPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  return e164.replace(/\d(?=\d{4})/g, "*");
}

export function parseMoneyBR(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^0-9,.]/g, "");
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function isGenericName(n: string | null | undefined): boolean {
  if (!n) return true;
  const t = n.trim().toLowerCase();
  if (!t) return true;
  if (
    [
      "cliente",
      "cliente whatsapp",
      "lead whatsapp",
      "whatsapp",
      "lead",
      "não informado",
      "nao informado",
      "sem nome",
      "contato",
      "usuário",
      "usuario",
    ].includes(t)
  )
    return true;
  return /^\+?\d[\d\s\-()]{6,}$/.test(t);
}

/* ------------------------------------------------------------------ */
/* Regras (editáveis no painel)                                        */
/* ------------------------------------------------------------------ */

export type LeadRules = { minFatura: number; exigirFatura: boolean; defaultOwnerId: number | null };

export async function getLeadRules(): Promise<LeadRules> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("key,value")
    .in("key", ["leads:min_fatura", "leads:exigir_fatura", "ploomes:default_owner_id"]);
  const map = new Map((data ?? []).map((r: any) => [r.key, String(r.value ?? "")]));
  const min = Number(map.get("leads:min_fatura") ?? 200);
  const owner = Number(map.get("ploomes:default_owner_id") ?? "");
  return {
    minFatura: Number.isFinite(min) ? min : 200,
    exigirFatura: (map.get("leads:exigir_fatura") ?? "false") === "true",
    defaultOwnerId: Number.isFinite(owner) && owner > 0 ? owner : null,
  };
}

/* ------------------------------------------------------------------ */
/* Qualificação                                                        */
/* ------------------------------------------------------------------ */

export type QualificationSignals = {
  /** Cliente se recusou a informar algo obrigatório. */
  recusou?: boolean;
  /** Cliente pediu humano / conversa já em humano. */
  humano?: boolean;
  /** Cliente disse explicitamente que não tem interesse. */
  semInteresse?: boolean;
  /** Interesse confirmado (energia solar etc.). */
  interesse?: string | null;
};

export function computeQualification(
  lead: LeadRow,
  rules: LeadRules,
  signals: QualificationSignals = {},
): { status: QualificationStatus; pendentes: string[]; motivo: string } {
  const pendentes: string[] = [];
  if (isGenericName(lead.nome)) pendentes.push("Nome não informado");
  if (!lead.telefone_e164) pendentes.push("Telefone inválido");
  if (!lead.cidade) pendentes.push("Cidade não informada");
  const valor = lead.valor_conta_num ?? parseMoneyBR(lead.valor_conta);
  if (valor == null) pendentes.push("Valor da fatura não informado");
  if (!lead.padrao_eletrico) pendentes.push("Tipo de ligação não informado");
  if (rules.exigirFatura && !lead.fatura_url) pendentes.push("Fatura de energia não anexada");
  if (!lead.produto_interesse && !signals.interesse && !lead.segmento) pendentes.push("Interesse/segmento não informado");

  if (signals.semInteresse) return { status: "desqualificado", pendentes, motivo: "Cliente informou que não tem interesse" };
  if (valor != null && valor < rules.minFatura) {
    return {
      status: "desqualificado",
      pendentes,
      motivo: `Fatura (R$ ${valor.toFixed(2)}) abaixo do mínimo de R$ ${rules.minFatura.toFixed(2)}`,
    };
  }
  if (signals.humano || signals.recusou) {
    return {
      status: "humano",
      pendentes,
      motivo: signals.recusou ? "Cliente se recusou a informar dado necessário" : "Transferido para atendimento humano",
    };
  }

  // Obrigatórios mínimos para qualificar: nome, telefone, cidade e valor da fatura.
  // Tipo de ligação e interesse são "quando informados" — viram pendência, mas não bloqueiam.
  const bloqueantes = pendentes.filter((p) =>
    ["Nome não informado", "Telefone inválido", "Cidade não informada", "Valor da fatura não informado", "Fatura de energia não anexada"].includes(p),
  );
  if (bloqueantes.length === 0) {
    return {
      status: "qualificado",
      pendentes,
      motivo: pendentes.length ? `Qualificado com pendências: ${pendentes.join("; ")}` : "Todos os dados obrigatórios confirmados",
    };
  }
  const temAlgo = !isGenericName(lead.nome) || lead.cidade || valor != null;
  return {
    status: temAlgo ? "em_qualificacao" : "novo",
    pendentes,
    motivo: `Faltam: ${bloqueantes.join("; ")}`,
  };
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

export async function logLeadEvent(e: {
  lead_id?: string | null;
  phone?: string | null;
  event: string;
  source?: string | null;
  step?: string | null;
  result?: string | null;
  external_ids?: Record<string, unknown>;
  detail?: Record<string, unknown>;
}) {
  try {
    await (supabaseAdmin as any).from("lead_events").insert({
      lead_id: e.lead_id ?? null,
      phone_masked: maskPhone(e.phone ?? null),
      event: e.event,
      source: e.source ?? null,
      step: e.step ?? null,
      result: e.result ?? null,
      external_ids: e.external_ids ?? {},
      detail: e.detail ?? {},
    });
  } catch (err) {
    console.warn("[lead_events]", err);
  }
}

/* ------------------------------------------------------------------ */
/* Ingestão central                                                    */
/* ------------------------------------------------------------------ */

export type IngestResult = {
  ok: true;
  leadId: string;
  created: boolean;
  lead: LeadRow;
  qualification: { status: QualificationStatus; pendentes: string[]; motivo: string };
  enqueued: boolean;
};

/**
 * Entrada única de leads. Idempotente: o mesmo telefone sempre cai no mesmo lead.
 * `opts.syncPolicy`:
 *   - "immediate": enfileira para o Ploomes assim que salvo (site, manual, Meta).
 *   - "when_qualified": só enfileira quando a qualificação fechar (Liz).
 *   - "never": só grava no CRM interno.
 */
export async function ingestLead(
  input: LeadInput,
  opts: { syncPolicy?: "immediate" | "when_qualified" | "never"; signals?: QualificationSignals; source?: string } = {},
): Promise<IngestResult> {
  const e164 = normalizePhone(input.telefone);
  if (!e164) throw new Error("Telefone inválido");

  const payload: Record<string, unknown> = { ...input };
  if (typeof input.valor_conta === "number") payload.valor_conta = `R$ ${input.valor_conta.toFixed(2).replace(".", ",")}`;
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];

  const { data, error } = await (supabaseAdmin as any).rpc("lead_upsert_by_phone", { _p: payload });
  if (error) throw new Error(`lead_upsert_by_phone: ${error.message}`);
  const created = Boolean(data?.created);
  let lead: LeadRow = data?.lead;
  const leadId: string = data?.id;

  const rules = await getLeadRules();
  const q = computeQualification(lead, rules, opts.signals);

  // Não regride: se já estava qualificado e continua com dados, mantém; se virou humano/desqualificado, aplica.
  const prev = lead.qualificacao_status as QualificationStatus;
  const rank: Record<QualificationStatus, number> = { novo: 0, em_qualificacao: 1, pendente: 1, qualificado: 3, humano: 2, desqualificado: 2 };
  const finalStatus: QualificationStatus =
    q.status === "humano" || q.status === "desqualificado" || rank[q.status] >= rank[prev] ? q.status : prev;

  const patch: Record<string, unknown> = {
    qualificacao_status: finalStatus,
    qualificacao_motivo: q.motivo,
    campos_pendentes: q.pendentes,
  };
  if (finalStatus === "qualificado" && !lead.qualificado_em) patch.qualificado_em = new Date().toISOString();
  if (input.qualificado_por) patch.qualificado_por = input.qualificado_por;
  if (rules.defaultOwnerId && !lead.ploomes_owner_id) patch.ploomes_owner_id = rules.defaultOwnerId;

  const { data: updated } = await (supabaseAdmin as any).from("leads").update(patch).eq("id", leadId).select("*").single();
  if (updated) lead = updated;

  await logLeadEvent({
    lead_id: leadId,
    phone: e164,
    event: created ? "lead.created" : "lead.updated",
    source: opts.source ?? input.sistema_entrada ?? input.origem_principal ?? null,
    step: "crm_interno",
    result: `${finalStatus}${q.pendentes.length ? ` · pendências: ${q.pendentes.join(", ")}` : ""}`,
    external_ids: { ploomes_contact_id: lead.ploomes_contact_id, ploomes_deal_id: lead.ploomes_deal_id },
    detail: { created, origem_principal: lead.origem_principal, qualificado_por: lead.qualificado_por },
  });

  let enqueued = false;
  const policy = opts.syncPolicy ?? "immediate";
  const shouldSync =
    policy === "immediate" ||
    (policy === "when_qualified" && (finalStatus === "qualificado" || finalStatus === "humano"));
  const alreadySynced = lead.ploomes_sync_status === "sincronizado" && lead.ploomes_deal_id;
  const dirty = !created && alreadySynced; // já existe no Ploomes → reenvia só para atualizar campos vazios
  if (shouldSync && (!alreadySynced || dirty)) {
    const { error: qErr } = await (supabaseAdmin as any).rpc("lead_enqueue_sync", {
      _lead_id: leadId,
      _reason: created ? `novo lead (${policy})` : `atualização (${finalStatus})`,
    });
    enqueued = !qErr;
    if (qErr) console.warn("[lead_enqueue_sync]", qErr.message);
    else await logLeadEvent({ lead_id: leadId, phone: e164, event: "sync.enqueued", step: "fila", result: "pendente" });
  }

  return { ok: true, leadId, created, lead, qualification: { ...q, status: finalStatus }, enqueued };
}
