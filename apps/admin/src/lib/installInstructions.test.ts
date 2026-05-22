import { describe, expect, it } from "vitest";
import { buildOwnerInstallMessage, buildOwnerUpdateMessage } from "./installInstructions";

describe("install instructions", () => {
  it("builds a copy-ready owner installation message", () => {
    const message = buildOwnerInstallMessage({
      deviceLabel: "Totem Recife 01",
      teamName: "Sport",
      location: "Shopping Recife",
      installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe",
      installCode: "SPORT-ABCD",
      supportPin: "123456",
      expiresAt: "2026-05-10T15:30:00.000Z",
    });

    expect(message).toContain("Instalacao FanFrame Totem - Totem Recife 01");
    expect(message).toContain("Time: Sport");
    expect(message).toContain("Local: Shopping Recife");
    expect(message).toContain("Link do instalador: https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe");
    expect(message).toContain("Codigo de instalacao: SPORT-ABCD");
    expect(message).toContain("PIN tecnico: 123456");
    expect(message).toContain("Ctrl + Shift + F12");
    expect(message).toContain("Testar tudo");
    expect(message).toContain("Nao mexa em Supabase, PagBank ou IA");
  });

  it("builds a copy-ready owner update message", () => {
    const message = buildOwnerUpdateMessage({
      deviceLabel: "Totem Recife 01",
      teamName: "Sport",
      location: "Shopping Recife",
      currentVersion: "0.1.0",
      expectedVersion: "0.2.0",
    });

    expect(message).toContain("Atualizacao FanFrame Totem - Totem Recife 01");
    expect(message).toContain("Versao instalada: 0.1.0");
    expect(message).toContain("Nova versao esperada: 0.2.0");
    expect(message).toContain("nao desinstale");
    expect(message).toContain("Ctrl + Shift + F12");
  });
});
