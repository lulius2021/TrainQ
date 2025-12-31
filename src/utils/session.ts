// src/utils/session.ts
// Single Source of Truth für "welcher User ist gerade aktiv?"
// Wird von Auth (setActiveSession/clearActiveSession) und von Entitlements & userScoped storage genutzt.

export type ActiveSession = {
  userId: string;
  isPro: boolean;
  email?: string;
  startedAt?: string;
};

const LS_ACTIVE_SESSION = "trainq_active_session_v1";
const SESSION_CHANGED_EVENT = "trainq:session_changed";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeUserId(v: unknown): string {
  return String(v ?? "").trim();
}

function readActiveSessionFromStorage(): ActiveSession | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(LS_ACTIVE_SESSION);
  const parsed = safeParse<ActiveSession | null>(raw, null);

  if (!parsed) return null;

  const userId = normalizeUserId((parsed as ActiveSession).userId);
  if (!userId) return null;

  return {
    userId,
    isPro: (parsed as ActiveSession).isPro === true,
    email: typeof (parsed as ActiveSession).email === "string" ? (parsed as ActiveSession).email : undefined,
    startedAt: typeof (parsed as ActiveSession).startedAt === "string" ? (parsed as ActiveSession).startedAt : undefined,
  };
}

function writeActiveSessionToStorage(s: ActiveSession | null): void {
  if (typeof window === "undefined") return;

  try {
    if (!s) window.localStorage.removeItem(LS_ACTIVE_SESSION);
    else window.localStorage.setItem(LS_ACTIVE_SESSION, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function emitSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

/* --------------------------------- Public API --------------------------------- */

export function setActiveSession(session: { userId: string; isPro: boolean; email?: string }): void {
  const userId = normalizeUserId(session.userId);
  if (!userId) return;

  const next: ActiveSession = {
    userId,
    isPro: session.isPro === true,
    email: session.email,
    startedAt: new Date().toISOString(),
  };

  writeActiveSessionToStorage(next);
  emitSessionChanged();
}

export function clearActiveSession(): void {
  writeActiveSessionToStorage(null);
  emitSessionChanged();
}

export function getActiveSession(): ActiveSession | null {
  return readActiveSessionFromStorage();
}

export function getActiveUserId(): string | null {
  return readActiveSessionFromStorage()?.userId ?? null;
}

// ✅ DAS fehlt dir gerade (Fehler in der Console)
export function getActiveIsPro(): boolean {
  return readActiveSessionFromStorage()?.isPro === true;
}

// ✅ Optional, falls du es irgendwo so importierst
export const getActiveIsProLegacy = getActiveIsPro;

/**
 * Baut einen user-scoped LocalStorage Key.
 * Dadurch sehen Free/Pro Accounts NICHT dieselben Kalender/History/Onboarding-Daten.
 */
export function userScopedKey(baseKey: string, userId?: string | null): string {
  const base = String(baseKey ?? "").trim();
  if (!base) return "";

  const uid = normalizeUserId(userId ?? getActiveUserId() ?? "");
  if (!uid) {
    // Fallback: unscope (sollte perspektivisch nicht passieren)
    return base;
  }

  return `${base}::${uid}`;
}

/**
 * Listener (praktisch, wenn Hooks/Stores auf Sessionwechsel reagieren sollen).
 */
export function onSessionChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => cb();
  window.addEventListener(SESSION_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SESSION_CHANGED_EVENT, handler);
}