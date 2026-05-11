export interface KioskRuntimeConfig {
  teamSlug: string;
  deviceCode: string;
  deviceSecret: string;
  appVersion?: string;
  kiosk?: boolean;
  fullscreen?: boolean;
  autoLaunch?: boolean;
  blockShortcuts?: boolean;
  simulatePayments?: boolean;
}

export interface StoredDeviceIdentity {
  deviceCode: string;
  deviceSecret: string;
  deviceId: string;
  teamSlug?: string;
  configVersion?: number;
  supportPinHash?: string | null;
  pairedAt: string;
}

export interface KioskTechnicalStatus {
  online: boolean;
  appVersion: string;
  deviceCode: string | null;
  lastSyncAt: string | null;
}

export interface KioskPaymentStatus {
  ready: boolean;
  mode: "simulated" | "plugpag" | "not_configured";
  message: string;
  plugpagConfigured: boolean;
  simulated: boolean;
}

export interface KioskCardPaymentRequest {
  sessionId: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  method: "credit" | "debit" | "card";
  referenceId?: string;
}

export interface KioskCardPaymentResult {
  approved: boolean;
  status: string;
  provider?: string;
  transactionCode?: string;
  message?: string;
  rawOutput?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    fanframeKiosk?: {
      getConfig: () => Promise<KioskRuntimeConfig>;
      startCardPayment: (request: KioskCardPaymentRequest) => Promise<KioskCardPaymentResult>;
      loadDeviceIdentity: () => Promise<StoredDeviceIdentity | null>;
      saveDeviceIdentity: (identity: StoredDeviceIdentity) => Promise<void>;
      clearDeviceIdentity: () => Promise<void>;
      getTechnicalStatus: () => Promise<KioskTechnicalStatus>;
      getPaymentStatus: () => Promise<KioskPaymentStatus>;
      relaunch: () => Promise<void>;
      onOpenTechnicalMode: (callback: () => void) => () => void;
    };
  }
}
