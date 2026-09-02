import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Fallback: busca a organização padrão da LZ7 ou a primeira cadastrada
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: defaultOrg } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, retention_days, opt_out_keywords")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultOrg) {
      return { ...defaultOrg, myRole: "admin" };
    }

    // Cria a organização padrão caso ainda não exista no banco
    const { data: createdOrg } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: "LZ7 Energia Solar",
        slug: "lz7",
        retention_days: 90,
        opt_out_keywords: ["sair", "parar", "descadastrar"],
      })
      .select("id, name, slug, retention_days, opt_out_keywords")
      .single();

    return createdOrg ? { ...createdOrg, myRole: "admin" } : null;
  });

export const listWaConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orgId: z.string().uuid().optional(),
        status: z.enum(["todos", "bot", "humano", "encerrada"]).default("todos"),
        search: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("wa_conversations")
      .select(
        "id, status, last_message_at, handoff_reason, assigned_to, unread_count, summary, wa_contacts(id, profile_name, phone_e164, consent_status, lead_id)",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (data.orgId) query = query.eq("org_id", data.orgId);
    if (data.status !== "todos") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const term = data.search?.trim().toLowerCase();
    const list = (rows ?? []).map((r) => {
      const c = r.wa_contacts as unknown as {
        id: string;
        profile_name: string | null;
        phone_e164: string;
        consent_status: string;
        lead_id: string | null;
      } | null;
      return {
        id: r.id,
        status: r.status,
        lastMessageAt: r.last_message_at,
        handoffReason: r.handoff_reason,
        assignedTo: r.assigned_to,
        unread: r.unread_count,
        summary: r.summary,
        contactId: c?.id ?? null,
        name: c?.profile_name ?? c?.phone_e164 ?? "Contato",
        phone: c?.phone_e164 ?? "",
        consent: c?.consent_status ?? "desconhecido",
        leadId: c?.lead_id ?? null,
      };
    });

    if (!term) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(term) || c.phone.includes(term.replace(/\D/g, "")),
    );
  });

export const listWaMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("wa_messages")
      .select(
        "id, direction, msg_type, body, status, error, occurred_at, ai_generated, imported, wa_media(id, mime_type, transcript, transcript_status, storage_path)",
      )
      .eq("conversation_id", data.conversationId)
      .order("occurred_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);
    return rows ?? [];
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
      .eq("id", data.conversationId);
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv, error } = await supabaseAdmin
      .from("wa_conversations")
      .select("id, org_id, contact_id, wa_contacts(phone_e164)")
      .eq("id", data.conversationId)
      .maybeSingle();

    if (error || !conv) throw new Error(error?.message ?? "Conversa não encontrada");

    const contact = conv.wa_contacts as unknown as { phone_e164: string } | null;
    const phone = contact?.phone_e164;
    if (!phone) throw new Error("Telefone do contato não encontrado");

    // 1. Envia a mensagem pelo WhatsApp oficial
    const { sendWhatsAppText } = await import("@/lib/whatsapp.server");
    await sendWhatsAppText(phone, data.text);

    // 2. Grava na tabela de mensagens do chat
    await supabaseAdmin.from("wa_messages").insert({
      conversation_id: conv.id,
      direction: "outbound",
      msg_type: "text",
      body: data.text,
      status: "sent",
      ai_generated: false,
      occurred_at: new Date().toISOString(),
    } as any);

    // 3. Atualiza timestamps da conversa
    await supabaseAdmin
      .from("wa_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        status: "humano",
        summary: data.text.slice(0, 160),
      } as any)
      .eq("id", conv.id);

    return { ok: true };
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv, error } = await supabaseAdmin
      .from("wa_conversations")
      .select("id, org_id, contact_id, wa_contacts(phone_e164)")
      .eq("id", data.conversationId)
      .maybeSingle();

    if (error || !conv) throw new Error(error?.message ?? "Conversa não encontrada");

    const contact = conv.wa_contacts as unknown as { phone_e164: string } | null;
    const phone = contact?.phone_e164;
    if (!phone) throw new Error("Telefone do contato não encontrado");

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

    let publicUrl = "";
    if (!uploadError) {
      const { data: signedData } = await supabaseAdmin.storage
        .from("wa-media")
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
      publicUrl = signedData?.signedUrl ?? "";
    }

    // Se publicUrl gerada, dispara via Meta Cloud API
    if (publicUrl) {
      const { sendWhatsAppMedia } = await import("@/lib/whatsapp.server");
      try {
        await sendWhatsAppMedia(phone, data.type, publicUrl, data.caption || data.fileName);
      } catch (sendErr) {
        console.error("[send wa media error]", sendErr);
      }
    }

    // 2. Grava a mensagem na tabela
    await supabaseAdmin.from("wa_messages").insert({
      conversation_id: conv.id,
      direction: "outbound",
      msg_type: data.type,
      body:
        data.caption ||
        (data.type === "audio"
          ? "[Áudio de voz enviado]"
          : `[Arquivo: ${data.fileName || "anexo"}]`),
      status: "sent",
      ai_generated: false,
      occurred_at: new Date().toISOString(),
    } as any);

    // 3. Atualiza timestamps da conversa
    await supabaseAdmin
      .from("wa_conversations")
      .update({
        last_message_at: new Date().toISOString(),
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { defaultOrgId, upsertContact, ensureConversation } =
      await import("@/lib/wa-ingest.server");

    const orgId = await defaultOrgId(supabaseAdmin as any);
    if (!orgId) throw new Error("Organização padrão não encontrada");

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
          conversation_id: conversationId,
          direction,
          msg_type: "text",
          body: body.trim(),
          status: "delivered",
          occurred_at: occurredAt,
          imported: true,
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [pending, dead, failed, waiting, lastEvent, badTranscripts] = await Promise.all([
      supabaseAdmin
        .from("wa_events")
        .select("id", { count: "exact", head: true })
        .eq("process_status", "pending"),
      supabaseAdmin
        .from("wa_events")
        .select("id", { count: "exact", head: true })
        .eq("process_status", "dead"),
      supabaseAdmin
        .from("wa_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("occurred_at", since),
      supabaseAdmin
        .from("wa_conversations")
        .select("id", { count: "exact", head: true })
        .eq("status", "humano"),
      supabaseAdmin
        .from("wa_events")
        .select("received_at")
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("wa_media")
        .select("id", { count: "exact", head: true })
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
