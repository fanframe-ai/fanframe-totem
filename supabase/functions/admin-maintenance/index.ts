import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  action?: "usage_counts" | "clear_usage";
  confirmation?: string;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireSuperAdmin(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return { error: json({ error: "Unauthorized" }, 401), adminClient: null, userId: "" };
  }

  const { data: roleData, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "super_admin")
    .maybeSingle();

  if (roleError || !roleData) {
    return { error: json({ error: "Only super admins can run maintenance actions" }, 403), adminClient: null, userId: userData.user.id };
  }

  return { error: null, adminClient, userId: userData.user.id };
}

async function countRows(adminClient: ReturnType<typeof createClient>) {
  const tables = [
    "kiosk_sessions",
    "kiosk_payments",
    "kiosk_delivery_links",
    "generation_queue",
    "generations",
  ];
  const result: Record<string, number> = {};

  await Promise.all(tables.map(async (table) => {
    const { count, error } = await adminClient.from(table).select("id", { count: "exact", head: true });
    if (error) throw error;
    result[table] = count || 0;
  }));

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const { error, adminClient, userId } = await requireSuperAdmin(authHeader);
    if (error || !adminClient) return error;

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action || "usage_counts";

    if (action === "usage_counts") {
      return json({ counts: await countRows(adminClient) });
    }

    if (action !== "clear_usage") {
      return json({ error: "Unsupported action" }, 400);
    }

    if (body.confirmation !== "LIMPAR DADOS") {
      return json({ error: "Invalid confirmation" }, 400);
    }

    const before = await countRows(adminClient);

    const deletions = [
      adminClient.from("kiosk_delivery_links").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      adminClient.from("kiosk_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      adminClient.from("kiosk_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      adminClient.from("generation_queue").delete().or("source.eq.kiosk,kiosk_session_id.not.is.null"),
      adminClient.from("generations").delete().or("source.eq.kiosk,kiosk_session_id.not.is.null"),
    ];

    for (const deletion of deletions) {
      const { error: deleteError } = await deletion;
      if (deleteError) throw deleteError;
    }

    const after = await countRows(adminClient);

    const { error: auditError } = await adminClient.from("kiosk_admin_audit_events").insert({
      actor_user_id: userId,
      target_table: "kiosk_usage",
      target_id: null,
      action: "usage_data_cleared",
      payload: { before, after },
    });
    if (auditError) console.error("[admin-maintenance] audit failed", auditError);

    return json({ success: true, before, after });
  } catch (error) {
    console.error("[admin-maintenance]", error);
    return json({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
