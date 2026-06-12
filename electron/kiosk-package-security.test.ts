import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
  build?: {
    asar?: boolean;
    compression?: string;
    files?: string[];
  };
};

describe("kiosk package security", () => {
  it("packages the Electron app with ASAR and excludes sensitive development files", () => {
    expect(packageJson.build?.asar).toBe(true);
    expect(packageJson.build?.compression).toBe("maximum");
    expect(packageJson.build?.files).toEqual(expect.arrayContaining([
      "!**/*.map",
      "!**/.env",
      "!**/.env.*",
      "!kiosk.config.json",
      "!**/*.test.*",
      "!**/*.spec.*",
      "!scripts/**/*",
      "!supabase/**/*",
      "!apps/**/*",
      "!src/**/*",
    ]));
  });

  it("disables renderer devtools in the packaged kiosk", () => {
    const main = readFileSync("electron/main.cjs", "utf8");

    expect(main).toContain("devTools: !app.isPackaged");
    expect(main).toContain("win.webContents.closeDevTools()");
  });
});
