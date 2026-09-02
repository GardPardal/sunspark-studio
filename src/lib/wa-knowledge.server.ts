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