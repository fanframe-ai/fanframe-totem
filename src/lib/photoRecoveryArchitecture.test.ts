import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("kiosk photo recovery flow", () => {
  it("offers CPF recovery from the home screen and renders recovered photos", () => {
    const kioskSource = readFileSync("src/pages/Kiosk.tsx", "utf8");
    const visualSource = readFileSync("src/shared/kiosk-ui/KioskVisual.tsx", "utf8");

    expect(kioskSource).toContain('"recovery-cpf"');
    expect(kioskSource).toContain('"recovery-results"');
    expect(kioskSource).toContain("searchKioskPhotos");
    expect(kioskSource).toContain("createRecoveredPhotoLink");
    expect(kioskSource).toContain("Recuperar minha foto");
    expect(visualSource).toContain("KioskRecoveryResultsVisual");
  });
});
