// Server-only: auditoria dos leads do quiz do site (tráfego interno).
//
// Lead do quiz = origem/captação/UTM/mensagem com "quiz" (ou captação "Tráfego interno"),
// ou que tenha o evento `quiz.enviado` (gravado pelo /api/public/lead, inclusive para quem
// já existia no CRM). O Ploomes é consultado SOMENTE com GET.

import { fetchAllRows } from "./fetch-all.server";

const FILIAIS: Record<number, string> = {
  600965622: "Londrina",
  609092593: "Ponta Grossa",
  600965621: "Wenceslau Braz",
};
const UNIDADE_PERFIL: Record<string, string> = {
  londrina: "Londrina",
  ponta_grossa: "Ponta Grossa",
  wenceslau_braz: "Wenceslau Braz",
};

const OR_QUIZ = [
  "origem.ilike.%quiz%",
  "origem_principal.ilike.%quiz%",
  "captacao_metodo.ilike.%quiz%",
  "captacao_metodo.ilike.%interno%",
  "utm_source.ilike.%quiz%",
  "mensagem.ilike.%via quiz%",
].join(",");

const COLS_LISTA =
  "id,nome,telefone,email,cidade,estado,created_at,updated_at,stage,stage_updated_at,assigned_to,ploomes_owner_id,ploomes_filial_id,ploomes_deal_id,ploomes_contact_id,ploomes_sync_status,ploomes_sync_error,pipeline_id,pipeline_stage_id,qualificacao_status,lead_quality,valor_conta,origem,utm_campaign,duplicado_de,wa_conversation_id";

export type LinhaQuiz = {
  id: string;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  estado: string | null;
  criadoEm: string;
  ultimaAtividade: string;
  etapa: string | null;
  etapaPloomes: string | null;
  responsavel: string;
  unidade: string;
  valorConta: string | null;
  campanha: string | null;
  ploomesDealId: number | null;
  sincronizacao: string;
  erroSync: string | null;
  qualificacao: string | null;
  duplicado: boolean;
};

function db() {
  return import("@/integrations/supabase/client.server").then((m) => m.supabaseAdmin as any);
}

async function nomesResponsaveis() {
  const sb = await db();
  const [{ data: perfis }, { data: pusers }] = await Promise.all([
    sb.from("profiles").select("id,full_name,unit"),
    sb.from("ploomes_users").select("ploomes_id,name,profile_id"),
  ]);
  const porPerfil = new Map<string, { nome: string; unidade: string | null }>();
  for (const p of perfis ?? [])
    porPerfil.set(p.id, { nome: p.full_name ?? "", unidade: UNIDADE_PERFIL[p.unit] ?? null });
  const porPloomes = new Map<number, string>();
  for (const u of pusers ?? []) porPloomes.set(Number(u.ploomes_id), u.name);
  return { porPerfil, porPloomes };
}

async function rotuloEtapa(pipelineId: number | null, stageId: number | null) {
  if (!pipelineId && !stageId) return null;
  const { ploomesStageLabel } = await import("./ploomes-stages");
  return ploomesStageLabel(pipelineId, stageId);
}

function unidadeDe(
  l: { ploomes_filial_id?: number | null; cidade?: string | null; estado?: string | null },
  unidadeResp: string | null,
  resolver: (c: string | null, e: string | null) => number | null,
): string {
  if (l.ploomes_filial_id && FILIAIS[Number(l.ploomes_filial_id)])
    return FILIAIS[Number(l.ploomes_filial_id)];
  if (unidadeResp) return unidadeResp;
  const f = resolver(l.cidade ?? null, l.estado ?? null);
  return (f && FILIAIS[f]) || "Sem unidade";
}

async function resolvedorFilial() {
  const { resolveCityAndFilial } = await import("./ploomes.server");
  return (c: string | null, e: string | null) => {
    if (!c) return null;
    try {
      return resolveCityAndFilial(c, e).filialId ?? null;
    } catch {
      return null;
    }
  };
}

