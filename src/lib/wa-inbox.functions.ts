import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireMyOrg(supabase: any, userId: string, requestedOrgId?: string) {
  let query = supabase.from("org_members").select("org_id, role").eq("user_id", userId);
  if (requestedOrgId) query = query.eq("org_id", requestedOrgId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error || !data?.org_id) throw new Error("Você não tem acesso a esta organização");
  return { orgId: data.org_id as string, role: data.role as string };
}

/** Organização do usuário logado (primeira em que ele é membro com fallback automático). */
export const getMyOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("org_members")
      .select("org_id, role, organizations(id, name, slug, retention_days, opt_out_keywords)")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();

    if (data?.organizations) {
      const org = data.organizations as {
        id: string;
        name: string;
        slug: string;
        retention_days: number;
        opt_out_keywords: string[];
      };
      return { ...org, myRole: data.role as string };
    }

    return null;
  });

export const listWaConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orgId: z.string().uuid().optional(),
        status: z.enum(["todos", "bot", "liz", "humano", "encerrada", "nao_lidas"]).default("todos"),
        search: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pickDisplayName, formatBrPhone } = await import("@/lib/wa-normalize.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId, data.orgId);
    let query = supabaseAdmin
      .from("wa_conversations")
      .select(
        "id, status, last_message_at, handoff_reason, assigned_to, unread_count, summary, wa_contacts(id, profile_name, phone_e164, phone_unknown, lid, photo_url, consent_status, lead_id)",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(300)
      .eq("org_id", orgId);

    if (data.status === "nao_lidas") query = query.gt("unread_count", 0);
    else if (data.status !== "todos") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const term = data.search?.trim().toLowerCase();
    const list = (rows ?? []).map((r) => {
      const c = r.wa_contacts as unknown as {
        id: string;
        profile_name: string | null;
        phone_e164: string;
        phone_unknown: boolean | null;
        lid: string | null;
        photo_url: string | null;
        consent_status: string;
        lead_id: string | null;
      } | null;

      const phoneKnown = c && !c.phone_unknown ? c.phone_e164 : null;

      return {
        id: r.id,
        status: r.status,
        lastMessageAt: r.last_message_at,
        handoffReason: r.handoff_reason,
        assignedTo: r.assigned_to,
        unread: r.unread_count ?? 0,
        summary: r.summary,
        contactId: c?.id ?? null,
        name: pickDisplayName({
          savedName: c?.profile_name ?? null,
          phone: phoneKnown,
          lid: c?.lid ?? null,
        }),
        phone: phoneKnown ? formatBrPhone(phoneKnown) : "",
        phoneRaw: phoneKnown ?? "",
        lid: c?.lid ?? null,
        consent: c?.consent_status ?? "desconhecido",
        leadId: c?.lead_id ?? null,
        avatarUrl: c?.photo_url ?? null,
      };
    });

    if (!term) return list;
    const digits = term.replace(/\D/g, "");
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (digits.length >= 3 && c.phoneRaw.includes(digits)),
    );
  });


export const startNewWaConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().optional(),
        phone: z.string().min(8).max(30),
        initialMessage: z.string().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendZApiText } = await import("@/lib/zapi.server");
    const { upsertContact, ensureConversation } = await import("@/lib/wa-ingest.server");

    const { orgId } = await requireMyOrg(context.supabase, context.userId);

    const contactId = await upsertContact(
      supabaseAdmin as any,
      orgId,
      data.phone,
      data.name || "Novo Contato",
    );
    if (!contactId) throw new Error("Não foi possível criar o contato");

    const convId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
    if (!convId) throw new Error("Não foi possível criar a conversa");

    const now = new Date().toISOString();
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("wa_messages")
      .insert({
        org_id: orgId,
        contact_id: contactId,
        conversation_id: convId,
        direction: "outbound",
        msg_type: "text",
        body: data.initialMessage,
        status: "sending",
        source: "zapi",
        ai_generated: false,
        occurred_at: now,
        sent_by: context.userId,
      } as any)
      .select("id")
      .single();
    if (pendingError || !pending)
      throw new Error(pendingError?.message ?? "Falha ao registrar mensagem");

    try {
      const sent = await sendZApiText(data.phone, data.initialMessage);
      const providerMessageId = sent?.messageId || sent?.id || sent?.zaapId || null;
      await supabaseAdmin
        .from("wa_messages")
        .update({ status: "sent", provider_message_id: providerMessageId })
        .eq("id", pending.id);
    } catch (error) {
      await supabaseAdmin
        .from("wa_messages")
        .update({
          status: "failed",
          error: error instanceof Error ? error.message.slice(0, 500) : "Falha no envio",
        })
        .eq("id", pending.id);
      throw new Error("Não foi possível enviar a mensagem pelo WhatsApp");
    }

    await supabaseAdmin
      .from("wa_conversations")
      .update({
        status: "humano",
        last_message_at: now,
        summary: data.initialMessage.slice(0, 160),
      } as any)
      .eq("id", convId);

    return { ok: true, conversationId: convId };
  });

