import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateText, tool } from "ai";
import { getResolvedAiModel } from "@/lib/ai-provider.server";
import { LIZ_CAPTURE_PROMPT } from "@/lib/liz-prompt";
import { z } from "zod";
import { pushLeadToPloomesInternal } from "@/lib/ploomes.server";

const SESSION_DIR = path.resolve(process.cwd(), "wa_session");

let activeSock: any = null;
let currentQR: string | null = null;
let connectionState: "disconnected" | "connecting" | "qr_ready" | "connected" = "disconnected";
let connectedPhone: string | null = null;

const logger = pino({ level: "silent" });

export function getBaileysStatus() {
  return {
    status: connectionState,
    qrCode: currentQR,
    phoneNumber: connectedPhone,
  };
}

export async function initBaileysSocket(): Promise<{ qrCode: string | null; status: string }> {
  if (activeSock && connectionState === "connected") {
    return { qrCode: null, status: "connected" };
  }

  if (activeSock && connectionState === "qr_ready" && currentQR) {
    return { qrCode: currentQR, status: "qr_ready" };
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  connectionState = "connecting";

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
  });

  activeSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      connectionState = "qr_ready";
      console.log("[Baileys] Novo QR Code gerado para o WhatsApp da Stephany!");
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("[Baileys] Conexão encerrada. Reconectar?", shouldReconnect);
      connectionState = "disconnected";
      currentQR = null;
      activeSock = null;

      if (shouldReconnect) {
        setTimeout(() => initBaileysSocket(), 3000);
      }
    } else if (connection === "open") {
      connectionState = "connected";
      currentQR = null;
      connectedPhone = sock.user?.id ? sock.user.id.split(":")[0] : "+55 43 9976-0685";
      console.log("[Baileys] WHATSAPP CONECTADO COM SUCESSO! Celular:", connectedPhone);
    }
  });

  // Escuta novas mensagens no WhatsApp
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message) continue;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid.includes("@g.us")) continue; // ignora grupos

      const isFromMe = msg.key.fromMe ?? false;
      const pushName = msg.pushName || "Cliente";
      const cleanPhone = remoteJid.replace(/\D/g, "");

      // Extrai texto da mensagem
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      if (isFromMe) {
        // Se a Stephany enviou mensagem pelo celular, pausa a IA para esse cliente
        console.log(`[Baileys] Stephany respondeu ${cleanPhone} pelo celular. Pausando IA.`);
        const { defaultOrgId, upsertContact, ensureConversation } =
          await import("@/lib/wa-ingest.server");
        const orgId = await defaultOrgId(supabaseAdmin as any);
        if (orgId) {
          const contactId = await upsertContact(supabaseAdmin as any, orgId, cleanPhone, pushName);
          if (contactId) {
            const convId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
            if (convId) {
              await supabaseAdmin
                .from("wa_conversations")
                .update({ status: "humano", last_message_at: new Date().toISOString() } as any)
                .eq("id", convId);

              await supabaseAdmin.from("wa_messages").insert({
                conversation_id: convId,
                direction: "outbound",
                msg_type: "text",
                body: text || "[Mídia enviada pelo celular]",
                status: "sent",
                ai_generated: false,
                occurred_at: new Date().toISOString(),
              } as any);
            }
          }
        }
        continue;
      }

      // Mensagem recebida do Cliente
      if (!text && !msg.message.audioMessage) continue;

      console.log(`[Baileys] Mensagem recebida de ${pushName} (${cleanPhone}): ${text}`);

      try {
        const { defaultOrgId, upsertContact, ensureConversation } =
          await import("@/lib/wa-ingest.server");
        const orgId = await defaultOrgId(supabaseAdmin as any);
        if (!orgId) continue;

        const contactId = await upsertContact(supabaseAdmin as any, orgId, cleanPhone, pushName);
        if (!contactId) continue;

        const convId = await ensureConversation(supabaseAdmin as any, orgId, contactId, null);
        if (!convId) continue;

        // Verifica se a conversa está pausada para humano
        const { data: convData } = await supabaseAdmin
          .from("wa_conversations")
          .select("status")
          .eq("id", convId)
          .maybeSingle();

        // Registra mensagem do cliente
        await supabaseAdmin.from("wa_messages").insert({
          conversation_id: convId,
          direction: "inbound",
          msg_type: msg.message.audioMessage ? "audio" : "text",
          body: text || "[Mensagem de áudio recebida]",
          status: "delivered",
          ai_generated: false,
          occurred_at: new Date().toISOString(),
        } as any);

        // TRAVA DE SEGURANÇA: Modo silencioso enquanto usuário prepara a base
        const LIZ_AUTO_REPLY_ENABLED = false;
        if (!LIZ_AUTO_REPLY_ENABLED || convData?.status === "humano") {
          console.log(`[Baileys] Mensagem registrada. Modo silencioso ativo ou atendente humano assumiu.`);
          continue;
        }
      } catch (err) {
        console.error("[Baileys Message Handling Error]", err);
      }
    }
  });

  return { qrCode: currentQR, status: connectionState };
}

export async function sendBaileysMessage(phone: string, text: string) {
  if (!activeSock || connectionState !== "connected") {
    throw new Error("WhatsApp Web não está conectado via QR Code");
  }
  const cleanPhone = phone.replace(/\D/g, "");
  const jid = `${cleanPhone}@s.whatsapp.net`;
  return activeSock.sendMessage(jid, { text });
}
