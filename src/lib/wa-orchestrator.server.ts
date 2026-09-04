// Orquestrador de resposta do WhatsApp: bot, transbordo humano e opt-out (server-only).

import { buildConversationContext, refreshConversationSummary } from "@/lib/wa-context.server";
import { waAdminClient, waAudit, waSendText, waSendWithRetry } from "@/lib/wa.server";

type Supa = ReturnType<typeof waAdminClient>;

const SENSITIVE = [
  "advogad",
  "process",
  "procon",
  "juridic",
  "reclama",
  "cancelar contrato",
  "distrat",
  "golpe",
  "fraude",
];

const HUMAN_REQUEST = [
  "falar com humano",
  "atendente",
  "pessoa de verdade",
  "quero falar com alguém",
];

export type OrchestrationResult =
  | { action: "ignored"; reason: string }
  | { action: "opt_out" }
  | { action: "handoff"; reason: string }
  | { action: "replied"; text: string };

function matches(text: string, list: string[]) {
  const t = text.toLowerCase();
  return list.some((k) => t.includes(k));
}

async function handoff(supabase: Supa, conversationId: string, orgId: string, reason: string) {
  await supabase
    .from("wa_conversations")
    .update({
      status: "humano",
      handoff_reason: reason,
      handoff_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
  await waAudit(supabase, {
    org_id: orgId,
    action: "wa.handoff",
    entity_type: "wa_conversation",
    entity_id: conversationId,
    detail: { reason },
  });
}

/**
 * Decide e executa a resposta a uma mensagem recebida.
 * Só envia quando o canal está com bot ligado e fora do modo sombra.
 */
export async function orchestrateReply(args: {
  orgId: string;
  conversationId: string;
  contactId: string;
  channelId: string | null;
  userText: string;
}): Promise<OrchestrationResult> {
  const supabase = waAdminClient();

  const [{ data: org }, { data: channel }, { data: contact }] = await Promise.all([
    supabase
      .from("organizations")
      .select("name, opt_out_keywords")
      .eq("id", args.orgId)
      .maybeSingle(),
    args.channelId
      ? supabase
          .from("wa_channels")
          .select("id, bot_enabled, shadow_mode, test_allowlist, persona, business_hours")
          .eq("id", args.channelId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("wa_contacts")
      .select("phone_e164, consent_status")
      .eq("id", args.contactId)
      .maybeSingle(),
  ]);

  const text = args.userText.trim();

  // 1) Opt-out sempre vence, mesmo em modo sombra
  const optOutWords = org?.opt_out_keywords ?? ["sair", "parar", "descadastrar"];
  if (optOutWords.some((w) => text.toLowerCase() === w.toLowerCase())) {
    await supabase
      .from("wa_contacts")
      .update({ consent_status: "opt_out", opt_out_at: new Date().toISOString() })
      .eq("id", args.contactId);
    await supabase.from("wa_consents").insert({
      org_id: args.orgId,
      contact_id: args.contactId,
      action: "opt_out",
      source: "palavra-chave",
      evidence: { text } as never,
    });
    await waAudit(supabase, {
      org_id: args.orgId,
      action: "wa.opt_out",
      entity_type: "wa_contact",
      entity_id: args.contactId,
      detail: { text },
    });
    return { action: "opt_out" };
  }

  // 2) Canal desligado / sombra → não responde
  if (!channel || channel.shadow_mode || !channel.bot_enabled) {
    return { action: "ignored", reason: "canal em modo sombra ou bot desligado" };
  }

  // 3) Lista de teste (quando preenchida, só responde para ela)
  const allowlist = channel.test_allowlist ?? [];
  if (allowlist.length && contact?.phone_e164 && !allowlist.includes(contact.phone_e164)) {
    return { action: "ignored", reason: "fora da lista de teste" };
  }

  // 4) Já está com humano
  const { data: conv } = await supabase
    .from("wa_conversations")
    .select("status")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (conv?.status === "humano") {
    return { action: "ignored", reason: "conversa em atendimento humano" };
  }

  // 5) Transbordo por pedido explícito ou tema sensível
  if (matches(text, HUMAN_REQUEST)) {
    await handoff(supabase, args.conversationId, args.orgId, "cliente pediu atendimento humano");
    await sendAndLog(
      supabase,
      args,
      "Claro! Já estou chamando alguém do time pra continuar com você por aqui. 🙂",
    );
    return { action: "handoff", reason: "pedido do cliente" };
  }
  if (matches(text, SENSITIVE)) {
    await handoff(supabase, args.conversationId, args.orgId, "tema sensível");
    await sendAndLog(
      supabase,
      args,
      "Esse assunto eu prefiro passar direto para uma pessoa do time. Já estou encaminhando.",
    );
    return { action: "handoff", reason: "tema sensível" };
  }

  // 6) Resposta com contexto
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { action: "ignored", reason: "LOVABLE_API_KEY ausente" };

  const { contextBlock, turns } = await buildConversationContext(supabase, {
    orgId: args.orgId,
    conversationId: args.conversationId,
    contactId: args.contactId,
    lastUserText: text,
  });

  const persona =
    channel.persona ??
    `Você é a assistente comercial da ${org?.name ?? "empresa"} no WhatsApp. Fale em português do Brasil, mensagens curtas, uma pergunta por vez, sem markdown. Use apenas as informações do contexto; se não souber, diga que vai confirmar com o time.`;

  let reply = "";
  let lowConfidence = false;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content: `${persona}\n\nSe a resposta não estiver no contexto e for algo que exige o time (preço fechado, contrato, prazo de obra), responda exatamente com: ESCALAR.\n\n${contextBlock}`,
          },
          ...turns.map((t) => ({ role: t.role, content: t.content })),
        ],
      }),
    });
    if (!res.ok) throw new Error(`chat [${res.status}]: ${await res.text()}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    reply = json.choices?.[0]?.message?.content?.trim() ?? "";
    lowConfidence = !reply || reply.toUpperCase().includes("ESCALAR");
  } catch (e) {
    console.error("[wa orchestrate]", e);
    lowConfidence = true;
  }

  if (lowConfidence) {
    await handoff(supabase, args.conversationId, args.orgId, "baixa confiança da IA");
    await sendAndLog(
      supabase,
      args,
      "Deixa eu confirmar isso com o time pra não te passar informação errada. Já te retorno por aqui. 🙂",
    );
    return { action: "handoff", reason: "baixa confiança" };
  }

  await sendAndLog(supabase, args, reply);
  await refreshConversationSummary(supabase, args.conversationId, [
    ...turns,
    { role: "assistant", content: reply },
  ]);
  return { action: "replied", text: reply };
}

/** Envia e registra a mensagem de saída. */
export async function sendAndLog(
  supabase: Supa,
  args: { orgId: string; conversationId: string; contactId: string },
  text: string,
  opts: { aiGenerated?: boolean; actorId?: string | null } = { aiGenerated: true },
) {
  const { data: contact } = await supabase
    .from("wa_contacts")
    .select("phone_e164")
    .eq("id", args.contactId)
    .maybeSingle();
  if (!contact?.phone_e164) return null;

  let providerId: string | null = null;
  let error: string | null = null;
  try {
    const res = await waSendWithRetry(() => waSendText(contact.phone_e164, text));
    providerId = res.messages?.[0]?.id ?? null;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    console.error("[wa send]", error);
  }

  await supabase.from("wa_messages").insert({
    org_id: args.orgId,
    conversation_id: args.conversationId,
    contact_id: args.contactId,
    direction: "outbound",
    msg_type: "text",
    body: text,
    provider_message_id: providerId,
    status: error ? "failed" : "sent",
    error,
    ai_generated: opts.aiGenerated ?? true,
    occurred_at: new Date().toISOString(),
  });

  await supabase
    .from("wa_contacts")
    .update({ last_outbound_at: new Date().toISOString() })
    .eq("id", args.contactId);
  await supabase
    .from("wa_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", args.conversationId);

  await waAudit(supabase, {
    org_id: args.orgId,
    actor_id: opts.actorId ?? null,
    action: error ? "wa.send_failed" : "wa.send",
    entity_type: "wa_conversation",
    entity_id: args.conversationId,
    detail: { ai: opts.aiGenerated ?? true, error },
  });

  return { providerId, error };
}

/**
 * Orquestra a resposta automática da LIZ IA para um chat específico no WhatsApp Z-API.
 */
export async function orchestrateLizZapiReply(args: {
  supabase: any;
  orgId: string;
  conversationId: string;
  contactId: string;
  phone: string;
  userText: string;
}): Promise<OrchestrationResult> {
  const { supabase, orgId, conversationId, contactId, phone, userText } = args;
  const text = userText.trim();
  if (!text) return { action: "ignored", reason: "mensagem sem texto" };

  // 0) Prevenção contra respostas em looping imediato (< 2s)
  const { data: lastAiOutbound } = await supabase
    .from("wa_messages")
    .select("body, occurred_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .eq("ai_generated", true)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastAiOutbound?.occurred_at) {
    const elapsedSec = (Date.now() - new Date(lastAiOutbound.occurred_at).getTime()) / 1000;
    if (elapsedSec < 2) {
      console.log(`[LIZ IA] Debounce de resposta IA no chat ${conversationId} (${elapsedSec.toFixed(1)}s atrás)`);
      return { action: "ignored", reason: "resposta IA recente em andamento" };
    }
  }

  // 1) Opt-out
  const { data: org } = await supabase.from("organizations").select("opt_out_keywords").eq("id", orgId).maybeSingle();
  const optOutWords = org?.opt_out_keywords ?? ["sair", "parar", "descadastrar"];
  if (optOutWords.some((w: string) => text.toLowerCase() === w.toLowerCase())) {
    await supabase
      .from("wa_contacts")
      .update({ consent_status: "opt_out", opt_out_at: new Date().toISOString() })
      .eq("id", contactId);
    return { action: "opt_out" };
  }

  // 2) Transbordo por pedido explícito ou tema sensível
  if (matches(text, HUMAN_REQUEST)) {
    await handoff(supabase, conversationId, orgId, "cliente pediu atendimento humano");
    const handoffMsg = "Claro! Já estou chamando a Stephany da nossa equipe para continuar com você por aqui. 🙂";
    await sendZApiAndRecord(supabase, orgId, conversationId, contactId, phone, handoffMsg);
    return { action: "handoff", reason: "pedido do cliente" };
  }

  if (matches(text, SENSITIVE)) {
    await handoff(supabase, conversationId, orgId, "tema sensível");
    const sensitiveMsg = "Esse assunto eu prefiro passar direto para um especialista do time. Já estou encaminhando para a Stephany!";
    await sendZApiAndRecord(supabase, orgId, conversationId, contactId, phone, sensitiveMsg);
    return { action: "handoff", reason: "tema sensível" };
  }

  // 3) Busca as 20 mensagens MAIS RECENTES em ordem cronológica verdadeira
  const { data: recentMsgs } = await supabase
    .from("wa_messages")
    .select("direction, body, occurred_at")
    .eq("conversation_id", conversationId)
    .not("body", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(20);

  const turns = (recentMsgs ?? [])
    .reverse()
    .map((m: any) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: String(m.body || "").trim(),
    }))
    .filter((t: { role: "user" | "assistant"; content: string }) => t.content.length > 0);

  const messagesForAi = [...turns];
  if (!messagesForAi.length || messagesForAi[messagesForAi.length - 1].content !== text) {
    messagesForAi.push({ role: "user", content: text });
  }

  // Busca os aprendizados e regras ensinados pela SDR/equipe na sala de treinamento /liztreinamento
  let dynamicSystemPrompt = "";
  try {
    const { LIZ_CAPTURE_PROMPT } = await import("@/lib/liz-prompt");
    const { data: aprendizados } = await supabase
      .from("liz_aprendizados")
      .select("categoria, titulo, conteudo")
      .order("created_at", { ascending: false })
      .limit(30);

    let aprendizadosText = "";
    if (aprendizados && aprendizados.length > 0) {
      aprendizadosText =
        "\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📚 REGRAS E DIRETRIZES ENSINADAS PELA SDR (STEPHANY / LZ7):\n" +
        aprendizados
          .map(
            (a: any) =>
              `• [${(a.categoria || "geral").toUpperCase()}] ${a.titulo}: ${a.conteudo}`,
          )
          .join("\n");
    }
    dynamicSystemPrompt = `${LIZ_CAPTURE_PROMPT}${aprendizadosText}`;
  } catch {
    const { LIZ_CAPTURE_PROMPT } = await import("@/lib/liz-prompt");
    dynamicSystemPrompt = LIZ_CAPTURE_PROMPT;
  }

  let replyText = "";
  try {
    const { getResolvedAiModel } = await import("@/lib/ai-provider.server");
    const { generateText } = await import("ai");

    const model = getResolvedAiModel();
    const aiResponse = await generateText({
      model,
      system: dynamicSystemPrompt,
      messages: messagesForAi,
    });

    replyText = aiResponse.text?.trim() ?? "";
  } catch (aiErr) {
    console.error("[LIZ IA Primary Generation Error]", aiErr);
    // Fallback secundário direto via Lovable Gateway API
    if (process.env.LOVABLE_API_KEY) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: dynamicSystemPrompt },
              ...messagesForAi.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as any;
          replyText = json.choices?.[0]?.message?.content?.trim() ?? "";
        }
      } catch (fallbackErr) {
        console.error("[LIZ IA Fallback Gateway Error]", fallbackErr);
      }
    }
  }

  if (!replyText) {
    replyText = "Olá! Tudo bem? Me chamo Liz, da equipe de atendimento da LZ7 Energia Solar. Como posso te ajudar com o seu projeto de energia solar hoje?";
  }

  // 4) Envia via Z-API e grava no banco
  await sendZApiAndRecord(supabase, orgId, conversationId, contactId, phone, replyText);

  // 5) Se o lead for qualificado no WhatsApp geral (não vindo do Quiz), cadastra automaticamente no Ploomes
  try {
    await autoRegisterPloomesLeadIfQualified({
      supabase,
      orgId,
      conversationId,
      contactId,
      phone,
      messages: [...messagesForAi, { role: "assistant", content: replyText }],
    });
  } catch (syncPloomesErr) {
    console.error("[LIZ IA -> Ploomes Auto-Registration Error]", syncPloomesErr);
  }

  return { action: "replied", text: replyText };
}

/**
 * Detecta se o lead atingiu a qualificação no WhatsApp geral e envia para o Ploomes CRM.
 * (Pula automaticamente se o lead já foi cadastrado ou veio do Quiz/Site).
 */
async function autoRegisterPloomesLeadIfQualified(args: {
  supabase: any;
  orgId: string;
  conversationId: string;
  contactId: string;
  phone: string;
  messages: Array<{ role: string; content: string }>;
}) {
  const { supabase, orgId, conversationId, contactId, phone, messages } = args;

  const cleanPhone = phone.replace(/\D/g, "");
  const last8 = cleanPhone.slice(-8);

  // 1. DEDUPLICAÇÃO NÍVEL 1: Verifica se o contato já possui lead_id
  const { data: contact } = await supabase
    .from("wa_contacts")
    .select("id, profile_name, phone_e164, lead_id")
    .eq("id", contactId)
    .maybeSingle();

  if (contact?.lead_id) {
    return; // Lead já cadastrado anteriormente
  }

  // 2. DEDUPLICAÇÃO NÍVEL 2: Verifica se já existe lead com este telefone na tabela leads
  if (last8.length >= 8) {
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("id, external_id, nome, cidade, valor_conta")
      .ilike("telefone", `%${last8}`)
      .limit(1);

    if (existingLeads && existingLeads.length > 0) {
      // Já cadastrado! Apenas vincula o contato localmente e não duplica no Ploomes
      await supabase.from("wa_contacts").update({ lead_id: existingLeads[0].id }).eq("id", contactId);
      return;
    }
  }

  // 3. DEDUPLICAÇÃO NÍVEL 3: Verifica se já houve disparo de criação no audit log para esta conversa ou telefone
  const { data: previousAudit } = await supabase
    .from("wa_audit_log")
    .select("id")
    .eq("entity_id", conversationId)
    .eq("action", "ploomes.lead_created")
    .limit(1)
    .maybeSingle();

  if (previousAudit) {
    return; // Já enviado ao Ploomes
  }

  // 4. Analisa o diálogo completo para extrair nome, cidade real e valor da conta
  const fullDialogue = messages
    .map((m) => `${m.role === "user" ? "Cliente" : "LIZ"}: ${m.content}`)
    .join("\n");

  let qualificado = false;
  let nome = (contact?.profile_name || "Cliente WhatsApp").trim();
  let cidadeFinal = "";
  let estadoFinal = "";
  let valorConta = 0;
  let tensao = "";

  try {
    const { getResolvedAiModel } = await import("@/lib/ai-provider.server");
    const { generateObject } = await import("ai");
    const { z } = await import("zod");

    const model = getResolvedAiModel();
    const extraction = await generateObject({
      model,
      schema: z.object({
        isQualified: z
          .boolean()
          .describe(
            "True se o cliente informou o nome da sua cidade específica (ex: Pirapozinho, Londrina, etc.) E o valor da conta de luz >= R$ 200 (ou pretende aumentar consumo)",
          ),
        nome: z.string().optional().describe("Nome do cliente (ex: Kátia, Marcelo)"),
        cidade: z.string().optional().describe("Nome exato da cidade (ex: Pirapozinho, Londrina, Wenceslau Braz, Presidente Prudente, Maringá, Ponta Grossa). NUNCA coloque 'Paraná' ou 'São Paulo' aqui!"),
        estado: z.string().optional().describe("Sigla do estado com 2 letras (ex: SP para Pirapozinho/Presidente Prudente, PR para Londrina/Wenceslau/Maringá)"),
        valorContaMensal: z.number().optional().describe("Valor da conta em reais (apenas número)"),
        tensao: z.enum(["110V", "220V", "outro"]).optional().describe("Tensão elétrica"),
      }),
      prompt: `Analise a conversa de WhatsApp abaixo entre a LIZ (consultora LZ7 Energia Solar) e o cliente.
Extraia com MÁXIMA PRECISÃO os dados de qualificação:
1. NOME do cliente (ex: Kátia).
2. CIDADE onde fica o imóvel ou residência:
   - Se o cliente disse "sou de Pirapozinho", a cidade é "Pirapozinho" e o estado é "SP".
   - Se o cliente disse "moro em Londrina", a cidade é "Londrina" e o estado é "PR".
   - Se o cliente disse "Wenceslau", a cidade é "Wenceslau Braz" e o estado é "PR".
   - NUNCA use "Paraná" como cidade, pois Paraná é um Estado (UF)! Se não houver cidade específica mencionada, isQualified DEVE ser false!
3. VALOR da conta em reais (>= 200).

Diálogo:
${fullDialogue}`,
    });

    if (
      extraction.object.isQualified &&
      extraction.object.cidade &&
      extraction.object.valorContaMensal
    ) {
      qualificado = true;
      if (extraction.object.nome && extraction.object.nome !== "Cliente" && extraction.object.nome !== "Cliente WhatsApp") {
        nome = extraction.object.nome;
      }
      cidadeFinal = extraction.object.cidade.trim();
      estadoFinal = (extraction.object.estado || "").trim().toUpperCase();
      valorConta = extraction.object.valorContaMensal;
      tensao = extraction.object.tensao || "";
    }
  } catch (aiExtractionErr) {
    // Fallback por regex rigoroso (somente se a cidade for reconhecida expressamente)
    const lower = fullDialogue.toLowerCase();
    const hasValue =
      lower.match(/(?:conta|gasto|média|uns|valor|pago|dá|r\$)\s*([0-9]{3,5})/i) ||
      lower.match(/([0-9]{3,5})\s*(?:reais|\/mês)/i);

    if (hasValue && Number(hasValue[1]) >= 200) {
      valorConta = Number(hasValue[1]);

      if (lower.includes("pirapozinho")) {
        cidadeFinal = "Pirapozinho";
        estadoFinal = "SP";
        qualificado = true;
      } else if (lower.includes("prudente")) {
        cidadeFinal = "Presidente Prudente";
        estadoFinal = "SP";
        qualificado = true;
      } else if (lower.includes("alvares machado")) {
        cidadeFinal = "Álvares Machado";
        estadoFinal = "SP";
        qualificado = true;
      } else if (lower.includes("wenceslau")) {
        cidadeFinal = "Wenceslau Braz";
        estadoFinal = "PR";
        qualificado = true;
      } else if (lower.includes("londrina")) {
        cidadeFinal = "Londrina";
        estadoFinal = "PR";
        qualificado = true;
      } else if (lower.includes("maringa")) {
        cidadeFinal = "Maringá";
        estadoFinal = "PR";
        qualificado = true;
      } else if (lower.includes("ponta grossa")) {
        cidadeFinal = "Ponta Grossa";
        estadoFinal = "PR";
        qualificado = true;
      }
    }
  }

  // Normalização final de cidades e estados para evitar qualquer 'Paraná - RN'
  const cNorm = cidadeFinal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (cNorm.includes("pirapozinho")) {
    cidadeFinal = "Pirapozinho";
    estadoFinal = "SP";
  } else if (cNorm.includes("prudente") || cNorm.includes("presidente prudente")) {
    cidadeFinal = "Presidente Prudente";
    estadoFinal = "SP";
  } else if (cNorm.includes("alvares machado")) {
    cidadeFinal = "Álvares Machado";
    estadoFinal = "SP";
  } else if (cNorm.includes("tarabai")) {
    cidadeFinal = "Tarabai";
    estadoFinal = "SP";
  } else if (cNorm.includes("londrina")) {
    cidadeFinal = "Londrina";
    estadoFinal = "PR";
  } else if (cNorm.includes("wenceslau")) {
    cidadeFinal = "Wenceslau Braz";
    estadoFinal = "PR";
  } else if (cNorm.includes("maringa")) {
    cidadeFinal = "Maringá";
    estadoFinal = "PR";
  } else if (cNorm.includes("ponta grossa")) {
    cidadeFinal = "Ponta Grossa";
    estadoFinal = "PR";
  }

  // Se a cidade for genérica como "Paraná", "São Paulo" ou vazia -> NÃO qualifica
  if (!qualificado || !cidadeFinal || cNorm === "parana" || cNorm === "sao paulo" || cNorm === "brasil" || !valorConta) {
    return;
  }

  const cidadeCompleta = estadoFinal ? `${cidadeFinal} - ${estadoFinal}` : cidadeFinal;

  console.log(
    `[LIZ IA] 🚀 Lead QUALIFICADO detectado! Cadastrando no Ploomes: ${nome} | ${cidadeCompleta} | R$ ${valorConta} | ${phone}`,
  );

  // 5. Cadastra no banco local de leads
  const { data: newLead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      org_id: orgId,
      nome,
      telefone: phone,
      cidade: cidadeCompleta,
      estado: estadoFinal || null,
      valor_conta: String(valorConta),
      origem: "WhatsApp - LIZ IA",
      stage: "qualificado",
      produto_interesse: tensao ? `Energia Solar (${tensao})` : "Energia Solar",
    })
    .select("id")
    .single();

  if (leadErr) {
    console.error("[Create local lead error]", leadErr);
  }

  const leadId = newLead?.id;
  if (leadId) {
    // Bloqueia imediatamente no contato para evitar duplicidades em mensagens simultâneas
    await supabase.from("wa_contacts").update({ lead_id: leadId }).eq("id", contactId);
  }

  // 6. Cadastra no CRM Ploomes Oficial com cidade e filial corretas
  const { pushLeadToPloomesForm } = await import("@/lib/ploomes.server");
  const ploomesRes = await pushLeadToPloomesForm({
    nome,
    telefone: phone,
    cidade: cidadeCompleta,
    estado: estadoFinal,
    valor_conta: String(valorConta),
    mensagem: `☀️ Lead Qualificado no WhatsApp pela LIZ IA\nNome: ${nome}\nCidade: ${cidadeCompleta}\nValor da Conta: R$ ${valorConta}\nTensão: ${tensao || "110V/220V"}\nTelefone: ${phone}`,
    origem: "WhatsApp - LIZ IA",
  });

  console.log(`[LIZ IA] Envio para Ploomes concluído:`, ploomesRes);

  // 7. Registra auditoria
  await supabase.from("wa_audit_log").insert({
    org_id: orgId,
    action: "ploomes.lead_created",
    entity_type: "wa_conversation",
    entity_id: conversationId,
    detail: { nome, cidade: cidadeCompleta, estado: estadoFinal, valorConta, phone, ploomesRes, leadId },
  });
}

async function sendZApiAndRecord(
  supabase: any,
  orgId: string,
  conversationId: string,
  contactId: string,
  phone: string,
  text: string,
) {
  // Divide a mensagem em blocos naturais caso tenha quebras de linha ou seja extensa
  const rawChunks = text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  const chunks: string[] = [];
  for (const c of rawChunks) {
    if (c.length <= 350) {
      chunks.push(c);
    } else {
      // Divide por frases se o parágrafo for muito longo
      const sentences = c.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [c];
      let currentChunk = "";
      for (const s of sentences) {
        if ((currentChunk + s).length <= 300) {
          currentChunk += s;
        } else {
          if (currentChunk.trim()) chunks.push(currentChunk.trim());
          currentChunk = s;
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
    }
  }

  const finalChunks = chunks.length > 0 ? chunks : [text];

  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.startsWith("55") && cleanPhone.length === 12) {
    const ddd = cleanPhone.slice(2, 4);
    const rest = cleanPhone.slice(4);
    cleanPhone = `55${ddd}9${rest}`;
  } else if (!cleanPhone.startsWith("55") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
    if (cleanPhone.length === 10) {
      const ddd = cleanPhone.slice(0, 2);
      const rest = cleanPhone.slice(2);
      cleanPhone = `55${ddd}9${rest}`;
    } else {
      cleanPhone = `55${cleanPhone}`;
    }
  }

  for (let i = 0; i < finalChunks.length; i++) {
    const chunkText = finalChunks[i];
    let providerId: string | null = null;
    let status = "sent";

    try {
      const { sendZApiText } = await import("@/lib/zapi.server");
      const res = await sendZApiText(cleanPhone || phone, chunkText);
      providerId = res?.messageId || res?.id || res?.zaapId || null;
    } catch (e) {
      console.error("[Z-API Send from LIZ IA Error]", e);
      status = "failed";
    }

    await supabase.from("wa_messages").insert({
      org_id: orgId,
      conversation_id: conversationId,
      contact_id: contactId,
      direction: "outbound",
      msg_type: "text",
      body: chunkText,
      provider_message_id: providerId,
      status,
      source: "zapi",
      ai_generated: true,
      occurred_at: new Date(Date.now() + i * 300).toISOString(),
    });

    await supabase
      .from("wa_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        summary: chunkText.slice(0, 160),
      })
      .eq("id", conversationId);

    // Pequeno intervalo natural entre mensagens consecutivas
    if (i < finalChunks.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
}
