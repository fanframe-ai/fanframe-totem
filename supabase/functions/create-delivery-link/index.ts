import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function getSupabaseClient() {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function createToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabaseClient();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return htmlResponse("<h1>Link invalido</h1>", 400);

    const { data: link, error } = await supabase
      .from("kiosk_delivery_links")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !link) return htmlResponse("<h1>Link nao encontrado</h1>", 404);
    if (new Date(link.expires_at).getTime() < Date.now()) {
      return htmlResponse("<h1>Link expirado</h1><p>Solicite uma nova geracao no totem.</p>", 410);
    }

    await supabase
      .from("kiosk_delivery_links")
      .update({ download_count: (link.download_count || 0) + 1 })
      .eq("id", link.id);

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: link.result_image_url },
    });
  }

  try {
    const body = await req.json();
    const sessionId = body.session_id as string | undefined;
    const queueId = body.queue_id as string | undefined;
    if (!sessionId || !queueId) throw new Error("Missing session_id or queue_id");

    const { data: session, error: sessionError } = await supabase
      .from("kiosk_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) throw new Error("Session not found");
    if (!["paid", "generating", "completed"].includes(session.status)) {
      throw new Error("Session is not eligible for delivery");
    }

    const { data: queue, error: queueError } = await supabase
      .from("generation_queue")
      .select("id, status, result_image_url")
      .eq("id", queueId)
      .maybeSingle();
    if (queueError) throw queueError;
    if (!queue || queue.status !== "completed" || !queue.result_image_url) {
      throw new Error("Generation is not completed");
    }

    const token = createToken();
    const expiresAt = addHours(new Date(), Number(Deno.env.get("KIOSK_DELIVERY_LINK_HOURS") || 24)).toISOString();

    const { error: insertError } = await supabase.from("kiosk_delivery_links").insert({
      session_id: session.id,
      team_id: session.team_id,
      token,
      result_image_url: queue.result_image_url,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    await supabase
      .from("kiosk_sessions")
      .update({
        status: "completed",
        generation_queue_id: queue.id,
        delivery_token: token,
        delivery_expires_at: expiresAt,
        result_image_url: queue.result_image_url,
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    return jsonResponse({
      token,
      expiresAt,
      deliveryUrl: `${SUPABASE_URL}/functions/v1/create-delivery-link?token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    console.error("[create-delivery-link]", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
