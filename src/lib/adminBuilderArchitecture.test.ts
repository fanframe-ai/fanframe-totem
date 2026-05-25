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

  it("shares the kiosk selection cards between the Windows app and admin preview", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const kioskSource = readFileSync("src/pages/Kiosk.tsx", "utf8");

    expect(adminSource).toContain("KioskSelectionVisual");
    expect(kioskSource).toContain("KioskSelectionVisual");
  });

  it("shares payment, camera, generation and result visuals between the Windows app and admin preview", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const kioskSource = readFileSync("src/pages/Kiosk.tsx", "utf8");

    for (const componentName of ["KioskPaymentVisual", "KioskCameraVisual", "KioskGeneratingVisual", "KioskResultVisual"]) {
      expect(adminSource).toContain(componentName);
      expect(kioskSource).toContain(componentName);
    }
  });

  it("keeps selection rail fades subtle instead of drawing dark side containers", () => {
    const cssSource = readFileSync("src/shared/kiosk-ui/kioskVisual.css", "utf8");

    expect(cssSource).toContain("width: 56px");
    expect(cssSource).toContain("rgb(0 0 0 / 0)");
    expect(cssSource).not.toContain("width: 112px");
  });

  it("lets the builder edit the team logo and before/after home images", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const sharedVisualSource = readFileSync("src/shared/kiosk-ui/KioskVisual.tsx", "utf8");

    expect(sharedVisualSource).toContain("onLogoSelect");
    expect(sharedVisualSource).toContain('onMediaSelect?.("before")');
    expect(sharedVisualSource).toContain('onMediaSelect?.("after")');
    expect(adminSource).toContain('type: "homeImage"');
    expect(adminSource).toContain("uploadTutorialImage");
    expect(adminSource).toContain("Trocar foto do antes");
    expect(adminSource).toContain("Trocar foto do depois");
  });

  it("uses fresh asset urls when replacing builder images", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");

    expect(adminSource).toContain("uniqueAssetPath");
    expect(adminSource).toContain('uniqueAssetPath(team.slug || "novo", "branding", name, extension)');
    expect(adminSource).toContain('uniqueAssetPath(team.slug || "novo", "experience", target, extension)');
    expect(adminSource).not.toContain('`${team.slug || "novo"}/branding/${name}.${extension}`');
    expect(adminSource).not.toContain('`${team.slug || "novo"}/experience/${target}.${extension}`');
  });
});
