import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-replicate-webhook-secret",
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function getSupabaseClient() {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(SUPABASE_URL, supabaseServiceKey);
}

// ============================================================================
// DATABASE HELPER FUNCTIONS
// ============================================================================

async function createAlert(supabase: ReturnType<typeof createClient>, type: string, message: string, severity: string) {
  try {
    const { error } = await supabase.from("system_alerts").insert({ type, message, severity });
    if (error) console.error("Error creating alert:", error);
  } catch (err) {
    console.error("Failed to create alert:", err);
  }
}

async function updateGenerationsTable(
  supabase: ReturnType<typeof createClient>,
  queueEntry: any,
  status: "completed" | "failed",
  errorMessage?: string,
  processingTimeMs?: number
) {
  try {
    // Find the generation record by queue ID or create mapping
    const { data: existingGen } = await supabase
      .from("generations")
      .select("id")
      .eq("id", queueEntry.id)
      .single();

    if (existingGen) {
      const updateData: any = {
        status,
        completed_at: new Date().toISOString(),
      };
      if (errorMessage) updateData.error_message = errorMessage;
      if (processingTimeMs) updateData.processing_time_ms = processingTimeMs;

      await supabase.from("generations").update(updateData).eq("id", queueEntry.id);
    }
  } catch (err) {
    console.error("Error updating generations table:", err);
  }
}

// ============================================================================
// CIRCUIT BREAKER HELPERS
// ============================================================================

async function upsertSetting(supabase: ReturnType<typeof createClient>, key: string, value: string) {
  const { error } = await supabase
    .from("system_settings")
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) console.error(`Error upserting ${key}:`, error);
}

async function recordSuccessCircuit(supabase: ReturnType<typeof createClient>, queueId: string) {
  try {
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["replicate_circuit_state"]);

    const currentState = settings?.find(s => s.key === "replicate_circuit_state")?.value;
    
    if (currentState && currentState !== "closed") {
      console.log(`[${queueId}] Circuit closing after success`);
      await upsertSetting(supabase, "replicate_circuit_state", "closed");
      await upsertSetting(supabase, "replicate_failure_count", "0");
    }
  } catch (err) {
    console.error("Error recording success in circuit:", err);
  }
}

// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Parse webhook payload from Replicate
    const payload = await req.json();
    
    console.log("[replicate-webhook] Received webhook:", JSON.stringify({
      id: payload.id,
      status: payload.status,
      hasOutput: Boolean(payload.output),
      error: payload.error,
    }));

    const { id: predictionId, status, output, error } = payload;

    if (!predictionId) {
      console.error("[replicate-webhook] Missing prediction ID in payload");
      return new Response(
        JSON.stringify({ error: "Missing prediction ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getSupabaseClient();

    // Find the queue entry by replicate_prediction_id
    const { data: queueEntry, error: fetchError } = await supabase
      .from("generation_queue")
      .select("*")
      .eq("replicate_prediction_id", predictionId)
      .single();

    if (fetchError || !queueEntry) {
      console.error("[replicate-webhook] Queue entry not found for prediction:", predictionId);
      return new Response(
        JSON.stringify({ error: "Queue entry not found", predictionId }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[replicate-webhook] Found queue entry: ${queueEntry.id}, current status: ${queueEntry.status}`);

    // Calculate processing time
    const processingTimeMs = queueEntry.started_at 
      ? Date.now() - new Date(queueEntry.started_at).getTime()
      : null;

    if (status === "succeeded") {
      // Extract image URL from output
      const generatedImageUrl = Array.isArray(output) ? output[0] : output;

      if (!generatedImageUrl) {
        console.error(`[replicate-webhook] No image in output for ${predictionId}`);
        
        // Update queue as failed
        const { error: updateError } = await supabase
          .from("generation_queue")
          .update({
            status: "failed",
            error_message: "No image returned from Replicate API",
            completed_at: new Date().toISOString(),
          })
          .eq("id", queueEntry.id);

        if (updateError) console.error("Error updating queue:", updateError);

        await updateGenerationsTable(supabase, queueEntry, "failed", "No image returned", processingTimeMs || undefined);

        return new Response(
          JSON.stringify({ received: true, status: "failed", reason: "no_image" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Success! Copy image to permanent Supabase Storage
      console.log(`[replicate-webhook] Generation succeeded for ${queueEntry.id}`);
      
      let permanentImageUrl = generatedImageUrl;
      try {
        console.log(`[replicate-webhook] Copying image to Supabase Storage...`);
        const imageResponse = await fetch(generatedImageUrl);
        if (imageResponse.ok) {
          const imageBlob = await imageResponse.arrayBuffer();
          const filePath = `results/${queueEntry.id}.png`;
          
          const { error: uploadError } = await supabase.storage
            .from("tryon-temp")
            .upload(filePath, imageBlob, { contentType: "image/png", upsert: true });
          
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("tryon-temp").getPublicUrl(filePath);
            permanentImageUrl = urlData.publicUrl;
            console.log(`[replicate-webhook] Image saved to Storage: ${permanentImageUrl}`);
          } else {
            console.error("[replicate-webhook] Storage upload error:", uploadError);
          }
        }
      } catch (storageErr) {
        console.error("[replicate-webhook] Error copying to storage:", storageErr);
      }
      
      const { error: updateError } = await supabase
        .from("generation_queue")
        .update({
          status: "completed",
          result_image_url: permanentImageUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueEntry.id);

      if (updateError) {
        console.error("Error updating queue:", updateError);
      }

      // Update generations table
      await updateGenerationsTable(supabase, queueEntry, "completed", undefined, processingTimeMs || undefined);

      if (queueEntry.kiosk_session_id) {
        await supabase
          .from("kiosk_sessions")
          .update({
            status: "completed",
            result_image_url: permanentImageUrl,
            completed_at: new Date().toISOString(),
          })
          .eq("id", queueEntry.kiosk_session_id);
      }

      // Reset circuit breaker on success
      await recordSuccessCircuit(supabase, queueEntry.id);

      // Log slow processing alert
      if (processingTimeMs && processingTimeMs > 90000) {
        await createAlert(supabase, "slow_processing", `Geração levou ${(processingTimeMs / 1000).toFixed(1)}s`, "warning");
      }

      console.log(`[replicate-webhook] Queue entry ${queueEntry.id} marked as completed in ${processingTimeMs}ms`);

    } else if (status === "failed" || status === "canceled") {
      // Generation failed
      const errorMessage = error || `Prediction ${status}`;
      console.error(`[replicate-webhook] Generation failed for ${queueEntry.id}:`, errorMessage);

      const { error: updateError } = await supabase
        .from("generation_queue")
        .update({
          status: "failed",
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueEntry.id);

      if (updateError) {
        console.error("Error updating queue:", updateError);
      }

      await updateGenerationsTable(supabase, queueEntry, "failed", errorMessage, processingTimeMs || undefined);

      if (queueEntry.kiosk_session_id) {
        await supabase
          .from("kiosk_sessions")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", queueEntry.kiosk_session_id);
      }

      // Record failure in circuit breaker
      try {
        const { data: settings } = await supabase
          .from("system_settings")
          .select("key, value")
          .in("key", ["replicate_failure_count", "replicate_circuit_state"]);

        const currentFailures = parseInt(settings?.find(s => s.key === "replicate_failure_count")?.value || "0");
        const newFailures = currentFailures + 1;

        await upsertSetting(supabase, "replicate_failure_count", String(newFailures));
        await upsertSetting(supabase, "replicate_last_failure", new Date().toISOString());

        if (newFailures >= 5) {
          console.log(`[replicate-webhook] Opening circuit after ${newFailures} failures`);
          await upsertSetting(supabase, "replicate_circuit_state", "open");
          await createAlert(
            supabase,
            "api_error",
            `Circuit breaker ativado após ${newFailures} falhas consecutivas`,
            "critical"
          );
        }
      } catch (circuitErr) {
        console.error("Error updating circuit breaker:", circuitErr);
      }

    } else {
      // Intermediate status (processing, starting, etc.) - just log
      console.log(`[replicate-webhook] Intermediate status for ${queueEntry.id}: ${status}`);
    }

    const webhookProcessingTime = Date.now() - startTime;
    console.log(`[replicate-webhook] Webhook processed in ${webhookProcessingTime}ms`);

    return new Response(
      JSON.stringify({ 
        received: true, 
        queueId: queueEntry.id,
        status: status,
        processingTimeMs: webhookProcessingTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[replicate-webhook] Error processing webhook:", err);
    
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : "Unknown error",
        processingTimeMs: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
