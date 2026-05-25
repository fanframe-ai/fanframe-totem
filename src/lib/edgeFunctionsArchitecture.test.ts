import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("edge functions architecture", () => {
  it("allows create-delivery-link POST requests from the kiosk flow", () => {
    const source = readFileSync("supabase/functions/create-delivery-link/index.ts", "utf8");

    expect(source).toContain('if (req.method === "POST")');
    expect(source).toContain('if (body?.action === "share_consent")');
    expect(source).toContain('const sessionId = body.session_id as string | undefined');
    expect(source).not.toContain('if (body?.action !== "share_consent")');
    expect(source.match(/await req\.json/g)?.length).toBe(1);
  });
});
