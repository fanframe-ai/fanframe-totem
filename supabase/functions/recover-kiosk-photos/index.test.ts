import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");

describe("recover-kiosk-photos paid failures", () => {
  it("returns paid sessions without result as paid_failed search items", () => {
    expect(source).toContain("paid_failed");
    expect(source).toContain('.in("status", ["completed", "failed", "paid"])');
    expect(source).toContain("isPaidFailed");
  });

  it("does not create a delivery link when there is no result image", () => {
    expect(source).toContain("!session?.result_image_url");
    expect(source).toContain("Foto ainda nao foi gerada para este pagamento.");
  });
});
