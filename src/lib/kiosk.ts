export interface VisibleAsset {
  visible?: boolean | null;
}

export function formatCurrencyFromCents(amountCents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amountCents / 100).replace(/\u00a0/g, " ");
}

export function filterVisibleAssets<T extends VisibleAsset>(assets: T[]) {
  return assets.filter((asset) => asset.visible !== false);
}

export function normalizeKioskTimeout(seconds: number | null | undefined) {
  if (!seconds || Number.isNaN(seconds)) return 60;
  return Math.min(180, Math.max(15, Math.round(seconds)));
}

export function buildDeliveryUrl(supabaseUrl: string, token: string) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  return `${baseUrl}/functions/v1/create-delivery-link?token=${encodeURIComponent(token)}`;
}

export type DeviceIdentity = {
  deviceCode: string;
  deviceSecret: string;
};

export type KioskErrorCode = "NET-001" | "CAM-001" | "PAY-001" | "CFG-001" | "IA-001" | "APP-001";

export type KioskFriendlyError = {
  code: KioskErrorCode;
  title: string;
  action: string;
};

export function normalizeInstallCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
}

export async function hashKioskSecret(value: string) {
  const data = new TextEncoder().encode(value.trim().toUpperCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyTechnicalPin(input: string, supportPinHash?: string | null) {
  if (!supportPinHash) return false;
  return (await hashKioskSecret(input)) === supportPinHash;
}

export function buildDeviceAuthHeaders(identity: DeviceIdentity) {
  return {
    "x-device-code": identity.deviceCode,
    "x-device-secret": identity.deviceSecret,
  };
}

export function shouldReportHealth(lastReportAt: number | null, intervalMs: number, now = Date.now()) {
  return lastReportAt === null || now - lastReportAt >= intervalMs;
}

export function classifyKioskError(message: string): KioskFriendlyError {
  const text = message.toLowerCase();
  if (text.includes("camera") || text.includes("webcam")) {
    return {
      code: "CAM-001",
      title: "Camera nao encontrada",
      action: "Verifique se a webcam esta conectada e teste novamente.",
    };
  }
  if (text.includes("network") || text.includes("internet") || text.includes("offline")) {
    return {
      code: "NET-001",
      title: "Internet indisponivel",
      action: "Verifique a conexao do PC e clique em tentar novamente.",
    };
  }
  if (text.includes("pagbank") || text.includes("plugpag") || text.includes("payment") || text.includes("pagamento")) {
    return {
      code: "PAY-001",
      title: "Pagamento indisponivel",
      action: "Verifique a maquininha ou tente PIX.",
    };
  }
  if (text.includes("config") || text.includes("sync")) {
    return {
      code: "CFG-001",
      title: "Configuracao nao sincronizada",
      action: "Clique em sincronizar ou chame o suporte.",
    };
  }
  if (text.includes("replicate") || text.includes("generation") || text.includes("geracao") || text.includes("ia")) {
    return {
      code: "IA-001",
      title: "Geracao indisponivel",
      action: "Aguarde alguns minutos e tente novamente.",
    };
  }
  return {
    code: "APP-001",
    title: "Erro do aplicativo",
    action: "Reinicie o app e envie diagnostico se continuar.",
  };
}

export async function redeemInstallCode(installCode: string, fingerprint: string, appVersion: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("redeem-kiosk-install-code", {
    body: { installCode: normalizeInstallCode(installCode), fingerprint, appVersion },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Pairing failed");
  return data;
}

export async function reportKioskHealth(identity: DeviceIdentity, body: Record<string, unknown>) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("report-kiosk-health", {
    headers: buildDeviceAuthHeaders(identity),
    body,
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Health report failed");
  return data;
}

export async function pollKioskCommand(identity: DeviceIdentity, complete?: Record<string, unknown>) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("poll-kiosk-commands", {
    headers: buildDeviceAuthHeaders(identity),
    body: complete || {},
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Command poll failed");
  return data?.command || null;
}
