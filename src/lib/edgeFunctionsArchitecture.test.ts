import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("edge functions architecture", () => {
  it("requests vertical 2:3 images from Replicate for kiosk delivery", () => {
    const source = readFileSync("supabase/functions/generate-tryon/index.ts", "utf8");

    expect(source).toContain('aspect_ratio: "2:3"');
    expect(source).not.toContain('aspect_ratio: "match_input_image"');
  });

  it("allows create-delivery-link POST requests from the kiosk flow", () => {
    const source = readFileSync("supabase/functions/create-delivery-link/index.ts", "utf8");

    expect(source).toContain("KIOSK_DELIVERY_PUBLIC_ORIGIN");
    expect(source).toContain('if (req.method === "POST")');
    expect(source).toContain('if (body?.action === "get_delivery")');
    expect(source).toContain('if (body?.action === "share_consent")');
    expect(source).toContain("normalizeInstagramHandle");
    expect(source).toContain("monthly_official_story_draw");
    expect(source).toContain("instagram_handle");
    expect(source).toContain('const sessionId = body.session_id as string | undefined');
    expect(source).not.toContain('if (body?.action !== "share_consent")');
    expect(source.match(/await req\.json/g)?.length).toBe(1);
  });
});
