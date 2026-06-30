import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("paid stuck kiosk sessions", () => {
  it("surfaces paid sessions without generation as urgent operational problems", () => {
    expect(app).toContain("Pago sem geracao");
    expect(app).toContain("generation_queue_id");
    expect(app).toContain('status === "paid"');
    expect(app).toContain("payment_status");
  });
});
