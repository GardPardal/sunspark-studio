// Persistência única das mensagens do WhatsApp (server-only).
// Todo caminho de ingestão (webhook, reparo, importação) passa por aqui.

import { resolveWaContact } from "@/lib/wa-identity.server";
import {
  previewFor,
  shouldApplyStatus,
  type NormalizedMessage,
  type WaDeliveryStatus,
} from "@/lib/wa-normalize.server";

type Supa = any;

export async function ensureConversationFor(
  supabase: Supa,
  orgId: string,
  contactId: string,
): Promise<string | null> {
  const { data: open } = await supabase
    .from("wa_conversations")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("contact_id", contactId)
    .neq("status", "encerrada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) return open.id as string;

  // Verifica se o modo global da LIZ está ativo para inicializar como 'bot'
  let initialStatus = "humano";
  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle();
    const settings = (org?.settings as any) || {};
    if (settings.liz_global_mode) {
      initialStatus = "bot";
    }
  } catch {}

  const { data, error } = await supabase
    .from("wa_conversations")
    .insert({ org_id: orgId, contact_id: contactId, status: initialStatus })
    .select("id")
    .single();
  if (error) {
    console.error("[wa store] conversa", error.message);
    return null;
  }
  return data.id as string;
}

export type PersistResult =
  | { ok: true; conversationId: string; contactId: string; messageId: string; duplicated: boolean }
  | { ok: false; reason: string };

/** Grava (ou atualiza) uma mensagem normalizada de forma idempotente. */
export async function persistNormalizedMessage(
  supabase: Supa,
  orgId: string,
  m: NormalizedMessage,
): Promise<PersistResult> {
  const contactId = await resolveWaContact(supabase, orgId, {
    lid: m.chatLid,
    phone: m.chatPhone,
    profileName: m.chatName ?? m.senderName,
    photoUrl: m.chatPhoto ?? m.senderPhoto,
    isFromMe: m.isFromMe,
  });
  if (!contactId) return { ok: false, reason: "sem identificação de contato" };

  const conversationId = await ensureConversationFor(supabase, orgId, contactId);
  if (!conversationId) return { ok: false, reason: "conversa não criada" };

  const body = m.text ?? null;

  const row = {
    org_id: orgId,
    conversation_id: conversationId,
    contact_id: contactId,
    direction: m.isFromMe ? "outbound" : "inbound",
    msg_type: m.msgType,
    raw_type: m.rawType,
    body,
    media_url: m.media.url,
    media_mime: m.media.mime,
    media_filename: m.media.filename,
    provider_message_id: m.messageId,
    reply_to: m.replyTo,
    status: m.isFromMe ? "sent" : "delivered",
    source: "zapi",
    ai_generated: false,
    occurred_at: m.occurredAt,
  };

  let messageId: string | null = null;
  let duplicated = false;

  if (m.messageId) {
    const { data: existing } = await supabase
      .from("wa_messages")
      .select("id, body, media_url, status, msg_type")
      .eq("org_id", orgId)
      .eq("provider_message_id", m.messageId)
      .maybeSingle();

    if (existing) {
      duplicated = true;
      messageId = existing.id;
      // Callback fora de ordem nunca apaga conteúdo válido.
      const patch: Record<string, unknown> = {};
      if (!existing.body && body) patch.body = body;
      if (!existing.media_url && m.media.url) {
        patch.media_url = m.media.url;
        patch.media_mime = m.media.mime;
        patch.media_filename = m.media.filename;
        patch.msg_type = m.msgType;
      }
      if (m.isEdit && body) patch.body = body;
      if (Object.keys(patch).length) {
        await supabase.from("wa_messages").update(patch).eq("id", existing.id);
      }
    }
  }

  if (!messageId) {
    const { data: inserted, error } = await supabase
      .from("wa_messages")
      .insert(row)
      .select("id")
      .single();
    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        return { ok: false, reason: "duplicada" };
      }
      console.error("[wa store] insert", error.message);
      return { ok: false, reason: error.message };
    }
    messageId = inserted.id;
  }

  if (!duplicated) {
    const preview = previewFor({
      msg_type: m.msgType,
      body,
      media_filename: m.media.filename,
    });
    const { data: conv } = await supabase
      .from("wa_conversations")
      .select("unread_count, last_message_at, status")
      .eq("id", conversationId)
      .maybeSingle();

    const patch: Record<string, unknown> = { summary: preview };
    if (!conv?.last_message_at || Date.parse(conv.last_message_at) <= Date.parse(m.occurredAt)) {
      patch.last_message_at = m.occurredAt;
    }
    if (m.isFromMe) {
      patch.unread_count = 0;
      // Não rebaixa status de 'bot' para 'humano' se o modo geral estiver ativo ou se a conversa for bot
      if (conv?.status !== "encerrada" && conv?.status !== "bot") {
        patch.status = "humano";
      }
    } else {
      patch.unread_count = (conv?.unread_count ?? 0) + 1;
    }
    await supabase.from("wa_conversations").update(patch).eq("id", conversationId);
  }

  await supabase
    .from("wa_contacts")
    .update({
      [m.isFromMe ? "last_outbound_at" : "last_inbound_at"]: m.occurredAt,
    })
    .eq("id", contactId);

  return { ok: true, conversationId, contactId, messageId: messageId!, duplicated };
}

/** Aplica um estado de entrega sem regredir. */
export async function applyDeliveryStatus(
  supabase: Supa,
  ids: string[],
  status: WaDeliveryStatus,
) {
  if (!ids.length) return 0;
  const { data: rows } = await supabase
    .from("wa_messages")
    .select("id, status")
    .in("provider_message_id", ids);
  if (!rows?.length) return 0;

  const alvo = rows
    .filter((r: any) => shouldApplyStatus(r.status, status))
    .map((r: any) => r.id);
  if (!alvo.length) return 0;

  await supabase
    .from("wa_messages")
    .update({ status, error: status === "failed" ? "Falha reportada pelo WhatsApp" : null })
    .in("id", alvo);
  return alvo.length;
}
