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

function findStringValue(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const item = record[key];
    if (typeof item === "string") return item;
  }

  for (const item of Object.values(record)) {
    if (Array.isArray(item)) {
      for (const child of item) {
        const found = findStringValue(child, keys);
        if (found) return found;
      }
    } else if (item && typeof item === "object") {
      const found = findStringValue(item, keys);
      if (found) return found;
    }
  }

  return null;
}

function webhookPaymentStatus(payload: unknown) {
  const json = JSON.stringify(payload).toUpperCase();
  if (json.includes('"PAID"') || json.includes('"AUTHORIZED"') || json.includes('"APPROVED"')) return "paid";
  if (json.includes('"DECLINED"') || json.includes('"CANCELED"') || json.includes('"CANCELLED"')) return "failed";
  return "pending";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const supabase = getSupabaseClient();
    const referenceId = findStringValue(payload, ["reference_id", "referenceId"]);
    const orderId = findStringValue(payload, ["id", "order_id", "orderId"]);

    let query = supabase.from("kiosk_payments").select("*");
    if (referenceId) {
      query = query.eq("reference_id", referenceId);
    } else if (orderId) {
      query = query.eq("pagbank_order_id", orderId);
    } else {
      return jsonResponse({ received: true, ignored: "no_reference" });
    }

    const { data: payment, error } = await query.maybeSingle();
    if (error) throw error;
    if (!payment) return jsonResponse({ received: true, ignored: "payment_not_found" });

    const status = webhookPaymentStatus(payload);
    if (status === "pending") {
      await supabase
        .from("kiosk_payments")
        .update({ provider_payload: payload })
        .eq("id", payment.id);
      return jsonResponse({ received: true, status });
    }

    await supabase
      .from("kiosk_payments")
      .update({
        status,
        provider_payload: payload,
        paid_at: status === "paid" ? new Date().toISOString() : payment.paid_at,
      })
      .eq("id", payment.id);

    await supabase
      .from("kiosk_sessions")
      .update({
        status: status === "paid" ? "paid" : "failed",
        error_message: status === "paid" ? null : "PagBank payment failed",
      })
      .eq("id", payment.session_id);

    return jsonResponse({ received: true, status, paymentId: payment.id });
  } catch (error) {
    console.error("[pagbank-webhook]", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
