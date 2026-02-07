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

export type AuthProvider = "email" | "apple" | "local";

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

const LOCAL_USER_KEY = "trainq_local_user_v1";

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
      // Don't nullify immediately, wait for local fallback check in effect
      return;
    }

    const u = session.user;
    const isPro = u.app_metadata?.plan === "pro" || u.user_metadata?.plan === "pro";

    // ✅ Get onboarding status with fallback to cache
    let onboardingCompleted = false;
    const client = getSupabaseClient();
    const cachedStatus = getOnboardingStatus(u.id);

    if (client) {
      try {
        const { data } = await client.from('profiles').select('onboarding_completed').eq('id', u.id).single();
        if (data) {
          if (data.onboarding_completed) {
            onboardingCompleted = true;
            cacheOnboardingCompleted(u.id);
          } else {
            if (cachedStatus.completed) {
              console.warn("[AuthContext] Optimistic onboarding override: Cache=true, DB=false");
              onboardingCompleted = true;
            }
          }
        } else {
          onboardingCompleted = cachedStatus.completed;
        }
      } catch (e) {
        onboardingCompleted = cachedStatus.completed;
      }
    } else {
      onboardingCompleted = cachedStatus.completed;
    }

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

    setUser((prev) => {
      if (prev && JSON.stringify(prev) === JSON.stringify(authUser)) {
        return prev;
      }
      return authUser;
    });

    setActiveSession({ userId: authUser.id, isPro: !!isPro, email: authUser.email });
    migrateUserStorage(authUser.id);
  }, []);

  const ensureLocalUser = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_USER_KEY);
      if (raw) {
        const localUser = JSON.parse(raw) as AuthUser;
        console.log("[Auth] Restored local user:", localUser.id);
        setUser(localUser);
        setActiveSession({ userId: localUser.id, isPro: !!localUser.isPro, email: localUser.email });
        return;
      }

      // Create new local user
      const newId = `local_${crypto.randomUUID()}`;
      const newUser: AuthUser = {
        id: newId,
        provider: "local",
        displayName: "Gast",
        isPro: true, // Default to PRO for local/offline users as requested ("Apple-only, local-first" implies premium experience)
        createdAt: new Date().toISOString(),
        onboardingCompleted: false
      };

      console.log("[Auth] Created new local user:", newUser.id);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newUser));
      setUser(newUser);
      setActiveSession({ userId: newUser.id, isPro: true, email: undefined });
    } catch (e) {
      console.error("[Auth] Failed to ensure local user:", e);
    }
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
    localStorage.setItem("isDemoSession", "true");
    setActiveSession({ userId: mockUser.id, isPro: true, email: mockUser.email });
    setUser(mockUser);
  }, []);

  // 1. Init Listener
  useEffect(() => {
    if (!mountedRef.current) return;

    const client = getSupabaseClient();

    // A. Demo Session
    if (localStorage.getItem("isDemoSession") === "true") {
      loginAsDemoUser();
      setLoading(false);
      return;
    }

    // B. Supabase Session
    if (!client) {
      // Fallback to local if no client
      ensureLocalUser();
      setLoading(false);
      return;
    }

    client.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;
      if (session) {
        await syncSessionToUser(session);
      } else {
        // ✅ No Session -> Local User Fallback
        ensureLocalUser();
      }
      setLoading(false);
    }).catch((err) => {
      console.error("[Auth] Session restore failed:", err);
      // Fallback on error too
      ensureLocalUser();
      if (mountedRef.current) setLoading(false);
    });

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      if (session) {
        syncSessionToUser(session);
      }
      // Note: If session is null (logout), we deliberately don't auto-create a local user here immediately
      // to avoid weird UX loops. Logout action handles cleanup.
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncSessionToUser, loginAsDemoUser, ensureLocalUser]);

  const getSafeClient = useCallback((): ReturnType<typeof getSupabaseClient> => {
    let client = getSupabaseClient();
    if (!client) {
      client = getSupabaseClient();
    }
    return client;
  }, []);

  // -------------------- Actions --------------------

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = getSafeClient();
    if (!client) return { ok: false, error: "Verbindungsfehler." };

    const { error, data } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, session: data.session, user: data.user };
  }, [getSafeClient]);

  const register = useCallback(async (email: string, password: string, data?: { full_name?: string }): Promise<AuthResult> => {
    const client = getSafeClient();
    if (!client) return { ok: false, error: "Verbindungsfehler." };

    const { error, data: authData } = await client.auth.signUp({
      email,
      password,
      options: { data: { plan: "free", ...data } }
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, session: authData.session, user: authData.user };
  }, [getSafeClient]);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const client = getSafeClient();
    if (!client) return { ok: false, error: "Verbindungsfehler." };
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/reset-password" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }, [getSafeClient]);

  const logout = useCallback(async () => {
    const client = getSafeClient();
    await client?.auth.signOut();
    localStorage.removeItem("isDemoSession");
    localStorage.removeItem(LOCAL_USER_KEY); // Clear local user too
    setUser(null);
    clearActiveSession();
    // Force reload to trigger ensureLocalUser() again and restart clean
    window.location.reload();
  }, [getSafeClient]);

  // -------------------- Apple --------------------

  const loginWithApple = useCallback(async (): Promise<AuthResult> => {
    if (!isNativeIOS()) {
      return { ok: false, error: "Apple Sign-In is only available on iOS devices." };
    }

    try {
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

      // Extract identityToken
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

      const { error, data } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        nonce: nonce,
      });

      if (error) return { ok: false, error: error.message };
      return { ok: true, session: data.session, user: data.user };

    } catch (e: any) {
      return { ok: false, error: e?.message || "Apple Login fehlgeschlagen." };
    }
  }, [getSafeClient]);

  const setUserPro = useCallback(async (isPro: boolean) => {
    // 1. Handle Local User
    if (user?.provider === 'local') {
      const updated = { ...user, isPro };
      setUser(updated);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
      return;
    }

    // 2. Handle Supabase User
    const client = getSafeClient();
    if (!client) return;

    try {
      // Attempt to update metadata
      await client.auth.updateUser({
        data: { plan: isPro ? "pro" : "free" }
      });
      // Also try updating profile table if it exists, though trigger usually handles sync
      await client.from('profiles').update({ is_pro: isPro }).eq('id', user?.id);
    } catch (e) {
      console.warn("Could not update user metadata/profile.", e);
    }
  }, [user, getSafeClient]);

  const completeOnboarding = useCallback(async (): Promise<void> => {
    if (!user) return;

    // 1. Update State
    const updatedUser = { ...user, onboardingCompleted: true };
    setUser(updatedUser);

    // 2. Persist Local
    if (user.provider === 'local') {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updatedUser));
    } else {
      cacheOnboardingCompleted(user.id);
      const client = getSafeClient();
      if (client) {
        try {
          await client.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
        } catch (e) { console.error(e); }
      }
    }
  }, [user, getSafeClient]);

  const resetOnboarding = useCallback(async (): Promise<void> => {
    if (!user) return;
    const updatedUser = { ...user, onboardingCompleted: false };
    setUser(updatedUser);

    if (user.provider === 'local') {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updatedUser));
    } else {
      clearOnboardingCache();
      const client = getSafeClient();
      if (client) await client.from('profiles').update({ onboarding_completed: false }).eq('id', user.id);
    }
  }, [user, getSafeClient]);

  const value = useMemo(() => ({
    user,
    login,
    register,
    requestPasswordReset,
    loginWithApple, // Keeping original ref if possible, or needing full mock
    logout,
    setUserPro,
    completeOnboardingLocal: completeOnboarding,
    completeOnboarding,
    resetOnboarding,
    loginAsDemoUser,
    loading
  }), [user, login, register, requestPasswordReset, loginWithApple, logout, setUserPro, completeOnboarding, resetOnboarding, loginAsDemoUser, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthContextProvider");
  return context;
};
