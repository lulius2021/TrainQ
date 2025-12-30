// src/context/AuthContext.tsx
import React, { createContext, useEffect, useMemo, useState, useCallback } from "react";
import { findUserByEmail, getAllUsers, updateUser, type TrainQUser } from "../utils/testAccountsSeed";

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
  isPro: boolean;
  createdAt?: string;
};

type LoginResult = { ok: true } | { ok: false; error: string };

type RegisterPayload = {
  email: string;
  password: string;
  displayName?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;

  // optional (falls RegisterPage es nutzt)
  register: (payload: RegisterPayload) => Promise<LoginResult>;

  // ✅ für Paywall/Trial: macht den aktuellen Account Pro/Free
  setUserPro: (isPro: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY_CURRENT_USER = "trainq_auth_current_user_v1";
const USERS_KEY = "trainq_users_v1"; // gleiche LS key wie Seed

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

function nowISO(): string {
  return new Date().toISOString();
}

function uuidFallback(prefix = "u") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapToAuthUser(u: TrainQUser): AuthUser {
  return {
    id: String(u.id),
    email: normalizeEmail(u.email),
    displayName: u.displayName,
    isPro: u.isPro === true,
    createdAt: u.createdAt,
  };
}

function readCurrentUserFromStorage(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY_CURRENT_USER);
  const parsed = safeParse<AuthUser | null>(raw, null);
  if (!parsed || !parsed.id || !parsed.email) return null;

  return {
    id: String(parsed.id),
    email: normalizeEmail(parsed.email),
    displayName: parsed.displayName,
    isPro: parsed.isPro === true,
    createdAt: parsed.createdAt,
  };
}

function writeCurrentUserToStorage(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (!user) window.localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    else window.localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
  } catch {
    // ignore
  }
}

function readUsersDirect(): TrainQUser[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(USERS_KEY);
  const parsed = safeParse<TrainQUser[]>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeUsersDirect(users: TrainQUser[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // ignore
  }
}

function findUserById(userId: string): TrainQUser | undefined {
  const id = String(userId ?? "").trim();
  if (!id) return undefined;
  return readUsersDirect().find((u) => String(u.id) === id);
}

export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => readCurrentUserFromStorage());

  // ✅ Beim Mount: Session refresh aus trainq_users_v1 (Source of Truth)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const current = readCurrentUserFromStorage();
    if (!current?.id) return;

    const fromStore = findUserById(current.id);

    // wenn User nicht mehr existiert -> logout
    if (!fromStore) {
      setUser(null);
      writeCurrentUserToStorage(null);
      return;
    }

    // store ist source of truth (isPro, displayName, email)
    const refreshed = mapToAuthUser(fromStore);

    // nur schreiben wenn wirklich anders, um unnötige rerenders zu vermeiden
    const changed =
      refreshed.id !== current.id ||
      refreshed.email !== current.email ||
      refreshed.displayName !== current.displayName ||
      refreshed.isPro !== current.isPro;

    if (changed) {
      setUser(refreshed);
      writeCurrentUserToStorage(refreshed);
    }
  }, []);

  // Sync bei Storage-Änderungen (z.B. Debug / mehrere Tabs)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_CURRENT_USER) {
        setUser(readCurrentUserFromStorage());
        return;
      }

      // wenn Users geändert werden, den aktuellen User refreshen
      if (e.key === USERS_KEY) {
        const current = readCurrentUserFromStorage();
        if (!current?.id) return;

        const fromStore = findUserById(current.id);
        if (!fromStore) {
          setUser(null);
          writeCurrentUserToStorage(null);
          return;
        }

        const refreshed = mapToAuthUser(fromStore);
        setUser(refreshed);
        writeCurrentUserToStorage(refreshed);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const e = normalizeEmail(email);
    const pw = String(password ?? "");

    if (!e) return { ok: false, error: "Bitte E-Mail eingeben." };
    if (!pw) return { ok: false, error: "Bitte Passwort eingeben." };

    const found = findUserByEmail(e);
    if (!found) return { ok: false, error: "Account nicht gefunden (TestFlight Seed)." };

    if (String(found.password) !== pw) {
      return { ok: false, error: "Passwort falsch." };
    }

    const next = mapToAuthUser(found);
    setUser(next);
    writeCurrentUserToStorage(next);

    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    writeCurrentUserToStorage(null);
  }, []);

  // Optional: simple Register (legt Free-User in trainq_users_v1 an)
  const register = useCallback(async (payload: RegisterPayload): Promise<LoginResult> => {
    const email = normalizeEmail(payload.email);
    const password = String(payload.password ?? "");
    const displayName = String(payload.displayName ?? "").trim();

    if (!email) return { ok: false, error: "Bitte E-Mail eingeben." };
    if (!password || password.length < 4) return { ok: false, error: "Bitte ein Passwort (min. 4 Zeichen) wählen." };

    const existing = findUserByEmail(email);
    if (existing) return { ok: false, error: "Diese E-Mail ist bereits registriert." };

    const users = getAllUsers();
    const newUser: TrainQUser = {
      id: uuidFallback("user"),
      email,
      password,
      displayName: displayName || email.split("@")[0],
      isPro: false,
      createdAt: nowISO(),
    };

    // keine createUser-API -> direkt speichern
    writeUsersDirect([...users, newUser]);

    // direkt einloggen
    const authUser = mapToAuthUser(newUser);
    setUser(authUser);
    writeCurrentUserToStorage(authUser);

    return { ok: true };
  }, []);

  const setUserPro = useCallback(
    (isPro: boolean) => {
      if (!user?.id) return;

      // ✅ Account-Store updaten (Source of Truth)
      const updated = updateUser(user.id, { isPro });

      if (updated) {
        const mapped = mapToAuthUser(updated);
        setUser(mapped);
        writeCurrentUserToStorage(mapped);
        return;
      }

      // Fallback (sollte selten passieren)
      const next: AuthUser = { ...user, isPro: isPro === true };
      setUser(next);
      writeCurrentUserToStorage(next);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      login,
      logout,
      register,
      setUserPro,
    }),
    [user, login, logout, register, setUserPro]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
export { AuthContext };