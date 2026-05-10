import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheckResult {
  service_id: string;
  service_name: string;
  status: "operational" | "degraded" | "partial_outage" | "major_outage";
  response_time_ms: number;
  error_message?: string;
}

async function checkDatabase(supabase: ReturnType<typeof createClient>): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("generations").select("id").limit(1);
    const responseTime = Date.now() - start;
    
    if (error) throw error;
    
    return {
      service_id: "database",
      service_name: "Banco de Dados",
      status: responseTime < 1000 ? "operational" : responseTime < 2000 ? "degraded" : "partial_outage",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "database",
      service_name: "Banco de Dados",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Database error",
    };
  }
}

async function checkAuth(supabase: ReturnType<typeof createClient>): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.auth.getSession();
    const responseTime = Date.now() - start;
    
    if (error) throw error;
    
    return {
      service_id: "auth",
      service_name: "Autenticação",
      status: responseTime < 500 ? "operational" : "degraded",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "auth",
      service_name: "Autenticação",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Auth error",
    };
  }
}

async function checkReplicate(): Promise<HealthCheckResult> {
  const start = Date.now();
  const replicateToken = Deno.env.get("REPLICATE_API_TOKEN");
  
  if (!replicateToken) {
    return {
      service_id: "replicate",
      service_name: "API IA (Replicate)",
      status: "major_outage",
      response_time_ms: 0,
      error_message: "REPLICATE_API_TOKEN not configured",
    };
  }
  
  try {
    const response = await fetch("https://api.replicate.com/v1/account", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${replicateToken}`,
      },
    });
    
    const responseTime = Date.now() - start;
    
    if (response.status === 401) {
      return {
        service_id: "replicate",
        service_name: "API IA (Replicate)",
        status: "major_outage",
        response_time_ms: responseTime,
        error_message: "Invalid API token",
      };
    }
    
    if (response.status === 429) {
      return {
        service_id: "replicate",
        service_name: "API IA (Replicate)",
        status: "degraded",
        response_time_ms: responseTime,
        error_message: "Rate limited",
      };
    }
    
    if (!response.ok) {
      return {
        service_id: "replicate",
        service_name: "API IA (Replicate)",
        status: "partial_outage",
        response_time_ms: responseTime,
        error_message: `HTTP ${response.status}`,
      };
    }
    
    return {
      service_id: "replicate",
      service_name: "API IA (Replicate)",
      status: responseTime < 1500 ? "operational" : "degraded",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "replicate",
      service_name: "API IA (Replicate)",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Connection error",
    };
  }
}

async function checkEdgeFunctions(): Promise<HealthCheckResult> {
  const start = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (!supabaseUrl) {
    return {
      service_id: "edge-functions",
      service_name: "Funções de Backend",
      status: "major_outage",
      response_time_ms: 0,
      error_message: "SUPABASE_URL not configured",
    };
  }
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/`, {
      method: "HEAD",
      headers: {
        "apikey": anonKey || "",
      },
    });
    
    const responseTime = Date.now() - start;
    
    if (response.ok || response.status === 404 || response.status === 204) {
      return {
        service_id: "edge-functions",
        service_name: "Funções de Backend",
        status: responseTime < 1000 ? "operational" : "degraded",
        response_time_ms: responseTime,
      };
    }
    
    return {
      service_id: "edge-functions",
      service_name: "Funções de Backend",
      status: "degraded",
      response_time_ms: responseTime,
      error_message: `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      service_id: "edge-functions",
      service_name: "Funções de Backend",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Connection error",
    };
  }
}

async function checkRealtime(): Promise<HealthCheckResult> {
  const start = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (!supabaseUrl) {
    return {
      service_id: "realtime",
      service_name: "Tempo Real",
      status: "major_outage",
      response_time_ms: 0,
      error_message: "SUPABASE_URL not configured",
    };
  }
  
  try {
    const realtimeUrl = supabaseUrl.replace("https://", "https://").replace(".supabase.co", ".supabase.co");
    const response = await fetch(`${realtimeUrl}/rest/v1/health_checks?select=id&limit=1`, {
      method: "GET",
      headers: {
        "apikey": anonKey || "",
        "Authorization": `Bearer ${anonKey || ""}`,
        "Content-Type": "application/json",
      },
    });
    
    const responseTime = Date.now() - start;
    
    if (response.ok) {
      return {
        service_id: "realtime",
        service_name: "Tempo Real",
        status: responseTime < 800 ? "operational" : "degraded",
        response_time_ms: responseTime,
      };
    }
    
    if (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403) {
      return {
        service_id: "realtime",
        service_name: "Tempo Real",
        status: responseTime < 800 ? "operational" : "degraded",
        response_time_ms: responseTime,
      };
    }
    
    return {
      service_id: "realtime",
      service_name: "Tempo Real",
      status: "degraded",
      response_time_ms: responseTime,
      error_message: `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      service_id: "realtime",
      service_name: "Tempo Real",
      status: "major_outage",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Connection error",
    };
  }
}

async function checkCDN(): Promise<HealthCheckResult> {
  const start = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      return {
        service_id: "cdn",
        service_name: "CDN / Assets",
        status: "operational",
        response_time_ms: 50,
      };
    }
    
    const response = await fetch(`${supabaseUrl}/storage/v1/`, {
      method: "HEAD",
    });
    
    const responseTime = Date.now() - start;
    
    return {
      service_id: "cdn",
      service_name: "CDN / Assets",
      status: responseTime < 800 ? "operational" : "degraded",
      response_time_ms: responseTime,
    };
  } catch (err) {
    return {
      service_id: "cdn",
      service_name: "CDN / Assets",
      status: "degraded",
      response_time_ms: Date.now() - start,
      error_message: err instanceof Error ? err.message : "Connection error",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log("Starting health checks...");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Run all health checks in parallel
    const [dbResult, authResult, replicateResult, edgeResult, realtimeResult, cdnResult] = await Promise.all([
      checkDatabase(supabase),
      checkAuth(supabase),
      checkReplicate(),
      checkEdgeFunctions(),
      checkRealtime(),
      checkCDN(),
    ]);

    const results = [dbResult, authResult, replicateResult, edgeResult, realtimeResult, cdnResult];

    console.log("Health check results:", JSON.stringify(results, null, 2));

    // Save results to database
    const { error: insertError } = await supabase
      .from("health_checks")
      .insert(results.map(r => ({
        service_id: r.service_id,
        service_name: r.service_name,
        status: r.status,
        response_time_ms: r.response_time_ms,
        error_message: r.error_message || null,
      })));

    if (insertError) {
      console.error("Error saving health checks:", insertError);
    }

    // Calculate overall status
    const statuses = results.map(r => r.status);
    let overallStatus: string;
    
    if (statuses.every(s => s === "operational")) {
      overallStatus = "operational";
    } else if (statuses.some(s => s === "major_outage")) {
      overallStatus = "major_outage";
    } else if (statuses.some(s => s === "partial_outage")) {
      overallStatus = "partial_outage";
    } else {
      overallStatus = "degraded";
    }

    const totalTime = Date.now() - startTime;
    console.log(`Health checks completed in ${totalTime}ms. Overall status: ${overallStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        overall_status: overallStatus,
        results,
        check_duration_ms: totalTime,
        checked_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in health-check:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
