import { describe, expect, it } from "vitest";
import {
  buildDeviceAuthHeaders,
  classifyKioskError,
  friendlyInstallCodeError,
  friendlyPaymentError,
  hashKioskSecret,
  normalizeInstallCode,
  shouldReportHealth,
  verifyTechnicalPin,
} from "./kiosk";

describe("kiosk pairing helpers", () => {
  it("normalizes installation codes for human input", () => {
    expect(normalizeInstallCode(" ff-recife 001 ")).toBe("FF-RECIFE-001");
    expect(normalizeInstallCode("ff 8k42")).toBe("FF-8K42");
  });

  it("builds device auth headers without exposing raw config names", () => {
    expect(buildDeviceAuthHeaders({ deviceCode: "TOTEM-1", deviceSecret: "secret" })).toEqual({
      "x-device-code": "TOTEM-1",
      "x-device-secret": "secret",
    });
  });

  it("reports health when never reported or interval elapsed", () => {
    expect(shouldReportHealth(null, 60_000, 100_000)).toBe(true);
    expect(shouldReportHealth(50_000, 60_000, 100_000)).toBe(false);
    expect(shouldReportHealth(39_999, 60_000, 100_000)).toBe(true);
  });

  it("maps common failures to owner-friendly codes", () => {
    expect(classifyKioskError("camera not found").code).toBe("CAM-001");
    expect(classifyKioskError("network offline").code).toBe("NET-001");
    expect(classifyKioskError("pagbank timeout").code).toBe("PAY-001");
    expect(classifyKioskError("config fetch failed").code).toBe("CFG-001");
  });

  it("maps install code failures to clear owner actions", () => {
    expect(friendlyInstallCodeError("Install code already used")).toContain("ja foi usado");
    expect(friendlyInstallCodeError("Install code expired")).toContain("expirou");
    expect(friendlyInstallCodeError("Invalid install code")).toContain("invalido");
    expect(friendlyInstallCodeError("Device disabled")).toContain("desativado");
  });

  it("maps PagBank payment failures to clear owner actions", () => {
    expect(friendlyPaymentError("401 Invalid credential")).toContain("credencial");
    expect(friendlyPaymentError("must be between 100 and 999999900")).toContain("R$ 1,00");
    expect(friendlyPaymentError("PagBank PIX order failed")).toContain("PagBank nao gerou");
  });

  it("validates technical PINs against the paired device hash", async () => {
    const hash = await hashKioskSecret("123456");
    await expect(verifyTechnicalPin("123456", hash)).resolves.toBe(true);
    await expect(verifyTechnicalPin(" 123456 ", hash)).resolves.toBe(true);
    await expect(verifyTechnicalPin("654321", hash)).resolves.toBe(false);
  });

  it("rejects technical PINs when the device has no configured hash", async () => {
    await expect(verifyTechnicalPin("4821", null)).resolves.toBe(false);
    await expect(verifyTechnicalPin("123456", null)).resolves.toBe(false);
  });
});
