import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultOrgId, upsertContact, ensureConversation } from "@/lib/wa-ingest.server";

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
          const payload = await request.json();
          console.log("[Z-API Webhook Event]", payload.type || payload.event || "message", JSON.stringify(payload));

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

          if (statusRaw && statusIds.length > 0) {
            let mappedStatus: "sent" | "delivered" | "read" | "failed" | null = null;
            if (statusRaw === "SENT" || statusRaw === "1") mappedStatus = "sent";
            else if (statusRaw === "RECEIVED" || statusRaw === "DELIVERED" || statusRaw === "2") mappedStatus = "delivered";
            else if (statusRaw === "READ" || statusRaw === "READ_BY_ME" || statusRaw === "PLAYED" || statusRaw === "3") mappedStatus = "read";
            else if (statusRaw === "FAILED" || statusRaw === "ERROR") mappedStatus = "failed";

            if (mappedStatus) {
              await supabaseAdmin
                .from("wa_messages")
                .update({ status: mappedStatus })
                .in("provider_message_id", statusIds);
              return new Response(`status updated to ${mappedStatus}`, { status: 200 });
            }
          }

          if (String(payload.type || "").toLowerCase().includes("statuscallback")) {
            return new Response("status ignored", { status: 200 });
          }

          // Ignora mensagens de grupo ou sem telefone válido
          if (payload.isGroup) return new Response("group ignored", { status: 200 });

          const rawPhone =
            payload.phone ||
            payload.participantPhone ||
            payload.senderPhone ||
            payload.chatId ||
            payload.from ||
            payload.to ||
            "";
          const phone = String(rawPhone).replace(/\D/g, "");
          if (!phone || phone.length < 8) return new Response("no valid phone", { status: 200 });

          const isFromMe = payload.fromMe === true || payload.isFromMe === true;
          const senderName =
            payload.senderName ||
            payload.chatName ||
            payload.pushName ||
            payload.name ||
            (isFromMe ? "Stephany (SDR)" : "Cliente");

          const messageText =
            (typeof payload.text === "string" ? payload.text : payload.text?.message) ||
            payload.message?.text ||
            payload.message ||
            payload.body ||
            payload.caption ||
            payload.image?.caption ||
            payload.video?.caption ||
            payload.document?.caption ||
            "";

          const audioUrl = payload.audio?.audioUrl || payload.audioUrl || (payload.type === "audio" ? payload.url : null);
          const imageUrl = payload.image?.imageUrl || payload.imageUrl || (payload.type === "image" ? payload.url : null);
          const docUrl = payload.document?.documentUrl || payload.documentUrl || (payload.type === "document" ? payload.url : null);
          const docName = payload.document?.fileName || payload.fileName || (docUrl ? "fatura_energia.pdf" : null);

          const orgId = await defaultOrgId(supabaseAdmin as any);
          if (!orgId) return new Response("no org", { status: 200 });

          const chatLid = typeof payload.chatLid === "string" ? payload.chatLid : null;
          let contactId: string | null = null;

          if (isFromMe && chatLid) {
            const { data: linkedContact } = await supabaseAdmin
              .from("wa_contacts")
              .select("id")
              .eq("org_id", orgId)
              .eq("wa_id", chatLid)
              .maybeSingle();
            contactId = linkedContact?.id ?? null;
          }

          if (!contactId && !String(rawPhone).endsWith("@lid")) {
            contactId = await upsertContact(
              supabaseAdmin as any,
              orgId,
              phone,
              senderName,
              chatLid,
            );
          }
          if (!contactId) return new Response("no contact", { status: 200 });

          const convId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
          if (!convId) return new Response("no conv", { status: 200 });

          // 2. Deduplicação Estrita por provider_message_id
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
            body = docName || "fatura_luz.pdf";
          } else if (audioUrl) {
            msgType = "audio";
            body = audioUrl;
          } else if (imageUrl) {
            msgType = "image";
            body = messageText || imageUrl;
          }

          if (!body) body = isFromMe ? "[Mensagem enviada]" : "[Mensagem recebida]";

          // 3. Se enviada pelo celular da Stephany (fromMe = true)
          if (isFromMe) {
            console.log(`[Z-API] Stephany enviou mensagem para ${phone} pelo celular.`);
            await supabaseAdmin
              .from("wa_conversations")
              .update({
                status: "humano",
                last_message_at: new Date().toISOString(),
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
              occurred_at: payload.momment
                ? new Date(Number(payload.momment)).toISOString()
                : new Date().toISOString(),
            } as any);

            if (insertError) throw insertError;

            return new Response("sdr message recorded", { status: 200 });
          }

          // 4. Mensagem Recebida do Cliente
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
            occurred_at: payload.momment
              ? new Date(Number(payload.momment)).toISOString()
              : new Date().toISOString(),
          } as any);

          if (insertError) throw insertError;

          await supabaseAdmin
            .from("wa_conversations")
            .update({
              status: convData?.status || "humano",
              last_message_at: new Date().toISOString(),
              summary: body.slice(0, 160),
              unread_count: newUnread,
            } as any)
            .eq("id", convId);

          // 🛑 TRAVA DE SEGURANÇA DA IA
          if (!LIZ_AUTO_REPLY_ENABLED || convData?.status === "humano") {
            console.log(`[Z-API] Mensagem de ${phone} registrada. LIZ IA pausada por segurança ou em atendimento humano.`);
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
