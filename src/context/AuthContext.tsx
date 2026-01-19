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
  onboardingCompleted?: boolean;
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
  completeOnboardingLocal: () => void;
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
  const syncSessionToUser = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      clearActiveSession();
      return;
    }

    const u = session.user;
    const isPro = u.app_metadata?.plan === "pro" || u.user_metadata?.plan === "pro";

    let onboardingCompleted = false;
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data } = await client.from('profiles').select('onboarding_completed').eq('id', u.id).single();
        if (data) onboardingCompleted = data.onboarding_completed;
      } catch (e) {
        // ignore
      }
    }

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
      onboardingCompleted,
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
    // Check initial session
    if (client) {
      client.auth.getSession().then(async ({ data }) => {
        if (mountedRef.current) {
          await syncSessionToUser(data.session);
          setLoading(false);
        }
      }).catch((err) => {
        console.error("Auth init session error:", err);
        if (mountedRef.current) setLoading(false);
      });
    } else {
      // Missing env vars or client init failed
      console.warn("Supabase client missing in AuthContext");
      setLoading(false);
    }

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

  // -------------------- Safe Client Access --------------------

  const getSafeClient = useCallback((): ReturnType<typeof getSupabaseClient> => {
    // Attempt to get client
    let client = getSupabaseClient();

    // If missing, try one forced re-init (though getSupabaseClient handles this, being explicit doesn't hurt)
    if (!client) {
      console.warn("AuthContext: Client is null, re-requesting...");
      client = getSupabaseClient();
    }

    if (!client) {
      console.error("CRITICAL: Supabase Client Unavailable. Check VITE_SUPABASE_URL.");
    }
    return client;
  }, []);

  // -------------------- Actions --------------------

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = getSafeClient();
    if (!client) return { ok: false, error: "Verbindungsfehler: Auth-Dienst nicht verfügbar (Client missing)." };

    // Clean inputs to avoid whitespace issues
    const cleanEmail = email.trim();

    const { error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      console.warn("Login Failed:", error.message);
      // Enhance error message for end-users
      if (error.message.includes("Invalid login credentials")) {
        return { ok: false, error: "Falsche E-Mail oder Passwort." };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true };
  }, [getSafeClient]);

  const register = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = getSafeClient();
    if (!client) return { ok: false, error: "Verbindungsfehler: Auth-Dienst nicht verfügbar." };

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
  }, [getSafeClient]);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const client = getSafeClient();
    if (!client) return { ok: false, error: "Verbindungsfehler: Auth-Dienst nicht verfügbar." };

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, [getSafeClient]);

  const logout = useCallback(async () => {
    const client = getSafeClient();
    await client?.auth.signOut();
    setUser(null);
    clearActiveSession();
  }, [getSafeClient]);

  // -------------------- Apple --------------------

  const loginWithApple = useCallback(async (): Promise<AuthResult> => {
    if (!isNativeIOS()) {
      return { ok: false, error: "Apple Sign-In is only available on iOS devices." };
    }

    try {
      const result = await SocialLogin.login({
        provider: "apple",
        options: { scopes: ["email", "name"] },
      });
      console.log("Apple Login Result:", JSON.stringify(result));

      const profile = (result as any)?.result?.profile;
      // Extract identityToken - check multiple potential paths based on plugin version/platform
      let idToken = (result as any)?.result?.response?.identityToken;
      if (!idToken) {
        idToken = (result as any)?.result?.idToken;
      }
      if (!idToken && (result as any)?.result?.credential?.identityToken) {
        idToken = (result as any)?.result?.credential?.identityToken;
      }

      if (!idToken) {
        console.error("Apple Sign-In failed: No identityToken found in result.", result);
        return { ok: false, error: "Kein Identity Token erhalten." };
      }

      const client = getSafeClient();
      if (!client) return { ok: false, error: "Systemfehler: Auth-Dienst nicht bereitzustellen." };

      const nonce = (result as any)?.result?.nonce;

      const { error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        nonce: nonce, // Forward nonce if present (critical for validation)
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true };

    } catch (e: any) {
      return { ok: false, error: e.message || "Apple Login fehlgeschlagen." };
    }
  }, [getSafeClient]);

  const setUserPro = useCallback(async (isPro: boolean) => {
    // Attempt to update metadata in Supabase
    // This often requires RLS policies allowing users to update their own metadata
    const client = getSafeClient();
    if (!client) return;

    try {
      await client.auth.updateUser({
        data: { plan: isPro ? "pro" : "free" }
      });
      // Listener will pick up change
    } catch {
      console.warn("Could not update user metadata. RLS might block this.");
    }
  }, [getSafeClient]);

  const completeOnboardingLocal = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, onboardingCompleted: true } : null));
  }, []);

  const value = useMemo(() => ({
    user,
    login,
    register,
    requestPasswordReset,
    loginWithApple,
    logout,
    setUserPro,
    completeOnboardingLocal,
    loading
  }), [user, login, register, requestPasswordReset, loginWithApple, logout, setUserPro, completeOnboardingLocal, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
