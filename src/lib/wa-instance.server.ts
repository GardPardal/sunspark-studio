import { getZApiQrCode, getZApiStatus } from "@/lib/zapi.server";

export interface WaInstanceStatus {
  status: "connected" | "connecting" | "disconnected" | "qr_ready";
  phoneNumber?: string | null;
  qrCode?: string | null;
  pairingCode?: string | null;
  lastConnectedAt?: string | null;
  channelType: "cloud_api" | "qr_cloud_session";
  gatewayConfigured?: boolean;
}

/**
 * Retorna o status atual e o QR Code real da Z-API.
 */
export async function getWaInstanceStatusServer(orgId?: string): Promise<WaInstanceStatus> {
  try {
    const statusData = await getZApiStatus();
    if (statusData && statusData.connected) {
      return {
        status: "connected",
        phoneNumber: statusData.phone || null,
        channelType: "qr_cloud_session",
        gatewayConfigured: true,
        lastConnectedAt: new Date().toISOString(),
      };
    }

    const qrData = await getZApiQrCode();
    if (qrData && qrData.value) {
      return {
        status: "qr_ready",
        qrCode: qrData.value,
        phoneNumber: null,
        channelType: "qr_cloud_session",
        gatewayConfigured: true,
        lastConnectedAt: new Date().toISOString(),
      };
    }

    return {
      status: "qr_ready",
      qrCode: null,
      phoneNumber: null,
      channelType: "qr_cloud_session",
      gatewayConfigured: false,
      lastConnectedAt: new Date().toISOString(),
    };
  } catch (e: any) {
    console.error("[Z-API Server Error]", e);
    return {
      status: "disconnected",
      phoneNumber: null,
      qrCode: null,
      channelType: "qr_cloud_session",
      gatewayConfigured: false,
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
