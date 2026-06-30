import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("kiosk online test links", () => {
  it("stores only token hashes and limits links to administrators", () => {
    const migration = source("../../supabase/migrations/20260625090000_add_kiosk_test_links.sql");

    expect(migration).toContain("create table if not exists public.kiosk_test_links");
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("public.is_admin(auth.uid())");
    expect(migration).not.toMatch(/\btoken\s+text/i);
  });

  it("resolves a public token without returning the device secret", () => {
    const edgeFunction = source("../../supabase/functions/manage-kiosk-test-links/index.ts");

    expect(edgeFunction).toContain('action === "resolve"');
    expect(edgeFunction).toContain("deviceCode");
    expect(edgeFunction).toContain("teamSlug");
    expect(edgeFunction).not.toContain("device_secret_hash:");
  });

  it("uses the real kiosk route with a web test token", () => {
    const app = source("../App.tsx");
    const kiosk = source("../pages/Kiosk.tsx");

    expect(app).toContain('path="/teste-totem/:token"');
    expect(kiosk).toContain("resolveKioskTestLink");
    expect(kiosk).toContain('source: isWebTestMode ? "web_test" : "kiosk"');
    expect(kiosk).toContain("MODO DE TESTE");
  });

  it("forces simulated payments for valid web test links", () => {
    const paymentFunction = source("../../supabase/functions/create-kiosk-payment/index.ts");

    expect(paymentFunction).toContain("test_link_token");
    expect(paymentFunction).toContain("isWebTest");
    expect(paymentFunction).toContain('source: isWebTest ? "web_test" : "kiosk"');
    expect(paymentFunction).toContain("const shouldSimulate = isWebTest ||");
  });
});
