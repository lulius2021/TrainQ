// src/utils/entitlements.ts
// ✅ Single Source of Truth für Limits + Counter (persisted)
// ✅ Pro/Free kommt NUR aus Account/Session (nicht aus localStorage)
// ✅ Pure mutations (consume/set/reset) -> speichern NUR via saveEntitlements()
// ❌ KEIN Pro-Leak zwischen Accounts

import type { AdaptiveSuggestion } from "../types/adaptive";
import { getActiveIsPro, userScopedKey } from "./session";

/* ---------------------------------- Types --------------------------------- */

export type PaywallReason = "plan_shift" | "calendar_7days" | "adaptive_limit";

export type EntitlementsState = {
  // ⚠️ NICHT persisted – wird beim Laden aus Account/Session gesetzt
  isPro: boolean;

  adaptiveBCUsedThisMonth: number;
  adaptiveMonthKey: string; // z.B. 2025-01

  planShiftUsedThisMonth: number;
  planShiftMonthKey: string;

  calendar7DaysUsedThisMonth: number;
  calendar7DaysMonthKey: string;
};

type PersistedEntitlementsState = Omit<EntitlementsState, "isPro">;

/* -------------------------------- Constants -------------------------------- */

const STORAGE_KEY_BASE = "trainq_entitlements";
export const ENTITLEMENTS_CHANGED_EVENT = "trainq:entitlements_changed";

export const FREE_LIMITS = {
  adaptiveBCPerMonth: 5,
  planShiftPerMonth: 5,
  calendar7DaysPerMonth: 3,
} as const;

/* --------------------------------- Helpers --------------------------------- */

function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isBCProfile(profile: AdaptiveSuggestion["profile"]): boolean {
  return profile === "kompakt" || profile === "fokus";
}

function clampInt(n: unknown, fallback = 0): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.floor(v));
}

function emitEntitlementsChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(ENTITLEMENTS_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

function makeDefaultPersisted(): PersistedEntitlementsState {
  const mk = getMonthKey();
  return {
    adaptiveBCUsedThisMonth: 0,
    adaptiveMonthKey: mk,
    planShiftUsedThisMonth: 0,
    planShiftMonthKey: mk,
    calendar7DaysUsedThisMonth: 0,
    calendar7DaysMonthKey: mk,
  };
}

function mergeIsPro(p: PersistedEntitlementsState, isPro: boolean): EntitlementsState {
  return { isPro, ...p };
}

function storageKey(userId?: string): string {
  // pro-user key; wenn userId fehlt, nimmt userScopedKey active user
  const key = userScopedKey(`${STORAGE_KEY_BASE}`, userId);
  return key;
}

/* ------------------------------- Load / Save ------------------------------- */

export function loadEntitlements(userId?: string, isProOverride?: boolean): EntitlementsState {
  const isPro = typeof isProOverride === "boolean" ? isProOverride : getActiveIsPro();

  const fallbackPersisted = makeDefaultPersisted();
  if (typeof window === "undefined") return mergeIsPro(fallbackPersisted, isPro);

  const STORAGE_KEY = storageKey(userId);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return mergeIsPro(fallbackPersisted, isPro);

    const parsed = JSON.parse(raw) as Partial<PersistedEntitlementsState>;
    const currentMonth = getMonthKey();

    const nextPersisted: PersistedEntitlementsState = {
      adaptiveBCUsedThisMonth:
        parsed.adaptiveMonthKey === currentMonth ? clampInt(parsed.adaptiveBCUsedThisMonth, 0) : 0,
      adaptiveMonthKey: currentMonth,

      planShiftUsedThisMonth:
        parsed.planShiftMonthKey === currentMonth ? clampInt(parsed.planShiftUsedThisMonth, 0) : 0,
      planShiftMonthKey: currentMonth,

      calendar7DaysUsedThisMonth:
        parsed.calendar7DaysMonthKey === currentMonth ? clampInt(parsed.calendar7DaysUsedThisMonth, 0) : 0,
      calendar7DaysMonthKey: currentMonth,
    };

    const needsPersist =
      parsed.adaptiveMonthKey !== currentMonth ||
      parsed.planShiftMonthKey !== currentMonth ||
      parsed.calendar7DaysMonthKey !== currentMonth ||
      typeof parsed.adaptiveBCUsedThisMonth !== "number" ||
      typeof parsed.planShiftUsedThisMonth !== "number" ||
      typeof parsed.calendar7DaysUsedThisMonth !== "number";

    if (needsPersist) {
      saveEntitlements(mergeIsPro(nextPersisted, isPro), userId);
    }

    return mergeIsPro(nextPersisted, isPro);
  } catch {
    return mergeIsPro(fallbackPersisted, isPro);
  }
}

