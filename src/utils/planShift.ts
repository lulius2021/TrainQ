// src/utils/planShift.ts
import type { CalendarEvent } from "../types/training";

/**
 * Monatlicher Key (z.B. 2025-12)
 */
function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STORAGE_KEY = "trainq_plan_shift_usage";

/**
 * Usage-Store lesen
 */
function readUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/**
 * Usage-Store schreiben
 */
function writeUsage(data: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * ✅ PUBLIC: aktueller Nutzungsstand
 */
export function getPlanShiftUsage(): { monthKey: string; used: number } {
  const key = monthKey();
  const data = readUsage();
  return {
    monthKey: key,
    used: data[key] ?? 0,
  };
}

/**
 * ✅ PUBLIC: Free-Limit prüfen
 */
export function canUsePlanShiftFree(limit: number): boolean {
  const { used } = getPlanShiftUsage();
  return used < limit;
}

/**
 * ✅ PUBLIC: Nutzung erhöhen
 */
export function incrementPlanShiftUsage(): void {
  const key = monthKey();
  const data = readUsage();
  data[key] = (data[key] ?? 0) + 1;
  writeUsage(data);
}

/**
 * ✅ PUBLIC: Events verschieben
 */
export function shiftPlanEvents(input: {
  events: CalendarEvent[];
  planId: string | null;
  days: number;
  fromDateISO: string;
}): { nextEvents: CalendarEvent[] } {
  const { events, planId, days, fromDateISO } = input;

  const shiftMs = days * 24 * 60 * 60 * 1000;

  const nextEvents = events.map((ev) => {
    if (ev.date < fromDateISO) return ev;
    if (planId && ev.templateId !== planId) return ev;

    const d = new Date(ev.date + "T00:00:00");
    d.setTime(d.getTime() + shiftMs);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    return {
      ...ev,
      date: `${yyyy}-${mm}-${dd}`,
    };
  });

  return { nextEvents };
}