import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-").replace(/-+/g, "-");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { installCode, fingerprint, appVersion } = await req.json();
    if (!installCode) return json({ error: "Missing install code" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const codeHash = await sha256(normalizeCode(String(installCode)));
    const { data: install, error: installError } = await supabase
      .from("kiosk_install_codes")
      .select(`
        id,
        device_id,
        expires_at,
        redeemed_at,
        kiosk_devices(
          id,
          team_id,
          device_code,
          label,
          location,
          status,
          config,
          support_pin_hash,
          config_version,
          teams(
            id,
            slug,
            name,
            subdomain,
            shirts,
            backgrounds,
            tutorial_assets,
            primary_color,
            secondary_color,
            logo_url,
            watermark_url,
            is_active,
            text_overrides,
            kiosk_font_family,
            published_config,
            published_config_version,
            kiosk_enabled,
            kiosk_price_cents,
            kiosk_currency,
            kiosk_timeout_seconds,
            kiosk_default_mode,
            kiosk_show_shirt_step,
            kiosk_show_background_step
          )
        )
      `)
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (installError) throw installError;
    if (!install) return json({ error: "Invalid install code" }, 404);
    if (install.redeemed_at) return json({ error: "Install code already used" }, 409);
    if (new Date(install.expires_at).getTime() < Date.now()) return json({ error: "Install code expired" }, 410);

    const rawDevice = Array.isArray(install.kiosk_devices) ? install.kiosk_devices[0] : install.kiosk_devices;
    if (!rawDevice) return json({ error: "Device not found" }, 404);
    if (rawDevice.status === "disabled") return json({ error: "Device disabled" }, 403);

    const deviceSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const deviceSecretHash = await sha256(deviceSecret);
    const now = new Date().toISOString();

    const { error: deviceError } = await supabase
      .from("kiosk_devices")
      .update({
        device_secret_hash: deviceSecretHash,
        install_status: "paired",
        paired_at: now,
        last_seen_at: now,
        app_version: appVersion || null,
      })
      .eq("id", install.device_id);
    if (deviceError) throw deviceError;

    const { error: redeemError } = await supabase
      .from("kiosk_install_codes")
      .update({ redeemed_at: now, redeemed_by_fingerprint: fingerprint || null })
      .eq("id", install.id);
    if (redeemError) throw redeemError;

    const rawTeam = Array.isArray(rawDevice.teams) ? rawDevice.teams[0] : rawDevice.teams;
    const publishedConfig = rawTeam?.published_config &&
      typeof rawTeam.published_config === "object" &&
      !Array.isArray(rawTeam.published_config)
      ? rawTeam.published_config as Record<string, unknown>
      : {};
    const publishedTeam = rawTeam ? { ...rawTeam, ...publishedConfig } : null;

    await supabase.from("kiosk_device_events").insert({
      device_id: install.device_id,
      team_id: rawDevice.team_id || null,
      event_type: "pairing_succeeded",
      severity: "info",
      message: "Device paired by installation code",
      payload: { fingerprint: fingerprint || null, appVersion: appVersion || null },
    });

    return json({
      device: {
        id: install.device_id,
        deviceCode: rawDevice.device_code,
        label: rawDevice.label,
        location: rawDevice.location,
        config: rawDevice.config && typeof rawDevice.config === "object" && !Array.isArray(rawDevice.config) ? rawDevice.config : {},
        supportPinHash: rawDevice.support_pin_hash || null,
        configVersion: rawDevice.config_version,
        publishedConfigVersion: rawTeam?.published_config_version || 1,
      },
      team: publishedTeam,
      deviceSecret,
    });
  } catch (error) {
    console.error("[redeem-kiosk-install-code]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
