const fs = require("fs");

console.log("==================================================");
console.log("🧪 SUÍTE DE TESTES DE ESTABILIZAÇÃO WHATSAPP + Z-API");
console.log("==================================================");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

// 1. Teste de Deduplicação de IDs de Mensagem
console.log("\n--- 1. Deduplicação Estrita de Mensagens (Idempotência) ---");
const seenIds = new Set();
function processIncomingWebhook(payload) {
  const providerMsgId = payload.messageId || payload.id || payload.wamid || null;
  if (providerMsgId && seenIds.has(providerMsgId)) {
    return { status: 200, action: "duplicate_ignored" };
  }
  if (providerMsgId) seenIds.add(providerMsgId);
  return { status: 200, action: "inserted", msgId: providerMsgId };
}

const res1 = processIncomingWebhook({ messageId: "ZAPI_W101_ABC", text: "Olá", phone: "554399760685" });
assert(res1.action === "inserted", "Primeira entrega do webhook inserida com sucesso");

const res2 = processIncomingWebhook({ messageId: "ZAPI_W101_ABC", text: "Olá", phone: "554399760685" });
assert(res2.action === "duplicate_ignored", "Reenvio de webhook duplicado ignorado com sucesso");

// 2. Teste de Transição de Estados de Envio / Leitura (Z-API Status)
console.log("\n--- 2. Transições de Status (SENT -> DELIVERED -> READ) ---");
function mapZApiStatus(rawStatus) {
  const s = String(rawStatus || "").toUpperCase();
  if (s === "SENT" || s === "1") return "sent";
  if (s === "RECEIVED" || s === "DELIVERED" || s === "2") return "delivered";
  if (s === "READ" || s === "PLAYED" || s === "3") return "read";
  if (s === "FAILED" || s === "ERROR") return "failed";
  return null;
}

assert(mapZApiStatus("SENT") === "sent", "Status SENT mapeado para 'sent' (1 check)");
assert(mapZApiStatus("DELIVERED") === "delivered", "Status DELIVERED mapeado para 'delivered' (2 checks)");
assert(mapZApiStatus("READ") === "read", "Status READ mapeado para 'read' (2 checks azuis)");
assert(mapZApiStatus("FAILED") === "failed", "Status FAILED mapeado para 'failed' (alerta)");

// 3. Teste da Trava Humano vs IA (Handoff Seguro)
console.log("\n--- 3. Trava de Handoff Humano vs LIZ IA ---");
function canAiRespond(conversationStatus, autoReplyEnabled) {
  if (!autoReplyEnabled) return false;
  if (conversationStatus === "humano" || conversationStatus === "encerrada") return false;
  return conversationStatus === "bot";
}

assert(canAiRespond("humano", true) === false, "IA proibida de responder quando conversa está em status 'humano'");
assert(canAiRespond("humano", false) === false, "IA proibida quando switch global está desligado");
assert(canAiRespond("bot", false) === false, "IA pausada se switch de segurança global estiver desativado");
assert(canAiRespond("bot", true) === true, "IA autorizada apenas quando conversa é 'bot' e switch está ativo");

// 4. Teste de Extração de Mídias (PDF, Áudio, Imagem)
console.log("\n--- 4. Mapeamento e Extração de Mídias ---");
function extractMedia(payload) {
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
  return { msgType, body };
}

const pdfExt = extractMedia({ type: "document", document: { fileName: "fatura_copel_102026.pdf" } });
assert(pdfExt.msgType === "document" && pdfExt.body === "fatura_copel_102026.pdf", "Extração de documento PDF com nome correto");

const audioExt = extractMedia({ type: "audio", audioUrl: "https://z-api.io/media/audio123.mp3" });
assert(audioExt.msgType === "audio" && audioExt.body.includes("audio123.mp3"), "Extração de áudio de voz com URL de streaming");

const imgExt = extractMedia({ type: "image", image: { imageUrl: "https://z-api.io/img/telhado.jpg", caption: "Foto do padrão de luz" } });
assert(imgExt.msgType === "image" && imgExt.body === "Foto do padrão de luz", "Extração de foto com legenda de inspeção");

console.log("\n==================================================");
console.log(`📊 RESULTADO DOS TESTES: ${passed} PASSOU | ${failed} FALHOU`);
console.log("==================================================");