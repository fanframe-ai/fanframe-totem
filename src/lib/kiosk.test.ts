import { describe, expect, it } from "vitest";
import {
  buildDeliveryUrl,
  filterVisibleAssets,
  formatCurrencyFromCents,
  normalizeKioskTimeout,
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
});
