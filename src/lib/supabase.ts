import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null | undefined;

function supabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL?.trim() || undefined;
}

function supabasePublishableKey(): string | undefined {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function getSupabase(): SupabaseClient<Database> | null {
  if (client !== undefined) return client;

  const url = supabaseUrl();
  const anonKey = supabasePublishableKey();

  if (!url || !anonKey) {
    client = null;
    return null;
  }

  client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });

  return client;
}
