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

  // 0) Prevenção contra mensagens duplicadas em janela curta (deboucing de 5s para a mesma conversa)
  const { data: lastOutbound } = await supabase
    .from("wa_messages")
    .select("body, occurred_at")
    .eq("conversation_id", conversationId)
    .eq("direction", "outbound")
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOutbound?.occurred_at) {
    const elapsedSec = (Date.now() - new Date(lastOutbound.occurred_at).getTime()) / 1000;
    if (elapsedSec < 5) {
      console.log(`[LIZ IA] Ignorando envio duplicado no chat ${conversationId} (${elapsedSec.toFixed(1)}s atrás)`);
      return { action: "ignored", reason: "resposta recente em andamento" };
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

  let replyText = "";
  try {
    const { getResolvedAiModel } = await import("@/lib/ai-provider.server");
    const { LIZ_CAPTURE_PROMPT } = await import("@/lib/liz-prompt");
    const { generateText } = await import("ai");

    const model = getResolvedAiModel();
    const aiResponse = await generateText({
      model,
      system: LIZ_CAPTURE_PROMPT,
      messages: messagesForAi,
    });

    replyText = aiResponse.text?.trim() ?? "";
  } catch (aiErr) {
    console.error("[LIZ IA Primary Generation Error]", aiErr);
    // Fallback secundário direto via Lovable Gateway API
    if (process.env.LOVABLE_API_KEY) {
      try {
        const { LIZ_CAPTURE_PROMPT } = await import("@/lib/liz-prompt");
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: LIZ_CAPTURE_PROMPT },
              ...messagesForAi.map((m) => ({ role: m.role, content: m.content })),
            ],
          }),
        });
        if (res.ok) {
          const json = await res.json() as any;
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

  return { action: "replied", text: replyText };
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

  for (let i = 0; i < finalChunks.length; i++) {
    const chunkText = finalChunks[i];
    let providerId: string | null = null;
    let status = "sent";

    try {
      const { sendZApiText } = await import("@/lib/zapi.server");
      const res = await sendZApiText(phone, chunkText);
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