export function saveEntitlements(state: EntitlementsState, userId?: string): void {
  if (typeof window === "undefined") return;

  const STORAGE_KEY = storageKey(userId);

  // ✅ Persist NUR Counter/Keys, niemals isPro
  const persisted: PersistedEntitlementsState = {
    adaptiveBCUsedThisMonth: clampInt(state.adaptiveBCUsedThisMonth, 0),
    adaptiveMonthKey: String(state.adaptiveMonthKey || getMonthKey()),
    planShiftUsedThisMonth: clampInt(state.planShiftUsedThisMonth, 0),
    planShiftMonthKey: String(state.planShiftMonthKey || getMonthKey()),
    calendar7DaysUsedThisMonth: clampInt(state.calendar7DaysUsedThisMonth, 0),
    calendar7DaysMonthKey: String(state.calendar7DaysMonthKey || getMonthKey()),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    emitEntitlementsChanged();
  } catch {
    // ignore
  }
}

/* ------------------------------- Adaptive Logic ----------------------------- */

export function canUseAdaptiveProfile(state: EntitlementsState, profile: AdaptiveSuggestion["profile"]): boolean {
  if (state.isPro) return true;

  // A ist immer free
  if (!isBCProfile(profile)) return true;

  return clampInt(state.adaptiveBCUsedThisMonth, 0) < FREE_LIMITS.adaptiveBCPerMonth;
}

export function consumeAdaptiveProfile(state: EntitlementsState, profile: AdaptiveSuggestion["profile"]): EntitlementsState {
  if (state.isPro) return state;
  if (!isBCProfile(profile)) return state;

  const currentMonth = getMonthKey();

  if (state.adaptiveMonthKey !== currentMonth) {
    return { ...state, adaptiveBCUsedThisMonth: 1, adaptiveMonthKey: currentMonth };
  }

  return { ...state, adaptiveBCUsedThisMonth: clampInt(state.adaptiveBCUsedThisMonth, 0) + 1 };
}

/* ------------------------------- Plan Shift Logic --------------------------- */

export function canUsePlanShift(state: EntitlementsState): boolean {
  if (state.isPro) return true;
  const currentMonth = getMonthKey();
  const used = state.planShiftMonthKey === currentMonth ? clampInt(state.planShiftUsedThisMonth, 0) : 0;
  return used < FREE_LIMITS.planShiftPerMonth;
}

export function consumePlanShift(state: EntitlementsState): EntitlementsState {
  if (state.isPro) return state;

  const currentMonth = getMonthKey();

  if (state.planShiftMonthKey !== currentMonth) {
    return { ...state, planShiftUsedThisMonth: 1, planShiftMonthKey: currentMonth };
  }

  return { ...state, planShiftUsedThisMonth: clampInt(state.planShiftUsedThisMonth, 0) + 1 };
}

/* --------------------------- Calendar 7 Days Logic -------------------------- */

export function canUseCalendar7Days(state: EntitlementsState): boolean {
  if (state.isPro) return true;
  const currentMonth = getMonthKey();
  const used = state.calendar7DaysMonthKey === currentMonth ? clampInt(state.calendar7DaysUsedThisMonth, 0) : 0;
  return used < FREE_LIMITS.calendar7DaysPerMonth;
}

export function consumeCalendar7Days(state: EntitlementsState): EntitlementsState {
  if (state.isPro) return state;

  const currentMonth = getMonthKey();

  if (state.calendar7DaysMonthKey !== currentMonth) {
    return { ...state, calendar7DaysUsedThisMonth: 1, calendar7DaysMonthKey: currentMonth };
  }

  return { ...state, calendar7DaysUsedThisMonth: clampInt(state.calendar7DaysUsedThisMonth, 0) + 1 };
}

/* --------------------- Backward-compat (alte Imports) ---------------------- */

export function canUseAdaptiveTraining(state: EntitlementsState): boolean {
  if (state.isPro) return true;
  return clampInt(state.adaptiveBCUsedThisMonth, 0) < FREE_LIMITS.adaptiveBCPerMonth;
}

export function consumeAdaptiveTraining(state: EntitlementsState): EntitlementsState {
  if (state.isPro) return state;

  const currentMonth = getMonthKey();

  if (state.adaptiveMonthKey !== currentMonth) {
    return { ...state, adaptiveBCUsedThisMonth: 1, adaptiveMonthKey: currentMonth };
  }

  return { ...state, adaptiveBCUsedThisMonth: clampInt(state.adaptiveBCUsedThisMonth, 0) + 1 };
}

/* ------------------------------- Mutations -------------------------------- */

// ⚠️ setPro ist absichtlich NICHT mehr vorgesehen, weil Pro aus Account kommt.
// (Wir lassen die Funktion für API-Kompatibilität, aber sie ändert nichts Persistentes.)
export function setPro(state: EntitlementsState): EntitlementsState {
  return { ...state, isPro: state.isPro };
}

export function resetEntitlements(userId?: string, isProOverride?: boolean): EntitlementsState {
  const persisted = makeDefaultPersisted();
  const isPro = typeof isProOverride === "boolean" ? isProOverride : getActiveIsPro();
  const next = mergeIsPro(persisted, isPro);
  saveEntitlements(next, userId);
  return next;
}