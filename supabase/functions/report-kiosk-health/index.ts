import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-device-code, x-device-secret",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const deviceCode = req.headers.get("x-device-code") || "";
    const deviceSecret = req.headers.get("x-device-secret") || "";
    if (!deviceCode || !deviceSecret) return json({ error: "Missing device auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: device, error: deviceError } = await supabase
      .from("kiosk_devices")
      .select("id, team_id, device_secret_hash, status")
      .eq("device_code", deviceCode)
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!device) return json({ error: "Unknown device" }, 404);
    if (device.status === "disabled") return json({ error: "Device disabled" }, 403);
    if (device.device_secret_hash !== await sha256(deviceSecret)) return json({ error: "Invalid device secret" }, 401);

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const health = body.health || {};
    const event = body.event || null;

    const { error: updateError } = await supabase
      .from("kiosk_devices")
      .update({
        last_seen_at: now,
        last_health_at: now,
        last_health_status: health,
        last_error_code: health.lastErrorCode || null,
        last_error_message: health.lastErrorMessage || null,
        app_version: health.appVersion || null,
      })
      .eq("id", device.id);
    if (updateError) throw updateError;

    if (event?.eventType) {
      const { error: eventError } = await supabase.from("kiosk_device_events").insert({
        device_id: device.id,
        team_id: device.team_id,
        session_id: event.sessionId || null,
        event_type: event.eventType,
        severity: event.severity || "info",
        error_code: event.errorCode || null,
        message: event.message || null,
        payload: event.payload || {},
      });
      if (eventError) throw eventError;
    }

    return json({ success: true, serverTime: now });
  } catch (error) {
    console.error("[report-kiosk-health]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
