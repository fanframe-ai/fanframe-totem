export interface VisibleAsset {
  visible?: boolean | null;
}

export function formatCurrencyFromCents(amountCents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amountCents / 100).replace(/\u00a0/g, " ");
}

export function filterVisibleAssets<T>(assets: T[]) {
  return assets.filter((asset) => (asset as T & VisibleAsset).visible !== false);
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

export type RemoteKioskDeviceState = {
  teamSlug?: string | null;
  config?: Record<string, unknown> | null;
  configVersion?: number | null;
  supportPinHash?: string | null;
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

export function shouldReloadForRemoteKioskState(
  localTeamSlug: string | null | undefined,
  localConfigVersion: number | null | undefined,
  remote: RemoteKioskDeviceState | null | undefined,
) {
  if (!remote) return false;
  if (remote.teamSlug && remote.teamSlug !== localTeamSlug) return true;
  const remoteVersion = Number(remote.configVersion || 0);
  const localVersion = Number(localConfigVersion || 0);
  return remoteVersion > 0 && remoteVersion !== localVersion;
}

export function isSafeKioskReloadStep(step: string) {
  return ["boot", "home", "maintenance", "pairing"].includes(step);
}

export function shouldResetKioskForInactivity(step: string) {
  return ["shirt", "cpf", "camera", "recovery-cpf", "recovery-results"].includes(step);
}

export type RecoveredKioskPhoto = {
  sessionId: string;
  imageUrl: string;
  completedAt: string;
};

export async function searchKioskPhotos(identity: DeviceIdentity, cpf: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("recover-kiosk-photos", {
    headers: buildDeviceAuthHeaders(identity),
    body: { action: "search", cpf },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Nao foi possivel buscar as fotos.");
  return (data?.photos || []) as RecoveredKioskPhoto[];
}

export async function createRecoveredPhotoLink(identity: DeviceIdentity, cpf: string, sessionId: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("recover-kiosk-photos", {
    headers: buildDeviceAuthHeaders(identity),
    body: { action: "recover", cpf, session_id: sessionId },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Nao foi possivel recuperar a foto.");
  return data as { deliveryUrl: string; imageUrl: string; expiresAt: string };
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

export function friendlyPaymentError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid credential") || text.includes("unauthorized") || text.includes("401")) {
    return "PagBank recusou a credencial de producao. Confira o token PagBank e se ele esta liberado para producao.";
  }
  if (text.includes("chave pix") || text.includes("pix de enderecamento") || text.includes("endereco")) {
    return "A conta PagBank precisa ter uma chave PIX ativa para gerar o QR Code.";
  }
  if (text.includes("between 100") || text.includes("amount") || text.includes("valor")) {
    return "Valor PIX invalido. Use no minimo R$ 1,00.";
  }
  if (text.includes("pagbank")) {
    return `PagBank nao gerou o QR Code: ${message}`;
  }
  return message;
}

export async function getSupabaseFunctionErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : "Erro na funcao do Supabase.";
  const context = error && typeof error === "object" && "context" in error
    ? (error as { context?: unknown }).context
    : null;
  const response = context && typeof context === "object" && "response" in context
    ? (context as { response?: unknown }).response
    : null;

  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (body && typeof body.error === "string") return body.error;
      if (body && typeof body.message === "string") return body.message;
    } catch {
      try {
        const text = await response.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        return fallback;
      }
    }
  }

  return fallback;
}

export function friendlyInstallCodeError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("already used")) {
    return "Este codigo de instalacao ja foi usado. Gere um novo codigo no painel e tente novamente.";
  }
  if (text.includes("expired")) {
    return "Este codigo de instalacao expirou. Gere um novo codigo no painel e tente novamente.";
  }
  if (text.includes("invalid") || text.includes("not found")) {
    return "Codigo de instalacao invalido. Confira o codigo ou gere um novo no painel.";
  }
  if (text.includes("disabled")) {
    return "Este totem esta desativado no painel. Ative o totem antes de instalar.";
  }
  return message;
}

export async function redeemInstallCode(installCode: string, fingerprint: string, appVersion: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("redeem-kiosk-install-code", {
    body: { installCode: normalizeInstallCode(installCode), fingerprint, appVersion },
  });
  if (error || data?.error) {
    const message = data?.error || (error ? await getSupabaseFunctionErrorMessage(error) : "Pairing failed");
    throw new Error(friendlyInstallCodeError(message));
  }
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
  const data = await pollKioskState(identity, complete);
  return data.command || null;
}

export async function pollKioskState(identity: DeviceIdentity, complete?: Record<string, unknown>) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("poll-kiosk-commands", {
    headers: buildDeviceAuthHeaders(identity),
    body: complete || {},
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || "Command poll failed");
  return data || { command: null, device: null };
}
