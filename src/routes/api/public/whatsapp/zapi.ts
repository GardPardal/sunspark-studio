import { createFileRoute } from "@tanstack/react-router";
import { generateText, tool } from "ai";
import { z } from "zod";
import { getResolvedAiModel } from "@/lib/ai-provider.server";
import { LIZ_CAPTURE_PROMPT } from "@/lib/liz-prompt";
import { sendZApiText } from "@/lib/zapi.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pushLeadToPloomesInternal } from "@/lib/ploomes.server";
import { defaultOrgId, upsertContact, ensureConversation } from "@/lib/wa-ingest.server";

export const Route = createFileRoute("/api/public/whatsapp/zapi")({
  server: {
    handlers: {
      GET: async () => {
        return new Response("Z-API Webhook LZ7 Ativo", { status: 200 });
      },
      POST: async ({ request }) => {
        try {
          const payload = await request.json();
          console.log("[Z-API Webhook Payload]", JSON.stringify(payload));

          // Ignora mensagens de grupo ou sem telefone
          if (payload.isGroup) return new Response("group ignored", { status: 200 });

          const phone = payload.phone?.replace(/\D/g, "");
          if (!phone) return new Response("no phone", { status: 200 });

          const isFromMe = payload.fromMe ?? false;
          const senderName = payload.senderName || payload.chatName || "Cliente";
          const messageText =
            payload.text?.message ||
            payload.image?.caption ||
            payload.video?.caption ||
            payload.document?.caption ||
            "";
          const audioUrl = payload.audio?.audioUrl;

          const orgId = await defaultOrgId(supabaseAdmin as any);
          if (!orgId) return new Response("no org", { status: 200 });

          const contactId = await upsertContact(supabaseAdmin as any, orgId, phone, senderName);
          if (!contactId) return new Response("no contact", { status: 200 });

          const convId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
          if (!convId) return new Response("no conv", { status: 200 });

          // Se a mensagem veio da Stephany (do celular físico)
          if (isFromMe) {
            console.log(`[Z-API] Stephany respondeu ${phone} pelo celular. Pausando robô.`);
            await supabaseAdmin
              .from("wa_conversations")
              .update({ status: "humano", last_message_at: new Date().toISOString() } as any)
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

          // Mensagem recebida do Cliente
          await supabaseAdmin.from("wa_messages").insert({
            conversation_id: convId,
            direction: "inbound",
            msg_type: audioUrl ? "audio" : "text",
            body: messageText || "[Mensagem de voz/áudio recebida]",
            status: "delivered",
            ai_generated: false,
            occurred_at: new Date().toISOString(),
          } as any);

          // Verifica se a conversa está com status humano
          const { data: convData } = await supabaseAdmin
            .from("wa_conversations")
            .select("status")
            .eq("id", convId)
            .maybeSingle();

          if (convData?.status === "humano") {
            console.log(`[Z-API] Conversa com ${phone} está assumida pela Stephany. Robô pausado.`);
            return new Response("human active", { status: 200 });
          }

          // Executa a IA LIZ para responder
          const model = getResolvedAiModel();
          const response = await generateText({
            model,
            system: LIZ_CAPTURE_PROMPT,
            messages: [
              {
                role: "user",
                content: `Nome do cliente: ${senderName}. Telefone: ${phone}. Mensagem do cliente: "${messageText || "Enviei um áudio no WhatsApp"}"`,
              },
            ],
            tools: {
              qualificar_lead: tool({
                description: "Salva os dados do lead qualificado",
                parameters: z.object({
                  nome: z.string(),
                  cidade: z.string(),
                  valorContaLuz: z.number().optional(),
                  tipoImovel: z.string().optional(),
                  padraoEnergia: z.enum(["110V", "220V", "nao_sabe"]).optional(),
                }),
                execute: async (leadData) => {
                  await pushLeadToPloomesInternal({
                    name: leadData.nome,
                    phone,
                    city: leadData.cidade,
                    energyBillValue: leadData.valorContaLuz,
                    roofType: leadData.tipoImovel,
                  });
                  return { status: "success" };
                },
              }),
            },
            maxSteps: 2,
          });

          const replyText = response.text?.trim();
          if (replyText) {
            // Dispara resposta no WhatsApp via Z-API
            await sendZApiText(phone, replyText);

            // Grava resposta no banco
            await supabaseAdmin.from("wa_messages").insert({
              conversation_id: convId,
              direction: "outbound",
              msg_type: "text",
              body: replyText,
              status: "sent",
              ai_generated: true,
              occurred_at: new Date().toISOString(),
            } as any);

            await supabaseAdmin
              .from("wa_conversations")
              .update({
                last_message_at: new Date().toISOString(),
                summary: replyText.slice(0, 160),
              } as any)
              .eq("id", convId);

            console.log(`[Z-API] LIZ respondeu para ${phone}: ${replyText}`);
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
