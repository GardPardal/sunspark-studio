import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultOrgId, upsertContact, ensureConversation } from "@/lib/wa-ingest.server";
import { getZApiConfig } from "@/lib/zapi.server";

// 🔒 TRAVA DE SEGURANÇA: IA PAUSADA ATÉ AUTORIZAÇÃO EXPRESSA DO USUÁRIO
const LIZ_AUTO_REPLY_ENABLED = false;

export const Route = createFileRoute("/api/public/whatsapp/zapi")({
  server: {
    handlers: {
      GET: async () => {
        return new Response("Z-API Webhook LZ7 Ativo (Modo Silencioso / Seguro)", { status: 200 });
      },
      POST: async ({ request }) => {
        try {
          const expectedToken = getZApiConfig().clientToken;
          const suppliedToken =
            request.headers.get("client-token") ||
            request.headers.get("x-zapi-token") ||
            new URL(request.url).searchParams.get("token");
          if (!suppliedToken || suppliedToken !== expectedToken) {
            return new Response("forbidden", { status: 403 });
          }

          const raw = await request.text();
          if (raw.length > 1_000_000) return new Response("payload too large", { status: 413 });
          const payload = JSON.parse(raw);

          // 1. Tratamento de Eventos de Status (Entrega, Leitura e Falha)
          const providerMsgId =
            payload.messageId ||
            payload.id ||
            payload.wamid ||
            payload.key?.id ||
            payload.zaapId ||
            null;

          const statusRaw = String(payload.status || payload.ack || "").toUpperCase();
          const statusIds = [
            ...(Array.isArray(payload.ids) ? payload.ids : []),
            ...(providerMsgId ? [providerMsgId] : []),
          ].filter((id): id is string => typeof id === "string" && id.length > 0);

          const orgId = await defaultOrgId(supabaseAdmin as any);
          if (!orgId) return new Response("no org", { status: 503 });
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
          const payloadHash = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const eventId = providerMsgId
            ? `${statusRaw ? "status" : "message"}:${providerMsgId}:${statusRaw || "received"}`
            : `zapi:${payloadHash}`;
          const { data: recordedEvent, error: eventError } = await supabaseAdmin
            .from("wa_events")
            .upsert(
              {
                org_id: orgId,
                channel_id: null,
                provider_event_id: eventId,
                event_kind: statusRaw ? "status" : "message",
                payload,
                process_status: "processing",
                attempts: 1,
              } as any,
              { onConflict: "provider_event_id", ignoreDuplicates: true },
            )
            .select("id")
            .maybeSingle();
          if (eventError) throw eventError;
          if (!recordedEvent) return new Response("duplicate event ignored", { status: 200 });

          const markEventProcessed = () =>
            supabaseAdmin
              .from("wa_events")
              .update({ process_status: "processed", processed_at: new Date().toISOString() })
              .eq("provider_event_id", eventId);

          if (statusRaw && statusIds.length > 0) {
            let mappedStatus: "sent" | "delivered" | "read" | "failed" | null = null;
            if (statusRaw === "SENT" || statusRaw === "1") mappedStatus = "sent";
            else if (statusRaw === "RECEIVED" || statusRaw === "DELIVERED" || statusRaw === "2")
              mappedStatus = "delivered";
            else if (
              statusRaw === "READ" ||
              statusRaw === "READ_BY_ME" ||
              statusRaw === "PLAYED" ||
              statusRaw === "3"
            )
              mappedStatus = "read";
            else if (statusRaw === "FAILED" || statusRaw === "ERROR") mappedStatus = "failed";

            if (mappedStatus) {
              await supabaseAdmin
                .from("wa_messages")
                .update({ status: mappedStatus })
                .in("provider_message_id", statusIds);
              await markEventProcessed();
              return new Response(`status updated to ${mappedStatus}`, { status: 200 });
            }
          }

          if (
            String(payload.type || "")
              .toLowerCase()
              .includes("statuscallback")
          ) {
            await markEventProcessed();
            return new Response("status ignored", { status: 200 });
          }

          // Ignora mensagens de grupo
          if (payload.isGroup) {
            await markEventProcessed();
            return new Response("group ignored", { status: 200 });
          }

          // Identificação do Telefone
          const phoneCandidates = [
            payload.phone,
            payload.participantPhone,
            payload.senderPhone,
            payload.chatId,
            payload.from,
            payload.to,
          ].filter((value): value is string => typeof value === "string" && value.length > 0);

          const rawPhone =
            phoneCandidates.find((value) => !value.endsWith("@lid")) || phoneCandidates[0] || "";
          const phone = String(rawPhone).replace(/\D/g, "");
          if (!phone || phone.length < 8) {
            await markEventProcessed();
            return new Response("no valid phone", { status: 200 });
          }

          const isFromMe =
            payload.fromMe === true || payload.isFromMe === true || payload.isSentByMe === true;

          // Identificação do Nome Real do Contato
          const senderName =
            payload.senderName ||
            payload.chatName ||
            payload.pushName ||
            payload.name ||
            payload.contact?.name ||
            payload.sender?.name ||
            payload.profileName ||
            payload.chat?.name ||
            payload.sender?.formattedName ||
            (isFromMe ? "Equipe LZ7" : `Contato (${phone.slice(-4)})`);

          // Parser Universal de Texto do WhatsApp
          const messageText =
            (typeof payload.text === "string" ? payload.text : payload.text?.message) ||
            payload.message?.text ||
            payload.message?.conversation ||
            payload.message?.extendedTextMessage?.text ||
            payload.message?.extendedTextMessage?.description ||
            (typeof payload.message === "string" ? payload.message : "") ||
            payload.body ||
            payload.content ||
            payload.caption ||
            payload.image?.caption ||
            payload.video?.caption ||
            payload.document?.caption ||
            payload.message?.imageMessage?.caption ||
            payload.message?.documentMessage?.caption ||
            payload.message?.documentMessage?.fileName ||
            payload.data?.message ||
            "";

          // Mídias
          const audioUrl =
            payload.audio?.audioUrl ||
            payload.audioUrl ||
            (payload.type === "audio" ? payload.url : null);
          const imageUrl =
            payload.image?.imageUrl ||
            payload.imageUrl ||
            (payload.type === "image" ? payload.url : null);
          const docUrl =
            payload.document?.documentUrl ||
            payload.documentUrl ||
            (payload.type === "document" ? payload.url : null);
          const docName =
            payload.document?.fileName ||
            payload.fileName ||
            (docUrl ? "fatura_energia.pdf" : null);
          const videoUrl =
            payload.video?.videoUrl ||
            payload.videoUrl ||
            (payload.type === "video" ? payload.url : null);

          const chatLid = typeof payload.chatLid === "string" ? payload.chatLid : null;
          let contactId: string | null = null;
          const lid = chatLid || phoneCandidates.find((value) => value.endsWith("@lid")) || null;

          if (lid) {
            const { data: linkedContact } = await supabaseAdmin
              .from("wa_contacts")
              .select("id")
              .eq("org_id", orgId)
              .eq("wa_id", lid)
              .maybeSingle();
            contactId = linkedContact?.id ?? null;
          }

          if (!contactId && !String(rawPhone).endsWith("@lid")) {
            contactId = await upsertContact(supabaseAdmin as any, orgId, phone, senderName, lid);
          }
          if (!contactId) return new Response("no contact", { status: 200 });

          const convId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
          if (!convId) return new Response("no conv", { status: 200 });

          // Deduplicação Estrita por provider_message_id
          if (providerMsgId) {
            const { data: existingMsg } = await supabaseAdmin
              .from("wa_messages")
              .select("id")
              .eq("provider_message_id", providerMsgId)
              .maybeSingle();

            if (existingMsg) {
              return new Response("duplicate message ignored", { status: 200 });
            }
          }

          // Determina o tipo de mensagem e o corpo
          let msgType = "text";
          let body = messageText;

          if (docUrl || docName) {
            msgType = "document";
            body = docUrl || docName || "fatura_luz.pdf";
          } else if (audioUrl) {
            msgType = "audio";
            body = audioUrl;
          } else if (imageUrl) {
            msgType = "image";
            body = imageUrl || messageText;
          } else if (videoUrl) {
            msgType = "video";
            body = videoUrl;
          }

          if (!body) body = isFromMe ? "[Mensagem enviada]" : "[Mensagem recebida]";

          // Timestamp robusto
          let occurredAt = new Date().toISOString();
          const rawMoment =
            payload.momment || payload.moment || payload.timestamp || payload.messageTimestamp;
          if (rawMoment) {
            const num = Number(rawMoment);
            if (!isNaN(num) && num > 0) {
              occurredAt = new Date(num > 1000000000000 ? num : num * 1000).toISOString();
            } else if (typeof rawMoment === "string" && !isNaN(Date.parse(rawMoment))) {
              occurredAt = new Date(rawMoment).toISOString();
            }
          }

          // Mensagem enviada pelo celular da Stephany (fromMe = true)
          if (isFromMe) {
            await supabaseAdmin
              .from("wa_conversations")
              .update({
                status: "humano",
                last_message_at: occurredAt,
                summary: body.slice(0, 160),
              } as any)
              .eq("id", convId);

            const { error: insertError } = await supabaseAdmin.from("wa_messages").insert({
              org_id: orgId,
              conversation_id: convId,
              contact_id: contactId,
              direction: "outbound",
              msg_type: msgType,
              body,
              status: "sent",
              provider_message_id: providerMsgId,
              source: "zapi",
              ai_generated: false,
              occurred_at: occurredAt,
            } as any);

            if (insertError) throw insertError;
            await markEventProcessed();
            return new Response("sdr message recorded", { status: 200 });
          }

          // Mensagem Recebida do Cliente
          const { data: convData } = await supabaseAdmin
            .from("wa_conversations")
            .select("unread_count, status")
            .eq("id", convId)
            .maybeSingle();

          const newUnread = ((convData?.unread_count as number) || 0) + 1;

          const { error: insertError } = await supabaseAdmin.from("wa_messages").insert({
            org_id: orgId,
            conversation_id: convId,
            contact_id: contactId,
            direction: "inbound",
            msg_type: msgType,
            body,
            status: "delivered",
            provider_message_id: providerMsgId,
            source: "zapi",
            ai_generated: false,
            occurred_at: occurredAt,
          } as any);

          if (insertError) throw insertError;

          await supabaseAdmin
            .from("wa_conversations")
            .update({
              status: convData?.status || "humano",
              last_message_at: occurredAt,
              summary: body.slice(0, 160),
              unread_count: newUnread,
            } as any)
            .eq("id", convId);

          await markEventProcessed();

          // Trava de segurança IA
          if (!LIZ_AUTO_REPLY_ENABLED || convData?.status === "humano") {
            return new Response("recorded (ai paused)", { status: 200 });
          }

          return new Response("ok", { status: 200 });
        } catch (err: any) {
          console.error("[Z-API Webhook Error]", err);
          return new Response(`error: ${err.message}`, { status: 500 });
        }
      },
    },
  },
});
