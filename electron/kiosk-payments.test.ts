import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { getPaymentReadiness } = require("./kiosk-payments.cjs") as {
  getPaymentReadiness: (config: Record<string, unknown>) => {
    ready: boolean;
    mode: string;
    message: string;
    plugpagConfigured: boolean;
    simulated: boolean;
  };
};

describe("kiosk payment readiness", () => {
  it("accepts simulated payments for lab installs", () => {
    expect(getPaymentReadiness({ simulatePayments: true })).toMatchObject({
      ready: true,
      mode: "simulated",
      simulated: true,
    });
  });

  it("uses production PIX when simulation is disabled", () => {
    expect(getPaymentReadiness({ payments: { plugpagCommand: "plugpag-adapter.exe" } })).toMatchObject({
      ready: true,
      mode: "pix",
      plugpagConfigured: false,
    });
  });

  it("does not require local card configuration", () => {
    expect(getPaymentReadiness({ payments: {} })).toMatchObject({
      ready: true,
      mode: "pix",
      plugpagConfigured: false,
      simulated: false,
    });
  });
});
