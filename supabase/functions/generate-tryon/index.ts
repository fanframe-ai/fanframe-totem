import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEBUG_LOG_TRUNCATE = 2500;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const REPLICATE_API_URL = "https://api.replicate.com/v1/models/bytedance/seedream-4.5/predictions";

// Webhook URL for async callbacks
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/replicate-webhook`;

// Rate Limiting
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora
const RATE_LIMIT_MAX = 25; // 25 gerações por hora

// Circuit Breaker
const FAILURE_THRESHOLD = 5;
const RECOVERY_TIME_MS = 2 * 60 * 1000; // 2 minutos
const CIRCUIT_STATE_KEY = "replicate_circuit_state";
const CIRCUIT_FAILURES_KEY = "replicate_failure_count";
const CIRCUIT_LAST_FAILURE_KEY = "replicate_last_failure";

const DEFAULT_PROMPT = `Virtual try-on: Transform this person to wear the Corinthians jersey (Timão).

RULES:
- Preserve the person's face, body proportions and pose exactly
- Replace only the upper body clothing with the Corinthians jersey
- Ensure realistic fabric folds and natural fit
- Place the person in the museum background setting
- Match lighting to indoor museum environment
- Maintain photorealistic quality, 8K resolution, sharp focus
- Professional DSLR camera quality`;

const FOREGROUND_PEOPLE_PROMPT_RULE = `Foreground people rule:
- Use only the 1 or 2 main people closest to the camera as the photo subjects.
- If there is 1 main person in the foreground, transform only that person.
- If there are 2 main people in the foreground, transform both people.
- Ignore bystanders, crowds, reflections, posters, screens, printed faces, and anyone behind the main foreground subject(s).
- Do not crop, erase, or distort the main foreground subject(s). Keep identity, pose, face, body proportions, and framing natural.`;

function withForegroundPeopleRule(prompt: string): string {
  const basePrompt = prompt?.trim() || DEFAULT_PROMPT;
  if (basePrompt.includes("Foreground people rule:")) return basePrompt;
  return `${basePrompt}\n\n${FOREGROUND_PEOPLE_PROMPT_RULE}`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function truncateLog(value: string, limit = DEBUG_LOG_TRUNCATE) {
  if (!value) return value;
  return value.length > limit ? `${value.slice(0, limit)}...<truncated ${value.length - limit} chars>` : value;
}

function getSupabaseClient() {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(SUPABASE_URL, supabaseServiceKey);
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
  base64Data: string,
  fileName: string,
  generationId: string
): Promise<string> {
  const base64Content = base64Data.includes(",") 
    ? base64Data.split(",")[1] 
    : base64Data;
  
  let contentType = "image/png";
  if (base64Data.startsWith("data:")) {
    const match = base64Data.match(/data:([^;]+);/);
    if (match) contentType = match[1];
  }
  
  const binaryString = atob(base64Content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const filePath = `${generationId}/${fileName}`;
  console.log(`[${generationId}] Uploading ${fileName} to storage (${bytes.length} bytes)`);
  
  const { error } = await supabase.storage
    .from("tryon-temp")
    .upload(filePath, bytes, { contentType, upsert: true });
  
  if (error) {
    console.error(`[${generationId}] Storage upload error:`, error);
    throw new Error(`Failed to upload ${fileName}: ${error.message}`);
  }
  
  const { data: urlData } = supabase.storage.from("tryon-temp").getPublicUrl(filePath);
  console.log(`[${generationId}] Uploaded ${fileName}: ${urlData.publicUrl}`);
  return urlData.publicUrl;
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

async function logGeneration(
  supabase: ReturnType<typeof createClient>,
  generationId: string,
  data: {
    external_user_id?: string | null;
    shirt_id: string;
    status: string;
    team_id?: string | null;
    kiosk_session_id?: string | null;
    payment_id?: string | null;
    source?: string;
    error_message?: string | null;
    processing_time_ms?: number | null;
  }
) {
  try {
    const payload: Record<string, unknown> = {
      id: generationId,
      external_user_id: data.external_user_id || null,
      shirt_id: data.shirt_id,
      status: data.status,
      team_id: data.team_id || null,
      kiosk_session_id: data.kiosk_session_id || null,
      payment_id: data.payment_id || null,
      source: data.source || "web",
    };
    if (data.error_message) payload.error_message = data.error_message;
    if (data.processing_time_ms) payload.processing_time_ms = data.processing_time_ms;
    if (data.status === "completed" || data.status === "failed") {
      payload.completed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("generations").upsert(payload);
    if (error) console.error("Error logging generation:", error);
  } catch (err) {
    console.error("Failed to log generation:", err);
  }
}

async function createAlert(supabase: ReturnType<typeof createClient>, type: string, message: string, severity: string) {
  try {
    const { error } = await supabase.from("system_alerts").insert({ type, message, severity });
    if (error) console.error("Error creating alert:", error);
  } catch (err) {
    console.error("Failed to create alert:", err);
  }
}

async function getGenerationPrompt(supabase: ReturnType<typeof createClient>, teamSlug?: string): Promise<string> {
  // First try team-specific prompt
  if (teamSlug) {
    try {
      const { data: teamData } = await supabase
        .from("teams")
        .select("generation_prompt, published_config")
        .eq("slug", teamSlug)
        .single();

      const published = teamData?.published_config &&
        typeof teamData.published_config === "object" &&
        !Array.isArray(teamData.published_config)
        ? teamData.published_config as Record<string, unknown>
        : {};
      const publishedPrompt = typeof published.generation_prompt === "string" ? published.generation_prompt : "";
      if (publishedPrompt || teamData?.generation_prompt) {
        console.log(`Using team-specific prompt for ${teamSlug}`);
        return publishedPrompt || teamData.generation_prompt;
      }
    } catch (err) {
      console.error("Error fetching team prompt:", err);
    }
  }
  
  // Fallback to system_settings
  try {
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "generation_prompt")
      .single();
    
    if (error || !data) {
      console.log("Using default prompt (no custom prompt found)");
      return DEFAULT_PROMPT;
    }
    
    console.log("Using custom prompt from database");
    return data.value;
  } catch (err) {
    console.error("Error fetching prompt:", err);
    return DEFAULT_PROMPT;
  }
}

async function getTeamReplicateToken(supabase: ReturnType<typeof createClient>, teamSlug?: string): Promise<string | null> {
  if (!teamSlug) return null;
  
  try {
    const { data } = await supabase
      .from("teams")
      .select("replicate_api_token")
      .eq("slug", teamSlug)
      .single();
    
    if (data?.replicate_api_token) {
      console.log(`Using team-specific Replicate token for ${teamSlug}`);
      return data.replicate_api_token;
    }
  } catch (err) {
    console.error("Error fetching team Replicate token:", err);
  }
  
  return null;
}

async function getTeamId(supabase: ReturnType<typeof createClient>, teamSlug?: string): Promise<string | null> {
  if (!teamSlug) return null;
  
  try {
    const { data } = await supabase
      .from("teams")
      .select("id")
      .eq("slug", teamSlug)
      .single();
    return data?.id || null;
  } catch {
    return null;
  }
}

async function upsertSetting(supabase: ReturnType<typeof createClient>, key: string, value: string) {
  const { error } = await supabase
    .from("system_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) console.error(`Error upserting ${key}:`, error);
}

// ============================================================================
// QUEUE FUNCTIONS
// ============================================================================

async function createQueueEntry(
  supabase: ReturnType<typeof createClient>,
  data: {
    id: string;
    user_id: string | null;
    user_image_url: string;
    shirt_asset_url: string;
    background_asset_url: string;
    shirt_id: string;
    team_id?: string | null;
    kiosk_session_id?: string | null;
    payment_id?: string | null;
    source?: string;
    foreground_filter_applied?: boolean | null;
    foreground_people_count?: number | null;
  }
): Promise<void> {
  const { error } = await supabase.from("generation_queue").insert({
    id: data.id,
    user_id: data.user_id,
    user_image_url: data.user_image_url,
    shirt_asset_url: data.shirt_asset_url,
    background_asset_url: data.background_asset_url,
    shirt_id: data.shirt_id,
    status: "pending",
    team_id: data.team_id || null,
    kiosk_session_id: data.kiosk_session_id || null,
    payment_id: data.payment_id || null,
    source: data.source || "web",
    foreground_filter_applied: data.foreground_filter_applied ?? null,
    foreground_people_count: data.foreground_people_count ?? null,
  });

  if (error) {
    console.error("Error creating queue entry:", error);
    throw new Error(`Failed to create queue entry: ${error.message}`);
  }
}

async function updateQueueStatus(
  supabase: ReturnType<typeof createClient>,
  queueId: string,
  status: string,
  extraData?: {
    replicate_prediction_id?: string;
    error_message?: string;
    started_at?: string;
    completed_at?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = { status, ...extraData };
  
  const { error } = await supabase
    .from("generation_queue")
    .update(updateData)
    .eq("id", queueId);

  if (error) {
    console.error("Error updating queue status:", error);
  }
}

async function getQueuePosition(supabase: ReturnType<typeof createClient>, queueId: string): Promise<number> {
  const { data, error } = await supabase
    .from("generation_queue")
    .select("id, created_at")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true });

  if (error || !data) return 1;

  const position = data.findIndex(entry => entry.id === queueId) + 1;
  return position > 0 ? position : 1;
}

// ============================================================================
// RATE LIMITING
// ============================================================================

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  generationId: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date | null }> {
  if (!userId) {
    console.log(`[${generationId}] No userId provided, skipping rate limit`);
    return { allowed: true, remaining: RATE_LIMIT_MAX, resetAt: null };
  }

  try {
    const { data: limit, error: fetchError } = await supabase
      .from("rate_limits")
      .select("count, window_start")
      .eq("user_id", userId)
      .eq("action", "generation")
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error(`[${generationId}] Error fetching rate limit:`, fetchError);
      return { allowed: true, remaining: RATE_LIMIT_MAX, resetAt: null };
    }

    const now = Date.now();

    if (!limit) {
      const { error: insertError } = await supabase
        .from("rate_limits")
        .insert({
          user_id: userId,
          action: "generation",
          count: 1,
          window_start: new Date().toISOString(),
        });

      if (insertError) {
        console.error(`[${generationId}] Error creating rate limit:`, insertError);
      }

      console.log(`[${generationId}] Rate limit: first use for user ${userId.substring(0, 8)}...`);
      return { 
        allowed: true, 
        remaining: RATE_LIMIT_MAX - 1, 
        resetAt: new Date(now + RATE_LIMIT_WINDOW_MS) 
      };
    }

    const windowAge = now - new Date(limit.window_start).getTime();

    if (windowAge >= RATE_LIMIT_WINDOW_MS) {
      const { error: updateError } = await supabase
        .from("rate_limits")
        .update({
          count: 1,
          window_start: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("action", "generation");

      if (updateError) {
        console.error(`[${generationId}] Error resetting rate limit:`, updateError);
      }

      console.log(`[${generationId}] Rate limit: window reset for user ${userId.substring(0, 8)}...`);
      return { 
        allowed: true, 
        remaining: RATE_LIMIT_MAX - 1, 
        resetAt: new Date(now + RATE_LIMIT_WINDOW_MS) 
      };
    }

    if (limit.count >= RATE_LIMIT_MAX) {
      const resetAt = new Date(new Date(limit.window_start).getTime() + RATE_LIMIT_WINDOW_MS);
      console.log(`[${generationId}] Rate limit EXCEEDED for user ${userId.substring(0, 8)}...: ${limit.count}/${RATE_LIMIT_MAX}`);
      
      await createAlert(
        supabase,
        "high_usage",
        `Usuário ${userId.substring(0, 8)}... atingiu limite de gerações`,
        "info"
      );

      return { allowed: false, remaining: 0, resetAt };
    }

    const { error: incError } = await supabase
      .from("rate_limits")
      .update({ count: limit.count + 1 })
      .eq("user_id", userId)
      .eq("action", "generation");

    if (incError) {
      console.error(`[${generationId}] Error incrementing rate limit:`, incError);
    }

    const remaining = RATE_LIMIT_MAX - limit.count - 1;
    const resetAt = new Date(new Date(limit.window_start).getTime() + RATE_LIMIT_WINDOW_MS);
    
    console.log(`[${generationId}] Rate limit: ${limit.count + 1}/${RATE_LIMIT_MAX} for user ${userId.substring(0, 8)}...`);
    return { allowed: true, remaining, resetAt };
  } catch (err) {
    console.error(`[${generationId}] Rate limit check error:`, err);
    return { allowed: true, remaining: RATE_LIMIT_MAX, resetAt: null };
  }
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

interface CircuitState {
  state: "closed" | "open" | "half-open";
  failures: number;
  lastFailure: string | null;
}

async function getCircuitState(supabase: ReturnType<typeof createClient>): Promise<CircuitState> {
  try {
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [CIRCUIT_STATE_KEY, CIRCUIT_FAILURES_KEY, CIRCUIT_LAST_FAILURE_KEY]);

    const state: CircuitState = {
      state: "closed",
      failures: 0,
      lastFailure: null,
    };

    if (settings) {
      for (const s of settings) {
        if (s.key === CIRCUIT_STATE_KEY) state.state = s.value as CircuitState["state"];
        if (s.key === CIRCUIT_FAILURES_KEY) state.failures = parseInt(s.value) || 0;
        if (s.key === CIRCUIT_LAST_FAILURE_KEY) state.lastFailure = s.value;
      }
    }

    return state;
  } catch (err) {
    console.error("Error getting circuit state:", err);
    return { state: "closed", failures: 0, lastFailure: null };
  }
}

async function checkCircuit(
  supabase: ReturnType<typeof createClient>,
  generationId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const circuit = await getCircuitState(supabase);
  
  console.log(`[${generationId}] Circuit state: ${circuit.state}, failures: ${circuit.failures}`);

  if (circuit.state === "closed") {
    return { allowed: true };
  }

  if (circuit.state === "open") {
    const lastFailure = circuit.lastFailure ? new Date(circuit.lastFailure).getTime() : 0;
    const timeSinceFailure = Date.now() - lastFailure;

    if (timeSinceFailure >= RECOVERY_TIME_MS) {
      console.log(`[${generationId}] Circuit transitioning to half-open after ${Math.round(timeSinceFailure / 1000)}s`);
      await upsertSetting(supabase, CIRCUIT_STATE_KEY, "half-open");
      return { allowed: true };
    }

    const waitSeconds = Math.ceil((RECOVERY_TIME_MS - timeSinceFailure) / 1000);
    console.log(`[${generationId}] Circuit OPEN, blocking request. Wait ${waitSeconds}s`);
    return { 
      allowed: false, 
      reason: `Sistema temporariamente indisponível. Tente novamente em ${waitSeconds} segundos.` 
    };
  }

  console.log(`[${generationId}] Circuit half-open, allowing test request`);
  return { allowed: true };
}

async function recordFailure(supabase: ReturnType<typeof createClient>, generationId: string, errorMessage: string) {
  const circuit = await getCircuitState(supabase);
  const newFailures = circuit.failures + 1;
  
  console.log(`[${generationId}] Recording failure #${newFailures}: ${errorMessage.substring(0, 100)}`);
  
  await upsertSetting(supabase, CIRCUIT_FAILURES_KEY, String(newFailures));
  await upsertSetting(supabase, CIRCUIT_LAST_FAILURE_KEY, new Date().toISOString());

  if (newFailures >= FAILURE_THRESHOLD && circuit.state !== "open") {
    console.log(`[${generationId}] Circuit OPENING after ${newFailures} failures`);
    await upsertSetting(supabase, CIRCUIT_STATE_KEY, "open");
    
    await createAlert(
      supabase,
      "api_error",
      `Circuit breaker ativado após ${newFailures} falhas consecutivas. Sistema pausado por 2 minutos.`,
      "critical"
    );
  }
}

