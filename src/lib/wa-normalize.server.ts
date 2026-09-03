// Camada central de normalização dos payloads da Z-API (server-only).
// Contrato oficial: https://developer.z-api.io/webhooks/on-message-received-examples
// Toda a ingestão (webhook, reparo e importação) usa exclusivamente estas funções.

export type WaMediaInfo = {
  url: string | null;
  mime: string | null;
  filename: string | null;
};

export type NormalizedStatus = {
  kind: "status";
  ids: string[];
  status: WaDeliveryStatus;
  occurredAt: string;
  instanceId: string | null;
};

export type NormalizedMessage = {
  kind: "message";
  messageId: string | null;
  instanceId: string | null;
  connectedPhone: string | null;
  isFromMe: boolean;
  isGroup: boolean;
  isEdit: boolean;
  /** Telefone real do chat (somente dígitos) quando o WhatsApp o expõe. */
  chatPhone: string | null;
  /** Identificador privado do WhatsApp (@lid), quando presente. */
  chatLid: string | null;
  participantPhone: string | null;
  participantLid: string | null;
  chatName: string | null;
  senderName: string | null;
  chatPhoto: string | null;
  senderPhoto: string | null;
  occurredAt: string;
  msgType: WaMsgType;
  rawType: string;
  /** Texto/legenda real. Nunca um texto genérico de preenchimento. */
  text: string | null;
  media: WaMediaInfo;
  replyTo: string | null;
  /** Descrição objetiva quando o tipo não tem texto (ex.: localização, contato). */
  describe: string | null;
  supported: boolean;
};

export type NormalizedIgnore = { kind: "ignore"; reason: string };

export type WaDeliveryStatus = "sending" | "sent" | "delivered" | "read" | "played" | "failed";

export type WaMsgType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "reaction"
  | "poll"
  | "system"
  | "unsupported";

const STATUS_RANK: Record<WaDeliveryStatus, number> = {
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  played: 4,
  failed: 5,
};

/** Estados nunca regridem (callbacks fora de ordem são ignorados). */
export function shouldApplyStatus(current: string | null, next: WaDeliveryStatus) {
  if (next === "failed") return current !== "read" && current !== "played";
  const cur = STATUS_RANK[(current ?? "sending") as WaDeliveryStatus];
  const nxt = STATUS_RANK[next];
  return Number.isFinite(cur) ? nxt > cur : true;
}

export function mapZapiStatus(raw: unknown): WaDeliveryStatus | null {
  const s = String(raw ?? "").toUpperCase();
  if (!s) return null;
  if (s === "PENDING" || s === "SENDING" || s === "0") return "sending";
  if (s === "SENT" || s === "1") return "sent";
  if (s === "RECEIVED" || s === "DELIVERED" || s === "2") return "delivered";
  if (s === "READ" || s === "READ_BY_ME" || s === "READ-SELF" || s === "3") return "read";
  if (s === "PLAYED" || s === "4") return "played";
  if (s === "FAILED" || s === "ERROR" || s === "DELETED") return "failed";
  return null;
}

export function toIsoMoment(value: unknown): string {
  if (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) {
    const n = Number(value);
    if (n > 0) return new Date(n > 1e12 ? n : n * 1000).toISOString();
  }
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
}

