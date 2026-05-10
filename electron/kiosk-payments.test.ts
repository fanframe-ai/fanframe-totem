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

  it("accepts PlugPag when a local command is configured", () => {
    expect(getPaymentReadiness({ payments: { plugpagCommand: "plugpag-adapter.exe" } })).toMatchObject({
      ready: true,
      mode: "plugpag",
      plugpagConfigured: true,
    });
  });

  it("blocks local card payments when neither simulation nor PlugPag are configured", () => {
    expect(getPaymentReadiness({ payments: {} })).toMatchObject({
      ready: false,
      mode: "not_configured",
      plugpagConfigured: false,
      simulated: false,
    });
  });
});
