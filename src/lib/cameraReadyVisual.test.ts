import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("camera ready screen", () => {
  const visualSource = readFileSync(resolve(process.cwd(), "src/shared/kiosk-ui/KioskVisual.tsx"), "utf8");
  const kioskSource = readFileSync(resolve(process.cwd(), "src/pages/Kiosk.tsx"), "utf8");

  it("shows one centered camera icon without a duplicated countdown badge", () => {
    const component = visualSource.slice(
      visualSource.indexOf("export function KioskCameraReadyVisual"),
      visualSource.indexOf("export function KioskGeneratingVisual"),
    );

    expect(component).toContain('className="ff-kiosk-camera-ready-icon"');
    expect(component).not.toContain("<span>{countdownSeconds}s</span>");
    expect(component.match(/<Camera/g)).toHaveLength(2);
  });

  it("uses correctly accented Portuguese instructions", () => {
    expect(kioskSource).toContain("Toque no botão e fique em posição. A foto será tirada");
  });
});
