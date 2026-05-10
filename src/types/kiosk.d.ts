export interface KioskRuntimeConfig {
  teamSlug: string;
  deviceCode: string;
  deviceSecret: string;
  appVersion?: string;
  kiosk?: boolean;
  fullscreen?: boolean;
  simulatePayments?: boolean;
}

export interface StoredDeviceIdentity {
  deviceCode: string;
  deviceSecret: string;
  deviceId: string;
  teamSlug?: string;
  pairedAt: string;
}

export interface KioskTechnicalStatus {
  online: boolean;
  appVersion: string;
  deviceCode: string | null;
  lastSyncAt: string | null;
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
      relaunch: () => Promise<void>;
      onOpenTechnicalMode: (callback: () => void) => () => void;
    };
  }
}