// ============================================================================
// MAIN HANDLER - ASYNC QUEUE-BASED
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const generationId = crypto.randomUUID();
  let supabase: ReturnType<typeof createClient> | null = null;
  let stage = "init";
  let requestContext: {
    kioskSessionId: string | null;
    paymentId: string | null;
    source: "web" | "kiosk" | "web_test";
    shirtId: string | null;
    teamId: string | null;
  } = {
    kioskSessionId: null,
    paymentId: null,
    source: "web",
    shirtId: null,
    teamId: null,
  };

  try {
    console.log(`[${generationId}] Request received: ${req.method}`);

    stage = "init_supabase";
    supabase = getSupabaseClient();

    stage = "validate_env";
    // Will be resolved after parsing body (team may have its own token)
    const DEFAULT_REPLICATE_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");

    stage = "parse_body";
    const rawBody = await req.text();
    console.log(`[${generationId}] Body received: ${rawBody.length} chars`);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      console.error(`[${generationId}] Invalid JSON body`);
      return new Response(
        JSON.stringify({ error: "Invalid JSON body", generationId, stage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const {
      userImageBase64,
      shirtAssetUrl,
      backgroundAssetUrl,
      shirtId,
      userId,
      team_slug,
      kiosk_session_id,
      payment_id,
      source,
    } = parsed as {
      userImageBase64?: string;
      shirtAssetUrl?: string;
      backgroundAssetUrl?: string;
      shirtId?: string;
      userId?: string;
      team_slug?: string;
      kiosk_session_id?: string;
      payment_id?: string;
      source?: string;
    };
    const requestSource = source === "kiosk" || source === "web_test" ? source : "web";
    requestContext = {
      kioskSessionId: kiosk_session_id || null,
      paymentId: payment_id || null,
      source: requestSource,
      shirtId: shirtId || null,
      teamId: null,
    };

    console.log(`[${generationId}] Parsed payload:`, {
      hasUserImage: Boolean(userImageBase64),
      shirtAssetUrl,
      backgroundAssetUrl,
      shirtId,
      userId: userId ? `${userId.substring(0, 8)}...` : null,
      team_slug: team_slug || "default",
      kiosk_session_id: kiosk_session_id || null,
      payment_id: payment_id || null,
      source: requestSource,
    });

    stage = "validate_params";
    if (!userImageBase64) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: userImageBase64", generationId, stage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shirtAssetUrl || !backgroundAssetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: shirtAssetUrl and backgroundAssetUrl", generationId, stage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate Limiting
    stage = "check_rate_limit";
    const rateLimit = await checkRateLimit(supabase, userId || "", generationId);
    if (!rateLimit.allowed) {
      const resetIn = rateLimit.resetAt 
        ? Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 60000)
        : 60;
      
      return new Response(
        JSON.stringify({ 
          error: `Limite de ${RATE_LIMIT_MAX} gerações/hora atingido. Tente novamente em ${resetIn} minutos.`,
          errorCode: "rate_limit_exceeded",
          generationId,
          resetAt: rateLimit.resetAt?.toISOString(),
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Circuit Breaker
    stage = "check_circuit";
    const circuit = await checkCircuit(supabase, generationId);
    if (!circuit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: circuit.reason || "Sistema temporariamente indisponível",
          errorCode: "circuit_open",
          generationId,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    stage = "resolve_team_id";
    const teamId = await getTeamId(supabase, team_slug);
    requestContext.teamId = teamId;

    if ((requestSource === "kiosk" || requestSource === "web_test") && kiosk_session_id) {
      await supabase
        .from("kiosk_sessions")
        .update({
          status: "generating",
          error_message: null,
          payment_id: payment_id || null,
        })
        .eq("id", kiosk_session_id);
    }

    // Upload user image to storage
    stage = "upload_user_image";
    const userImageUrl = await uploadToStorage(supabase, userImageBase64, "user-photo.png", generationId);
    console.log(`[${generationId}] User image uploaded to temp storage`);

    // Create queue entry
    stage = "create_queue_entry";
    await createQueueEntry(supabase, {
      id: generationId,
      user_id: userId || null,
      user_image_url: userImageUrl,
      shirt_asset_url: shirtAssetUrl,
      background_asset_url: backgroundAssetUrl,
      shirt_id: shirtId || "unknown",
      team_id: teamId,
      kiosk_session_id: kiosk_session_id || null,
      payment_id: payment_id || null,
      source: requestSource,
      foreground_filter_applied: false,
      foreground_people_count: null,
    });
    console.log(`[${generationId}] Queue entry created`);

    if ((requestSource === "kiosk" || requestSource === "web_test") && kiosk_session_id) {
      await supabase
        .from("kiosk_sessions")
        .update({
          status: "generating",
          generation_queue_id: generationId,
        })
        .eq("id", kiosk_session_id);
    }

    // Log to generations table
    stage = "log_processing";
    await logGeneration(supabase, generationId, {
      external_user_id: userId || null,
      shirt_id: shirtId || "unknown",
      status: "processing",
      team_id: teamId,
      kiosk_session_id: kiosk_session_id || null,
      payment_id: payment_id || null,
      source: requestSource,
    });

    // Get generation prompt (team-specific or fallback)
    stage = "fetch_prompt";
    const textPrompt = withForegroundPeopleRule(await getGenerationPrompt(supabase, team_slug));
    console.log(`[${generationId}] Prompt length: ${textPrompt.length} chars`);

    // Resolve Replicate API token (team-specific or fallback)
    stage = "resolve_replicate_token";
    const teamReplicateToken = await getTeamReplicateToken(supabase, team_slug);
    const REPLICATE_API_TOKEN = teamReplicateToken || DEFAULT_REPLICATE_TOKEN;
    
    if (!REPLICATE_API_TOKEN) {
      console.error(`[${generationId}] No Replicate API token available`);
      throw new Error("REPLICATE_API_TOKEN is not configured");
    }

    // Call Replicate with webhook (async - no polling!)
    stage = "call_replicate";
    console.log(`[${generationId}] Calling Replicate with webhook: ${WEBHOOK_URL}, using ${teamReplicateToken ? "team" : "default"} token`);
    
    const response = await fetch(REPLICATE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: textPrompt,
          image_input: [userImageUrl, shirtAssetUrl, backgroundAssetUrl],
          size: "2K",
          aspect_ratio: "2:3",
          max_images: 1,
          sequential_image_generation: "disabled",
        },
        webhook: WEBHOOK_URL,
        webhook_events_filter: ["completed"],
      }),
    });

    console.log(`[${generationId}] Replicate response: ${response.status}`);

    if (!response.ok) {
      stage = "replicate_error";
      const errorText = await response.text();
      console.error(`[${generationId}] Replicate error: ${response.status}`, truncateLog(errorText));

      // Update queue as failed
      await updateQueueStatus(supabase, generationId, "failed", {
        error_message: `Replicate API error: ${response.status}`,
        completed_at: new Date().toISOString(),
      });

      await logGeneration(supabase, generationId, {
        external_user_id: userId || null,
        shirt_id: shirtId || "unknown",
        status: "failed",
        team_id: teamId,
        kiosk_session_id: kiosk_session_id || null,
        payment_id: payment_id || null,
        source: requestSource,
        error_message: `Replicate API error: ${response.status}`,
        processing_time_ms: Date.now() - startTime,
      });

      if ((requestSource === "kiosk" || requestSource === "web_test") && kiosk_session_id) {
        await supabase
          .from("kiosk_sessions")
          .update({
            status: "failed",
            error_message: `Replicate API error: ${response.status}`,
          })
          .eq("id", kiosk_session_id);
      }

      await recordFailure(supabase, generationId, `API error: ${response.status}`);

      if (response.status === 401 || response.status === 403) {
        await createAlert(supabase, "api_error", "Replicate API token inválido", "critical");
        return new Response(
          JSON.stringify({ error: "Invalid API token. Please check configuration.", generationId }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();
    console.log(`[${generationId}] Prediction created:`, JSON.stringify({
      id: prediction.id,
      status: prediction.status,
    }));

    // Update queue with prediction ID and mark as processing
    stage = "update_queue";
    await updateQueueStatus(supabase, generationId, "processing", {
      replicate_prediction_id: prediction.id,
      started_at: new Date().toISOString(),
    });

    // Get queue position for UX
    const queuePosition = await getQueuePosition(supabase, generationId);

    const processingTime = Date.now() - startTime;
    console.log(`[${generationId}] Request processed in ${processingTime}ms, position in queue: ${queuePosition}`);

    // Return immediately with queue info (async pattern)
    return new Response(
      JSON.stringify({
        message: "Generation started",
        queueId: generationId,
        predictionId: prediction.id,
        status: "processing",
        queuePosition,
        estimatedWaitSeconds: queuePosition <= 5 ? 45 : queuePosition <= 20 ? 120 : 300,
        rateLimitRemaining: rateLimit.remaining,
        processingTimeMs: processingTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${generationId}] Error (stage=${stage}):`, error);
    
    if (supabase) {
      await updateQueueStatus(supabase, generationId, "failed", {
        error_message: error instanceof Error ? error.message : "Unknown error",
        completed_at: new Date().toISOString(),
      });

      await logGeneration(supabase, generationId, {
        shirt_id: requestContext.shirtId || "unknown",
        status: "failed",
        team_id: requestContext.teamId,
        kiosk_session_id: requestContext.kioskSessionId,
        payment_id: requestContext.paymentId,
        source: requestContext.source,
        error_message: error instanceof Error ? error.message : "Unknown error",
        processing_time_ms: processingTime,
      });

      if (requestContext.kioskSessionId && (requestContext.source === "kiosk" || requestContext.source === "web_test")) {
        await supabase
          .from("kiosk_sessions")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", requestContext.kioskSessionId);
      }
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
        generationId,
        stage,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
