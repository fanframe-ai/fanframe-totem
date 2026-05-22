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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function deliveryPage(imageUrl: string, token: string) {
  const safeImageUrl = escapeHtml(imageUrl);
  const safeToken = escapeHtml(token);
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sua foto FanFrame</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #050505; color: #fff; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 18px; background: #050505; }
    main { width: min(100%, 520px); display: grid; gap: 18px; }
    header { display: grid; gap: 6px; text-align: center; }
    p, h1 { margin: 0; }
    h1 { font-size: clamp(28px, 8vw, 42px); line-height: .95; text-transform: uppercase; }
    p { color: #a3a3a3; font-size: 15px; line-height: 1.45; }
    img { width: 100%; max-height: 68vh; object-fit: contain; border-radius: 18px; background: #151515; border: 1px solid #2c2c2c; }
    .actions { display: grid; gap: 10px; }
    a, button { min-height: 56px; border: 0; border-radius: 12px; display: grid; place-items: center; font: inherit; font-weight: 900; text-transform: uppercase; text-decoration: none; }
    a { background: #fff; color: #050505; }
    button { background: #151515; color: #fff; border: 1px solid #333; }
    button:disabled { opacity: .72; }
    .consent { border: 1px solid #2c2c2c; border-radius: 16px; background: #101010; padding: 16px; display: grid; gap: 10px; }
    .consent strong { font-size: 16px; text-transform: uppercase; }
    .consent button { min-height: 48px; font-size: 13px; }
    small { color: #737373; text-align: center; line-height: 1.4; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Sua foto esta pronta</h1>
      <p>Baixe no celular e compartilhe quando quiser.</p>
    </header>
    <img src="${safeImageUrl}" alt="Foto gerada pelo FanFrame" />
    <div class="actions">
      <a href="${safeImageUrl}" download="fanframe-foto.jpg">Baixar imagem</a>
      <button type="button" id="shareButton">Compartilhar</button>
    </div>
    <section class="consent">
      <strong>Autorizar uso nas redes</strong>
      <p>Opcional: permita que a equipe FanFrame selecione esta foto para posts, stories ou materiais de divulgacao. A publicacao nao e automatica.</p>
      <button type="button" id="consentButton">Autorizo usar minha foto</button>
    </section>
    <small>Esta pagina e temporaria. Salve a imagem antes que o link expire.</small>
  </main>
  <script>
    const imageUrl = ${JSON.stringify(imageUrl)};
    const token = ${JSON.stringify(token)};
    const button = document.getElementById("shareButton");
    button?.addEventListener("click", async () => {
      if (!navigator.share) {
        await navigator.clipboard?.writeText(imageUrl).catch(() => undefined);
        button.textContent = "Link copiado";
        return;
      }
      await navigator.share({ title: "Minha foto FanFrame", text: "Olha minha foto gerada no totem FanFrame", url: imageUrl }).catch(() => undefined);
    });
    const consentButton = document.getElementById("consentButton");
    consentButton?.addEventListener("click", async () => {
      consentButton.setAttribute("disabled", "true");
      consentButton.textContent = "Enviando...";
      const response = await fetch(location.href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "share_consent", token })
      }).catch(() => null);
      consentButton.textContent = response?.ok ? "Autorizacao registrada" : "Nao foi possivel registrar";
      if (!response?.ok) consentButton.removeAttribute("disabled");
    });
  </script>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabaseClient();

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.action === "share_consent") {
        const token = String(body.token || "");
        if (!token) return jsonResponse({ error: "Missing token" }, 400);

        const { data: link, error } = await supabase
          .from("kiosk_delivery_links")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (error || !link) return jsonResponse({ error: "Link not found" }, 404);
        if (new Date(link.expires_at).getTime() < Date.now()) {
          return jsonResponse({ error: "Link expired" }, 410);
        }

        const consentText = JSON.stringify({
          text: "Cliente autorizou o uso da foto gerada em posts, stories ou materiais de divulgacao FanFrame. Publicacao depende de revisao humana.",
          delivery_link_id: link.id,
          session_id: link.session_id,
          result_image_url: link.result_image_url,
        });

        const { error: consentError } = await supabase.from("consent_logs").insert({
          team_id: link.team_id,
          user_id: `kiosk_delivery:${link.id}`,
          consent_type: "kiosk_social_share",
          consent_text: consentText,
          ip_address: req.headers.get("x-forwarded-for") || null,
          user_agent: req.headers.get("user-agent") || null,
        });
        if (consentError) throw consentError;

        return jsonResponse({ ok: true });
      }
    } catch (error) {
      console.error("[create-delivery-link:consent]", error);
      return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  }

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

    return htmlResponse(deliveryPage(link.result_image_url, token));
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
