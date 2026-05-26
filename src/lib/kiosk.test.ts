import { describe, expect, it } from "vitest";
import {
  buildDeliveryUrl,
  filterVisibleAssets,
  formatCurrencyFromCents,
  isSafeKioskReloadStep,
  normalizeKioskTimeout,
  shouldResetKioskForInactivity,
  shouldReloadForRemoteKioskState,
} from "./kiosk";

describe("kiosk helpers", () => {
  it("formats BRL prices from cents", () => {
    expect(formatCurrencyFromCents(2500, "BRL")).toBe("R$ 25,00");
  });

  it("keeps assets visible by default and removes hidden assets", () => {
    const assets = [
      { id: "home", visible: true },
      { id: "away" },
      { id: "hidden", visible: false },
    ];

    expect(filterVisibleAssets(assets).map((asset) => asset.id)).toEqual(["home", "away"]);
  });

  it("clamps kiosk timeouts to a useful range", () => {
    expect(normalizeKioskTimeout(null)).toBe(60);
    expect(normalizeKioskTimeout(5)).toBe(15);
    expect(normalizeKioskTimeout(999)).toBe(180);
  });

  it("builds a delivery function URL with the token encoded", () => {
    expect(buildDeliveryUrl("https://example.supabase.co", "abc 123")).toBe(
      "https://example.supabase.co/functions/v1/create-delivery-link?token=abc%20123",
    );
  });

  it("detects remote team and config changes that require kiosk reload", () => {
    expect(shouldReloadForRemoteKioskState("corinthians", 1, { teamSlug: "redbull", configVersion: 1 })).toBe(true);
    expect(shouldReloadForRemoteKioskState("redbull", 1, { teamSlug: "redbull", configVersion: 2 })).toBe(true);
    expect(shouldReloadForRemoteKioskState("redbull", 2, { teamSlug: "redbull", configVersion: 2 })).toBe(false);
    expect(shouldReloadForRemoteKioskState("redbull", 0, null)).toBe(false);
  });

  it("only reloads kiosk automatically on safe screens", () => {
    expect(isSafeKioskReloadStep("home")).toBe(true);
    expect(isSafeKioskReloadStep("maintenance")).toBe(true);
    expect(isSafeKioskReloadStep("shirt")).toBe(false);
    expect(isSafeKioskReloadStep("payment")).toBe(false);
    expect(isSafeKioskReloadStep("camera")).toBe(false);
  });

  it("never resets an active payment screen for inactivity", () => {
    expect(shouldResetKioskForInactivity("shirt")).toBe(true);
    expect(shouldResetKioskForInactivity("background")).toBe(true);
    expect(shouldResetKioskForInactivity("camera")).toBe(true);
    expect(shouldResetKioskForInactivity("payment")).toBe(false);
    expect(shouldResetKioskForInactivity("generating")).toBe(false);
    expect(shouldResetKioskForInactivity("result")).toBe(false);
  });
});
