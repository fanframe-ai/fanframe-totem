import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("edge functions architecture", () => {
  it("requests vertical 2:3 images from Replicate for kiosk delivery", () => {
    const source = readFileSync("supabase/functions/generate-tryon/index.ts", "utf8");

    expect(source).toContain('aspect_ratio: "2:3"');
    expect(source).not.toContain('aspect_ratio: "match_input_image"');
  });

  it("keeps foreground people handling in the Replicate prompt instead of local image processing", () => {
    const source = readFileSync("supabase/functions/generate-tryon/index.ts", "utf8");

    expect(source).toContain("FOREGROUND_PEOPLE_PROMPT_RULE");
    expect(source).toContain("Use only the 1 or 2 main people closest to the camera");
    expect(source).toContain("withForegroundPeopleRule(await getGenerationPrompt");
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

  it("recovers recent photos only for an authenticated kiosk and an exact CPF", () => {
    const source = readFileSync("supabase/functions/recover-kiosk-photos/index.ts", "utf8");

    expect(source).toContain('req.headers.get("x-device-code")');
    expect(source).toContain('req.headers.get("x-device-secret")');
    expect(source).toContain('device.device_secret_hash !== await sha256(deviceSecret)');
    expect(source).toContain('.eq("device_id", device.id)');
    expect(source).toContain('.eq("customer_tax_id", cpf)');
    expect(source).toContain("RECOVERY_WINDOW_DAYS");
    expect(source).toContain("photo_recovery_rate_limited");
    expect(source).toContain("kiosk_delivery_links");
  });
});
