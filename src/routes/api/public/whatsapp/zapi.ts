import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultOrgId } from "@/lib/wa-ingest.server";
import { normalizeZapiWebhook } from "@/lib/wa-normalize.server";
import { applyDeliveryStatus, persistNormalizedMessage } from "@/lib/wa-store.server";
import { getZApiConfig } from "@/lib/zapi.server";

// 🔒 IA pausada até autorização expressa do usuário.
const LIZ_AUTO_REPLY_ENABLED = false;

export const Route = createFileRoute("/api/public/whatsapp/zapi")({
  server: {
    handlers: {
      GET: async () => new Response("Z-API Webhook LZ7 ativo", { status: 200 }),

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

          const orgId = await defaultOrgId(supabaseAdmin as never);
          if (!orgId) return new Response("no org", { status: 503 });

          const evento = normalizeZapiWebhook(payload);

          // Registro bruto idempotente (permite reprocessar e reparar depois).
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
          const payloadHash = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          const eventId =
            evento.kind === "status"
              ? `status:${evento.ids.join(",")}:${evento.status}`
              : evento.kind === "message" && evento.messageId
                ? `message:${evento.messageId}:${payload.isEdit ? "edit" : "new"}`
                : `zapi:${payloadHash}`;

          const { data: recordedEvent, error: eventError } = await supabaseAdmin
            .from("wa_events")
            .upsert(
              {
                org_id: orgId,
                provider_event_id: eventId,
                event_kind: evento.kind,
                payload,
                process_status: "processing",
                attempts: 1,
              } as never,
              { onConflict: "provider_event_id", ignoreDuplicates: true },
            )
            .select("id")
            .maybeSingle();
          if (eventError) throw eventError;
          if (!recordedEvent) return new Response("duplicate event ignored", { status: 200 });

          const finish = async (status: string, texto: string, code = 200) => {
            await supabaseAdmin
              .from("wa_events")
              .update({
                process_status: status,
                processed_at: new Date().toISOString(),
                error: status === "processed" ? null : texto,
              } as never)
              .eq("provider_event_id", eventId);
            return new Response(texto, { status: code });
          };

          if (evento.kind === "ignore") {
            return finish("processed", `ignorado: ${evento.reason}`);
          }

          if (evento.kind === "status") {
            const n = await applyDeliveryStatus(supabaseAdmin, evento.ids, evento.status);
            return finish("processed", `status ${evento.status} em ${n} mensagem(ns)`);
          }

          if (evento.isGroup) {
            return finish("processed", "mensagem de grupo ignorada");
          }

          const result = await persistNormalizedMessage(supabaseAdmin, orgId, evento);
          if (!result.ok) return finish("failed", `não persistida: ${result.reason}`);

          // 🤖 ATENDIMENTO AUTOMÁTICO LIZ IA (Z-API)
          if (!evento.isFromMe && result.conversationId && !result.duplicated) {
            // 1. Busca configurações da organização
            const { data: orgData } = await supabaseAdmin
              .from("organizations")
              .select("id, settings")
              .eq("id", orgId)
              .maybeSingle();
            const orgSettings = (orgData?.settings as any) || {};
            const isGlobalLizActive = Boolean(orgSettings.liz_global_mode);

            // 2. Busca configuração dos canais WhatsApp
            const { data: channelData } = await supabaseAdmin
              .from("wa_channels")
              .select("id, bot_enabled, shadow_mode, test_allowlist")
              .eq("org_id", orgId)
              .maybeSingle();
            const isChannelBotActive = Boolean(channelData?.bot_enabled && !channelData?.shadow_mode);

            // 3. Status da conversa atual
            const { data: conv } = await supabaseAdmin
              .from("wa_conversations")
              .select("status, handoff_reason, handoff_at")
              .eq("id", result.conversationId)
              .maybeSingle();

            const isExplicitlyHuman =
              conv?.status === "humano_assumiu" ||
              conv?.status === "encerrada" ||
              conv?.status === "humano_bloqueado";

            // Por padrão, a LIZ IA atende automaticamente todos os leads a menos que um atendente humano tenha assumido explicitamente
            const shouldLizReply = !isExplicitlyHuman;

            if (shouldLizReply) {
              const { orchestrateLizZapiReply } = await import("@/lib/wa-orchestrator.server");
              let targetPhone = (evento.chatPhone || evento.participantPhone || "")
                .replace(/@.*$/, "")
                .replace(/\D/g, "");

              if (!targetPhone) {
                const { data: cData } = await supabaseAdmin
                  .from("wa_contacts")
                  .select("phone_e164")
                  .eq("id", result.contactId)
                  .maybeSingle();
                targetPhone = (cData?.phone_e164 || "").replace(/\D/g, "");
              }

              // Normaliza para 13 dígitos no Brasil (55 + DDD + 9 + 8 dígitos)
              if (targetPhone.startsWith("55") && targetPhone.length === 12) {
                const ddd = targetPhone.slice(2, 4);
                const rest = targetPhone.slice(4);
                targetPhone = `55${ddd}9${rest}`;
              } else if (!targetPhone.startsWith("55") && (targetPhone.length === 10 || targetPhone.length === 11)) {
                if (targetPhone.length === 10) {
                  const ddd = targetPhone.slice(0, 2);
                  const rest = targetPhone.slice(2);
                  targetPhone = `55${ddd}9${rest}`;
                } else {
                  targetPhone = `55${targetPhone}`;
                }
              }

              // Se houver lista de teste e não for modo global geral
              if (channelData?.test_allowlist?.length && !isGlobalLizActive && channelData.test_allowlist.length > 0) {
                const isAllowed = channelData.test_allowlist.some(
                  (a: string) => a.replace(/\D/g, "") === targetPhone,
                );
                if (!isAllowed) {
                  return finish("processed", "fora da lista de teste permitida");
                }
              }

              let userContent = evento.text || "";

              // Se for mensagem de voz / áudio, transcreve com IA de alta fidelidade
              if (
                evento.msgType === "audio" ||
                (evento.media?.url &&
                  (evento.media.mime?.startsWith("audio/") ||
                    evento.media.url.includes(".ogg") ||
                    evento.media.url.includes(".mp4") ||
                    evento.media.url.includes(".m4a")))
              ) {
                const { transcribeWaAudio } = await import("@/lib/wa-audio.server");
                const transcription = await transcribeWaAudio(evento.media.url || "", evento.media.mime);
                if (transcription) {
                  userContent = `[Áudio do cliente]: "${transcription}"`;
                  if (result.messageId) {
                    await supabaseAdmin
                      .from("wa_messages")
                      .update({ body: `🎤 ${transcription}` })
                      .eq("id", result.messageId);
                  }
                } else {
                  userContent = "[Áudio de voz recebido do cliente]";
                }
              } else if (evento.media?.url) {
                const filename = evento.media.filename || "imagem/documento";
                userContent = userContent
                  ? `${userContent} [Arquivo anexo: ${filename}]`
                  : `[Cliente enviou um anexo/foto: ${filename}]`;
              }

              if (!userContent.trim()) {
                userContent = "Olá";
              }

              // Garante status 'bot' na conversa para visualização no inbox
              await supabaseAdmin
                .from("wa_conversations")
                .update({ status: "bot" })
                .eq("id", result.conversationId);

              console.log(
                `[LIZ IA - Auto Reply Ativo] Respondendo para ${targetPhone} no chat ${result.conversationId}: "${userContent}"`,
              );

              await orchestrateLizZapiReply({
                supabase: supabaseAdmin,
                orgId,
                conversationId: result.conversationId,
                contactId: result.contactId,
                phone: targetPhone,
                userText: userContent,
              });

              return finish("processed", "respondido pela LIZ IA");
            }
          }

          // 🧠 APRENDIZADO PASSIVO CONTÍNUO: Quando a SDR/humano envia uma resposta, a LIZ aprende silenciosamente
          if (evento.isFromMe && result.conversationId && !result.duplicated && (evento.text || "").length > 8) {
            import("@/lib/wa-knowledge.server")
              .then(({ backgroundLearnFromHumanResponse }) => {
                backgroundLearnFromHumanResponse(result.conversationId, evento.text || "").catch((e) =>
                  console.warn("[Background Human Learning Error]", e),
                );
              })
              .catch(() => {});
          }

          return finish("processed", "mensagem registrada");
        } catch (err) {
          const message = err instanceof Error ? err.message : "erro desconhecido";
          console.error("[Z-API Webhook Error]", message);
          return new Response(`error: ${message}`, { status: 500 });
        }
      },
    },
  },
});
