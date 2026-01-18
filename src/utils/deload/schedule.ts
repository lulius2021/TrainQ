import type { CalendarEvent } from "../../types/training";

type DueInput = {
  planStartISO?: string | null;
  lastDeloadStartISO?: string | null;
  baselineIntervalWeeks?: number | null;
  avgSessionsPerWeek: number;
  firstTrainingISO?: string | null;
};

type DueCheckInput = {
  todayISO: string;
  dueISO: string;
  dismissedUntilISO?: string | null;
  activePlan?: { startISO: string; endISO: string } | null;
};

function parseISO(dateISO: string): Date {
  const base = String(dateISO || "").slice(0, 10);
  return new Date(`${base}T00:00:00`);
}

function formatISO(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export function getWeekStartISO(dateISO: string): string {
  const d = parseISO(dateISO);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return formatISO(d);
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = parseISO(dateISO);
  d.setDate(d.getDate() + days);
  return formatISO(d);
}

export function addWeeksISO(dateISO: string, weeks: number): string {
  return addDaysISO(dateISO, weeks * 7);
}

export function computeAvgSessionsPerWeek(events: CalendarEvent[], weeksLookback = 6): number {
  if (!weeksLookback) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - weeksLookback * 7);
  let count = 0;
  for (const ev of events ?? []) {
    if (ev.type !== "training") continue;
    const d = parseISO(ev.date);
    if (d >= start && d <= today) count += 1;
  }
  return count / weeksLookback;
}

export function mapSessionsToIntervalWeeks(avg: number): number {
  if (avg >= 6) return 4;
  if (avg >= 5) return 5;
  if (avg >= 4) return 6;
  if (avg >= 3) return 8;
  if (avg >= 2) return 10;
  return 12;
}

export function computeNextDueISO(input: DueInput): string {
  const interval = input.baselineIntervalWeeks ?? mapSessionsToIntervalWeeks(input.avgSessionsPerWeek);
  if (input.lastDeloadStartISO) return addWeeksISO(getWeekStartISO(input.lastDeloadStartISO), interval);
  if (input.planStartISO) return addWeeksISO(getWeekStartISO(input.planStartISO), interval);
  if (input.firstTrainingISO) return addWeeksISO(getWeekStartISO(input.firstTrainingISO), interval);
  return addWeeksISO(getWeekStartISO(formatISO(new Date())), interval);
}

export function isDeloadDue(input: DueCheckInput): boolean {
  const today = getWeekStartISO(input.todayISO);
  const due = getWeekStartISO(input.dueISO);
  if (input.dismissedUntilISO) {
    const dismiss = getWeekStartISO(input.dismissedUntilISO);
    if (today < dismiss) return false;
  }
  if (input.activePlan) {
    const start = getWeekStartISO(input.activePlan.startISO);
    const end = getWeekStartISO(input.activePlan.endISO);
    if (today >= start && today <= end) return false;
  }
  return today >= due;
}

export function getFirstTrainingDateISO(events: CalendarEvent[]): string | null {
  let earliest: string | null = null;
  for (const ev of events ?? []) {
    if (ev.type !== "training") continue;
    if (!ev.date) continue;
    if (!earliest || ev.date < earliest) earliest = ev.date;
  }
  return earliest;
}
