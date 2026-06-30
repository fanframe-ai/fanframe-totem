import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function requireBusinessAdmin(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Unauthorized");

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");

  const { data: allowed, error: roleError } = await client.rpc("is_admin", {
    _user_id: userData.user.id,
  });
  if (roleError || !allowed) throw new Error("Forbidden");
  return userData.user;
}

async function resolveLink(token: string) {
  if (!token || token.length < 32) return json({ error: "Link de teste invalido." }, 400);
  const supabase = serviceClient();
  const tokenHash = await sha256Hex(token);
  const { data: link, error } = await supabase
    .from("kiosk_test_links")
    .select("id, device_id, expires_at, kiosk_devices!inner(id, device_code, label, status, team_id, teams!inner(slug, name, is_active, kiosk_enabled))")
    .eq("token_hash", tokenHash)
    .eq("enabled", true)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw error;
  if (!link) return json({ error: "Este link expirou ou foi desativado." }, 404);

  const device = Array.isArray(link.kiosk_devices) ? link.kiosk_devices[0] : link.kiosk_devices;
  const team = Array.isArray(device?.teams) ? device.teams[0] : device?.teams;
  if (!device || device.status !== "active" || !team?.is_active || team.kiosk_enabled === false) {
    return json({ error: "Este totem nao esta disponivel para teste." }, 403);
  }

  await supabase
    .from("kiosk_test_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", link.id);

  return json({
    deviceId: device.id,
    deviceCode: device.device_code,
    deviceLabel: device.label || device.device_code,
    teamSlug: team.slug,
    teamName: team.name,
    expiresAt: link.expires_at,
    simulatePayments: true,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({})) as {
      action?: "create" | "revoke" | "status" | "resolve";
      device_id?: string;
      token?: string;
      days_valid?: number;
    };
    const action = body.action || "status";

    if (action === "resolve") return await resolveLink(String(body.token || ""));

    const user = await requireBusinessAdmin(req);
    if (!body.device_id) return json({ error: "Totem nao informado." }, 400);
    const supabase = serviceClient();

    if (action === "status") {
      const { data, error } = await supabase
        .from("kiosk_test_links")
        .select("id, enabled, expires_at, created_at, last_accessed_at")
        .eq("device_id", body.device_id)
        .eq("enabled", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return json({ link: data || null });
    }

    if (action === "revoke") {
      const { error } = await supabase
        .from("kiosk_test_links")
        .update({ enabled: false })
        .eq("device_id", body.device_id)
        .eq("enabled", true);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "create") {
      const daysValid = Math.min(90, Math.max(1, Number(body.days_valid || 30)));
      const token = generateToken();
      const tokenHash = await sha256Hex(token);
      const expiresAt = new Date(Date.now() + daysValid * 86400000).toISOString();

      await supabase
        .from("kiosk_test_links")
        .update({ enabled: false })
        .eq("device_id", body.device_id)
        .eq("enabled", true);

      const { data, error } = await supabase
        .from("kiosk_test_links")
        .insert({
          device_id: body.device_id,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select("id, expires_at, created_at")
        .single();
      if (error) throw error;
      return json({ link: data, token });
    }

    return json({ error: "Acao nao suportada." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    console.error("[manage-kiosk-test-links]", error);
    return json({ error: message }, status);
  }
});
