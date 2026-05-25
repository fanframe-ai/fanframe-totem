import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin visual builder architecture", () => {
  it("uses the real kiosk route as the admin preview instead of a fake phone renderer", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");

    expect(adminSource).toContain("function getKioskRuntimePreviewUrl");
    expect(adminSource).toContain('title="Preview real do kiosk"');
    expect(adminSource).not.toContain('className="builder-phone"');
  });

  it("does not block the builder behind a missing preview origin", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");

    expect(adminSource).toContain("function InlineKioskPreview");
    expect(adminSource).not.toContain("Configure a URL do kiosk");
  });
});
