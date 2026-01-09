// src/utils/planShift.ts
import type { CalendarEvent } from "../types/training";
import { getScopedItem, setScopedItem } from "./scopedStorage";

/* -------------------------------- Helpers -------------------------------- */

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Monatsschlüssel z.B. 2025-12
 */
function getMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STORAGE_KEY = "trainq_plan_shift_usage_v1";

type UsageStore = Record<string, number>;

/* ------------------------------- Storage ---------------------------------- */

function readUsage(): UsageStore {
  if (!hasLocalStorage()) return {};
  try {
    const raw = getScopedItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as UsageStore) : {};
  } catch {
    return {};
  }
}

function writeUsage(data: UsageStore): void {
  if (!hasLocalStorage()) return;
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/* ----------------------------- Public API --------------------------------- */

/**
 * ✅ Aktueller Nutzungsstand (für UI)
 */
export function getPlanShiftUsage(): { monthKey: string; used: number } {
  const key = getMonthKey();
  const data = readUsage();
  return { monthKey: key, used: data[key] ?? 0 };
}

/**
 * ✅ Prüft Free-Limit
 */
export function canUsePlanShiftFree(limit: number): boolean {
  const { used } = getPlanShiftUsage();
  return used < limit;
}

/**
 * ✅ Erhöht Nutzung (nach erfolgreichem Shift)
 */
export function incrementPlanShiftUsage(): void {
  const key = getMonthKey();
  const data = readUsage();
  data[key] = (data[key] ?? 0) + 1;
  writeUsage(data);
}

/* ---------------------------- Date Helpers -------------------------------- */

function isoToLocalDate(iso: string): Date | null {
  if (!iso || typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);

  const dt = new Date(y, mo, d, 0, 0, 0, 0);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function localDateToISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isTrainingEvent(ev: CalendarEvent): boolean {
  return String((ev as any)?.type ?? "") === "training";
}

/* ---------------------------- Core Logic ---------------------------------- */

/**
 * ✅ Verschiebt Trainings im Kalender
 * - nur type === "training"
 * - nur ab fromDateISO (inkl.)
 * - optional nur für ein templateId (planId)
 */
export function shiftPlanEvents(input: {
  events: CalendarEvent[];
  planId: string | null;
  days: number;
  fromDateISO: string;
}): { nextEvents: CalendarEvent[] } {
  const { events, planId, days, fromDateISO } = input;

  if (!Array.isArray(events) || !Number.isFinite(days) || days === 0) {
    return { nextEvents: events ?? [] };
  }

  const fromDate = isoToLocalDate(fromDateISO);
  if (!fromDate) {
    return { nextEvents: events };
  }

  const nextEvents = events.map((ev) => {
    if (!ev?.date || typeof ev.date !== "string") return ev;

    // ✅ nur Trainings
    if (!isTrainingEvent(ev)) return ev;

    // ✅ nur ab Startdatum
    if (ev.date < fromDateISO) return ev;

    // ✅ optional nur bestimmter Plan
    if (planId && (ev as any).templateId !== planId) return ev;

    const d = isoToLocalDate(ev.date);
    if (!d) return ev;

    d.setDate(d.getDate() + Math.trunc(days));

    return {
      ...ev,
      date: localDateToISO(d),
    };
  });

  return { nextEvents };
}