export const listWaMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        limit: z.number().min(1).max(200).optional().default(60),
        beforeOccurredAt: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId);
    const { data: allowedConversation } = await supabaseAdmin
      .from("wa_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!allowedConversation) throw new Error("Conversa não encontrada nesta organização");

    // Página mais recente primeiro; a UI inverte para ordem cronológica.
    let q = supabaseAdmin
      .from("wa_messages")
      .select(
        "id, direction, msg_type, raw_type, body, media_url, media_mime, media_filename, media_id, status, error, occurred_at, ai_generated, imported, provider_message_id",
      )
      .eq("conversation_id", data.conversationId)
      .eq("org_id", orgId)
      .order("occurred_at", { ascending: false })
      .limit(data.limit + 1);
    if (data.beforeOccurredAt) q = q.lt("occurred_at", data.beforeOccurredAt);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const page = rows ?? [];
    const hasMore = page.length > data.limit;
    const messages = (hasMore ? page.slice(0, data.limit) : page).slice().reverse();

    return { messages, hasMore, conversationId: data.conversationId };
  });

/** Zera o contador de não lidas de forma explícita (ao abrir a conversa). */
export const markWaConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId);
    await supabaseAdmin
      .from("wa_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId)
      .eq("org_id", orgId);
    return { ok: true };
  });


