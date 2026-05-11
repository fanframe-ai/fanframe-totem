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
      .select("id, team_id, device_secret_hash, status, config_version, teams(slug, name)")
      .eq("device_code", deviceCode)
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!device) return json({ error: "Unknown device" }, 404);
    if (device.device_secret_hash !== await sha256(deviceSecret)) return json({ error: "Invalid device secret" }, 401);
    if (device.status === "disabled") return json({ error: "Device disabled" }, 403);

    const body = await req.json().catch(() => ({}));

    if (body.completeCommandId) {
      const status = body.success ? "succeeded" : "failed";
      const { error } = await supabase
        .from("kiosk_device_commands")
        .update({
          status,
          completed_at: new Date().toISOString(),
          result: body.result || {},
          error_message: body.errorMessage || null,
        })
        .eq("id", body.completeCommandId)
        .eq("device_id", device.id);
      if (error) throw error;
    }

    await supabase
      .from("kiosk_device_commands")
      .update({
        status: "expired",
        completed_at: new Date().toISOString(),
        error_message: "Command expired before kiosk claimed it",
      })
      .eq("device_id", device.id)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    await supabase
      .from("kiosk_device_commands")
      .update({
        status: "expired",
        completed_at: new Date().toISOString(),
        error_message: "Command expired before kiosk completed it",
      })
      .eq("device_id", device.id)
      .eq("status", "running")
      .lt("expires_at", new Date().toISOString());

    const { data: command, error: commandError } = await supabase
      .from("kiosk_device_commands")
      .select("*")
      .eq("device_id", device.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (commandError) throw commandError;

    const rawTeam = Array.isArray(device.teams) ? device.teams[0] : device.teams;
    const deviceState = {
      id: device.id,
      teamId: device.team_id,
      teamSlug: rawTeam?.slug || null,
      teamName: rawTeam?.name || null,
      status: device.status,
      configVersion: device.config_version || 0,
    };

    if (!command) return json({ command: null, device: deviceState });

    const { error: claimError } = await supabase
      .from("kiosk_device_commands")
      .update({ status: "running", claimed_at: new Date().toISOString() })
      .eq("id", command.id)
      .eq("status", "pending");
    if (claimError) throw claimError;

    await supabase.from("kiosk_device_events").insert({
      device_id: device.id,
      team_id: device.team_id,
      event_type: "remote_command_received",
      severity: "info",
      message: `Command ${command.command_type} claimed`,
      payload: { commandId: command.id, commandType: command.command_type },
    });

    return json({ command, device: deviceState });
  } catch (error) {
    console.error("[poll-kiosk-commands]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
