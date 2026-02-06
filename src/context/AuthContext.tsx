// src/context/AuthContext.tsx
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { clearActiveSession, setActiveSession } from "../utils/session";
import { migrateUserStorage } from "../utils/scopedStorage";
import { getSupabaseClient } from "../lib/supabaseClient";
import { signOutSupabase } from "../services/supabaseAuth";
import { getOnboardingStatus, cacheOnboardingCompleted, clearOnboardingCache } from "../utils/onboardingPersistence";
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

export type AuthResult = { ok: boolean; error?: string; session?: Session | null; user?: User | null };

export type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string, data?: { full_name?: string }) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  loginWithApple: () => Promise<AuthResult>;
  logout: () => void;
  setUserPro: (isPro: boolean) => void;
  completeOnboardingLocal: () => void; // @deprecated
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  loginAsDemoUser: () => Promise<void>;
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
      clearOnboardingCache(); // ✅ Clear cache on logout
      return;
    }

    const u = session.user;
    const isPro = u.app_metadata?.plan === "pro" || u.user_metadata?.plan === "pro";

    // ✅ Get onboarding status with fallback to cache
    // Fix: Validates DB vs Cache to prevent loops
    let onboardingCompleted = false;
    const client = getSupabaseClient();
    const cachedStatus = getOnboardingStatus(u.id);

    if (client) {
      try {
        const { data } = await client.from('profiles').select('onboarding_completed').eq('id', u.id).single();
        if (data) {
          // If DB is true, trust it
          if (data.onboarding_completed) {
            onboardingCompleted = true;
            cacheOnboardingCompleted(u.id);
          } else {
            // DB is false. Check cache for optimistic completion
            if (cachedStatus.completed) {
              console.warn("[AuthContext] Optimistic onboarding override: Cache=true, DB=false");
              onboardingCompleted = true;
            } else {
              onboardingCompleted = false;
            }
          }
        } else {
          // No profile found? Use cache
          onboardingCompleted = cachedStatus.completed;
        }
      } catch (e) {
        // Fallback to cache if DB fails
        onboardingCompleted = cachedStatus.completed;
        console.warn("[AuthContext] Using cached onboarding status (DB Error):", cachedStatus.source);
      }
    } else {
      // No client - use cache
      onboardingCompleted = cachedStatus.completed;
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

    // ✅ Prevent unnecessary re-renders (Fix for Error #310)
    setUser((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(authUser)) {
        return prev;
      }
      return authUser;
    });

    setActiveSession({ userId: authUser.id, isPro: !!isPro, email: authUser.email });
    migrateUserStorage(authUser.id);
  }, []);

  const loginAsDemoUser = useCallback(async (): Promise<void> => {
    const mockUser: AuthUser = {
      id: "apple-review-id",
      provider: "email",
      email: "apple@trainq.app",
      displayName: "Apple Review",
      isPro: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      onboardingCompleted: true
    };

    // Persist the "Lie"
    localStorage.setItem("isDemoSession", "true");
    setActiveSession({ userId: mockUser.id, isPro: true, email: mockUser.email });
    setUser(mockUser);
  }, []);

  // 1. Init Listener - ROBUST IMPLEMENTATION (Fixes Error #310)
  // 1. Init Listener - OPTIMIZED FOR PERSISTENCE
  useEffect(() => {
    if (!mountedRef.current) return;

    const client = getSupabaseClient();

    // A. Demo Session Bypass (Local Only)
    if (localStorage.getItem("isDemoSession") === "true") {
      console.log("[Auth] Restoring Demo Session...");
      loginAsDemoUser();
      setLoading(false);
      return;
    }

    // B. Supabase Session (Persistent)
    if (!client) {
      console.warn("[Auth] No client available, stopping load.");
      setLoading(false);
      return;
    }

    // 1. Check active session immediately (Async)
    client.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;
      console.log("[Auth] Initial session restored:", !!session);
      await syncSessionToUser(session);
      setLoading(false);
    }).catch((err) => {
      console.error("[Auth] Session restore failed:", err);
      if (mountedRef.current) setLoading(false);
    });

    // 2. Listen for changes (Login, Logout, Auto-Refresh)
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      // Note: We don't set loading=false here aggressively to avoid flickering, 
      // but strictly sync the user state.
      syncSessionToUser(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncSessionToUser, loginAsDemoUser]);

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

    const { error, data } = await client.auth.signInWithPassword({
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

    return { ok: true, session: data.session, user: data.user };
  }, [getSafeClient]);

  const register = useCallback(async (email: string, password: string, data?: { full_name?: string }): Promise<AuthResult> => {
    const client = getSafeClient();
    if (!client) return { ok: false, error: "Verbindungsfehler: Auth-Dienst nicht verfügbar." };

    const { error, data: authData } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          plan: "free", // Default
          ...data,
        }
      }
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, session: authData.session, user: authData.user };
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
    localStorage.removeItem("isDemoSession");
    setUser(null);
    clearActiveSession();
  }, [getSafeClient]);

  // -------------------- Apple --------------------

  const loginWithApple = useCallback(async (): Promise<AuthResult> => {
    if (!isNativeIOS()) {
      return { ok: false, error: "Apple Sign-In is only available on iOS devices." };
    }

    try {
      // Defined locally to match partial responses from different plugin versions
      type AppleResponse = {
        result?: {
          profile?: unknown;
          response?: { identityToken?: string };
          idToken?: string;
          credential?: { identityToken?: string };
          nonce?: string;
        };
      };

      const result = (await SocialLogin.login({
        provider: "apple",
        options: { scopes: ["email", "name"] },
      })) as AppleResponse;

      console.log("Apple Login Result:", JSON.stringify(result));

      // Extract identityToken - check multiple potential paths based on plugin version/platform
      let idToken = result.result?.response?.identityToken;
      if (!idToken) {
        idToken = result.result?.idToken;
      }
      if (!idToken && result.result?.credential?.identityToken) {
        idToken = result.result?.credential?.identityToken;
      }

      if (!idToken) {
        console.error("Apple Sign-In failed: No identityToken found in result.", result);
        return { ok: false, error: "Kein Identity Token erhalten." };
      }

      const client = getSafeClient();
      if (!client) return { ok: false, error: "Systemfehler: Auth-Dienst nicht bereitzustellen." };

      const nonce = result.result?.nonce;

      const { error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        nonce: nonce, // Forward nonce if present (critical for validation)
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true };

    } catch (e: any) {
      // Keep 'any' for catch clause types as they are unknown by default
      return { ok: false, error: e?.message || "Apple Login fehlgeschlagen." };
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

  const completeOnboarding = useCallback(async (): Promise<void> => {
    // 1. Optimistic Update (Local State & Cache)
    setUser((prev) => {
      if (!prev) return null;
      // Write to localStorage immediately
      cacheOnboardingCompleted(prev.id);
      return { ...prev, onboardingCompleted: true };
    });

    // 2. Persist to Database (Async)
    const client = getSafeClient();
    if (client && user?.id) {
      try {
        await client.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
      } catch (e) {
        console.error("Failed to persist onboarding status to DB", e);
        // Note: We keep the local state as true to not block the user
      }
    }
  }, [user?.id, getSafeClient]);

  const resetOnboarding = useCallback(async (): Promise<void> => {
    if (!user) return;

    // 1. Clear Local Cache
    clearOnboardingCache();

    // 2. Update Local State
    setUser((prev) => prev ? { ...prev, onboardingCompleted: false } : null);

    // 3. Update Database
    const client = getSafeClient();
    if (client) {
      try {
        await client.from('profiles').update({ onboarding_completed: false }).eq('id', user.id);
      } catch (e) {
        console.error("Failed to reset onboarding in DB", e);
      }
    }
  }, [user, getSafeClient]);



  const value = useMemo(() => ({
    user,
    login,
    register,
    requestPasswordReset,
    loginWithApple,
    logout,
    setUserPro,
    completeOnboardingLocal: completeOnboarding, // Deprecated name kept for compatibility if needed, but implementation updated
    completeOnboarding,
    resetOnboarding,
    loginAsDemoUser,
    loading
  }), [user, login, register, requestPasswordReset, loginWithApple, logout, setUserPro, completeOnboarding, resetOnboarding, loginAsDemoUser, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return context;
};
