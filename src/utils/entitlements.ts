// src/utils/entitlements.ts
// ✅ Single Source of Truth für Pro / Free + Limits
// ✅ MVP-tauglich (LocalStorage)
// ✅ Apple-Review-freundlich
// ❌ KEINE DUPLIKATE, KEINE HOOKS

import type { AdaptiveSuggestion } from "../types/adaptive";

/* ---------------------------------- Types --------------------------------- */

export type PaywallReason = "plan_shift" | "calendar_7days" | "adaptive_limit";

export type EntitlementsState = {
  isPro: boolean;

  /**
   * ✅ Nur Profil B/C zählen hier rein (A ist immer free/unbegrenzt).
   * Nutzung im aktuellen Monat.
   */
  adaptiveBCUsedThisMonth: number;

  /** Monatsschlüssel z.B. 2025-01 */
  adaptiveMonthKey: string;

  /**
   * ✅ Plan Shift (Tag +1 etc.)
   * Nutzung im aktuellen Monat (Free: limitiert, Pro: unbegrenzt)
   */
  planShiftUsedThisMonth: number;

  /** Monatsschlüssel z.B. 2025-01 */
  planShiftMonthKey: string;

  /**
   * ✅ Kalender > 7 Tage voraus planen
   * Nutzung im aktuellen Monat (Free: limitiert, Pro: unbegrenzt)
   */
  calendar7DaysUsedThisMonth: number;

  /** Monatsschlüssel z.B. 2025-01 */
  calendar7DaysMonthKey: string;
};

/* -------------------------------- Constants -------------------------------- */

// ✅ pro-user storage
const STORAGE_KEY_BASE = "trainq_entitlements";

function storageKeyForUser(userId?: string): string {
  const id = String(userId ?? "").trim();
  return id ? `${STORAGE_KEY_BASE}_${id}_v1` : "trainq_entitlements_v1";
}

// ✅ Optional: Custom Event, damit UI sofort syncen kann (ohne Hooks hier)
export const ENTITLEMENTS_CHANGED_EVENT = "trainq:entitlements_changed";

/**
 * Free Limits:
 * - Adaptive: A („stabil“) unbegrenzt (wird NICHT gezählt), B/C zusammen X pro Monat
 * - Plan Shift: X pro Monat
 * - Kalender > 7 Tage voraus: X pro Monat
 */
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

/* ------------------------------- Load / Save ------------------------------- */

export function loadEntitlements(userId?: string): EntitlementsState {
  const fallback: EntitlementsState = {
    isPro: false,

    adaptiveBCUsedThisMonth: 0,
    adaptiveMonthKey: getMonthKey(),

    planShiftUsedThisMonth: 0,
    planShiftMonthKey: getMonthKey(),

    calendar7DaysUsedThisMonth: 0,
    calendar7DaysMonthKey: getMonthKey(),
  };

  if (typeof window === "undefined") return fallback;

  const STORAGE_KEY = storageKeyForUser(userId);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<EntitlementsState>;
    const currentMonth = getMonthKey();

    const isPro = parsed.isPro === true;

    const next: EntitlementsState = {
      isPro,

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
      typeof parsed.planShiftUsedThisMonth === "undefined" ||
      typeof parsed.calendar7DaysUsedThisMonth === "undefined";

    if (needsPersist) {
      saveEntitlements(next, userId);
    }

    return next;
  } catch {
    return fallback;
  }
}

export function saveEntitlements(state: EntitlementsState, userId?: string): void {
  if (typeof window === "undefined") return;

  const STORAGE_KEY = storageKeyForUser(userId);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

  // B/C: Monatslimit
  return clampInt(state.adaptiveBCUsedThisMonth, 0) < FREE_LIMITS.adaptiveBCPerMonth;
}

export function consumeAdaptiveProfile(
  state: EntitlementsState,
  profile: AdaptiveSuggestion["profile"],
  userId?: string
): EntitlementsState {
  if (state.isPro) return state;
  if (!isBCProfile(profile)) return state;

  const currentMonth = getMonthKey();

  const next: EntitlementsState =
    state.adaptiveMonthKey !== currentMonth
      ? { ...state, adaptiveBCUsedThisMonth: 1, adaptiveMonthKey: currentMonth }
      : { ...state, adaptiveBCUsedThisMonth: clampInt(state.adaptiveBCUsedThisMonth, 0) + 1 };

  saveEntitlements(next, userId);
  return next;
}

