import { createClient } from "@supabase/supabase-js";

export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || (SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : "");
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Missing Supabase configuration for admin app.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export function publicAssetUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const clean = pathOrUrl.replace(/^\/+/, "").replace(/^assets\//, "");
  return `${SUPABASE_URL}/storage/v1/object/public/tryon-assets/${clean}`;
}
