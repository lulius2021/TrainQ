// src/utils/calendarGeneration.ts
// TrainQ Launch-Core: Plan -> CalendarWorkout Generation
//
// Ziel:
// - Erzeuge konkrete CalendarWorkouts aus einem aktiven TrainingPlan
// - Ohne Storage, ohne UI, pure Functions
// - Überschreibt niemals bestehende CalendarWorkouts
//
// Launch-Entscheidungen (fix):
// - Pro Datum genau EIN CalendarWorkout (Single-Entry Design)
// - Adaptives Training überschreibt den bestehenden Eintrag in-place (keine Replacement-Links)
// - Plan bleibt stabil: wir generieren nur neue Einträge für zukünftige Tage im Fenster

import type {
  ISODate,
  WeekdayIndex,
  CalendarWorkoutStatus,
  CalendarWorkout,
  NewCalendarWorkout,
  TrainingPlan,
} from "../types";

/**
 * Formatiert Datum als ISODate "YYYY-MM-DD" in lokaler Zeit.
 */
export function toISODateLocal(d: Date): ISODate {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parst ISODate "YYYY-MM-DD" als lokales Date-Objekt.
 * (Kein UTC-Shift, bewusst lokal.)
 */
export function parseISODateLocal(date: ISODate): Date {
  const [y, m, d] = date.split("-").map((x) => Number(x));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * 0=Mo ... 6=So
 * JS Date.getDay(): 0=So ... 6=Sa
 */
export function weekdayIndexMondayFirst(date: Date): WeekdayIndex {
  const js = date.getDay(); // 0..6 (Sun..Sat)
  const mondayFirst = (js + 6) % 7; // Mon=0 ... Sun=6
  return mondayFirst as WeekdayIndex;
}

export interface GenerateCalendarOptions {
  /**
   * Startpunkt (inklusive). Default: heute (lokal).
   */
  fromDate?: ISODate;

  /**
   * Anzahl Tage nach vorne (inklusive Starttag).
   * Empfehlung Launch: 14 oder 28.
   */
  days: number;

  /**
   * Status für neu generierte Einträge.
   * Default: "planned"
   */
  defaultStatus?: CalendarWorkoutStatus;
}

/**
 * Ergebnis der Generierung: neue Einträge + Meta fürs Debugging.
 */
export interface GenerateCalendarResult {
  created: NewCalendarWorkout[];
  skippedExistingDates: ISODate[];
  skippedNoRuleDates: ISODate[];
}

/**
 * Generiert neue CalendarWorkouts aus einem TrainingPlan für ein Fenster.
 *
 * Wichtig:
 * - Diese Funktion generiert nur "payloads" ohne IDs.
 * - IDs werden beim Speichern/Upsert vom Storage-Layer erzeugt.
 * - existingWorkouts sind die aktuellen CalendarWorkouts (Wahrheit).
 * - Existierende Einträge werden nie überschrieben.
 */
export function generateCalendarWorkouts(
  plan: TrainingPlan,
  existingWorkouts: CalendarWorkout[],
  options: GenerateCalendarOptions
): GenerateCalendarResult {
  if (!plan.isActive) {
    return { created: [], skippedExistingDates: [], skippedNoRuleDates: [] };
  }

  if (options.days <= 0 || !Number.isFinite(options.days)) {
    throw new Error("generateCalendarWorkouts: options.days must be > 0");
  }

  const from = options.fromDate
    ? parseISODateLocal(options.fromDate)
    : new Date();

  // normalize start-of-day local
  from.setHours(0, 0, 0, 0);

  const defaultStatus: CalendarWorkoutStatus =
    options.defaultStatus ?? "planned";

  // Fast lookup: welche dates existieren bereits im Kalender?
  const existingByDate = new Set<ISODate>();
  for (const w of existingWorkouts) {
    existingByDate.add(w.date);
  }

  // Fast lookup: Regel pro Wochentag (0=Mo..6=So)
  // Hinweis: Wenn mehrere Regeln denselben weekday haben -> nehmen wir die erste (Validation sollte das verhindern).
  const ruleByWeekday = new Map<WeekdayIndex, string>();
  for (const rule of plan.weeklyRules) {
    if (!ruleByWeekday.has(rule.weekday)) {
      ruleByWeekday.set(rule.weekday, rule.workoutType);
    }
  }

  const created: NewCalendarWorkout[] = [];
  const skippedExistingDates: ISODate[] = [];
  const skippedNoRuleDates: ISODate[] = [];

  for (let i = 0; i < options.days; i++) {
    const current = new Date(from);
    current.setDate(from.getDate() + i);

    const iso = toISODateLocal(current);

    // Wenn an dem Tag schon ein Eintrag existiert -> nichts erzeugen
    if (existingByDate.has(iso)) {
      skippedExistingDates.push(iso);
      continue;
    }

    const weekday = weekdayIndexMondayFirst(current);
    const workoutType = ruleByWeekday.get(weekday);

    // Kein Plan-Training an diesem Tag
    if (!workoutType) {
      skippedNoRuleDates.push(iso);
      continue;
    }

    created.push({
      date: iso,
      workoutType: workoutType as any, // safe, weil ruleByWeekday aus plan.weeklyRules kommt
      sourcePlanId: plan.id,
      status: defaultStatus,

      // optional fields (explizit, damit TS/Refactors sauber bleiben)
      notes: undefined,
      historyEntryId: undefined,
      skippedAt: undefined,
      completedAt: undefined,
      adaptedAt: undefined,
      adaptedFromWorkoutType: undefined,
    });
  }

  return { created, skippedExistingDates, skippedNoRuleDates };
}

/**
 * Helper: Erzeugt schnell ein Set aus ISODate für UI/Debugging.
 */
export function buildDateSet(workouts: CalendarWorkout[]): Set<ISODate> {
  const s = new Set<ISODate>();
  for (const w of workouts) s.add(w.date);
  return s;
}