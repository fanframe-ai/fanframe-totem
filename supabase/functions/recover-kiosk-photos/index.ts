import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RECOVERY_WINDOW_DAYS = 7;
const MAX_ATTEMPTS_PER_TEN_MINUTES = 10;
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

function cleanCpf(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildPublicDeliveryUrl(token: string) {
  const configuredOrigin = String(Deno.env.get("KIOSK_DELIVERY_PUBLIC_ORIGIN") || "").replace(/\/$/, "");
  if (configuredOrigin) return `${configuredOrigin}/foto/${encodeURIComponent(token)}`;
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return `${supabaseUrl}/functions/v1/create-delivery-link?token=${encodeURIComponent(token)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const deviceCode = req.headers.get("x-device-code") || "";
    const deviceSecret = req.headers.get("x-device-secret") || "";
    if (!deviceCode || !deviceSecret) return json({ error: "Totem nao autenticado." }, 401);

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
    if (!device) return json({ error: "Totem nao encontrado." }, 404);
    if (device.device_secret_hash !== await sha256(deviceSecret)) return json({ error: "Totem nao autenticado." }, 401);
    if (device.status === "disabled") return json({ error: "Totem desativado." }, 403);

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentAttempts, error: attemptsError } = await supabase
      .from("kiosk_device_events")
      .select("id", { count: "exact", head: true })
      .eq("device_id", device.id)
      .eq("event_type", "photo_recovery_attempt")
      .gte("created_at", tenMinutesAgo);
    if (attemptsError) throw attemptsError;
    if ((recentAttempts || 0) >= MAX_ATTEMPTS_PER_TEN_MINUTES) {
      await supabase.from("kiosk_device_events").insert({
        device_id: device.id,
        team_id: device.team_id,
        event_type: "photo_recovery_rate_limited",
        severity: "warning",
        message: "Limite de tentativas de recuperacao atingido.",
      });
      return json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const cpf = cleanCpf(body.cpf);
    if (cpf.length !== 11) return json({ error: "CPF invalido." }, 400);

    await supabase.from("kiosk_device_events").insert({
      device_id: device.id,
      team_id: device.team_id,
      event_type: "photo_recovery_attempt",
      severity: "info",
      message: "Consulta de recuperacao de foto.",
      payload: { action: body.action || "search", cpf_last4: cpf.slice(-4) },
    });

    const since = new Date(Date.now() - RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: payments, error: paymentError } = await supabase
      .from("kiosk_payments")
      .select("session_id, status, paid_at, created_at")
      .eq("device_id", device.id)
      .eq("customer_tax_id", cpf)
      .eq("status", "paid")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (paymentError) throw paymentError;

    const sessionIds = (payments || []).map((payment) => payment.session_id).filter(Boolean);
    if (sessionIds.length === 0) return json({ photos: [] });
    const paymentBySessionId = new Map((payments || []).filter((payment) => payment.session_id).map((payment) => [payment.session_id, payment]));

    const { data: sessions, error: sessionError } = await supabase
      .from("kiosk_sessions")
      .select("id, status, result_image_url, completed_at, created_at")
      .in("id", sessionIds)
      .eq("device_id", device.id)
      .eq("team_id", device.team_id)
      .in("status", ["completed", "failed", "paid"])
      .order("created_at", { ascending: false })
      .limit(5);
    if (sessionError) throw sessionError;
    const recoverableSessions = (sessions || []).filter((session) => {
      const payment = paymentBySessionId.get(session.id);
      const isPaidFailed = session.status !== "completed" && payment?.status === "paid" && !session.result_image_url;
      return Boolean(session.result_image_url) || isPaidFailed;
    });

    if (body.action !== "recover") {
      return json({
        photos: recoverableSessions.map((session) => {
          const payment = paymentBySessionId.get(session.id);
          const isPaidFailed = session.status !== "completed" && payment?.status === "paid" && !session.result_image_url;
          return {
            sessionId: session.id,
            imageUrl: session.result_image_url,
            completedAt: session.completed_at || payment?.paid_at || session.created_at,
            status: isPaidFailed ? "paid_failed" : "completed",
            label: isPaidFailed ? "Pagamento encontrado. Chame o suporte." : "Abrir esta foto",
          };
        }),
      });
    }

    const sessionId = String(body.session_id || "");
    const session = recoverableSessions.find((item) => item.id === sessionId);
    if (!session?.result_image_url) return json({ error: "Foto ainda nao foi gerada para este pagamento." }, 404);

    const token = createToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: linkError } = await supabase.from("kiosk_delivery_links").insert({
      session_id: session.id,
      team_id: device.team_id,
      token,
      result_image_url: session.result_image_url,
      expires_at: expiresAt,
    });
    if (linkError) throw linkError;

    await supabase.from("kiosk_sessions").update({
      delivery_token: token,
      delivery_expires_at: expiresAt,
    }).eq("id", session.id);

    return json({
      imageUrl: session.result_image_url,
      expiresAt,
      deliveryUrl: buildPublicDeliveryUrl(token),
    });
  } catch (error) {
    console.error("[recover-kiosk-photos]", error);
    return json({ error: "Nao foi possivel recuperar as fotos agora." }, 500);
  }
});
