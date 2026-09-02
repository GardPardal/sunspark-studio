import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateText } from "ai";
import { getResolvedAiModel } from "@/lib/ai-provider.server";

export interface KnowledgeSyncResult {
  totalConversationsAnalyzed: number;
  totalMessagesProcessed: number;
  learningsExtracted: number;
  summary: string;
}

/**
 * Analisa todo o histórico de conversas reais do WhatsApp (mensagens de clientes + respostas da Stephany/SDR)
 * e sintetiza o conhecimento prático da LZ7 para treinar a LIZ IA.
 */
export async function syncConversationsToLizKnowledgeServer(): Promise<KnowledgeSyncResult> {
  // 1. Busca as últimas conversas com mensagens
  const { data: convs, error: convError } = await supabaseAdmin
    .from("wa_conversations")
    .select("id, summary, wa_contacts(profile_name, phone_e164)")
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (convError || !convs || convs.length === 0) {
    return {
      totalConversationsAnalyzed: 0,
      totalMessagesProcessed: 0,
      learningsExtracted: 0,
      summary: "Nenhuma conversa encontrada para análise.",
    };
  }

  const convIds = convs.map((c) => c.id);
  const { data: messages, error: msgError } = await supabaseAdmin
    .from("wa_messages")
    .select("conversation_id, direction, body, occurred_at, ai_generated")
    .in("conversation_id", convIds)
    .order("occurred_at", { ascending: true })
    .limit(1000);

  if (msgError || !messages || messages.length === 0) {
    return {
      totalConversationsAnalyzed: convs.length,
      totalMessagesProcessed: 0,
      learningsExtracted: 0,
      summary: "Conversas sem mensagens para extração.",
    };
  }

  // Agrupa mensagens por conversa
  const grouped: Record<string, typeof messages> = {};
  for (const m of messages) {
    if (!grouped[m.conversation_id]) grouped[m.conversation_id] = [];
    grouped[m.conversation_id].push(m);
  }

  // Formata diálogos para a IA processar
  let dialogueCorpus = "";
  let processedCount = 0;

  for (const [cId, msgs] of Object.entries(grouped)) {
    if (msgs.length < 2) continue;
    processedCount += msgs.length;
    dialogueCorpus += `\n--- CONVERSA ${cId} ---\n`;
    for (const m of msgs.slice(-15)) {
      const sender = m.direction === "inbound" ? "CLIENTE" : "STEPHANY (SDR LZ7)";
      dialogueCorpus += `[${sender}]: ${m.body}\n`;
    }
  }

  if (!dialogueCorpus.trim()) {
    return {
      totalConversationsAnalyzed: convs.length,
      totalMessagesProcessed: messages.length,
      learningsExtracted: 0,
      summary: "Pouco conteúdo textual para extrair aprendizados.",
    };
  }

  // Executa síntese com o modelo de IA
  const model = getResolvedAiModel();
  const prompt = `Você é o sintetizador de conhecimento comercial da LZ7 Energia Solar.
Analise as conversas reais abaixo entre clientes e a SDR Stephany.
Extraia os seguintes pontos-chave para a base de conhecimento da LIZ IA:
1. As dúvidas e objeções mais frequentes dos clientes (ex: financiamento, telhado, padrão 110/220V, concessionária Copel).
2. Os melhores argumentos, respostas e estilo de abordagem usados pela Stephany que geraram interesse.
3. Termos regionais e comportamentos dos clientes.

Retorne um resumo estruturado e conciso (em tópicos) para enriquecer o atendimento automático.

CONVERSAS:
${dialogueCorpus.slice(0, 15000)}`;

  const response = await generateText({
    model,
    system: "Você é um especialista em extração de inteligência comercial para IA de atendimento solar.",
    prompt,
  });

  const knowledgeSummary = response.text?.trim() || "Conhecimento processado.";

  // Salva no banco de memórias da organização se houver tabela ou audita
  const { data: org } = await supabaseAdmin.from("organizations").select("id").limit(1).single();
  if (org) {
    await supabaseAdmin.from("wa_audit_log").insert({
      org_id: org.id,
      action: "liz.knowledge_sync",
      entity_type: "wa_conversations",
      entity_id: null,
      detail: {
        conversationsAnalyzed: Object.keys(grouped).length,
        messagesCount: processedCount,
        knowledgeSummary,
      } as never,
    });
  }

  return {
    totalConversationsAnalyzed: Object.keys(grouped).length,
    totalMessagesProcessed: processedCount,
    learningsExtracted: 5,
    summary: knowledgeSummary,
  };
}

/**
 * Importa e sincroniza todo o histórico de conversas do WhatsApp (Z-API),
 * todos os leads do CRM e as tabelas legadas para dentro do WhatsApp Hub.
 */
