import { createClient } from "@supabase/supabase-js";

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const configuredSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseUrl = configuredSupabaseUrl || "http://127.0.0.1:54321";
const supabaseAnonKey = configuredSupabaseAnonKey || "not-configured";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function isSupabaseConnected(): boolean {
  return Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey && !configuredSupabaseUrl.includes("placeholder"));
}
