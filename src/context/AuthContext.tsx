// src/context/AuthContext.tsx
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  SignInWithApple,
  type SignInWithAppleOptions,
  type SignInWithAppleResponse,
} from "@capacitor-community/apple-sign-in";

export type AuthProvider = "email" | "apple";

export type AuthUser = {
  id: string;
  provider: AuthProvider;
  email?: string;
  displayName?: string;
  isPro?: boolean;

  // Apple stable identifier for this app (response.user)
  appleSub?: string;

  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export type AuthResult = { ok: boolean; error?: string };

export type AuthContextValue = {
  user: AuthUser | null;

  // Email/Password
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;

  // Apple
  loginWithApple: () => Promise<AuthResult>;

  // Session
  logout: () => void;

  // Account flags
  setUserPro: (isPro: boolean) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

// -------------------- Storage Keys --------------------

const LS_USERS = "trainq_auth_users_v1";
const LS_SESSION = "trainq_auth_session_v1"; // { userId: string }
const LS_APPLE_SUB = "trainq_auth_apple_sub_v1";

// -------------------- Helpers --------------------

function nowISO(): string {
  return new Date().toISOString();
}

function uuidFallback(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function newId(prefix = "u"): string {
  // randomUUID ist nicht überall garantiert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  return uuidFallback(prefix);
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readUsers(): AuthUser[] {
  if (typeof window === "undefined") return [];
  return safeParse<AuthUser[]>(window.localStorage.getItem(LS_USERS), []);
}

function writeUsers(users: AuthUser[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_USERS, JSON.stringify(users));
  } catch {
    // ignore
  }
}

function readSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  const s = safeParse<{ userId?: string }>(window.localStorage.getItem(LS_SESSION), {});
  return typeof s.userId === "string" && s.userId.trim() ? s.userId : null;
}

function writeSessionUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!userId) window.localStorage.removeItem(LS_SESSION);
    else window.localStorage.setItem(LS_SESSION, JSON.stringify({ userId }));
  } catch {
    // ignore
  }
}

function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

// Für dein MVP okay (lokal), aber: in Produktion nicht plaintext speichern.
type StoredUserRecord = AuthUser & { password?: string };

function readStoredUsers(): StoredUserRecord[] {
  return readUsers() as StoredUserRecord[];
}

function writeStoredUsers(users: StoredUserRecord[]) {
  writeUsers(users as AuthUser[]);
}

function seedDefaultTestAccountsIfMissing() {
  const users = readStoredUsers();
  if (users.some((u) => u.provider === "email" && u.email)) return;

  const t = nowISO();

  const seeded: StoredUserRecord[] = [
    {
      id: newId("u"),
      provider: "email",
      email: "pro01@testflight.trainq",
      displayName: "Pro 01",
      isPro: true,
      password: "trainq1234",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId("u"),
      provider: "email",
      email: "pro02@testflight.trainq",
      displayName: "Pro 02",
      isPro: true,
      password: "trainq1234",
      createdAt: t,
      updatedAt: t,
    },
    {
      id: newId("u"),
      provider: "email",
      email: "free01@testflight.trainq",
      displayName: "Free 01",
      isPro: false,
      password: "trainq1234",
      createdAt: t,
      updatedAt: t,
    },
  ];

  writeStoredUsers([...users, ...seeded]);
}

function buildDisplayNameFromApple(email?: string, given?: string, family?: string): string {
  const n = `${String(given ?? "").trim()} ${String(family ?? "").trim()}`.trim();
  if (n) return n;
  if (email && email.includes("@")) return email.split("@")[0] || "Apple User";
  return "Apple User";
}

function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

function env(key: string): string {
  // Vite env
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (import.meta as any)?.env?.[key];
  return String(v ?? "").trim();
}

function randomState(prefix = "st") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// -------------------- Provider --------------------

