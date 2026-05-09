import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  action?: "list" | "create" | "delete";
  user_id?: string;
  email?: string;
  password?: string;
  role?: "admin" | "super_admin";
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
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
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleError || !roleData) return json({ error: "Only super admins can manage users" }, 403);

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = body.action || "list";

    if (action === "list") {
      const { data: roles, error } = await adminClient
        .from("user_roles")
        .select("user_id, role, created_at")
        .in("role", ["admin", "super_admin"])
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw usersError;

      const users = (roles || []).map((role) => {
        const authUser = usersData.users.find((user) => user.id === role.user_id);
        return {
          id: role.user_id,
          email: authUser?.email || "(sem email)",
          role: role.role,
          created_at: role.created_at,
        };
      });

      return json({ users });
    }

    if (action === "create") {
      if (!body.email || !body.password) return json({ error: "Missing email or password" }, 400);
      const role = body.role === "super_admin" ? "super_admin" : "admin";
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
      });
      if (createError) throw createError;
      if (!created.user) return json({ error: "User was not created" }, 500);

      const { error: roleInsertError } = await adminClient
        .from("user_roles")
        .upsert({ user_id: created.user.id, role }, { onConflict: "user_id,role" });
      if (roleInsertError) throw roleInsertError;

      return json({ success: true, userId: created.user.id });
    }

    if (action === "delete") {
      if (!body.user_id) return json({ error: "Missing user_id" }, 400);
      if (body.user_id === userData.user.id) return json({ error: "You cannot delete your own user" }, 400);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.user_id);
      if (deleteError) throw deleteError;

      return json({ success: true });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("[manage-admin-users]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
