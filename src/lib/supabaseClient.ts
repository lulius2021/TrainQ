import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authStorageAdapter } from "./authStorageAdapter";

let cachedClient: SupabaseClient | null = null;

// Helper only for "existence" check, but we use direct access for values below to ensure Vite replacement.


export function hasSupabaseEnv(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("DEBUG: Supabase Env Missing", { url: !!url, key: !!key });
  } else if (url.includes("replace-me") || key.includes("replace-me")) {
    console.error("CRITICAL: Supabase Env contains placeholders. Please update .env file with real values.");
  } else {
    console.log("DEBUG: Supabase Env Found", { url });
  }
  return !!(url && key && !url.includes("replace-me"));
}

export function getSupabaseClient(): SupabaseClient | null {
  // Use DIRECT access so Vite can statically replace these at build time.
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(" [Supabase] Warning: Environment variables missing.");
    return null;
  }

  if (!cachedClient) {
    try {
      console.log(" [Supabase] Initializing client...", { url });
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: authStorageAdapter,
        },
      });
      console.log(" [Supabase] Client initialized successfully.");
    } catch (err) {
      console.error(" [Supabase] Client creation failed:", err);
      return null;
    }
  }

  return cachedClient;
}
