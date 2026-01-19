// src/context/AuthContext.tsx
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { clearActiveSession, setActiveSession } from "../utils/session";
import { migrateUserStorage } from "../utils/scopedStorage";
import { getSupabaseClient } from "../lib/supabaseClient";
import { signOutSupabase } from "../services/supabaseAuth";
import type { User, Session } from "@supabase/supabase-js";

export type AuthProvider = "email" | "apple";

export type AuthUser = {
  id: string;
  provider: AuthProvider;
  email?: string;
  displayName?: string;
  isPro?: boolean;
  supabaseId?: string; // Should match id for Email users
  createdAt?: string;
  updatedAt?: string;
};

export type AuthResult = { ok: boolean; error?: string };

export type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  loginWithApple: () => Promise<AuthResult>;
  logout: () => void;
  setUserPro: (isPro: boolean) => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

// -------------------- Helpers --------------------

function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

// -------------------- Provider --------------------

export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  // Sync Supabase Session -> AuthUser
  const syncSessionToUser = useCallback((session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      clearActiveSession();
      return;
    }

    const u = session.user;
    const isPro = u.app_metadata?.plan === "pro" || u.user_metadata?.plan === "pro";

    // Map Supabase User to our AuthUser
    const authUser: AuthUser = {
      id: u.id,
      provider: u.app_metadata?.provider === "apple" ? "apple" : "email",
      email: u.email,
      displayName: u.user_metadata?.full_name || u.email?.split("@")[0],
      isPro,
      supabaseId: u.id,
      createdAt: u.created_at,
      updatedAt: u.updated_at,
    };

    setUser(authUser);
    setActiveSession({ userId: authUser.id, isPro: !!isPro, email: authUser.email });
    migrateUserStorage(authUser.id);
  }, []);

  // 1. Init Listener
  useEffect(() => {
    mountedRef.current = true;
    const client = getSupabaseClient();

    // Check initial session
    client?.auth.getSession().then(({ data }) => {
      if (mountedRef.current) {
        syncSessionToUser(data.session);
        setLoading(false);
      }
    });

    // Listen for changes
    const { data: listener } = client?.auth.onAuthStateChange((_event, session) => {
      if (mountedRef.current) {
        syncSessionToUser(session);
      }
    }) || { data: null };

    // Init Social Login (Native)
    if (isNativeIOS()) {
      SocialLogin.initialize({ apple: {} }).catch(() => console.warn("SocialLogin init failed"));
    }

    return () => {
      mountedRef.current = false;
      listener?.subscription.unsubscribe();
    };
  }, [syncSessionToUser]);

  // -------------------- Actions --------------------

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Auth Client nicht verfügbar." };

    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    // Session update logic handled by onAuthStateChange
    return { ok: true };
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Auth Client nicht verfügbar." };

    const { error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          plan: "free", // Default
        }
      }
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "Auth Client nicht verfügbar." };

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password", // Ensure this route exists or client handles it
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    const client = getSupabaseClient();
    await client?.auth.signOut();
    // onAuthStateChange will handle state clear
    // Force clear locally just in case
    setUser(null);
    clearActiveSession();
  }, []);

  // -------------------- Apple --------------------
  // Note: For a "Pure Supabase" pivot, Apple Login should ideally exchange token with Supabase.
  // Since we don't have the backend config verified, we will try to sign in with ID token if available,
  // or fallback to a limited local session (WITHOUT PASSWORD) if strictly necessary. 
  // Given the "Security Engineer" persona: I will strictly NOT store passwords.

  const loginWithApple = useCallback(async (): Promise<AuthResult> => {
    if (!isNativeIOS()) {
      return { ok: false, error: "Apple Login nur auf iOS verfügbar (Dev Stub removed for security)." };
    }

    try {
      const result = await SocialLogin.login({
        provider: "apple",
        options: { scopes: ["email", "name"] },
      });

      const profile = (result as any)?.result?.profile;
      const idToken = (result as any)?.result?.response?.identityToken;

      if (!idToken) return { ok: false, error: "Kein Identity Token erhalten." };

      const client = getSupabaseClient();
      if (!client) return { ok: false, error: "Supabase Client fehlt." };

      const { error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true };

    } catch (e: any) {
      return { ok: false, error: e.message || "Apple Login fehlgeschlagen." };
    }
  }, []);

  const setUserPro = useCallback(async (isPro: boolean) => {
    // Attempt to update metadata in Supabase
    // This often requires RLS policies allowing users to update their own metadata
    const client = getSupabaseClient();
    if (!client) return;

    try {
      await client.auth.updateUser({
        data: { plan: isPro ? "pro" : "free" }
      });
      // Listener will pick up change
    } catch {
      console.warn("Could not update user metadata. RLS might block this.");
    }
  }, []);

  const value = useMemo(() => ({
    user,
    login,
    register,
    requestPasswordReset,
    loginWithApple,
    logout,
    setUserPro,
    loading
  }), [user, login, register, requestPasswordReset, loginWithApple, logout, setUserPro, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