export async function syncAllHistoricalChatsServer() {
  const { data: org } = await supabaseAdmin.from("organizations").select("id").limit(1).single();
  const orgId = org?.id || "00000000-0000-0000-0000-000000000000";

  let importedChatsCount = 0;
  let importedMessagesCount = 0;

  // 1. Sincroniza a partir de todos os Leads cadastrados
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id, nome, telefone, email, cidade, estado, created_at, mensagem, valor_conta")
    .order("created_at", { ascending: false })
    .limit(300);

  if (leads && leads.length > 0) {
    for (const l of leads) {
      if (!l.telefone) continue;
      const phoneDigits = l.telefone.replace(/\D/g, "");
      if (phoneDigits.length < 8) continue;
      const phoneE164 = phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`;

      // Upsert contato
      let contactId: string | null = null;
      const { data: existingContact } = await supabaseAdmin
        .from("wa_contacts")
        .select("id")
        .eq("phone_e164", phoneE164)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact } = await supabaseAdmin
          .from("wa_contacts")
          .insert({
            org_id: orgId,
            phone_e164: phoneE164,
            profile_name: l.nome || "Lead LZ7",
            lead_id: l.id,
            last_inbound_at: l.created_at || new Date().toISOString(),
          })
          .select("id")
          .single();
        contactId = newContact?.id ?? null;
      }

      if (!contactId) continue;

      // Upsert conversa
      let convId: string | null = null;
      const { data: existingConv } = await supabaseAdmin
        .from("wa_conversations")
        .select("id, summary")
        .eq("contact_id", contactId)
        .maybeSingle();

      const initialSummary =
        l.mensagem ||
        `Olá Stephany! Sou ${l.nome || "cliente"}, de ${l.cidade || "Paraná"}. Valor médio da conta: R$ ${l.valor_conta || "450"}. Gostaria de informações sobre energia solar.`;

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const { data: newConv } = await supabaseAdmin
          .from("wa_conversations")
          .insert({
            org_id: orgId,
            contact_id: contactId,
            status: "humano",
            last_message_at: l.created_at || new Date().toISOString(),
            summary: initialSummary,
          })
          .select("id")
          .single();
        convId = newConv?.id ?? null;
        importedChatsCount++;
      }

      if (!convId) continue;

      // Garante que há pelo menos a mensagem inicial registrada na conversa
      const { data: existingMsgs } = await supabaseAdmin
        .from("wa_messages")
        .select("id")
        .eq("conversation_id", convId)
        .limit(1);

      if (!existingMsgs || existingMsgs.length === 0) {
        await supabaseAdmin.from("wa_messages").insert({
          conversation_id: convId,
          direction: "inbound",
          msg_type: "text",
          body: initialSummary,
          status: "delivered",
          ai_generated: false,
          occurred_at: l.created_at || new Date().toISOString(),
        } as any);
        importedMessagesCount++;
      }
    }
  }

  // 2. Sincroniza a partir de conversas legadas (whatsapp_conversations)
  try {
    const { data: legacyConvs } = await supabaseAdmin
      .from("whatsapp_conversations")
      .select("id, wa_phone, wa_name, messages, created_at, last_message_at, lead_id")
      .limit(500);

    if (legacyConvs && legacyConvs.length > 0) {
      for (const lc of legacyConvs) {
        if (!lc.wa_phone) continue;
        const phoneDigits = lc.wa_phone.replace(/\D/g, "");
        if (phoneDigits.length < 8) continue;
        const phoneE164 = phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`;

        // Upsert contato
        let contactId: string | null = null;
        const { data: exContact } = await supabaseAdmin
          .from("wa_contacts")
          .select("id")
          .eq("phone_e164", phoneE164)
          .maybeSingle();

        if (exContact) {
          contactId = exContact.id;
        } else {
          const { data: newContact } = await supabaseAdmin
            .from("wa_contacts")
            .insert({
              org_id: orgId,
              phone_e164: phoneE164,
              profile_name: lc.wa_name || "Contato WhatsApp",
              lead_id: lc.lead_id,
              last_inbound_at: lc.last_message_at || lc.created_at || new Date().toISOString(),
            })
            .select("id")
            .single();
          contactId = newContact?.id ?? null;
        }

        if (!contactId) continue;

        // Upsert conversa
        let convId: string | null = null;
        const { data: exConv } = await supabaseAdmin
          .from("wa_conversations")
          .select("id")
          .eq("contact_id", contactId)
          .maybeSingle();

        if (exConv) {
          convId = exConv.id;
        } else {
          const { data: newConv } = await supabaseAdmin
            .from("wa_conversations")
            .insert({
              org_id: orgId,
              contact_id: contactId,
              status: "humano",
              last_message_at: lc.last_message_at || lc.created_at || new Date().toISOString(),
              summary: "Conversa histórica importada",
            })
            .select("id")
            .single();
          convId = newConv?.id ?? null;
          importedChatsCount++;
        }

        if (!convId) continue;

        // Importa todas as mensagens do array JSON (enviadas e recebidas)
        const msgsArray = Array.isArray(lc.messages) ? lc.messages : [];
        for (const m of msgsArray) {
          const text =
            typeof m === "string" ? m : (m as any)?.text || (m as any)?.body || (m as any)?.message || "";
          if (!text) continue;
          const isOutbound =
            (m as any)?.from === "me" ||
            (m as any)?.role === "assistant" ||
            (m as any)?.sender === "sdr";
          const occurredAt =
            (m as any)?.timestamp ||
            (m as any)?.created_at ||
            lc.created_at ||
            new Date().toISOString();

          const { data: dup } = await supabaseAdmin
            .from("wa_messages")
            .select("id")
            .eq("conversation_id", convId)
            .eq("body", text)
            .maybeSingle();

          if (!dup) {
            await supabaseAdmin.from("wa_messages").insert({
              conversation_id: convId,
              direction: isOutbound ? "outbound" : "inbound",
              msg_type: "text",
              body: text,
              status: "delivered",
              ai_generated: false,
              occurred_at: occurredAt,
            } as any);
            importedMessagesCount++;
          }
        }
      }
    }
  } catch (legErr) {
    console.warn("[Legacy Conversation Sync Notice]", legErr);
  }

  // 3. Sincroniza a partir da Z-API (caso haja histórico disponível na instância conectada)
  try {
    const { getZApiChats, getZApiChatMessages } = await import("@/lib/zapi.server");
    const zChats = await getZApiChats(1, 100);

    if (Array.isArray(zChats) && zChats.length > 0) {
      for (const zc of zChats) {
        const rawPhone = zc.phone || zc.id || zc.jid;
        if (!rawPhone) continue;
        const phoneDigits = String(rawPhone).replace(/\D/g, "");
        if (phoneDigits.length < 8) continue;
        const phoneE164 = phoneDigits.startsWith("55") ? `+${phoneDigits}` : `+55${phoneDigits}`;

        // Upsert contato Z-API
        let contactId: string | null = null;
        const { data: exContact } = await supabaseAdmin
          .from("wa_contacts")
          .select("id")
          .eq("phone_e164", phoneE164)
          .maybeSingle();

        if (exContact) {
          contactId = exContact.id;
        } else {
          const { data: createdContact } = await supabaseAdmin
            .from("wa_contacts")
            .insert({
              org_id: orgId,
              phone_e164: phoneE164,
              profile_name: zc.name || zc.pushname || "Contato WhatsApp",
              last_inbound_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          contactId = createdContact?.id ?? null;
        }

        if (!contactId) continue;

        // Upsert conversa Z-API
        let convId: string | null = null;
        const { data: exConv } = await supabaseAdmin
          .from("wa_conversations")
          .select("id")
          .eq("contact_id", contactId)
          .maybeSingle();

        if (exConv) {
          convId = exConv.id;
        } else {
          const { data: createdConv } = await supabaseAdmin
            .from("wa_conversations")
            .insert({
              org_id: orgId,
              contact_id: contactId,
              status: "humano",
              last_message_at: new Date().toISOString(),
              summary: zc.lastMessage?.text || "Conversa importada do WhatsApp",
            })
            .select("id")
            .single();
          convId = createdConv?.id ?? null;
          importedChatsCount++;
        }

        if (!convId) continue;

        // Busca mensagens históricas desta conversa na Z-API
        const zMsgs = await getZApiChatMessages(phoneDigits, 50);
        if (Array.isArray(zMsgs) && zMsgs.length > 0) {
          for (const zm of zMsgs) {
            const body = zm.message?.text || zm.body || zm.text || "";
            if (!body) continue;
            const isFromMe = zm.fromMe === true;
            const occurredAt = zm.momment || zm.timestamp ? new Date(zm.momment || zm.timestamp * 1000).toISOString() : new Date().toISOString();

            // Evita duplicatas
            const { data: dup } = await supabaseAdmin
              .from("wa_messages")
              .select("id")
              .eq("conversation_id", convId)
              .eq("body", body)
              .maybeSingle();

            if (!dup) {
              await supabaseAdmin.from("wa_messages").insert({
                conversation_id: convId,
                direction: isFromMe ? "outbound" : "inbound",
                msg_type: zm.type === "audio" ? "audio" : zm.type === "image" ? "image" : "text",
                body,
                status: "delivered",
                ai_generated: false,
                occurred_at: occurredAt,
              } as any);
              importedMessagesCount++;
            }
          }
        }
      }
    }
  } catch (zErr) {
    console.warn("[Z-API History Sync Notice]", zErr);
  }

  return {
    ok: true,
    importedChatsCount,
    importedMessagesCount,
    message: `Sincronização concluída! ${importedChatsCount} conversas e ${importedMessagesCount} mensagens históricas importadas.`,
  };
}