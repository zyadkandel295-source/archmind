import { createClient } from "@supabase/supabase-js";

function serverCredentials() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ADMIN_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return { url, key };
}

export function isSupabaseServerConfigured() {
  // Unit/integration tests use the injected in-memory store. Do not let a
  // developer's local .env turn deterministic tests into live network calls.
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  const { url, key } = serverCredentials();
  return Boolean(url && key && !url.includes("placeholder"));
}

export function createSupabaseServerClient() {
  const { url, key } = serverCredentials();
  return createClient(url || "http://127.0.0.1:54321", key || "not-configured", {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
