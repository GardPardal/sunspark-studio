// Integração oficial Z-API para Solar OS e LIZ IA (24/7 em Nuvem)
const DEFAULT_INSTANCE_ID = "3F89104678B85162FC2D92B31FE9D931";
const DEFAULT_TOKEN = "91E284DA042276996B9E0C54";

export function getZApiConfig() {
  const instanceId = process.env.ZAPI_INSTANCE_ID || DEFAULT_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN || DEFAULT_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN || "";
  return { instanceId, token, clientToken };
}

export function zApiHeaders() {
  const { clientToken } = getZApiConfig();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  return headers;
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
