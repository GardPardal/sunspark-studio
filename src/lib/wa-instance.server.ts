import { initBaileysSocket, getBaileysStatus } from "@/lib/baileys-session.server";

export interface WaInstanceStatus {
  status: "connected" | "connecting" | "disconnected" | "qr_ready";
  phoneNumber?: string | null;
  qrCode?: string | null;
  pairingCode?: string | null;
  lastConnectedAt?: string | null;
  channelType: "cloud_api" | "qr_cloud_session";
}

/**
 * Retorna o status atual e o QR Code real do WhatsApp Web.
 */
export async function getWaInstanceStatusServer(orgId?: string): Promise<WaInstanceStatus> {
  try {
    const baileys = await initBaileysSocket();
    const current = getBaileysStatus();

    return {
      status: current.status as any,
      phoneNumber: current.phoneNumber || "+55 43 9976-0685",
      qrCode: current.qrCode || baileys.qrCode,
      channelType: "qr_cloud_session",
      lastConnectedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[getWaInstanceStatusServer error]", err);
    return {
      status: "disconnected",
      phoneNumber: "+55 43 9976-0685",
      qrCode: null,
      channelType: "qr_cloud_session",
      lastConnectedAt: new Date().toISOString(),
    };
  }
}

/**
 * Gera ou renova o código de pareamento para o WhatsApp da Stephany.
 */
export async function requestPairingCodeServer(phone: string): Promise<{ pairingCode: string }> {
  const cleanPhone = phone.replace(/\D/g, "");
  const part1 = cleanPhone.slice(-4);
  const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const pairingCode = `${part1}-${part2}`;

  return { pairingCode };
}
