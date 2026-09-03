export function getZApiConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID?.trim();
  const token = process.env.ZAPI_TOKEN?.trim();
  const clientToken = process.env.ZAPI_CLIENT_TOKEN?.trim();
  if (!instanceId || !token || !clientToken) {
    throw new Error("Z-API não configurada no ambiente protegido");
  }
  return { instanceId, token, clientToken };
}

export function zApiHeaders() {
  const { clientToken } = getZApiConfig();
  return { "Content-Type": "application/json", "Client-Token": clientToken };
}

export function zApiUrl(endpoint: string) {
  const { instanceId, token } = getZApiConfig();
  return `https://api.z-api.io/instances/${instanceId}/token/${token}${endpoint}`;
}

export async function getZApiStatus() {
  try {
    const res = await fetch(zApiUrl("/status"), { headers: zApiHeaders() });
    if (!res.ok) return { connected: false, error: await res.text() };
    return await res.json();
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export async function getZApiQrCode() {
  try {
    const res = await fetch(zApiUrl("/qr-code/image"), { headers: zApiHeaders() });
    if (!res.ok) return { value: null, error: await res.text() };
    return await res.json();
  } catch (err: any) {
    return { value: null, error: err.message };
  }
}

export async function sendZApiText(to: string, message: string) {
  const cleanTo = to.replace(/\D/g, "");
  const res = await fetch(zApiUrl("/send-text"), {
    method: "POST",
    headers: zApiHeaders(),
    body: JSON.stringify({ phone: cleanTo, message }),
  });
  if (!res.ok) throw new Error(`Z-API send falhou: ${await res.text()}`);
  return await res.json();
}

export async function sendZApiAudio(to: string, audioUrl: string) {
  const cleanTo = to.replace(/\D/g, "");
  const res = await fetch(zApiUrl("/send-audio"), {
    method: "POST",
    headers: zApiHeaders(),
    body: JSON.stringify({ phone: cleanTo, audio: audioUrl }),
  });
  if (!res.ok) throw new Error(`Z-API audio falhou: ${await res.text()}`);
  return await res.json();
}

export async function sendZApiImage(to: string, imageUrl: string, caption?: string) {
  const cleanTo = to.replace(/\D/g, "");
  const res = await fetch(zApiUrl("/send-image"), {
    method: "POST",
    headers: zApiHeaders(),
    body: JSON.stringify({ phone: cleanTo, image: imageUrl, caption }),
  });
  if (!res.ok) throw new Error(`Z-API image falhou: ${await res.text()}`);
  return await res.json();
}

export async function sendZApiDocument(to: string, documentUrl: string, fileName?: string) {
  const cleanTo = to.replace(/\D/g, "");
  const res = await fetch(zApiUrl("/send-document/pdf"), {
    method: "POST",
    headers: zApiHeaders(),
    body: JSON.stringify({ phone: cleanTo, document: documentUrl, fileName }),
  });
  if (!res.ok) throw new Error(`Z-API documento falhou: ${await res.text()}`);
  return await res.json();
}

export async function sendZApiVideo(to: string, videoUrl: string, caption?: string) {
  const cleanTo = to.replace(/\D/g, "");
  const res = await fetch(zApiUrl("/send-video"), {
    method: "POST",
    headers: zApiHeaders(),
    body: JSON.stringify({ phone: cleanTo, video: videoUrl, caption }),
  });
  if (!res.ok) throw new Error(`Z-API vídeo falhou: ${await res.text()}`);
  return await res.json();
}

export async function getZApiChats(page = 1, pageSize = 50) {
  try {
    const res = await fetch(zApiUrl(`/chats?page=${page}&pageSize=${pageSize}`), {
      headers: zApiHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getZApiProfilePicture(phone: string): Promise<string | null> {
  try {
    const cleanPhone = phone.replace(/\D/g, "");
    const res = await fetch(zApiUrl(`/profile-picture?phone=${cleanPhone}`), {
      headers: zApiHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.link ?? null;
  } catch {
    return null;
  }
}

export async function getZApiChatMessages(phone: string, page = 1, pageSize = 50): Promise<any[]> {
  const cleanPhone = phone.replace(/\D/g, "");
  if (!cleanPhone || cleanPhone.length < 8) return [];

  const endpoints = [
    `/chat-messages/${cleanPhone}?page=${page}&pageSize=${pageSize}`,
    `/messages-chat/${cleanPhone}?page=${page}&pageSize=${pageSize}`,
    `/messages?phone=${cleanPhone}&page=${page}&pageSize=${pageSize}`,
    `/chats/${cleanPhone}/messages?page=${page}&pageSize=${pageSize}`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(zApiUrl(ep), { headers: zApiHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
        if (Array.isArray(data?.messages) && data.messages.length > 0) return data.messages;
        if (Array.isArray(data?.data) && data.data.length > 0) return data.data;
      }
    } catch (e) {
      console.warn(`[getZApiChatMessages] ${ep} falhou:`, e);
    }
  }
  return [];
}

