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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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
    if (device.device_secret_hash !== await sha256(deviceSecret)) return json({ error: "Invalid device secret" }, 401);
    if (device.status === "disabled") return json({ error: "Device disabled" }, 403);

    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body.session_id === "string" ? body.session_id : "";
    const paymentId = typeof body.payment_id === "string" ? body.payment_id : null;
    const errorCode = typeof body.error_code === "string" ? body.error_code : "generation_start_failed";
    const errorMessage = typeof body.error_message === "string" ? body.error_message : "Erro ao iniciar geracao da foto.";
    const step = typeof body.step === "string" ? body.step : "generating";

    if (!sessionId) return json({ error: "Missing session_id" }, 400);

    const recoverableMetadata = {
      error_code: errorCode,
      failed_step: step,
      payment_id: paymentId,
      recoverable_paid_generation: true,
    };

    const { error: updateError } = await supabase
      .from("kiosk_sessions")
      .update({
        status: "failed",
        error_message: errorMessage,
        metadata: recoverableMetadata,
      })
      .eq("id", sessionId)
      .eq("device_id", device.id)
      .eq("team_id", device.team_id)
      .neq("status", "completed");
    if (updateError) throw updateError;

    const { error: eventError } = await supabase.from("kiosk_device_events").insert({
      device_id: device.id,
      team_id: device.team_id,
      session_id: sessionId,
      event_type: "generation_start_failed",
      severity: "error",
      error_code: errorCode,
      message: errorMessage,
      payload: { step, payment_id: paymentId, recoverable_paid_generation: true },
    });
    if (eventError) throw eventError;

    return json({ ok: true });
  } catch (error) {
    console.error("[mark-kiosk-session-error]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