/** Separa "5544999999999" de "14405437804566@lid". */
export function splitIdentifier(value: unknown): { phone: string | null; lid: string | null } {
  if (typeof value !== "string" || !value.trim()) return { phone: null, lid: null };
  const v = value.trim();
  if (v.endsWith("@lid")) return { phone: null, lid: v };
  const digits = v.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return { phone: null, lid: null };
  return { phone: digits, lid: null };
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type MediaShape = {
  msgType: WaMsgType;
  rawType: string;
  text: string | null;
  media: WaMediaInfo;
  describe: string | null;
  supported: boolean;
};

/** Descobre tipo, texto e mídia a partir do corpo do callback. */
export function shapeZapiContent(p: Record<string, unknown>): MediaShape {
  const empty: WaMediaInfo = { url: null, mime: null, filename: null };

  const text = obj(p.text);
  if (text && str(text.message)) {
    return {
      msgType: "text",
      rawType: "text",
      text: str(text.message),
      media: empty,
      describe: null,
      supported: true,
    };
  }

  const image = obj(p.image);
  if (image) {
    return {
      msgType: "image",
      rawType: "image",
      text: str(image.caption),
      media: {
        url: str(image.imageUrl) ?? str(image.url),
        mime: str(image.mimeType) ?? "image/jpeg",
        filename: str(image.fileName),
      },
      describe: "Imagem",
      supported: true,
    };
  }

  const sticker = obj(p.sticker);
  if (sticker) {
    return {
      msgType: "sticker",
      rawType: "sticker",
      text: null,
      media: {
        url: str(sticker.stickerUrl) ?? str(sticker.url),
        mime: str(sticker.mimeType) ?? "image/webp",
        filename: null,
      },
      describe: "Figurinha",
      supported: true,
    };
  }

  const audio = obj(p.audio);
  if (audio) {
    return {
      msgType: "audio",
      rawType: "audio",
      text: null,
      media: {
        url: str(audio.audioUrl) ?? str(audio.url),
        mime: str(audio.mimeType) ?? "audio/ogg",
        filename: null,
      },
      describe: "Áudio",
      supported: true,
    };
  }

  const video = obj(p.video) ?? obj(p.ptv);
  if (video) {
    return {
      msgType: "video",
      rawType: obj(p.ptv) ? "ptv" : "video",
      text: str(video.caption),
      media: {
        url: str(video.videoUrl) ?? str(video.url),
        mime: str(video.mimeType) ?? "video/mp4",
        filename: null,
      },
      describe: "Vídeo",
      supported: true,
    };
  }

  const document = obj(p.document);
  if (document) {
    return {
      msgType: "document",
      rawType: "document",
      text: str(document.caption) ?? str(document.title),
      media: {
        url: str(document.documentUrl) ?? str(document.url),
        mime: str(document.mimeType) ?? "application/octet-stream",
        filename: str(document.fileName) ?? str(document.title),
      },
      describe: str(document.fileName) ?? "Documento",
      supported: true,
    };
  }

  const location = obj(p.location);
  if (location) {
    const label = [str(location.name), str(location.address)].filter(Boolean).join(" · ");
    return {
      msgType: "location",
      rawType: "location",
      text: label || null,
      media: {
        url: str(location.url),
        mime: null,
        filename: null,
      },
      describe: `Localização${label ? `: ${label}` : ""}`,
      supported: true,
    };
  }

  const contact = obj(p.contact);
  if (contact) {
    const nome = str(contact.displayName) ?? str(contact.name);
    return {
      msgType: "contact",
      rawType: "contact",
      text: nome,
      media: empty,
      describe: `Contato compartilhado${nome ? `: ${nome}` : ""}`,
      supported: true,
    };
  }

  const reaction = obj(p.reaction);
  if (reaction) {
    return {
      msgType: "reaction",
      rawType: "reaction",
      text: str(reaction.value) ?? str(reaction.reaction),
      media: empty,
      describe: "Reação",
      supported: true,
    };
  }

  const poll = obj(p.poll) ?? obj(p.pollCreation);
  if (poll) {
    return {
      msgType: "poll",
      rawType: "poll",
      text: str(poll.question) ?? str(poll.name),
      media: empty,
      describe: "Enquete",
      supported: true,
    };
  }

  // Respostas de botões e listas trazem o texto escolhido.
  const button = obj(p.buttonsResponseMessage) ?? obj(p.listResponseMessage) ?? obj(p.hydratedTemplate);
  if (button) {
    const escolhido = str(button.message) ?? str(button.title) ?? str(button.selectedRowId);
    return {
      msgType: "text",
      rawType: "button_response",
      text: escolhido,
      media: empty,
      describe: null,
      supported: true,
    };
  }

  const rawType =
    str(p.messageType) ??
    Object.keys(p).find((k) =>
      ["notification", "pix", "order", "product", "review", "event"].includes(k),
    ) ??
    "desconhecido";

  return {
    msgType: "unsupported",
    rawType,
    text: null,
    media: empty,
    describe: `Mensagem do tipo "${rawType}" ainda não suportada no Solar OS`,
    supported: false,
  };
}

/** Normaliza um callback bruto da Z-API. */
export function normalizeZapiWebhook(
  payload: unknown,
): NormalizedStatus | NormalizedMessage | NormalizedIgnore {
  const p = obj(payload);
  if (!p) return { kind: "ignore", reason: "payload inválido" };

  const callbackType = String(p.type ?? "");
  const instanceId = str(p.instanceId);

  // 1) Callbacks de estado de entrega — jamais viram mensagem.
  if (/statuscallback|deliverycallback/i.test(callbackType)) {
    const ids = (Array.isArray(p.ids) ? p.ids : [])
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .concat(str(p.messageId) ? [String(p.messageId)] : []);
    const status = mapZapiStatus(p.status ?? p.ack);
    if (!status || ids.length === 0) return { kind: "ignore", reason: "status sem alvo" };
    return { kind: "status", ids, status, occurredAt: toIsoMoment(p.momment), instanceId };
  }

  if (/presence|connected|disconnected|chatpresence|history/i.test(callbackType)) {
    return { kind: "ignore", reason: `callback ${callbackType}` };
  }

  // 2) Callbacks de mensagem (ReceivedCallback / SentCallback / MessageCallback).
  const chat = splitIdentifier(p.phone);
  const chatLid = str(p.chatLid) ?? chat.lid;
  const participant = splitIdentifier(p.participantPhone);
  const shape = shapeZapiContent(p);

  if (
    !shape.supported &&
    !str(p.messageId) &&
    !chat.phone &&
    !chatLid
  ) {
    return { kind: "ignore", reason: "sem identificação de conversa" };
  }

  return {
    kind: "message",
    messageId: str(p.messageId) ?? str(p.id),
    instanceId,
    connectedPhone: str(p.connectedPhone),
    isFromMe: p.fromMe === true,
    isGroup: p.isGroup === true,
    isEdit: p.isEdit === true,
    chatPhone: chat.phone,
    chatLid,
    participantPhone: participant.phone,
    participantLid: str(p.participantLid) ?? str(p.senderLid),
    chatName: str(p.chatName),
    senderName: str(p.senderName),
    chatPhoto: str(p.photo),
    senderPhoto: str(p.senderPhoto),
    occurredAt: toIsoMoment(p.momment ?? p.moment ?? p.timestamp),
    msgType: shape.msgType,
    rawType: shape.rawType,
    text: shape.text,
    media: shape.media,
    replyTo: str(obj(p.referenceMessageId)?.id) ?? str(p.referenceMessageId),
    describe: shape.describe,
    supported: shape.supported,
  };
}

/** Nomes que não identificam ninguém e devem ser substituídos pelo telefone. */
export function isGenericContactName(value: string | null | undefined) {
  const v = (value ?? "").trim();
  if (!v) return true;
  if (v.endsWith("@lid")) return true;
  if (/^\+?\d[\d\s()-]*$/.test(v)) return true;
  if (/^contato( \(\d+\))?$/i.test(v)) return true;
  if (/^cliente$/i.test(v)) return true;
  if (/whatsapp privado|sem n[úu]mero|desconhecid/i.test(v)) return true;
  return false;
}

/** Identificador curto e estável para quem não expõe telefone (@lid). */
export function shortLidLabel(lid: string) {
  const d = lid.replace(/\D/g, "");
  return `Sem nome · ID ${d.slice(-6)}`;
}

/** Nome exibido: nunca um valor genérico, nunca o nome da conta conectada no contato. */
export function pickDisplayName(opts: {
  savedName?: string | null;
  directoryName?: string | null;
  profileName?: string | null;
  phone?: string | null;
  lid?: string | null;
}) {
  const candidates = [opts.savedName, opts.directoryName, opts.profileName];
  for (const c of candidates) {
    if (isGenericContactName(c)) continue;
    return (c as string).trim();
  }
  // Sem nome no perfil: o telefone é a melhor identificação possível.
  if (opts.phone) return formatBrPhone(opts.phone);
  if (opts.lid) return shortLidLabel(opts.lid);
  return "Contato";
}


export function formatBrPhone(input: string) {
  const d = input.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    const meio = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const fim = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${meio}-${fim}`;
  }
  return `+${d}`;
}

/** Prévia curta e honesta da última mensagem. */
export function previewFor(msg: {
  msg_type?: string | null;
  body?: string | null;
  media_filename?: string | null;
}) {
  const body = (msg.body ?? "").trim();
  if (body) return body.slice(0, 160);
  switch (msg.msg_type) {
    case "image":
      return "📷 Foto";
    case "audio":
      return "🎤 Áudio";
    case "video":
      return "🎬 Vídeo";
    case "document":
      return `📄 ${msg.media_filename ?? "Documento"}`;
    case "sticker":
      return "🌟 Figurinha";
    case "location":
      return "📍 Localização";
    case "contact":
      return "👤 Contato";
    case "reaction":
      return "❤️ Reação";
    case "poll":
      return "📊 Enquete";
    default:
      return "Mensagem sem texto";
  }
}
