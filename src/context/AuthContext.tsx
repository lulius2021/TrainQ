// src/context/AuthContext.tsx
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SocialLogin } from "@capgo/capacitor-social-login";
import { clearActiveSession, setActiveSession } from "../utils/session";
import { migrateUserStorage, clearUserScopedData } from "../utils/scopedStorage";
import { getSupabaseClient } from "../lib/supabaseClient";
import { authStorageAdapter } from "../lib/authStorageAdapter";
import { pullAndMerge } from "../services/nutritionSync";
import { signOutSupabase } from "../services/supabaseAuth";
import { getOnboardingStatus, cacheOnboardingCompleted, clearOnboardingCache } from "../utils/onboardingPersistence";
import { hasActiveChallengeGrant } from "../utils/challengeStore";
import { ensureCommunityProfile } from "../services/community/api";
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
const CACHED_AUTH_KEY = "trainq_cached_auth_v1";

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
    const isPro = u.app_metadata?.plan === "pro" || u.user_metadata?.plan === "pro" || hasActiveChallengeGrant();

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

    // Cache for optimistic auth on next cold start
    try { localStorage.setItem(CACHED_AUTH_KEY, JSON.stringify(authUser)); } catch { /* ignore */ }

    setActiveSession({ userId: authUser.id, isPro: !!isPro, email: authUser.email });
    migrateUserStorage(authUser.id);
    pullAndMerge().catch((e) => { if (import.meta.env.DEV) console.warn("[Auth] pullAndMerge failed:", e); });

    // Ensure community profile exists so user appears in "Entdecken"
    const handle = u.email?.split("@")[0] || `user_${u.id.slice(0, 6)}`;
    const displayName = u.user_metadata?.full_name || handle;
    ensureCommunityProfile(u.id, handle, displayName).catch(() => {});
  }, []);

  const ensureLocalUser = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_USER_KEY);
      if (raw) {
        const localUser = JSON.parse(raw) as AuthUser;

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


      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newUser));
      setUser(newUser);
      setActiveSession({ userId: newUser.id, isPro: true, email: undefined });
    } catch (e) {
      if (import.meta.env.DEV) console.error("[Auth] Failed to ensure local user:", e);
    }
  }, []);

  const loginAsDemoUser = useCallback(async (): Promise<void> => {
    if (!import.meta.env.DEV) return;
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
    localStorage.setItem("isDemoSession", "trainq_demo_2026");
    setActiveSession({ userId: mockUser.id, isPro: true, email: mockUser.email });
    setUser(mockUser);
  }, []);

  // 0. Initialize SocialLogin (required by @capgo/capacitor-social-login v8 before any login call)
  useEffect(() => {
    if (!isNativeIOS()) return;
    SocialLogin.initialize({ apple: { clientId: "com.trainq.app" } }).catch(() => {});
  }, []);

  // 1. Init Listener
  useEffect(() => {
    let cancelled = false;

    const client = getSupabaseClient();

    // A. Demo Session
    if (import.meta.env.DEV && localStorage.getItem("isDemoSession") === "trainq_demo_2026") {
      loginAsDemoUser();
      setLoading(false);
      return;
    }

    // B. Supabase Session
    if (!client) {
      ensureLocalUser();
      setLoading(false);
      return;
    }

    // Optimistic auth: if we have a cached Supabase user, show the app immediately
    // while we verify the session in the background.
    try {
      const cached = localStorage.getItem(CACHED_AUTH_KEY);
      if (cached) {
        const cachedUser = JSON.parse(cached) as AuthUser;
        if (cachedUser?.id && cachedUser?.provider !== "local") {
          setUser(cachedUser);
          setActiveSession({ userId: cachedUser.id, isPro: !!cachedUser.isPro, email: cachedUser.email });
          setLoading(false);
        }
      }
    } catch { /* ignore */ }

    // Hard safety: loading NEVER stays stuck longer than 2s
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
      }
    }, 2000);

    const init = async () => {
      try {
        const { data: { session } } = await client.auth.getSession();
        if (cancelled) return;
        if (session) {
          await syncSessionToUser(session);
        } else {
          // No valid session — show login screen
          try { localStorage.removeItem(CACHED_AUTH_KEY); } catch { /* ignore */ }
          setUser(null);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error("[Auth] Session restore failed:", err);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) {
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      }
    };

    init();

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session) {
        syncSessionToUser(session);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
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
    try {
      await client?.auth.signOut();
    } catch {
      // signOut may fail if network is unavailable — proceed with local cleanup
    }
    // Explicitly clear Supabase session from storage (handles signOut failure + SecureStorage on iOS)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (supabaseUrl) {
      const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
      try {
        await authStorageAdapter.removeItem(`sb-${projectRef}-auth-token`);
      } catch {
        // ignore
      }
    }
    // Clear scoped user data before wiping session
    const uid = user?.id;
    if (uid) {
      clearUserScopedData(uid);
    }
    localStorage.removeItem("isDemoSession");
    localStorage.removeItem(LOCAL_USER_KEY);
    localStorage.removeItem(CACHED_AUTH_KEY);
    clearActiveSession();
    setUser(null);
  }, [getSafeClient, user?.id]);

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

      if (import.meta.env.DEV) console.log("[Apple] SocialLogin.login() wird aufgerufen...");
      const result = (await SocialLogin.login({
        provider: "apple",
        options: { scopes: ["email", "name"] },
      })) as AppleResponse;

      if (import.meta.env.DEV) console.log("[Apple] Native Response erhalten:", JSON.stringify(result));

      // Extract identityToken
      let idToken = result.result?.response?.identityToken;
      if (!idToken) {
        idToken = result.result?.idToken;
      }
      if (!idToken && result.result?.credential?.identityToken) {
        idToken = result.result?.credential?.identityToken;
      }

      if (!idToken) {
        if (import.meta.env.DEV) console.error("[Apple] FEHLER: Kein identityToken in Response:", JSON.stringify(result));
        return { ok: false, error: "Kein Identity Token erhalten." };
      }

      if (import.meta.env.DEV) console.log("[Apple] idToken gefunden, Länge:", idToken.length, "— rufe Supabase signInWithIdToken auf...");

      const client = getSafeClient();
      if (!client) return { ok: false, error: "Systemfehler: Auth-Dienst nicht bereitzustellen." };

      const nonce = result.result?.nonce;

      const { error, data } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        nonce: nonce,
      });

      if (error) {
        if (import.meta.env.DEV) console.error("[Apple] Supabase signInWithIdToken FEHLER:", error.message, error);
        return { ok: false, error: error.message };
      }
      if (import.meta.env.DEV) console.log("[Apple] Supabase Login erfolgreich, User:", data.user?.id);
      return { ok: true, session: data.session, user: data.user };

    } catch (e: any) {
      const msg: string = e?.message || "";
      if (import.meta.env.DEV) console.error("[Apple] CATCH-Fehler (native layer):", msg, "— vollständiges Objekt:", JSON.stringify(e));
      // User cancelled — no error shown
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("abgebrochen") || e?.code === "1001") {
        return { ok: false };
      }
      return { ok: false, error: msg || "Apple Login fehlgeschlagen." };
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

    // Fire-and-forget — UI state already updated above; don't block on network
    client.auth.updateUser({ data: { plan: isPro ? "pro" : "free" } })
      .then(() => {})
      .catch((e: unknown) => { if (import.meta.env.DEV) console.warn("Could not update user metadata:", e); });
    client.from('profiles').update({ is_pro: isPro }).eq('id', user?.id)
      .then(() => {})
      .catch((e: unknown) => { if (import.meta.env.DEV) console.warn("Could not update profile is_pro:", e); });
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
        // Fire-and-forget — local state is already updated; don't block navigation on network
        client.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)
          .then(() => {})
          .catch((e: unknown) => { if (import.meta.env.DEV) console.error("[Auth] onboarding update failed:", e); });
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
      if (client) {
        client.from('profiles').update({ onboarding_completed: false }).eq('id', user.id)
          .then(() => {})
          .catch((e: unknown) => { if (import.meta.env.DEV) console.error("[Auth] resetOnboarding update failed:", e); });
      }
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
