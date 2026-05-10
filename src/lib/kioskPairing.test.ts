import { describe, expect, it } from "vitest";
import {
  buildDeviceAuthHeaders,
  classifyKioskError,
  normalizeInstallCode,
  shouldReportHealth,
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
});