export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mountedRef = useRef(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  const sanitizeUser = (u: StoredUserRecord): AuthUser => {
    // Passwort niemals in den React-State übernehmen
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = u;
    return rest;
  };

  const persistAndSetUser = useCallback((u: StoredUserRecord | null) => {
    if (!mountedRef.current) return;
    if (!u) {
      setUser(null);
      writeSessionUserId(null);
      return;
    }
    setUser(sanitizeUser(u));
    writeSessionUserId(u.id);
  }, []);

  // Init: Seed + Session restore
  useEffect(() => {
    mountedRef.current = true;

    seedDefaultTestAccountsIfMissing();

    const sessionUserId = readSessionUserId();
    if (sessionUserId) {
      const users = readStoredUsers();
      const found = users.find((u) => u.id === sessionUserId) ?? null;
      setUser(found ? sanitizeUser(found) : null);
      if (!found) writeSessionUserId(null);
    } else {
      setUser(null);
    }

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- Email/Password --------------------

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const e = normalizeEmail(email);
      const p = String(password ?? "");

      if (!e) return { ok: false, error: "Bitte E-Mail eingeben." };
      if (!p) return { ok: false, error: "Bitte Passwort eingeben." };

      const users = readStoredUsers();
      const found = users.find((u) => u.provider === "email" && normalizeEmail(u.email ?? "") === e);

      if (!found) return { ok: false, error: "Account nicht gefunden." };
      if ((found as StoredUserRecord).password !== p) return { ok: false, error: "Passwort ist falsch." };

      persistAndSetUser(found);
      return { ok: true };
    },
    [persistAndSetUser]
  );

  const register = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const e = normalizeEmail(email);
      const p = String(password ?? "");

      if (!e) return { ok: false, error: "Bitte E-Mail eingeben." };
      if (p.length < 6) return { ok: false, error: "Passwort muss mindestens 6 Zeichen haben." };

      const users = readStoredUsers();
      const exists = users.some((u) => u.provider === "email" && normalizeEmail(u.email ?? "") === e);
      if (exists) return { ok: false, error: "Diese E-Mail ist bereits registriert." };

      const t = nowISO();
      const created: StoredUserRecord = {
        id: newId("u"),
        provider: "email",
        email: e,
        displayName: e.split("@")[0] || "User",
        isPro: false,
        password: p,
        createdAt: t,
        updatedAt: t,
      };

      writeStoredUsers([...users, created]);
      persistAndSetUser(created);
      return { ok: true };
    },
    [persistAndSetUser]
  );

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const e = normalizeEmail(email);
    if (!e) return { ok: false, error: "Bitte E-Mail eingeben." };

    // MVP (lokal) – kein echter Mailversand.
    const users = readStoredUsers();
    const exists = users.some((u) => u.provider === "email" && normalizeEmail(u.email ?? "") === e);
    if (!exists) return { ok: false, error: "Account nicht gefunden." };

    return { ok: true };
  }, []);

  // -------------------- Apple (REAL on iOS) + fallback --------------------

  const loginWithApple = useCallback(async (): Promise<AuthResult> => {
    if (typeof window === "undefined") return { ok: false, error: "Apple Login ist hier nicht verfügbar." };

    // ✅ Real Apple flow (native iOS)
    if (isNativeIOS()) {
      try {
        const clientId = env("VITE_APPLE_CLIENT_ID");
        const redirectURI = env("VITE_APPLE_REDIRECT_URI");

        if (!clientId) return { ok: false, error: "Apple Login: VITE_APPLE_CLIENT_ID fehlt." };
        if (!redirectURI) return { ok: false, error: "Apple Login: VITE_APPLE_REDIRECT_URI fehlt." };

        const options: SignInWithAppleOptions = {
          clientId,
          redirectURI,
          // ✅ FIX: diese Plugin-Version erwartet einen String (nicht string[])
          scopes: "email name",
          state: randomState("state"),
          nonce: randomState("nonce"),
        };

        const result: SignInWithAppleResponse = await SignInWithApple.authorize(options);

        const r = result?.response;
        const appleSub = r?.user;
        if (!appleSub) return { ok: false, error: "Apple Login: Keine User-ID erhalten." };

        const email = r?.email ?? undefined; // häufig nur beim ersten Mal
        const givenName = r?.givenName ?? undefined;
        const familyName = r?.familyName ?? undefined;
        const displayName = buildDisplayNameFromApple(email, givenName, familyName);

        // optionaler Cache
        try {
          window.localStorage.setItem(LS_APPLE_SUB, JSON.stringify(appleSub));
        } catch {
          // ignore
        }

        const users = readStoredUsers();
        let found = users.find((u) => u.provider === "apple" && u.appleSub === appleSub);

        const t = nowISO();

        if (!found) {
          const created: StoredUserRecord = {
            id: newId("u"),
            provider: "apple",
            appleSub,
            email,
            displayName,
            isPro: false,
            createdAt: t,
            updatedAt: t,
          };

          writeStoredUsers([...users, created]);
          persistAndSetUser(created);
          return { ok: true };
        }

        // Update nur auffüllen, wenn Apple neue Infos liefert
        const updated: StoredUserRecord = {
          ...found,
          email: found.email || email,
          displayName: found.displayName || displayName,
          updatedAt: t,
        };

        const nextUsers = users.map((u) => (u.id === found!.id ? updated : u));
        writeStoredUsers(nextUsers);
        persistAndSetUser(updated);

        return { ok: true };
      } catch (e: any) {
        const msg = String(e?.message ?? "Apple Login fehlgeschlagen.");
        const low = msg.toLowerCase();
        if (low.includes("canceled") || low.includes("cancelled")) return { ok: false, error: "Abgebrochen." };
        return { ok: false, error: msg };
      }
    }

    // ✅ Fallback für Browser/Dev (damit du weiter testen kannst)
    let sub = safeParse<string | null>(window.localStorage.getItem(LS_APPLE_SUB), null);
    if (!sub) sub = `apple-stub-${newId("sub")}`;

    try {
      window.localStorage.setItem(LS_APPLE_SUB, JSON.stringify(sub));
    } catch {
      // ignore
    }

    const users = readStoredUsers();
    let found = users.find((u) => u.provider === "apple" && u.appleSub === sub);

    if (!found) {
      const t = nowISO();
      const created: StoredUserRecord = {
        id: newId("u"),
        provider: "apple",
        appleSub: sub,
        displayName: "Apple User",
        isPro: false,
        createdAt: t,
        updatedAt: t,
      };
      writeStoredUsers([...users, created]);
      found = created;
    }

    persistAndSetUser(found);
    return { ok: true };
  }, [persistAndSetUser]);

  // -------------------- Session / Flags --------------------

  const logout = useCallback(() => {
    persistAndSetUser(null);
  }, [persistAndSetUser]);

  const setUserPro = useCallback(
    (isPro: boolean) => {
      if (!user) return;

      const users = readStoredUsers();
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx < 0) return;

      const updated: StoredUserRecord = {
        ...users[idx],
        isPro: !!isPro,
        updatedAt: nowISO(),
      };

      const next = [...users];
      next[idx] = updated;
      writeStoredUsers(next);

      persistAndSetUser(updated);
    },
    [user, persistAndSetUser]
  );

  const value: AuthContextValue = useMemo(
    () => ({
      user,
      login,
      register,
      requestPasswordReset,
      loginWithApple,
      logout,
      setUserPro,
    }),
    [user, login, register, requestPasswordReset, loginWithApple, logout, setUserPro]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};