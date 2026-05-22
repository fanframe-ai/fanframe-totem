import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { mergeKioskConfig } = require("./kiosk-config.cjs") as {
  mergeKioskConfig: (
    fileConfig: Record<string, unknown>,
    remoteConfig: Record<string, unknown>,
    env: Record<string, string | undefined>,
  ) => Record<string, unknown>;
};

describe("kiosk config merge", () => {
  it("lets remote device update config override local file config while env keeps priority", () => {
    const config = mergeKioskConfig(
      {
        updates: {
          installerUrl: "https://local.example/FanFrame-Kiosk-Setup.exe",
          installerPath: "C:\\local\\setup.exe",
        },
      },
      {
        updates: {
          installerUrl: "https://remote.example/FanFrame-Kiosk-Setup.exe",
        },
      },
      {
        FANFRAME_UPDATE_PATH: "C:\\env\\setup.exe",
      },
    );

    expect(config).toMatchObject({
      updates: {
        installerUrl: "https://remote.example/FanFrame-Kiosk-Setup.exe",
        installerPath: "C:\\env\\setup.exe",
      },
    });
  });
});
