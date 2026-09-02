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
          console.log("[Z-API Webhook Payload]", JSON.stringify(payload));

          // Ignora mensagens de grupo ou sem telefone
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

          const audioUrl = payload.audio?.audioUrl || payload.audioUrl;
          const imageUrl = payload.image?.imageUrl || payload.imageUrl;
          const docUrl = payload.document?.documentUrl || payload.documentUrl;

          const orgId = await defaultOrgId(supabaseAdmin as any);
          if (!orgId) return new Response("no org", { status: 200 });

          const contactId = await upsertContact(supabaseAdmin as any, orgId, phone, senderName);
          if (!contactId) return new Response("no contact", { status: 200 });

          const convId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
          if (!convId) return new Response("no conv", { status: 200 });

          // Se a mensagem foi enviada pelo celular físico (Stephany)
          if (isFromMe) {
            console.log(`[Z-API] Stephany enviou mensagem para ${phone} pelo celular.`);
            await supabaseAdmin
              .from("wa_conversations")
              .update({
                status: "humano",
                last_message_at: new Date().toISOString(),
                summary: messageText.slice(0, 160),
              } as any)
              .eq("id", convId);

            await supabaseAdmin.from("wa_messages").insert({
              conversation_id: convId,
              direction: "outbound",
              msg_type: audioUrl ? "audio" : "text",
              body: messageText || "[Mídia enviada pelo celular]",
              status: "sent",
              ai_generated: false,
              occurred_at: new Date().toISOString(),
            } as any);

            return new Response("sdr message recorded", { status: 200 });
          }

          // Mensagem recebida do Cliente -> Grava no banco
          await supabaseAdmin.from("wa_messages").insert({
            conversation_id: convId,
            direction: "inbound",
            msg_type: audioUrl ? "audio" : "text",
            body: messageText || "[Mensagem de voz/áudio recebida]",
            status: "delivered",
            ai_generated: false,
            occurred_at: new Date().toISOString(),
          } as any);

          await supabaseAdmin
            .from("wa_conversations")
            .update({
              status: "humano",
              last_message_at: new Date().toISOString(),
              summary: messageText.slice(0, 160),
            } as any)
            .eq("id", convId);

          // 🛑 TRAVA: NÃO DISPARA A IA AUTOMATICAMENTE
          if (!LIZ_AUTO_REPLY_ENABLED) {
            console.log(`[Z-API] Mensagem de ${phone} registrada. LIZ IA pausada por segurança.`);
            return new Response("recorded (ai paused by user request)", { status: 200 });
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
