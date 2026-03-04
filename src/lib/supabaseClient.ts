import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authStorageAdapter } from "./authStorageAdapter";

let cachedClient: SupabaseClient | null = null;

// Helper only for "existence" check, but we use direct access for values below to ensure Vite replacement.


export function hasSupabaseEnv(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (import.meta.env.DEV) console.error("DEBUG: Supabase Env Missing", { url: !!url, key: !!key });
  } else if (url.includes("replace-me") || key.includes("replace-me")) {
    if (import.meta.env.DEV) console.error("CRITICAL: Supabase Env contains placeholders. Please update .env file with real values.");
  }
  return !!(url && key && !url.includes("replace-me"));
}

export function getSupabaseClient(): SupabaseClient | null {
  // Use DIRECT access so Vite can statically replace these at build time.
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: authStorageAdapter,
        },
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error(" [Supabase] Client creation failed:", err);
      return null;
    }
  }

  return cachedClient;
}
