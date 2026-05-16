import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { findLatestLocalInstaller, getUpdateReadiness } = require("./kiosk-updates.cjs") as {
  findLatestLocalInstaller: (searchDirs: string[]) => string;
  getUpdateReadiness: (config: Record<string, unknown>, options?: { searchDirs?: string[] }) => {
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

  it("finds a downloaded installer automatically", async () => {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fanframe-update-"));
    const oldInstaller = path.join(dir, "FanFrame Kiosk Setup 0.1.1.exe");
    const newInstaller = path.join(dir, "FanFrame Kiosk Setup 0.1.2.exe");
    await fs.writeFile(oldInstaller, "");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fs.writeFile(newInstaller, "");

    expect(findLatestLocalInstaller([dir])).toBe(newInstaller);
    expect(getUpdateReadiness({}, { searchDirs: [dir] })).toMatchObject({
      ready: true,
      mode: "local_installer",
      installerPath: newInstaller,
    });
  });
});
