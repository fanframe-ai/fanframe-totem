export interface KioskRuntimeConfig {
  teamSlug: string;
  deviceCode: string;
  deviceSecret: string;
  appVersion?: string;
  kiosk?: boolean;
  fullscreen?: boolean;
  simulatePayments?: boolean;
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
    };
  }
}
