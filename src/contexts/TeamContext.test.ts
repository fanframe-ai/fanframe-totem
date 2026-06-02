import { beforeAll, describe, expect, it, vi } from "vitest";

describe("normalizeTutorialAssets", () => {
  beforeAll(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    });
  });

  it("keeps the kiosk header logo configuration from published team config", async () => {
    const { normalizeTutorialAssets } = await import("./TeamContext");

    expect(normalizeTutorialAssets({
      headerLogo: "/flamengo/logo_imersivo.png",
      headerLogoMode: "horizontal",
    })).toMatchObject({
      headerLogo: "/flamengo/logo_imersivo.png",
      headerLogoMode: "horizontal",
    });
  });
});
