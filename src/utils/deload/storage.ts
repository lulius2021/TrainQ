import type { DeloadPlan } from "../../types/deload";
import type { DeloadHistoryEntry } from "../../types/wellness";
import { getScopedItem, removeScopedItem, setScopedItem } from "../scopedStorage";

const STORAGE_KEY = "trainq_deload_v1";
const STORAGE_KEY_DISMISSED = "trainq_deload_dismissed_until_v1";
const STORAGE_KEY_LAST_START = "trainq_deload_last_start_v1";
const STORAGE_KEY_LAST_INTERVAL = "trainq_deload_last_interval_weeks_v1";

function safeParse(raw: string | null): DeloadPlan | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeloadPlan;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.startISO || !parsed.endISO || !parsed.createdAtISO) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readDeloadPlan(userId?: string | null): DeloadPlan | null {
  return safeParse(getScopedItem(STORAGE_KEY, userId));
}

export function writeDeloadPlan(userId: string | undefined | null, plan: DeloadPlan): void {
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(plan), userId);
  } catch {
    // ignore
  }
}

export function clearDeloadPlan(userId?: string | null): void {
  try {
    removeScopedItem(STORAGE_KEY, userId);
  } catch {
    // ignore
  }
}

export function readDeloadDismissedUntil(userId?: string | null): string | null {
  const raw = getScopedItem(STORAGE_KEY_DISMISSED, userId);
  return raw ? String(raw) : null;
}

export function writeDeloadDismissedUntil(userId: string | undefined | null, iso: string): void {
  try {
    setScopedItem(STORAGE_KEY_DISMISSED, iso, userId);
  } catch {
    // ignore
  }
}

export function clearDeloadDismissedUntil(userId?: string | null): void {
  try {
    removeScopedItem(STORAGE_KEY_DISMISSED, userId);
  } catch {
    // ignore
  }
}

export function readLastDeloadStartISO(userId?: string | null): string | null {
  const raw = getScopedItem(STORAGE_KEY_LAST_START, userId);
  return raw ? String(raw) : null;
}

export function writeLastDeloadStartISO(userId: string | undefined | null, iso: string): void {
  try {
    setScopedItem(STORAGE_KEY_LAST_START, iso, userId);
  } catch {
    // ignore
  }
}

export function readLastDeloadIntervalWeeks(userId?: string | null): number | null {
  const raw = getScopedItem(STORAGE_KEY_LAST_INTERVAL, userId);
  const v = raw ? Number(raw) : NaN;
  return Number.isFinite(v) ? v : null;
}

export function writeLastDeloadIntervalWeeks(userId: string | undefined | null, weeks: number): void {
  if (!Number.isFinite(weeks) || weeks <= 0) return;
  try {
    setScopedItem(STORAGE_KEY_LAST_INTERVAL, String(weeks), userId);
  } catch {
    // ignore
  }
}

// ────────────────────────────────────────────────────────────
// Deload History (post-deload feedback)
// ────────────────────────────────────────────────────────────

const STORAGE_KEY_HISTORY = "trainq_deload_history_v1";
const STORAGE_KEY_FEEDBACK_GIVEN = "trainq_deload_feedback_given_v1";

export function readDeloadHistory(userId?: string | null): DeloadHistoryEntry[] {
  const raw = getScopedItem(STORAGE_KEY_HISTORY, userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addDeloadHistoryEntry(
  userId: string | undefined | null,
  entry: DeloadHistoryEntry
): void {
  try {
    const current = readDeloadHistory(userId);
    const next = [entry, ...current.filter((e) => e.id !== entry.id)].slice(0, 20);
    setScopedItem(STORAGE_KEY_HISTORY, JSON.stringify(next), userId);
  } catch {
    // ignore
  }
}

export function updateDeloadHistoryEntry(
  userId: string | undefined | null,
  id: string,
  patch: Partial<DeloadHistoryEntry>
): void {
  try {
    const current = readDeloadHistory(userId);
    const next = current.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setScopedItem(STORAGE_KEY_HISTORY, JSON.stringify(next), userId);
  } catch {
    // ignore
  }
}

export function readFeedbackGivenIds(userId?: string | null): string[] {
  const raw = getScopedItem(STORAGE_KEY_FEEDBACK_GIVEN, userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markFeedbackGiven(userId: string | undefined | null, planId: string): void {
  try {
    const current = readFeedbackGivenIds(userId);
    if (!current.includes(planId)) {
      setScopedItem(STORAGE_KEY_FEEDBACK_GIVEN, JSON.stringify([...current, planId]), userId);
    }
  } catch {
    // ignore
  }
}
