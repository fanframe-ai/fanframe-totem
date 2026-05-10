import { describe, expect, it } from "vitest";
import { buildOwnerInstallMessage } from "./installInstructions";

describe("install instructions", () => {
  it("builds a copy-ready owner installation message", () => {
    const message = buildOwnerInstallMessage({
      deviceLabel: "Totem Recife 01",
      teamName: "Sport",
      location: "Shopping Recife",
      installCode: "SPORT-ABCD",
      supportPin: "123456",
      expiresAt: "2026-05-10T15:30:00.000Z",
    });

    expect(message).toContain("Instalacao FanFrame Totem - Totem Recife 01");
    expect(message).toContain("Time: Sport");
    expect(message).toContain("Local: Shopping Recife");
    expect(message).toContain("Codigo de instalacao: SPORT-ABCD");
    expect(message).toContain("PIN tecnico: 123456");
    expect(message).toContain("Ctrl + Shift + F12");
  });
});
