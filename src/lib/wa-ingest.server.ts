// Normalização dos eventos do WhatsApp para o modelo wa_* (server-only).

import { ingestWaMedia } from "@/lib/wa-media.server";
import { toE164, waAdminClient } from "@/lib/wa.server";

type Supa = ReturnType<typeof waAdminClient>;

export type WaValue = {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: Array<Record<string, unknown>>;
  statuses?: Array<Record<string, unknown>>;
};

/** Descobre a organização a partir do phone_number_id do canal. */
export async function resolveChannel(supabase: Supa, phoneNumberId: string | undefined) {
  if (!phoneNumberId) return null;
  const { data } = await supabase
    .from("wa_channels")
    .select("id, org_id, bot_enabled, shadow_mode, test_allowlist")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return data ?? null;
}

/** Organização padrão (LZ7) quando o canal ainda não foi cadastrado. */
export async function defaultOrgId(supabase: Supa) {
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "lz7")
    .maybeSingle();
  return data?.id ?? null;
}

export async function upsertContact(
  supabase: Supa,
  orgId: string,
  phone: string,
  profileName?: string | null,
  waId?: string | null,
) {
  const e164 = toE164(phone);
  if (!e164) return null;
  const { data: existing } = await supabase
    .from("wa_contacts")
    .select("id, lead_id, consent_status")
    .eq("org_id", orgId)
    .eq("phone_e164", e164)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("wa_contacts")
      .update({
        profile_name: profileName ?? undefined,
        wa_id: waId ?? undefined,
        last_inbound_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return existing.id;
  }

  // tenta ligar com um lead existente pelo telefone
  const digits = e164.replace(/\D/g, "").slice(-8);
  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .ilike("telefone", `%${digits}%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("wa_contacts")
    .insert({
      org_id: orgId,
      phone_e164: e164,
      wa_id: waId ?? null,
      profile_name: profileName ?? null,
      lead_id: lead?.id ?? null,
      last_inbound_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[wa contact]", error.message);
    return null;
  }
  return created.id;
}

export async function ensureConversation(
  supabase: Supa,
  orgId: string,
  contactId: string,
  channelId: string | null,
) {
  const { data: open } = await supabase
    .from("wa_conversations")
    .select("id, status")
    .eq("contact_id", contactId)
    .neq("status", "encerrada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) return open.id;

  const { data, error } = await supabase
    .from("wa_conversations")
    .insert({ org_id: orgId, contact_id: contactId, channel_id: channelId })
    .select("id")
    .single();
  if (error) {
    console.error("[wa conversation]", error.message);
    return null;
  }
  return data.id;
}

function textFromMessage(msg: Record<string, unknown>): string | null {
  const type = String(msg.type ?? "");
  const get = (k: string) => msg[k] as Record<string, unknown> | undefined;
  switch (type) {
    case "text":
      return (get("text")?.body as string) ?? null;
    case "button":
      return (get("button")?.text as string) ?? null;
    case "interactive": {
      const i = get("interactive") ?? {};
      const br = i.button_reply as Record<string, unknown> | undefined;
      const lr = i.list_reply as Record<string, unknown> | undefined;
      return (br?.title as string) ?? (lr?.title as string) ?? null;
    }
    case "reaction":
      return (get("reaction")?.emoji as string) ?? null;
    case "image":
    case "video":
    case "document":
    case "audio":
      return (get(type)?.caption as string) ?? null;
    default:
      return null;
  }
}

function mediaIdFromMessage(msg: Record<string, unknown>) {
  const type = String(msg.type ?? "");
  if (!["image", "video", "document", "audio", "sticker"].includes(type)) return null;
  const node = msg[type] as Record<string, unknown> | undefined;
  return {
    id: (node?.id as string) ?? null,
    mime: (node?.mime_type as string) ?? null,
  };
}

/** Processa uma mensagem recebida: contato, conversa, mídia e registro. */
export async function ingestInboundMessage(
  supabase: Supa,
  value: WaValue,
  msg: Record<string, unknown>,
) {
  const channel = await resolveChannel(supabase, value.metadata?.phone_number_id);
  const orgId = channel?.org_id ?? (await defaultOrgId(supabase));
  if (!orgId) return { ok: false as const, reason: "sem organização" };

  const from = String(msg.from ?? "");
  const contactProfile = value.contacts?.[0];
  const contactId = await upsertContact(
    supabase,
    orgId,
    from,
    contactProfile?.profile?.name ?? null,
    contactProfile?.wa_id ?? null,
  );
  if (!contactId) return { ok: false as const, reason: "telefone inválido" };

  const conversationId = await ensureConversation(supabase, orgId, contactId, channel?.id ?? null);
  if (!conversationId) return { ok: false as const, reason: "conversa não criada" };

  const media = mediaIdFromMessage(msg);
  let mediaRowId: string | null = null;
  let transcript: string | null = null;
  if (media?.id) {
    mediaRowId = await ingestWaMedia({
      orgId,
      providerMediaId: media.id,
      fallbackMime: media.mime,
    });
    if (mediaRowId) {
      const { data: m } = await supabase
        .from("wa_media")
        .select("transcript")
        .eq("id", mediaRowId)
        .maybeSingle();
      transcript = m?.transcript ?? null;
    }
  }

  const body = textFromMessage(msg) ?? transcript;
  const occurredAt = msg.timestamp
    ? new Date(Number(msg.timestamp) * 1000).toISOString()
    : new Date().toISOString();

  const { error } = await supabase.from("wa_messages").insert({
    org_id: orgId,
    conversation_id: conversationId,
    contact_id: contactId,
    direction: "inbound",
    msg_type: String(msg.type ?? "text"),
    body,
    media_id: mediaRowId,
    provider_message_id: (msg.id as string) ?? null,
    reply_to: ((msg.context as Record<string, unknown> | undefined)?.id as string) ?? null,
    status: "received",
    occurred_at: occurredAt,
  });
  if (error && !error.message.includes("duplicate")) {
    console.error("[wa message]", error.message);
  }

  await supabase
    .from("wa_conversations")
    .update({ last_message_at: occurredAt })
    .eq("id", conversationId);

  // Transcrição falhou em áudio → precisa de humano
  if (media?.id && !body) {
    await supabase
      .from("wa_conversations")
      .update({
        status: "humano",
        handoff_reason: "mídia sem transcrição",
        handoff_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  }

  return { ok: true as const, orgId, contactId, conversationId };
}

/** Atualiza status de entrega de uma mensagem enviada. */
export async function ingestStatus(supabase: Supa, status: Record<string, unknown>) {
  const providerId = status.id as string | undefined;
  if (!providerId) return;
  const errors = status.errors as Array<{ title?: string }> | undefined;
  await supabase
    .from("wa_messages")
    .update({
      status: String(status.status ?? "unknown"),
      error: errors?.[0]?.title ?? null,
    })
    .eq("provider_message_id", providerId);
}
