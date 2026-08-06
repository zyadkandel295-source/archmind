import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://irjvqukildhucqbfotux.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_SA9Fx4epoTqtNdt0YCuN7g_gov6kD8M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function isSupabaseConnected(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("placeholder"));
}
