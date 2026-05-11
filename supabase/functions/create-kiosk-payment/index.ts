import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PAGBANK_API_BASE = Deno.env.get("PAGBANK_API_BASE") || "https://sandbox.api.pagseguro.com";
const PAGBANK_TOKEN = Deno.env.get("PAGBANK_API_TOKEN");
const NOTIFICATION_URL =
  Deno.env.get("PAGBANK_NOTIFICATION_URL") || `${SUPABASE_URL}/functions/v1/pagbank-webhook`;

type PaymentAction = "create" | "confirm_card" | "status" | "cancel";
type PaymentMethod = "pix" | "credit" | "debit" | "card";

interface KioskPaymentRequest {
  action?: PaymentAction;
  team_slug?: string;
  device_code?: string;
  device_secret?: string;
  session_id?: string;
  payment_id?: string;
  method?: PaymentMethod;
  selected_shirt_id?: string;
  selected_background_id?: string;
  plugpag_result?: Record<string, unknown>;
  simulate?: boolean;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSupabaseClient() {
  return createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function getQrImageUrl(qrCode: Record<string, unknown>) {
  const links = Array.isArray(qrCode.links) ? qrCode.links as Array<Record<string, string>> : [];
  return links.find((link) => link.media === "image/png")?.href || null;
}

function isPaidPagBankPayload(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload).toUpperCase();
  return json.includes('"PAID"') || json.includes('"AUTHORIZED"') || json.includes('"APPROVED"');
}

async function resolveTeam(supabase: ReturnType<typeof createClient>, slug?: string) {
  if (!slug) throw new Error("Missing team_slug");

  const { data, error } = await supabase
    .from("teams")
    .select("id, slug, name, kiosk_enabled, kiosk_price_cents, kiosk_currency, kiosk_timeout_seconds, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.is_active || !data.kiosk_enabled) {
    throw new Error("Kiosk is not enabled for this team");
  }

  return data;
}

async function resolveDevice(
  supabase: ReturnType<typeof createClient>,
  teamId: string,
  deviceCode = "",
  deviceSecret = "",
) {
  if (!deviceCode || !deviceSecret) {
    throw new Error("Totem nao pareado. Gere um codigo de instalacao no painel admin.");
  }

  const secretHash = deviceSecret ? await sha256Hex(deviceSecret) : null;

  const { data: existing, error } = await supabase
    .from("kiosk_devices")
    .select("*")
    .eq("device_code", deviceCode)
    .maybeSingle();

  if (error) throw error;
  if (!existing) {
    throw new Error("Totem nao encontrado no painel admin.");
  }

  if (existing.team_id !== teamId) {
    throw new Error("Totem cadastrado para outro time.");
  }
  if (existing.status !== "active") {
    throw new Error("Totem pausado ou desativado no painel admin.");
  }
  if (existing.install_status && existing.install_status !== "paired") {
    throw new Error("Totem ainda nao foi instalado pelo codigo de pareamento.");
  }
  if (!existing.device_secret_hash || existing.device_secret_hash !== secretHash) {
    throw new Error("Chave local do totem invalida.");
  }

  await supabase
    .from("kiosk_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", existing.id);
  return existing;
}

async function createPixOrder(params: {
  referenceId: string;
  teamName: string;
  amountCents: number;
  expiresAt: string;
}) {
  if (!PAGBANK_TOKEN) {
    throw new Error("PAGBANK_API_TOKEN is not configured");
  }

  const body = {
    reference_id: params.referenceId,
    customer: {
      name: Deno.env.get("PAGBANK_CUSTOMER_NAME") || "Cliente FanFrame",
      email: Deno.env.get("PAGBANK_CUSTOMER_EMAIL") || "totem@fanframe.local",
      tax_id: Deno.env.get("PAGBANK_CUSTOMER_TAX_ID") || "12345678909",
      phones: [
        {
          country: "55",
          area: Deno.env.get("PAGBANK_CUSTOMER_PHONE_AREA") || "11",
          number: Deno.env.get("PAGBANK_CUSTOMER_PHONE_NUMBER") || "999999999",
          type: "MOBILE",
        },
      ],
    },
    items: [
      {
        reference_id: params.referenceId,
        name: `FanFrame Totem - ${params.teamName}`,
        quantity: 1,
        unit_amount: params.amountCents,
      },
    ],
    qr_codes: [
      {
        amount: { value: params.amountCents },
        expiration_date: params.expiresAt,
      },
    ],
    notification_urls: [NOTIFICATION_URL],
  };

  const response = await fetch(`${PAGBANK_API_BASE}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAGBANK_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`PagBank PIX order failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload as Record<string, unknown>;
}

async function createPayment(req: KioskPaymentRequest) {
  const supabase = getSupabaseClient();
  const team = await resolveTeam(supabase, req.team_slug);
  const device = await resolveDevice(supabase, team.id, req.device_code, req.device_secret);
  const method: PaymentMethod = req.method || "pix";
  const amountCents = team.kiosk_price_cents ?? 0;
  const currency = team.kiosk_currency || "BRL";
  const referenceId = `kiosk-${crypto.randomUUID()}`;
  const shouldSimulate = req.simulate || Deno.env.get("KIOSK_SIMULATE_PAYMENTS") === "true";

  if (method === "pix" && !shouldSimulate && !PAGBANK_TOKEN) {
    throw new Error("PagBank PIX ainda nao configurado. Use pagamento simulado para testes ou configure PAGBANK_API_TOKEN.");
  }

  const { data: session, error: sessionError } = await supabase
    .from("kiosk_sessions")
    .insert({
      team_id: team.id,
      device_id: device.id,
      status: "awaiting_payment",
      selected_shirt_id: req.selected_shirt_id || null,
      selected_background_id: req.selected_background_id || null,
      amount_cents: amountCents,
      currency,
      metadata: { team_slug: team.slug },
    })
    .select("*")
    .single();

  if (sessionError) throw sessionError;

  const provider = method === "pix" ? "pagbank_pix" : "plugpag_card";
  const expiresAt = addMinutes(new Date(), method === "pix" ? 10 : 5).toISOString();

  const { data: payment, error: paymentError } = await supabase
    .from("kiosk_payments")
    .insert({
      session_id: session.id,
      team_id: team.id,
      device_id: device.id,
      provider,
      method,
      status: "pending",
      amount_cents: amountCents,
      currency,
      reference_id: referenceId,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (paymentError) throw paymentError;

  await supabase.from("kiosk_sessions").update({ payment_id: payment.id }).eq("id", session.id);

  if (method !== "pix") {
    return jsonResponse({
      sessionId: session.id,
      paymentId: payment.id,
      status: "awaiting_local_payment",
      amountCents,
      currency,
      referenceId,
    });
  }

  if (shouldSimulate) {
    const qrCodeText = `fanframe-simulated-pix:${referenceId}:${amountCents}`;
    await supabase
      .from("kiosk_payments")
      .update({
        provider: "simulated",
        qr_code_text: qrCodeText,
        provider_payload: { simulated: true },
      })
      .eq("id", payment.id);

    return jsonResponse({
      sessionId: session.id,
      paymentId: payment.id,
      status: "pending",
      amountCents,
      currency,
      referenceId,
      qrCodeText,
      expiresAt,
      simulated: true,
    });
  }

  const order = await createPixOrder({
    referenceId,
    teamName: team.name,
    amountCents,
    expiresAt,
  });
  const qrCode = Array.isArray(order.qr_codes) ? order.qr_codes[0] as Record<string, unknown> : {};
  const qrCodeText = typeof qrCode.text === "string" ? qrCode.text : null;
  const qrCodeUrl = getQrImageUrl(qrCode);

  await supabase
    .from("kiosk_payments")
    .update({
      pagbank_order_id: String(order.id || ""),
      qr_code_text: qrCodeText,
      qr_code_url: qrCodeUrl,
      provider_payload: order,
    })
    .eq("id", payment.id);

  return jsonResponse({
    sessionId: session.id,
    paymentId: payment.id,
    status: "pending",
    amountCents,
    currency,
    referenceId,
    qrCodeText,
    qrCodeUrl,
    expiresAt,
  });
}

async function confirmCard(req: KioskPaymentRequest) {
  const supabase = getSupabaseClient();
  if (!req.payment_id || !req.session_id) throw new Error("Missing payment_id or session_id");

  const { data: payment, error } = await supabase
    .from("kiosk_payments")
    .select("*")
    .eq("id", req.payment_id)
    .eq("session_id", req.session_id)
    .maybeSingle();

  if (error) throw error;
  if (!payment) throw new Error("Payment not found");

  await resolveDevice(supabase, payment.team_id, req.device_code, req.device_secret);

  const result = req.plugpag_result || {};
  const approved = result.approved === true || result.status === "approved";
  const status = approved ? "paid" : "failed";

  await supabase
    .from("kiosk_payments")
    .update({
      status,
      provider_payload: result,
      paid_at: approved ? new Date().toISOString() : null,
    })
    .eq("id", req.payment_id);

  await supabase
    .from("kiosk_sessions")
    .update({
      status: approved ? "paid" : "failed",
      error_message: approved ? null : "Card payment was not approved",
    })
    .eq("id", req.session_id);

  return jsonResponse({ status, paid: approved });
}

async function checkStatus(req: KioskPaymentRequest) {
  const supabase = getSupabaseClient();
  if (!req.payment_id) throw new Error("Missing payment_id");

  const { data: payment, error } = await supabase
    .from("kiosk_payments")
    .select("*")
    .eq("id", req.payment_id)
    .maybeSingle();

  if (error) throw error;
  if (!payment) throw new Error("Payment not found");

  if (payment.status === "pending" && payment.pagbank_order_id && PAGBANK_TOKEN) {
    const response = await fetch(`${PAGBANK_API_BASE}/orders/${payment.pagbank_order_id}`, {
      headers: {
        Authorization: `Bearer ${PAGBANK_TOKEN}`,
        Accept: "application/json",
      },
    });
    const order = await response.json().catch(() => ({}));
    if (response.ok && isPaidPagBankPayload(order)) {
      await supabase
        .from("kiosk_payments")
        .update({ status: "paid", provider_payload: order, paid_at: new Date().toISOString() })
        .eq("id", payment.id);
      await supabase.from("kiosk_sessions").update({ status: "paid" }).eq("id", payment.session_id);
      return jsonResponse({ status: "paid", paid: true });
    }
  }

  return jsonResponse({
    status: payment.status,
    paid: payment.status === "paid",
    paymentId: payment.id,
    sessionId: payment.session_id,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({})) as KioskPaymentRequest;
    const action = body.action || "create";

    if (action === "create") return await createPayment(body);
    if (action === "confirm_card") return await confirmCard(body);
    if (action === "status") return await checkStatus(body);

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("[create-kiosk-payment]", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
