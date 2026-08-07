// Montagem de contexto para a IA do WhatsApp (server-only).

import { searchKnowledge } from "@/lib/kb.server";
import { waAdminClient } from "@/lib/wa.server";

type Supa = ReturnType<typeof waAdminClient>;

export type WaTurn = { role: "user" | "assistant"; content: string };

const RECENT_LIMIT = 20;

export async function loadRecentTurns(
  supabase: Supa,
  conversationId: string,
): Promise<WaTurn[]> {
  const { data } = await supabase
    .from("wa_messages")
    .select("direction, body, occurred_at")
    .eq("conversation_id", conversationId)
    .not("body", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(RECENT_LIMIT);

  return (data ?? [])
    .reverse()
    .map((m) => ({
      role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: String(m.body ?? ""),
    }))
    .filter((t) => t.content.trim().length > 0);
}

/** Contexto completo: perfil, resumo, trechos da base e histórico recente. */
export async function buildConversationContext(
  supabase: Supa,
  args: { orgId: string; conversationId: string; contactId: string; lastUserText: string },
) {
  const [{ data: contact }, { data: conversation }, turns] = await Promise.all([
    supabase
      .from("wa_contacts")
      .select("profile_name, phone_e164, tags, consent_status, lead_id")
      .eq("id", args.contactId)
      .maybeSingle(),
    supabase
      .from("wa_conversations")
      .select("summary, status")
      .eq("id", args.conversationId)
      .maybeSingle(),
    loadRecentTurns(supabase, args.conversationId),
  ]);

  let leadInfo = "";
  if (contact?.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("nome, cidade, estado, valor_conta, stage, produto_interesse")
      .eq("id", contact.lead_id)
      .maybeSingle();
    if (lead) {
      leadInfo = [
        `Lead no CRM: ${lead.nome}`,
        lead.cidade ? `Cidade: ${lead.cidade}/${lead.estado ?? ""}` : null,
        lead.valor_conta ? `Conta de luz: ${lead.valor_conta}` : null,
        `Etapa: ${lead.stage}`,
        lead.produto_interesse ? `Interesse: ${lead.produto_interesse}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
  }

  const hits = await searchKnowledge(args.orgId, args.lastUserText, 6);
  const knowledge = hits
    .map((h, i) => `[${i + 1}] (relevância ${h.similarity.toFixed(2)})\n${h.content}`)
    .join("\n\n");

  const profile = [
    contact?.profile_name ? `Nome no WhatsApp: ${contact.profile_name}` : null,
    contact?.phone_e164 ? `Telefone: ${contact.phone_e164}` : null,
    contact?.tags?.length ? `Tags: ${contact.tags.join(", ")}` : null,
    leadInfo || null,
  ]
    .filter(Boolean)
    .join("\n");

  const contextBlock = [
    profile ? `## Sobre o contato\n${profile}` : null,
    conversation?.summary ? `## Resumo da conversa até aqui\n${conversation.summary}` : null,
    knowledge ? `## Base de conhecimento da empresa\n${knowledge}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { contextBlock, turns, hits, contact, conversation };
}

/** Atualiza o resumo contínuo a cada bloco de mensagens. */
export async function refreshConversationSummary(
  supabase: Supa,
  conversationId: string,
  turns: WaTurn[],
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || turns.length < 6) return;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Resuma em até 6 linhas o essencial desta conversa comercial: quem é o cliente, o que ele quer, dados já coletados (cidade, conta de luz, imóvel), objeções e próximo passo combinado. Sem saudação, sem markdown.",
          },
          {
            role: "user",
            content: turns.map((t) => `${t.role === "user" ? "Cliente" : "Atendente"}: ${t.content}`).join("\n"),
          },
        ],
      }),
    });
    if (!res.ok) return;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const summary = json.choices?.[0]?.message?.content?.trim();
    if (!summary) return;
    await supabase
      .from("wa_conversations")
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq("id", conversationId);
  } catch (e) {
    console.error("[wa summary]", e);
  }
}
