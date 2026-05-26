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

  it("lets the admin builder scroll through all shirts and backgrounds in the preview", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const sharedVisualSource = readFileSync("src/shared/kiosk-ui/KioskVisual.tsx", "utf8");

    expect(adminSource).toContain("shirtRailRef");
    expect(adminSource).toContain("backgroundRailRef");
    expect(adminSource).toContain("scrollBuilderRail");
    expect(adminSource).toContain("items={shirts.map");
    expect(adminSource).toContain("items={backgrounds.map");
    expect(adminSource).not.toContain("items={shirts.slice(0, 3)");
    expect(adminSource).not.toContain("items={backgrounds.slice(0, 3)");
    expect(sharedVisualSource).toContain("onWheel={handleRailWheel}");
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

  it("includes the official Flamengo toolkit font fallback in admin and kiosk", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const adminMain = readFileSync("apps/admin/src/main.tsx", "utf8");
    const kioskMain = readFileSync("src/main.tsx", "utf8");
    const kioskSource = readFileSync("src/pages/Kiosk.tsx", "utf8");

    expect(adminMain).toContain("@fontsource-variable/zalando-sans-expanded");
    expect(kioskMain).toContain("@fontsource-variable/zalando-sans-expanded");
    expect(adminSource).toContain("Zalando Sans Expanded");
    expect(adminSource).toContain("resolveTeamFontFamily");
    expect(kioskSource).toContain("resolveTeamFontFamily");
  });

  it("serves the QR Code delivery experience from the public admin domain route", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const cssSource = readFileSync("apps/admin/src/styles.css", "utf8");

    expect(adminSource).toContain('path="/foto/:token"');
    expect(adminSource).toContain("function DeliveryPage");
    expect(adminSource).toContain('action: "get_delivery"');
    expect(adminSource).toContain("Baixar foto");
    expect(adminSource).toContain("Compartilhar");
    expect(adminSource).toContain("function downloadPhoto");
    expect(adminSource).toContain("function StoryDrawPage");
    expect(adminSource).toContain('href: "/sorteio"');
    expect(adminSource).toContain("instagram_handle");
    expect(adminSource).toContain("Participar do sorteio");
    expect(adminSource).toContain("Sorteio Stories");
    expect(adminSource).toContain("URL.createObjectURL(blob)");
    expect(adminSource).toContain("new File([blob]");
    expect(adminSource).toContain("navigator.canShare");
    expect(adminSource).not.toContain("Abrir Instagram");
    expect(cssSource).toContain(".delivery-page");
    expect(cssSource).toContain(".delivery-photo-card");
    expect(cssSource).toContain("white-space: nowrap");
    expect(cssSource).toContain("background: transparent");
    expect(cssSource).toContain("overflow-x: hidden");
    expect(cssSource).toContain("box-sizing: border-box");
    expect(cssSource).toContain("@media (max-width: 420px)");
  });

  it("does not place the team logo as a giant decorative background over the configured kiosk background", () => {
    const adminSource = readFileSync("apps/admin/src/App.tsx", "utf8");
    const kioskSource = readFileSync("src/pages/Kiosk.tsx", "utf8");

    expect(adminSource).not.toContain("ghostLogoUrl={publicAssetUrl(team.logo_url");
    expect(kioskSource).not.toContain("ghostLogoUrl={team?.logo_url");
  });
});
