import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  getKioskControlShortcut,
  isBlockedKioskShortcut,
  isTechnicalShortcut,
  shouldEnableAutoLaunch,
} = require("./kiosk-hardening.cjs") as {
  getKioskControlShortcut: (input: Record<string, unknown>) => string | null;
  isBlockedKioskShortcut: (input: Record<string, unknown>, kioskActive?: boolean) => boolean;
  isTechnicalShortcut: (input: Record<string, unknown>) => boolean;
  shouldEnableAutoLaunch: (config: Record<string, unknown>) => boolean;
};

describe("kiosk hardening", () => {
  it("enables Windows auto-launch by default for kiosk installations", () => {
    expect(shouldEnableAutoLaunch({ kiosk: true })).toBe(true);
    expect(shouldEnableAutoLaunch({ kiosk: true, autoLaunch: false })).toBe(false);
    expect(shouldEnableAutoLaunch({ kiosk: false })).toBe(false);
  });

  it("keeps the technical shortcut available while blocking escape shortcuts", () => {
    expect(isTechnicalShortcut({ type: "keyDown", control: true, shift: true, key: "F12" })).toBe(true);
    expect(isTechnicalShortcut({ type: "keyDown", control: true, shift: true, key: "", code: "F12" })).toBe(true);
    expect(isTechnicalShortcut({ type: "keyDown", control: true, alt: true, key: "t" })).toBe(true);
    expect(isBlockedKioskShortcut({ type: "keyDown", control: true, shift: true, key: "F12" }, true)).toBe(false);
    expect(isBlockedKioskShortcut({ type: "keyDown", control: true, alt: true, key: "t" }, true)).toBe(false);
    expect(isBlockedKioskShortcut({ type: "keyDown", alt: true, key: "F4" }, true)).toBe(true);
    expect(isBlockedKioskShortcut({ type: "keyDown", alt: true, key: "Tab" }, true)).toBe(true);
    expect(isBlockedKioskShortcut({ type: "keyDown", control: true, key: "r" }, true)).toBe(true);
    expect(isBlockedKioskShortcut({ type: "keyDown", key: "F11" }, true)).toBe(true);
    expect(isBlockedKioskShortcut({ type: "keyDown", alt: true, key: "F4" }, false)).toBe(false);
  });

  it("allows explicit kiosk control shortcuts for local support", () => {
    expect(getKioskControlShortcut({ type: "keyDown", control: true, alt: true, key: "m" })).toBe("minimize");
    expect(getKioskControlShortcut({ type: "keyDown", control: true, alt: true, key: "f" })).toBe("toggle_fullscreen");
    expect(getKioskControlShortcut({ type: "keyDown", control: true, alt: true, key: "q" })).toBe("quit");
    expect(isBlockedKioskShortcut({ type: "keyDown", control: true, alt: true, key: "m" }, true)).toBe(false);
    expect(isBlockedKioskShortcut({ type: "keyDown", control: true, alt: true, key: "f" }, true)).toBe(false);
  });
});
