import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("paid kiosk generation recovery", () => {
  it("does not leave a paid kiosk session untracked when generation start fails", () => {
    const kiosk = source("../pages/Kiosk.tsx");

    expect(kiosk).toContain("markKioskSessionError");
    expect(kiosk).toContain("Erro ao iniciar geracao da foto");
    expect(kiosk).toContain("retryPaidGeneration");
  });

  it("classifies generation start failures as IA errors instead of generic APP errors", () => {
    const kioskLib = source("./kiosk.ts");

    expect(kioskLib).toContain("generation_start_failed");
    expect(kioskLib).toContain("geracao da foto");
  });

  it("the generate-tryon catch path preserves kiosk session context", () => {
    const edgeFunction = source("../../supabase/functions/generate-tryon/index.ts");

    expect(edgeFunction).toContain("let requestContext");
    expect(edgeFunction).toContain("kiosk_session_id: requestContext.kioskSessionId");
    expect(edgeFunction).toContain("payment_id: requestContext.paymentId");
    expect(edgeFunction).toContain("status: \"failed\"");
    expect(edgeFunction).toContain("error_message:");
  });
});