/* ------------------------------- Plan Shift Logic --------------------------- */

export function canUsePlanShift(state: EntitlementsState): boolean {
  if (state.isPro) return true;
  const currentMonth = getMonthKey();
  const used = state.planShiftMonthKey === currentMonth ? clampInt(state.planShiftUsedThisMonth, 0) : 0;
  return used < FREE_LIMITS.planShiftPerMonth;
}

export function consumePlanShift(state: EntitlementsState, userId?: string): EntitlementsState {
  if (state.isPro) return state;

  const currentMonth = getMonthKey();

  const next: EntitlementsState =
    state.planShiftMonthKey !== currentMonth
      ? { ...state, planShiftUsedThisMonth: 1, planShiftMonthKey: currentMonth }
      : { ...state, planShiftUsedThisMonth: clampInt(state.planShiftUsedThisMonth, 0) + 1 };

  saveEntitlements(next, userId);
  return next;
}

/* --------------------------- Calendar 7 Days Logic -------------------------- */

/**
 * ✅ Nur relevant, wenn man >7 Tage in die Zukunft plant.
 * Free: 3/Monat, Pro: unbegrenzt.
 */
export function canUseCalendar7Days(state: EntitlementsState): boolean {
  if (state.isPro) return true;
  const currentMonth = getMonthKey();
  const used = state.calendar7DaysMonthKey === currentMonth ? clampInt(state.calendar7DaysUsedThisMonth, 0) : 0;
  return used < FREE_LIMITS.calendar7DaysPerMonth;
}

/**
 * ✅ Konsumiert einen "7 Tage voraus" Credit (nur Free relevant).
 */
export function consumeCalendar7Days(state: EntitlementsState, userId?: string): EntitlementsState {
  if (state.isPro) return state;

  const currentMonth = getMonthKey();

  const next: EntitlementsState =
    state.calendar7DaysMonthKey !== currentMonth
      ? { ...state, calendar7DaysUsedThisMonth: 1, calendar7DaysMonthKey: currentMonth }
      : { ...state, calendar7DaysUsedThisMonth: clampInt(state.calendar7DaysUsedThisMonth, 0) + 1 };

  saveEntitlements(next, userId);
  return next;
}

/* --------------------- Backward-compat (alte Imports) ---------------------- */

export function canUseAdaptiveTraining(state: EntitlementsState): boolean {
  if (state.isPro) return true;
  return clampInt(state.adaptiveBCUsedThisMonth, 0) < FREE_LIMITS.adaptiveBCPerMonth;
}

export function consumeAdaptiveTraining(state: EntitlementsState, userId?: string): EntitlementsState {
  if (state.isPro) return state;

  const currentMonth = getMonthKey();

  const next: EntitlementsState =
    state.adaptiveMonthKey !== currentMonth
      ? { ...state, adaptiveBCUsedThisMonth: 1, adaptiveMonthKey: currentMonth }
      : { ...state, adaptiveBCUsedThisMonth: clampInt(state.adaptiveBCUsedThisMonth, 0) + 1 };

  saveEntitlements(next, userId);
  return next;
}

/* ------------------------------- Mutations -------------------------------- */

export function setPro(state: EntitlementsState, isPro: boolean, userId?: string): EntitlementsState {
  const currentMonth = getMonthKey();

  const next: EntitlementsState = {
    ...state,
    isPro,

    adaptiveMonthKey: state.adaptiveMonthKey || currentMonth,
    adaptiveBCUsedThisMonth: clampInt(state.adaptiveBCUsedThisMonth, 0),

    planShiftMonthKey: state.planShiftMonthKey || currentMonth,
    planShiftUsedThisMonth: clampInt(state.planShiftUsedThisMonth, 0),

    calendar7DaysMonthKey: state.calendar7DaysMonthKey || currentMonth,
    calendar7DaysUsedThisMonth: clampInt(state.calendar7DaysUsedThisMonth, 0),
  };

  saveEntitlements(next, userId);
  return next;
}

export function resetEntitlements(userId?: string): EntitlementsState {
  const mk = getMonthKey();

  const next: EntitlementsState = {
    isPro: false,

    adaptiveBCUsedThisMonth: 0,
    adaptiveMonthKey: mk,

    planShiftUsedThisMonth: 0,
    planShiftMonthKey: mk,

    calendar7DaysUsedThisMonth: 0,
    calendar7DaysMonthKey: mk,
  };

  saveEntitlements(next, userId);
  return next;
}