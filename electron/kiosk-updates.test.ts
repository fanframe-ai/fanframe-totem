import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { defaultRemoteInstallerUrl, findLatestLocalInstaller, getUpdateReadiness } = require("./kiosk-updates.cjs") as {
  defaultRemoteInstallerUrl: string;
  findLatestLocalInstaller: (searchDirs: string[]) => string;
  getUpdateReadiness: (config: Record<string, unknown>, options?: { searchDirs?: string[]; fileExists?: (path: string) => boolean; defaultInstallerUrl?: string }) => {
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
  it("prefers a remote installer url over a local update command", () => {
    const readiness = getUpdateReadiness({
      updates: {
        installerUrl: "https://example.com/FanFrame-Kiosk-Setup.exe",
        installerPath: "C:\\FanFrame\\FanFrame-Kiosk-Setup.exe",
        updateCommand: "C:\\FanFrame\\update.bat",
        updateArgs: ["/S"],
      },
    });

    expect(readiness).toMatchObject({
      ready: true,
      mode: "remote_installer",
      installerUrl: "https://example.com/FanFrame-Kiosk-Setup.exe",
      updateCommand: "C:\\FanFrame\\update.bat",
      updateArgs: ["/S"],
    });
    expect(readiness.installerPath).toBe("");
  });

  it("accepts a local installer path", () => {
    expect(getUpdateReadiness({
      updates: { installerPath: "C:\\FanFrame\\FanFrame-Kiosk-Setup.exe" },
    })).toMatchObject({
      ready: true,
      mode: "local_installer",
    });
  });

  it("accepts a remote installer url as an update source", () => {
    expect(getUpdateReadiness({
      updates: {
        installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe",
      },
    })).toMatchObject({
      ready: true,
      mode: "remote_installer",
      installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe",
      updateArgs: ["/S"],
    });
  });

  it("uses silent NSIS installer arguments by default for unattended kiosk updates", () => {
    expect(getUpdateReadiness({
      updates: {
        installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup-latest.exe",
      },
    })).toMatchObject({
      ready: true,
      mode: "remote_installer",
      updateArgs: ["/S"],
    });
  });

  it("keeps custom update arguments when the admin config overrides the default", () => {
    expect(getUpdateReadiness({
      updates: {
        installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup-latest.exe",
        updateArgs: ["/S", "/D=C:\\FanFrame"],
      },
    })).toMatchObject({
      ready: true,
      mode: "remote_installer",
      updateArgs: ["/S", "/D=C:\\FanFrame"],
    });
  });

  it("prefers a remote installer url over a downloaded local installer", () => {
    const readiness = getUpdateReadiness(
      {
        updates: {
          installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe",
        },
      },
      { searchDirs: ["D:/Downloads"], fileExists: (filePath) => filePath.endsWith("FanFrame Kiosk Setup 0.2.1.exe") },
    );

    expect(readiness).toMatchObject({
      ready: true,
      mode: "remote_installer",
      installerUrl: "https://fanframe.ai/releases/FanFrame-Kiosk-Setup.exe",
    });
    expect(readiness.installerPath).toBe("");
  });

  it("uses the GitHub latest installer when no update source is configured", () => {
    expect(getUpdateReadiness({ updates: {} }, { searchDirs: [], fileExists: () => false })).toMatchObject({
      ready: true,
      mode: "remote_installer",
      installerUrl: defaultRemoteInstallerUrl,
      message: "Atualizacao pronta para baixar e instalar.",
    });
  });

  it("prefers the default GitHub latest installer over a downloaded local installer", () => {
    expect(getUpdateReadiness(
      { updates: {} },
      { searchDirs: ["D:/Downloads"], fileExists: (filePath) => filePath.endsWith("FanFrame Kiosk Setup.exe") },
    )).toMatchObject({
      ready: true,
      mode: "remote_installer",
      installerUrl: defaultRemoteInstallerUrl,
    });
  });

  it("can still use a local installer when the default remote installer is disabled", () => {
    expect(getUpdateReadiness(
      { updates: {} },
      { searchDirs: ["D:/Downloads"], fileExists: (filePath) => filePath.endsWith("FanFrame Kiosk Setup.exe"), defaultInstallerUrl: "" },
    )).toMatchObject({
      ready: true,
      mode: "local_installer",
    });
  });

  it("returns a clear message when no update source exists and default remote installer is disabled", () => {
    expect(getUpdateReadiness({ updates: {} }, { searchDirs: [], fileExists: () => false, defaultInstallerUrl: "" })).toMatchObject({
      ready: false,
      mode: "not_configured",
      message: "Nenhum instalador de atualizacao configurado neste PC.",
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
    expect(getUpdateReadiness({}, { searchDirs: [dir], defaultInstallerUrl: "" })).toMatchObject({
      ready: true,
      mode: "local_installer",
      installerPath: newInstaller,
    });
  });

  it("finds known installer names in existing directories and keeps the newest mtime", async () => {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fanframe-known-update-"));
    const oldInstaller = path.join(dir, "FanFrame Kiosk Setup.exe");
    const newInstaller = path.join(dir, "FanFrame-Kiosk-Setup.exe");
    await fs.writeFile(oldInstaller, "");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fs.writeFile(newInstaller, "");

    expect(findLatestLocalInstaller([dir])).toBe(newInstaller);
  });
});
