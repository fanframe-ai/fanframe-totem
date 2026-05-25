import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Kiosk pairing form", () => {
  it("uses a submit button so clicking Conectar sends the install code", () => {
    const source = readFileSync("src/pages/Kiosk.tsx", "utf8");

    expect(source).toContain('type?: "button" | "submit"');
    expect(source).toContain('<KioskButton type="submit" disabled={pairingBusy || !pairingCode.trim()} className="w-full">');
  });
});
