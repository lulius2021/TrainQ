// src/services/supabaseAuth.ts
import { getSupabaseClient, hasSupabaseEnv } from "../lib/supabaseClient";

export type SupabaseAuthResult = { userId: string | null; error?: string };

export async function signInSupabase(email: string, password: string): Promise<SupabaseAuthResult> {
  if (!hasSupabaseEnv()) {
    if (import.meta.env.DEV) {
      return { userId: null, error: "Supabase ENV fehlt." };
    }
    return { userId: null };
  }

  const client = getSupabaseClient();
  if (!client) return { userId: null, error: "Supabase Client fehlt." };

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { userId: null, error: error.message };
  return { userId: data.user?.id ?? null };
}

export async function signUpSupabase(
  email: string,
  password: string,
  _displayName?: string
): Promise<SupabaseAuthResult> {
  if (!hasSupabaseEnv()) {
    if (import.meta.env.DEV) {
      return { userId: null, error: "Supabase ENV fehlt." };
    }
    return { userId: null };
  }

  const client = getSupabaseClient();
  if (!client) return { userId: null, error: "Supabase Client fehlt." };

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) return { userId: null, error: error.message };
  return { userId: data.user?.id ?? null };
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function deleteSupabaseAccount(): Promise<{ error?: string }> {
  const client = getSupabaseClient();
  if (!client) return { error: "Supabase nicht verfügbar." };

  const { error } = await client.functions.invoke("delete-account");
  if (error) return { error: error.message };
  return {};
}