/** Leads do quiz criados (ou que enviaram o quiz) no período [de, ate). */
export async function listarLeadsQuiz(de: string, ate: string): Promise<LinhaQuiz[]> {
  const sb = await db();
  const [porOrigem, eventos] = await Promise.all([
    fetchAllRows((from, to) =>
      sb
        .from("leads")
        .select(COLS_LISTA, { count: "exact" })
        .or(OR_QUIZ)
        .gte("created_at", de)
        .lt("created_at", ate)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      sb
        .from("lead_events")
        .select("lead_id,created_at", { count: "exact" })
        .eq("event", "quiz.enviado")
        .gte("created_at", de)
        .lt("created_at", ate)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  const ids = new Set(porOrigem.map((l: any) => l.id));
  const faltam = Array.from(
    new Set(eventos.map((e: any) => e.lead_id).filter((id: string) => id && !ids.has(id))),
  );
  const extras: any[] = [];
  for (let i = 0; i < faltam.length; i += 150) {
    const { data } = await sb
      .from("leads")
      .select(COLS_LISTA)
      .in("id", faltam.slice(i, i + 150));
    extras.push(...(data ?? []));
  }
  const leads = [...porOrigem, ...extras];
  // lead que já existia e refez o quiz: vale a data do quiz
  const dataQuiz = new Map<string, string>();
  for (const e of eventos as any[])
    if (e.lead_id && !ids.has(e.lead_id)) dataQuiz.set(e.lead_id, e.created_at);

  const { porPerfil, porPloomes } = await nomesResponsaveis();
  const resolver = await resolvedorFilial();
  const { ploomesStageLabel } = await import("./ploomes-stages");

  return leads
    .map((l: any): LinhaQuiz => {
      const perfil = l.assigned_to ? porPerfil.get(l.assigned_to) : null;
      const responsavel =
        perfil?.nome ||
        (l.ploomes_owner_id ? porPloomes.get(Number(l.ploomes_owner_id)) : null) ||
        "Sem responsável";
      const sinc =
        l.ploomes_deal_id && (!l.ploomes_sync_status || l.ploomes_sync_status === "sincronizado")
          ? "No Ploomes"
          : l.ploomes_sync_status === "revisao_manual"
            ? "Revisão manual"
            : l.ploomes_sync_status === "erro"
              ? "Erro no envio"
              : l.ploomes_deal_id
                ? "No Ploomes"
                : "Ainda não enviado";
      return {
        id: l.id,
        nome: l.nome ?? "(sem nome)",
        telefone: l.telefone,
        cidade: l.cidade,
        estado: l.estado,
        criadoEm: dataQuiz.get(l.id) ?? l.created_at,
        ultimaAtividade: [l.updated_at, l.stage_updated_at, l.created_at]
          .filter(Boolean)
          .sort()
          .pop(),
        etapa: l.stage,
        etapaPloomes:
          l.pipeline_id || l.pipeline_stage_id
            ? ploomesStageLabel(l.pipeline_id, l.pipeline_stage_id)
            : null,
        responsavel,
        unidade: unidadeDe(l, perfil?.unidade ?? null, resolver),
        valorConta: l.valor_conta,
        campanha: l.utm_campaign,
        ploomesDealId: l.ploomes_deal_id ? Number(l.ploomes_deal_id) : null,
        sincronizacao: sinc,
        erroSync: l.ploomes_sync_error,
        qualificacao: l.qualificacao_status,
        duplicado: Boolean(l.duplicado_de),
      };
    })
    .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Ficha completa                                                      */
/* ------------------------------------------------------------------ */

export type ItemLinha = {
  quando: string;
  tipo: string;
  titulo: string;
  detalhe?: string | null;
  quem?: string | null;
  origem: "Solar OS" | "Ploomes" | "WhatsApp";
};

/** Respostas do quiz a partir da mensagem ("• Padrão de entrada: Bifásico"). */
function respostasQuiz(mensagem: string | null | undefined) {
  const out: { pergunta: string; resposta: string }[] = [];
  for (const linha of String(mensagem ?? "").split(/\r?\n/)) {
    const m = linha.match(/^\s*[•*-]\s*([^:]+):\s*(.+)$/);
    if (m) out.push({ pergunta: m[1].trim(), resposta: m[2].trim() });
  }
  return out;
}

async function ploomesSeguro<T>(caminho: string): Promise<T[] | null> {
  try {
    const { ploomesGet } = await import("./ploomes-sales.server");
    const j = await ploomesGet(caminho);
    return (j?.value ?? []) as T[];
  } catch {
    return null;
  }
}

export async function fichaLead(id: string) {
  const sb = await db();
  const { data: lead, error } = await sb.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead) throw new Error("Lead não encontrado.");

  const convIds = new Set<string>();
  if (lead.wa_conversation_id) convIds.add(lead.wa_conversation_id);

  const [
    eventos,
    transferencias,
    tarefas,
    agenda,
    conversoes,
    fila,
    conversas,
    conversasAntigas,
    duplicados,
    timeline,
    nomes,
    resolver,
  ] = await Promise.all([
    sb
      .from("lead_events")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(300),
    sb
      .from("lead_transfers")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    sb
      .from("lead_cadence_tasks")
      .select("*")
      .eq("lead_id", id)
      .order("due_at", { ascending: true }),
    sb
      .from("agenda_appointments")
      .select("*")
      .eq("lead_id", id)
      .order("starts_at", { ascending: false }),
    sb
      .from("conversion_events")
      .select("id,event_name,platform,status,status_detail,value,created_at,match_quality")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    sb
      .from("lead_sync_queue")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    sb
      .from("wa_conversations")
      .select(
        "id,status,assigned_to,summary,last_message_at,handoff_at,handoff_reason,created_at,unread_count",
      )
      .eq("lead_id", id),
    sb
      .from("whatsapp_conversations")
      .select("id,wa_name,wa_phone,messages,qualified,last_message_at,created_at")
      .eq("lead_id", id),
    sb.from("leads").select("id,nome,telefone,origem,created_at").eq("duplicado_de", id),
    sb
      .from("timeline_events")
      .select("*")
      .eq("entity_id", id)
      .order("ts", { ascending: false })
      .limit(200),
    nomesResponsaveis(),
    resolvedorFilial(),
  ]);
  for (const c of conversas.data ?? []) convIds.add(c.id);

  const { data: mensagens } = convIds.size
    ? await sb
        .from("wa_messages")
        .select(
          "id,conversation_id,direction,body,msg_type,media_url,media_filename,ai_generated,sent_by,status,occurred_at",
        )
        .in("conversation_id", Array.from(convIds))
        .order("occurred_at", { ascending: true })
        .limit(1000)
    : { data: [] };

  const nomeDe = (uid: string | null | undefined) =>
    (uid && nomes.porPerfil.get(uid)?.nome) || null;
  const perfilResp = lead.assigned_to ? nomes.porPerfil.get(lead.assigned_to) : null;

  // ---------- Ploomes (somente leitura) ----------
  let ploomes: Record<string, unknown> | null = null;
  const linha: ItemLinha[] = [];
  if (lead.ploomes_deal_id || lead.ploomes_contact_id) {
    const dealId = lead.ploomes_deal_id ? Number(lead.ploomes_deal_id) : null;
    let contactId = lead.ploomes_contact_id ? Number(lead.ploomes_contact_id) : null;
    const [deal] =
      (dealId &&
        (await ploomesSeguro<any>(
          `/Deals?$filter=Id eq ${dealId}&$select=Id,Title,Amount,StatusId,PipelineId,StageId,OwnerId,ContactId,CreateDate,LastUpdateDate,FinishDate&$expand=Owner($select=Name),Creator($select=Name),Stage($select=Name),Pipeline($select=Name),Tags($select=TagId,Tag),OtherProperties`,
        ))) ||
      [];
    if (!contactId && deal?.ContactId) contactId = Number(deal.ContactId);
    const [contato, negocios, interacoes, tarefasP, propostas] = await Promise.all([
      contactId
        ? ploomesSeguro<any>(
            `/Contacts?$filter=Id eq ${contactId}&$select=Id,Name,Email,CreateDate,Note&$expand=Phones($select=PhoneNumber),City($select=Name),Owner($select=Name),Creator($select=Name)`,
          )
        : null,
      contactId
        ? ploomesSeguro<any>(
            `/Deals?$filter=ContactId eq ${contactId}&$select=Id,Title,Amount,StatusId,CreateDate,FinishDate&$expand=Owner($select=Name),Stage($select=Name),Pipeline($select=Name)&$orderby=CreateDate desc&$top=50`,
          )
        : null,
      contactId || dealId
        ? ploomesSeguro<any>(
            `/InteractionRecords?$filter=${contactId ? `ContactId eq ${contactId}` : `DealId eq ${dealId}`}&$select=Id,Content,Date,DealId,TypeId&$expand=Creator($select=Name)&$orderby=Date desc&$top=100`,
          )
        : null,
      dealId
        ? ploomesSeguro<any>(
            `/Tasks?$filter=DealId eq ${dealId}&$select=Id,Title,Description,DateTime,Finished,FinishDate&$expand=Owner($select=Name)&$orderby=DateTime desc&$top=50`,
          )
        : null,
      dealId
        ? ploomesSeguro<any>(
            `/Quotes?$filter=DealId eq ${dealId}&$select=Id,QuoteNumber,ReviewNumber,Amount,Date,LastReview,CreateDate&$orderby=CreateDate desc&$top=20`,
          )
        : null,
    ]);
    const c = contato?.[0] ?? null;
    ploomes = {
      disponivel: Boolean(deal || c),
      negocio: deal
        ? {
            id: deal.Id,
            titulo: deal.Title,
            valor: deal.Amount,
            status: deal.StatusId === 2 ? "Ganho" : deal.StatusId === 3 ? "Perdido" : "Em aberto",
            funil: deal.Pipeline?.Name ?? null,
            etapa: deal.Stage?.Name ?? null,
            responsavel: deal.Owner?.Name ?? null,
            criadoPor: deal.Creator?.Name ?? null,
            criadoEm: deal.CreateDate,
            atualizadoEm: deal.LastUpdateDate,
            fechadoEm: deal.FinishDate,
            etiquetas: (deal.Tags ?? []).map((t: any) => t?.Tag?.Name ?? t?.TagId),
            campos: (deal.OtherProperties ?? [])
              .map((p: any) => ({
                campo: p.FieldKey,
                id: p.FieldId,
                valor:
                  p.ObjectValueName ??
                  p.UserValueName ??
                  p.StringValue ??
                  p.BigStringValue ??
                  p.DecimalValue ??
                  p.IntegerValue ??
                  p.DateTimeValue ??
                  p.BoolValue,
              }))
              .filter((p: any) => p.valor !== null && p.valor !== undefined && p.valor !== ""),
          }
        : null,
      contato: c
        ? {
            id: c.Id,
            nome: c.Name,
            email: c.Email,
            telefones: (c.Phones ?? []).map((p: any) => p.PhoneNumber),
            cidade: c.City?.Name ?? null,
            responsavel: c.Owner?.Name ?? null,
            criadoPor: c.Creator?.Name ?? null,
            criadoEm: c.CreateDate,
            observacao: c.Note,
          }
        : null,
      negocios: (negocios ?? []).map((d: any) => ({
        id: d.Id,
        titulo: d.Title,
        valor: d.Amount,
        status: d.StatusId === 2 ? "Ganho" : d.StatusId === 3 ? "Perdido" : "Em aberto",
        funil: d.Pipeline?.Name ?? null,
        etapa: d.Stage?.Name ?? null,
        responsavel: d.Owner?.Name ?? null,
        criadoEm: d.CreateDate,
        fechadoEm: d.FinishDate,
      })),
      propostas: (propostas ?? []).map((q: any) => ({
        numero: q.QuoteNumber,
        revisao: q.ReviewNumber,
        valor: q.Amount,
        data: q.Date ?? q.CreateDate,
        ultima: q.LastReview,
      })),
      leituraInteracoes: interacoes !== null,
      leituraTarefas: tarefasP !== null,
    };
    for (const r of interacoes ?? [])
      linha.push({
        quando: r.Date,
        tipo: "Interação",
        titulo: "Registro no Ploomes",
        detalhe: String(r.Content ?? "")
          .replace(/<[^>]+>/g, " ")
          .trim(),
        quem: r.Creator?.Name ?? null,
        origem: "Ploomes",
      });
    for (const t of tarefasP ?? [])
      linha.push({
        quando: t.DateTime,
        tipo: t.Finished ? "Tarefa concluída" : "Tarefa",
        titulo: t.Title,
        detalhe: t.Description,
        quem: t.Owner?.Name ?? null,
        origem: "Ploomes",
      });
    if (deal?.CreateDate)
      linha.push({
        quando: deal.CreateDate,
        tipo: "Negócio",
        titulo: `Negócio criado no Ploomes (${deal.Pipeline?.Name ?? "funil"})`,
        quem: deal.Creator?.Name ?? null,
        origem: "Ploomes",
      });
  }

  // ---------- Linha do tempo do Solar OS ----------
  linha.push({
    quando: lead.created_at,
    tipo: "Entrada",
    titulo: `Lead criado (${lead.origem ?? "origem não informada"})`,
    detalhe: lead.canal ?? lead.sistema_entrada ?? null,
    origem: "Solar OS",
  });
  for (const e of eventos.data ?? [])
    linha.push({
      quando: e.created_at,
      tipo: "Evento",
      titulo: `${e.event}${e.step ? ` · ${e.step}` : ""}`,
      detalhe: [e.result, e.source].filter(Boolean).join(" · ") || null,
      origem: "Solar OS",
    });
  for (const t of transferencias.data ?? [])
    linha.push({
      quando: t.created_at,
      tipo: "Transferência",
      titulo: `De ${nomeDe(t.from_user) ?? "—"} para ${nomeDe(t.to_user) ?? "—"}`,
      detalhe: t.reason,
      quem: nomeDe(t.performed_by),
      origem: "Solar OS",
    });
  for (const t of tarefas.data ?? [])
    linha.push({
      quando: t.completed_at ?? t.due_at ?? t.created_at,
      tipo: t.completed_at ? "Cadência concluída" : "Cadência",
      titulo: t.title,
      detalhe: [t.channel, t.notes ?? t.description].filter(Boolean).join(" · ") || null,
      quem: nomeDe(t.completed_by),
      origem: "Solar OS",
    });
  for (const a of agenda.data ?? [])
    linha.push({
      quando: a.starts_at,
      tipo: "Agenda",
      titulo: a.title ?? a.type ?? "Compromisso",
      detalhe: [a.status, a.notes].filter(Boolean).join(" · ") || null,
      quem: nomeDe(a.consultor_id),
      origem: "Solar OS",
    });
  for (const cv of conversoes.data ?? [])
    linha.push({
      quando: cv.created_at,
      tipo: "Conversão",
      titulo: `${cv.event_name} → ${cv.platform}`,
      detalhe: [cv.status, cv.status_detail].filter(Boolean).join(" · ") || null,
      origem: "Solar OS",
    });
  for (const t of timeline.data ?? [])
    linha.push({
      quando: t.ts ?? t.created_at,
      tipo: t.kind ?? "Linha do tempo",
      titulo: t.title ?? t.summary ?? "Atualização",
      detalhe: t.summary && t.summary !== t.title ? t.summary : null,
      quem: t.actor_name ?? null,
      origem: "Solar OS",
    });
  // WhatsApp: primeira e última mensagem como marcos (a conversa inteira vai em `conversa`)
  const msgs = mensagens ?? [];
  if (msgs.length) {
    linha.push({
      quando: msgs[0].occurred_at,
      tipo: "WhatsApp",
      titulo: "Início da conversa no WhatsApp",
      detalhe: String(msgs[0].body ?? "").slice(0, 200),
      origem: "WhatsApp",
    });
    if (msgs.length > 1)
      linha.push({
        quando: msgs[msgs.length - 1].occurred_at,
        tipo: "WhatsApp",
        titulo: `Última mensagem (${msgs.length} no total)`,
        detalhe: String(msgs[msgs.length - 1].body ?? "").slice(0, 200),
        origem: "WhatsApp",
      });
  }
  linha.sort((a, b) => (String(a.quando) < String(b.quando) ? 1 : -1));

  // conversa antiga (JSON) quando não há mensagens novas
  const antigas = (conversasAntigas.data ?? []).flatMap((c: any) =>
    Array.isArray(c.messages)
      ? c.messages.map((m: any) => ({
          direction:
            m.role === "user" || m.from === "user" || m.direction === "inbound"
              ? "inbound"
              : "outbound",
          body: m.content ?? m.text ?? m.body ?? "",
          occurred_at: m.ts ?? m.timestamp ?? m.created_at ?? c.created_at,
          ai_generated: m.role === "assistant",
        }))
      : [],
  );

  const responsavel =
    perfilResp?.nome ||
    (lead.ploomes_owner_id ? nomes.porPloomes.get(Number(lead.ploomes_owner_id)) : null) ||
    "Sem responsável";

  return {
    lead,
    resumo: {
      responsavel,
      responsavelPloomes: lead.ploomes_owner_id
        ? (nomes.porPloomes.get(Number(lead.ploomes_owner_id)) ?? null)
        : null,
      unidade: unidadeDe(lead, perfilResp?.unidade ?? null, resolver),
      etapaPloomes: await rotuloEtapa(lead.pipeline_id, lead.pipeline_stage_id),
    },
    quiz: respostasQuiz(lead.mensagem),
    quizData: lead.quiz_data ?? null,
    ploomes,
    linhaDoTempo: linha,
    conversas: conversas.data ?? [],
    conversa: msgs.length ? msgs : antigas,
    filaPloomes: fila.data ?? [],
    duplicados: duplicados.data ?? [],
    contagens: {
      eventos: (eventos.data ?? []).length,
      mensagens: msgs.length || antigas.length,
      tarefas: (tarefas.data ?? []).length,
      agenda: (agenda.data ?? []).length,
      transferencias: (transferencias.data ?? []).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Relatório diário                                                    */
/* ------------------------------------------------------------------ */

const contar = (xs: LinhaQuiz[], k: (l: LinhaQuiz) => string) => {
  const m = new Map<string, number>();
  for (const l of xs) m.set(k(l), (m.get(k(l)) ?? 0) + 1);
  return [...m.entries()].map(([chave, qtd]) => ({ chave, qtd })).sort((a, b) => b.qtd - a.qtd);
};

/** 15h de Brasília de hoje (ou de ontem, se ainda não passou das 15h), em ISO. */
export function corteDas15h(agora = new Date()) {
  const brt = new Date(agora.getTime() - 3 * 3600_000);
  const dia = brt.toISOString().slice(0, 10);
  let ate = new Date(`${dia}T18:00:00.000Z`); // 15h BRT = 18h UTC
  if (agora < ate) ate = new Date(ate.getTime() - 86400_000);
  const de = new Date(ate.getTime() - 86400_000);
  return { de: de.toISOString(), ate: ate.toISOString() };
}

export async function montarRelatorio(de: string, ate: string) {
  const linhas = (await listarLeadsQuiz(de, ate)).filter((l) => !l.duplicado);
  // acumulado do mês (BRT) até o corte
  const ateBrt = new Date(new Date(ate).getTime() - 3 * 3600_000);
  const inicioMes = new Date(`${ateBrt.toISOString().slice(0, 7)}-01T03:00:00.000Z`).toISOString();
  const mes = (await listarLeadsQuiz(inicioMes, ate)).filter((l) => !l.duplicado);
  return {
    periodo: { de, ate },
    total: linhas.length,
    totalMes: mes.length,
    porResponsavel: contar(linhas, (l) => l.responsavel),
    porUnidade: contar(linhas, (l) => l.unidade),
    porEtapa: contar(linhas, (l) => l.etapaPloomes ?? l.etapa ?? "Sem etapa"),
    porSincronizacao: contar(linhas, (l) => l.sincronizacao),
    semResponsavel: linhas.filter((l) => l.responsavel === "Sem responsável").length,
    foraDoPloomes: linhas.filter((l) => l.sincronizacao !== "No Ploomes").length,
    mesPorResponsavel: contar(mes, (l) => l.responsavel),
    linhas,
  };
}

export type Relatorio = Awaited<ReturnType<typeof montarRelatorio>>;

/** Gera e guarda o relatório do período (padrão: últimas 24h até as 15h). */
export async function gerarESalvarRelatorio(
  origem: "agendado" | "manual",
  periodo?: { de: string; ate: string },
) {
  const p = periodo ?? corteDas15h();
  const r = await montarRelatorio(p.de, p.ate);
  const sb = await db();
  const { data, error } = await sb
    .from("relatorios_quiz")
    .insert({
      periodo_de: p.de,
      periodo_ate: p.ate,
      total: r.total,
      origem,
      dados: r,
    })
    .select("id,gerado_em")
    .single();
  if (error) throw new Error(`salvar relatório: ${error.message}`);
  return { id: data.id as string, geradoEm: data.gerado_em as string, total: r.total };
}
