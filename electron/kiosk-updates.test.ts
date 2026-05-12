import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { getUpdateReadiness } = require("./kiosk-updates.cjs") as {
  getUpdateReadiness: (config: Record<string, unknown>) => {
    ready: boolean;
    mode: string;
    message: string;
    installerUrl: string;
    installerPath: string;
    updateCommand: string;
    updateArgs: string[];
  };
};

describe("kiosk update readiness", () => {
  it("uses a local update command first", () => {
    expect(getUpdateReadiness({
      updates: {
        installerUrl: "https://example.com/FanFrame-Kiosk-Setup.exe",
        updateCommand: "C:\\FanFrame\\update.bat",
        updateArgs: ["/S"],
      },
    })).toMatchObject({
      ready: true,
      mode: "command",
      updateCommand: "C:\\FanFrame\\update.bat",
      updateArgs: ["/S"],
    });
  });

  it("accepts a local installer path", () => {
    expect(getUpdateReadiness({
      updates: { installerPath: "C:\\FanFrame\\FanFrame-Kiosk-Setup.exe" },
    })).toMatchObject({
      ready: true,
      mode: "local_installer",
    });
  });

  it("accepts a remote installer URL", () => {
    expect(getUpdateReadiness({
      updates: { installerUrl: "https://example.com/FanFrame-Kiosk-Setup.exe" },
    })).toMatchObject({
      ready: true,
      mode: "download",
    });
  });

  it("reports when updates are not configured", () => {
    expect(getUpdateReadiness({})).toMatchObject({
      ready: false,
      mode: "not_configured",
    });
  });
});
