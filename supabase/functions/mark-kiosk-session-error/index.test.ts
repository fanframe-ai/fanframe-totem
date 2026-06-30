import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("mark-kiosk-session-error contract", () => {
  it("requires device auth and only updates the authenticated device session", () => {
    expect(source).toContain("x-device-code");
    expect(source).toContain("x-device-secret");
    expect(source).toContain('.eq("device_id", device.id)');
    expect(source).toContain('.eq("team_id", device.team_id)');
  });

  it("marks paid generation failures as recoverable and logs a device event", () => {
    expect(source).toContain("recoverable_paid_generation");
    expect(source).toContain("generation_start_failed");
    expect(source).toContain("kiosk_device_events");
  });
});
