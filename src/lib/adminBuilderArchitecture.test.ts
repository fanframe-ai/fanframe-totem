import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin visual builder architecture", () => {
  it("uses the real kiosk route as the admin preview instead of a fake phone renderer", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");

    expect(adminSource).toContain("function getKioskRuntimePreviewUrl");
    expect(adminSource).toContain("function InlineKioskPreview");
    expect(adminSource).toContain("renderPreviewScreen()");
    expect(adminSource).not.toContain('className="builder-phone"');
  });

  it("does not block the builder behind a missing preview origin", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");

    expect(adminSource).toContain("function InlineKioskPreview");
    expect(adminSource).not.toContain("Configure a URL do kiosk");
  });

  it("keeps the editable home preview structurally close to the kiosk home", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");

    expect(adminSource).toContain("KioskHomeVisual");
    expect(adminSource).toContain("homeBeforeImage");
    expect(adminSource).toContain("homeAfterImage");
  });

  it("uses a kiosk-sized portrait preview instead of a narrow phone preview", () => {
    const cssSource = readFileSync("apps/admin/src/styles.css", "utf8");

    expect(cssSource).toContain("width: min(620px, 100%)");
    expect(cssSource).toContain("min-height: 980px");
  });

  it("shares kiosk visual components between the Windows app and admin preview", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const kioskSource = readFileSync("src/pages/Kiosk.tsx", "utf8");

    expect(adminSource).toContain("KioskVisualShell");
    expect(kioskSource).toContain("KioskVisualShell");
    expect(adminSource).toContain("KioskHomeVisual");
    expect(kioskSource).toContain("KioskHomeVisual");
  });
});