export const claimWaConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        action: z.enum(["assumir", "devolver", "encerrar"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { orgId } = await requireMyOrg(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch =
      data.action === "assumir"
        ? {
            status: "humano",
            assigned_to: context.userId,
            handoff_reason: "assumido manualmente pela SDR",
            handoff_at: new Date().toISOString(),
          }
        : data.action === "devolver"
          ? { status: "bot", assigned_to: null, handoff_reason: null, handoff_at: null }
          : { status: "encerrada", assigned_to: null };

    const { error } = await supabaseAdmin
      .from("wa_conversations")
      .update(patch)
      .eq("id", data.conversationId)
      .eq("org_id", orgId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const sendWaManualMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        text: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId);
    const { data: conv, error } = await supabaseAdmin
      .from("wa_conversations")
      .select("id, org_id, contact_id, wa_contacts(phone_e164, phone_unknown, lid)")
      .eq("id", data.conversationId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (error || !conv) throw new Error(error?.message ?? "Conversa não encontrada");

    const contact = conv.wa_contacts as unknown as {
      phone_e164: string;
      phone_unknown: boolean | null;
      lid: string | null;
    } | null;
    // Contatos sem telefone real são endereçados pelo identificador @lid.
    const phone = contact?.phone_unknown ? contact?.lid : contact?.phone_e164;
    if (!phone) throw new Error("Destino do contato não encontrado");

    const now = new Date().toISOString();
    const { data: insertedMsg, error: insertError } = await supabaseAdmin
      .from("wa_messages")
      .insert({
        org_id: conv.org_id,
        contact_id: conv.contact_id,
        conversation_id: conv.id,
        direction: "outbound",
        msg_type: "text",
        body: data.text,
        status: "sending",
        source: "zapi",
        sent_by: context.userId,
        ai_generated: false,
        occurred_at: now,
      } as any)
      .select("id, status, provider_message_id, occurred_at")
      .single();
    if (insertError || !insertedMsg)
      throw new Error(insertError?.message ?? "Falha ao registrar mensagem");

    let providerMessageId: string | null = null;
    try {
      const { sendZApiText } = await import("@/lib/zapi.server");
      const zRes = await sendZApiText(phone, data.text);
      providerMessageId = zRes?.messageId || zRes?.id || zRes?.zaapId || null;
      const { error: statusError } = await supabaseAdmin
        .from("wa_messages")
        .update({ status: "sent", provider_message_id: providerMessageId })
        .eq("id", insertedMsg.id);
      if (statusError) throw statusError;
    } catch (sendError) {
      const detail =
        sendError instanceof Error ? sendError.message.slice(0, 500) : "Falha no envio";
      await supabaseAdmin
        .from("wa_messages")
        .update({ status: "failed", error: detail })
        .eq("id", insertedMsg.id);
      throw new Error("A mensagem não foi enviada. Tente novamente.");
    }

    // 3. Atualiza timestamps e status da conversa para humano
    await supabaseAdmin
      .from("wa_conversations")
      .update({
        last_message_at: now,
        status: "humano",
        summary: data.text.slice(0, 160),
      } as any)
      .eq("id", conv.id);

    return {
      ok: true,
      messageId: insertedMsg?.id,
      providerMessageId,
      status: "sent",
    };
  });

export const sendWaMediaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid(),
        type: z.enum(["image", "document", "audio", "video"]),
        base64Data: z.string(),
        fileName: z.string().max(160).optional(),
        mimeType: z.string().max(100),
        caption: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId);
    const { data: conv, error } = await supabaseAdmin
      .from("wa_conversations")
      .select("id, org_id, contact_id, wa_contacts(phone_e164, phone_unknown, lid)")
      .eq("id", data.conversationId)
      .eq("org_id", orgId)
      .maybeSingle();

    if (error || !conv) throw new Error(error?.message ?? "Conversa não encontrada");

    const contact = conv.wa_contacts as unknown as {
      phone_e164: string;
      phone_unknown: boolean | null;
      lid: string | null;
    } | null;
    // Contatos sem telefone real são endereçados pelo identificador @lid.
    const phone = contact?.phone_unknown ? contact?.lid : contact?.phone_e164;
    if (!phone) throw new Error("Destino do contato não encontrado");

    // 1. Converte base64 para Buffer e faz upload no Supabase Storage
    const base64Pure = data.base64Data.includes(",")
      ? data.base64Data.split(",")[1]
      : data.base64Data;
    const buffer = Buffer.from(base64Pure, "base64");
    const fileExt = data.fileName?.split(".").pop() || (data.type === "audio" ? "ogg" : "jpg");
    const storagePath = `outbound/${conv.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("wa-media")
      .upload(storagePath, buffer, {
        contentType: data.mimeType,
        upsert: true,
      });

    if (uploadError) throw new Error(`Falha ao armazenar o anexo: ${uploadError.message}`);
    let publicUrl = "";
    if (!uploadError) {
      const { data: signedData } = await supabaseAdmin.storage
        .from("wa-media")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      publicUrl = signedData?.signedUrl ?? "";
    }

    if (!publicUrl) throw new Error("Não foi possível gerar o acesso temporário ao anexo");
    const now = new Date().toISOString();
    const { data: pending, error: pendingError } = await supabaseAdmin
      .from("wa_messages")
      .insert({
        org_id: (conv as any).org_id,
        contact_id: (conv as any).contact_id,
        conversation_id: conv.id,
        direction: "outbound",
        msg_type: data.type,
        body: data.caption || null,
        media_url: publicUrl,
        media_mime: data.mimeType,
        media_filename: data.fileName ?? null,
        status: "sending",
        source: "zapi",
        sent_by: context.userId,
        ai_generated: false,
        occurred_at: now,
      } as any)
      .select("id")
      .single();
    if (pendingError || !pending)
      throw new Error(pendingError?.message ?? "Falha ao registrar anexo");

    try {
      const { sendZApiImage, sendZApiAudio, sendZApiDocument, sendZApiVideo } =
        await import("@/lib/zapi.server");
      const response =
        data.type === "image"
          ? await sendZApiImage(phone, publicUrl, data.caption || data.fileName)
          : data.type === "audio"
            ? await sendZApiAudio(phone, publicUrl)
            : data.type === "video"
              ? await sendZApiVideo(phone, publicUrl, data.caption || data.fileName)
              : await sendZApiDocument(phone, publicUrl, data.fileName);
      const providerMessageId = response?.messageId || response?.id || response?.zaapId || null;
      await supabaseAdmin
        .from("wa_messages")
        .update({ status: "sent", provider_message_id: providerMessageId })
        .eq("id", pending.id);
    } catch (sendError) {
      const detail =
        sendError instanceof Error ? sendError.message.slice(0, 500) : "Falha no envio";
      await supabaseAdmin
        .from("wa_messages")
        .update({ status: "failed", error: detail })
        .eq("id", pending.id);
      throw new Error("O anexo não foi enviado. Tente novamente.");
    }

    // 3. Atualiza timestamps da conversa
    await supabaseAdmin
      .from("wa_conversations")
      .update({
        last_message_at: now,
        status: "humano",
        summary: data.caption || (data.type === "audio" ? "Áudio enviado" : "Arquivo enviado"),
      } as any)
      .eq("id", conv.id);

    return { ok: true, publicUrl };
  });

export const importWaChatExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        contactPhone: z.string().min(8).max(30),
        contactName: z.string().max(120).optional(),
        chatText: z.string().min(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { upsertContact, ensureConversation } = await import("@/lib/wa-ingest.server");

    const { orgId } = await requireMyOrg(context.supabase, context.userId);

    const cleanPhone = data.contactPhone.replace(/\D/g, "");
    const contactId = await upsertContact(
      supabaseAdmin as any,
      orgId,
      cleanPhone,
      data.contactName || cleanPhone,
    );
    if (!contactId) throw new Error("Erro ao criar contato");

    const conversationId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
    if (!conversationId) throw new Error("Erro ao criar conversa");

    const lines = data.chatText.split("\n");
    const messagesToInsert: any[] = [];
    let parsedCount = 0;

    const regexAndroid =
      /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+):\s*(.*)$/;
    const regexIOS =
      /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.*)$/;

    for (const line of lines) {
      const match = line.match(regexAndroid) || line.match(regexIOS);
      if (match) {
        const [, dateStr, timeStr, sender, body] = match;
        const isFromSdrOrCompany =
          sender.toLowerCase().includes("stephany") ||
          sender.toLowerCase().includes("lz7") ||
          sender.toLowerCase().includes("você") ||
          sender.toLowerCase().includes("voce");

        const direction = isFromSdrOrCompany ? "outbound" : "inbound";

        let occurredAt = new Date().toISOString();
        try {
          const parts = dateStr.split("/");
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year =
            parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
          const timeParts = timeStr.split(":");
          const hour = parseInt(timeParts[0], 10);
          const min = parseInt(timeParts[1], 10);
          occurredAt = new Date(year, month, day, hour, min).toISOString();
        } catch {
          // fallback
        }

        messagesToInsert.push({
          org_id: orgId,
          contact_id: contactId,
          conversation_id: conversationId,
          direction,
          msg_type: "text",
          body: body.trim(),
          status: "delivered",
          occurred_at: occurredAt,
          imported: true,
          source: "import",
        });

        parsedCount++;
      }
    }

    if (messagesToInsert.length > 0) {
      for (let i = 0; i < messagesToInsert.length; i += 100) {
        const batch = messagesToInsert.slice(i, i + 100);
        await supabaseAdmin.from("wa_messages").insert(batch);
      }

      await supabaseAdmin
        .from("wa_conversations")
        .update({
          last_message_at: messagesToInsert[messagesToInsert.length - 1].occurred_at,
          summary: `Histórico importado (${parsedCount} msgs)`,
        } as any)
        .eq("id", conversationId);
    }

    return { ok: true, conversationId, count: parsedCount };
  });

export const getWaMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mediaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: media, error } = await context.supabase
      .from("wa_media")
      .select("storage_path")
      .eq("id", data.mediaId)
      .maybeSingle();
    if (error || !media?.storage_path) return null;
    const { data: signed } = await context.supabase.storage
      .from("wa-media")
      .createSignedUrl(media.storage_path, 300);
    return signed?.signedUrl ?? null;
  });

export const getWaChannelHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orgId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId, data.orgId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [pending, dead, failed, waiting, lastEvent, badTranscripts] = await Promise.all([
      supabaseAdmin
        .from("wa_events")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("process_status", "pending"),
      supabaseAdmin
        .from("wa_events")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("process_status", "dead"),
      supabaseAdmin
        .from("wa_messages")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "failed")
        .gte("occurred_at", since),
      supabaseAdmin
        .from("wa_conversations")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("status", "humano"),
      supabaseAdmin
        .from("wa_events")
        .select("received_at")
        .eq("org_id", orgId)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("wa_media")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)
        .eq("transcript_status", "error"),
    ]);

    return {
      pending: pending.count ?? 0,
      dead: dead.count ?? 0,
      failedSends24h: failed.count ?? 0,
      waitingHuman: waiting.count ?? 0,
      lastEventAt: lastEvent.data?.received_at ?? null,
      transcriptErrors: badTranscripts.count ?? 0,
    };
  });

export const listWaChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("wa_channels")
      .select(
        "id, label, phone_number_id, display_phone, bot_enabled, shadow_mode, test_allowlist, persona",
      )
      .eq("org_id", data.orgId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertWaChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        orgId: z.string().uuid(),
        label: z.string().trim().min(1).max(80),
        phoneNumberId: z.string().trim().min(3).max(60),
        displayPhone: z.string().trim().max(30).optional(),
        botEnabled: z.boolean(),
        shadowMode: z.boolean(),
        testAllowlist: z.array(z.string().trim().max(20)).max(20),
        persona: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      org_id: data.orgId,
      label: data.label,
      phone_number_id: data.phoneNumberId,
      display_phone: data.displayPhone ?? null,
      bot_enabled: data.botEnabled,
      shadow_mode: data.shadowMode,
      test_allowlist: data.testAllowlist,
      persona: data.persona ?? null,
    };
    const query = data.id
      ? context.supabase.from("wa_channels").update(payload).eq("id", data.id)
      : context.supabase.from("wa_channels").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("wa_audit_log").insert({
      org_id: data.orgId,
      actor_id: context.userId,
      action: "wa.channel_config",
      entity_type: "wa_channel",
      entity_id: data.id ?? null,
      detail: { bot: data.botEnabled, sombra: data.shadowMode } as never,
    });
    return { ok: true };
  });

export const getWaInstanceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ orgId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { getWaInstanceStatusServer } = await import("@/lib/wa-instance.server");
    return getWaInstanceStatusServer(data.orgId);
  });

export const requestPairingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ phone: z.string().min(8).max(30) }).parse(input))
  .handler(async ({ data }) => {
    const { requestPairingCodeServer } = await import("@/lib/wa-instance.server");
    return requestPairingCodeServer(data.phone);
  });

export const syncWaKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { syncConversationsToLizKnowledgeServer } = await import("@/lib/wa-knowledge.server");
    return syncConversationsToLizKnowledgeServer();
  });

export const syncWaHistoricalChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { syncAllHistoricalChatsServer } = await import("@/lib/wa-knowledge.server");
    return syncAllHistoricalChatsServer();
  });

/** Sincroniza a agenda da Z-API (nome, telefone, @lid) e corrige contatos existentes. */
export const syncWaIdentities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ refreshPhotos: z.boolean().optional().default(true) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncWaDirectory, refreshContactPhoto } = await import("@/lib/wa-identity.server");
    const { pickDisplayName } = await import("@/lib/wa-normalize.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId);

    const dir = await syncWaDirectory(supabaseAdmin, orgId);

    const { data: contatos } = await supabaseAdmin
      .from("wa_contacts")
      .select("id, profile_name, phone_e164, phone_unknown, lid, photo_url, photo_updated_at")
      .eq("org_id", orgId)
      .limit(1000);

    const { data: directory } = await supabaseAdmin
      .from("wa_directory")
      .select("lid, phone_e164, name, img_url")
      .eq("org_id", orgId)
      .limit(5000);

    const porLid = new Map((directory ?? []).filter((d) => d.lid).map((d) => [d.lid!, d]));
    const porPhone = new Map(
      (directory ?? []).filter((d) => d.phone_e164).map((d) => [d.phone_e164!, d]),
    );

    let nomesCorrigidos = 0;
    let telefonesResolvidos = 0;
    let fotos = 0;

    for (const c of contatos ?? []) {
      const d = (c.lid ? porLid.get(c.lid) : null) ?? porPhone.get(c.phone_e164 ?? "");
      const patch: Record<string, unknown> = {};

      const nomeAtual = (c.profile_name ?? "").trim();
      const nomeRuim =
        !nomeAtual ||
        nomeAtual.endsWith("@lid") ||
        /^Contato( \(\d+\))?$/i.test(nomeAtual) ||
        /^\+?\d[\d\s()-]*$/.test(nomeAtual) ||
        nomeAtual === "Cliente" ||
        nomeAtual === "Novo Contato";

      if (nomeRuim) {
        const novo = pickDisplayName({
          directoryName: d?.name ?? null,
          phone: c.phone_unknown ? null : c.phone_e164,
          lid: c.lid,
        });
        if (novo && novo !== nomeAtual) {
          patch.profile_name = novo;
          nomesCorrigidos++;
        }
      }

      if (c.phone_unknown && d?.phone_e164) {
        patch.phone_e164 = d.phone_e164;
        patch.phone_unknown = false;
        telefonesResolvidos++;
      }

      if (Object.keys(patch).length) {
        await supabaseAdmin.from("wa_contacts").update(patch as never).eq("id", c.id);
      }

      if (data.refreshPhotos) {
        const link = await refreshContactPhoto(supabaseAdmin, {
          id: c.id,
          phone_e164: c.phone_e164,
          lid: c.lid,
          photo_url: c.photo_url,
          photo_updated_at: c.photo_updated_at,
        });
        if (link) fotos++;
      }
    }

    return {
      agenda: dir,
      contatos: contatos?.length ?? 0,
      nomesCorrigidos,
      telefonesResolvidos,
      fotos,
    };
  });

/**
 * Reprocessa os eventos brutos já guardados para recuperar o conteúdo real
 * das mensagens antigas gravadas como placeholder. Idempotente e retomável.
 */
export const repairWaMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().min(1).max(2000).optional().default(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeZapiWebhook, previewFor } = await import("@/lib/wa-normalize.server");
    const { orgId } = await requireMyOrg(context.supabase, context.userId);

    const { data: eventos } = await supabaseAdmin
      .from("wa_events")
      .select("id, payload")
      .eq("org_id", orgId)
      .order("received_at", { ascending: true })
      .limit(data.limit);

    let analisados = 0;
    let recuperados = 0;
    let semConteudo = 0;

    for (const ev of eventos ?? []) {
      const norm = normalizeZapiWebhook(ev.payload);
      if (norm.kind !== "message" || !norm.messageId) continue;
      analisados++;

      const conteudo = norm.text ?? null;
      if (!conteudo && !norm.media.url) {
        semConteudo++;
        continue;
      }

      const { data: msg } = await supabaseAdmin
        .from("wa_messages")
        .select("id, body, media_url, msg_type, conversation_id")
        .eq("org_id", orgId)
        .eq("provider_message_id", norm.messageId)
        .maybeSingle();
      if (!msg) continue;

      const placeholder =
        !msg.body ||
        msg.body === "[Mensagem recebida]" ||
        msg.body === "[Mensagem enviada]" ||
        /^\[(Imagem|Áudio|Vídeo|Documento|Áudio de voz)\]$/i.test(msg.body);

      const patch: Record<string, unknown> = {};
      if (placeholder && conteudo) patch.body = conteudo;
      if (placeholder && !conteudo) patch.body = null;
      if (!msg.media_url && norm.media.url) {
        patch.media_url = norm.media.url;
        patch.media_mime = norm.media.mime;
        patch.media_filename = norm.media.filename;
      }
      if (msg.msg_type !== norm.msgType) patch.msg_type = norm.msgType;
      patch.raw_type = norm.rawType;

      if (Object.keys(patch).length) {
        await supabaseAdmin.from("wa_messages").update(patch as never).eq("id", msg.id);
        recuperados++;
      }
    }

    // Recalcula a prévia da última mensagem de cada conversa.
    const { data: convs } = await supabaseAdmin
      .from("wa_conversations")
      .select("id")
      .eq("org_id", orgId)
      .limit(500);
    for (const c of convs ?? []) {
      const { data: ultima } = await supabaseAdmin
        .from("wa_messages")
        .select("body, msg_type, media_filename, occurred_at")
        .eq("conversation_id", c.id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ultima) continue;
      await supabaseAdmin
        .from("wa_conversations")
        .update({ summary: previewFor(ultima), last_message_at: ultima.occurred_at })
        .eq("id", c.id);
    }

    // Mensagens que continuam sem conteúdo recuperável.
    const { count: pendentes } = await supabaseAdmin
      .from("wa_messages")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("body", ["[Mensagem recebida]", "[Mensagem enviada]"]);

    return { analisados, recuperados, semConteudo, pendentes: pendentes ?? 0 };
  });
