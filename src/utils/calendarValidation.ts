// src/utils/calendarValidation.ts
// TrainQ Launch-Core: Validation (pure)
// Ziel: harte Checks für Plan/Kalender, ohne UI/Storage

import type { CalendarWorkout, TrainingPlan, SplitType, WorkoutType } from "../types";

export const SPLIT_WORKOUT_TYPES: Record<SplitType, WorkoutType[]> = {
  push_pull: ["Push", "Pull"],
  upper_lower: ["Upper", "Lower"],
};

// 1) Genau ein aktiver Plan (Launch)
export function validateSingleActivePlan(plans: TrainingPlan[]): string[] {
  const active = plans.filter((p) => p.isActive);
  if (active.length === 0) return ["Kein aktiver Plan vorhanden."];
  if (active.length > 1) return ["Mehr als ein aktiver Plan vorhanden (Launch: genau 1)."];
  return [];
}

// 2) Plan-Regeln plausibel
export function validatePlanWeeklyRules(plan: TrainingPlan): string[] {
  const issues: string[] = [];

  if (!plan.weeklyRules?.length) {
    issues.push("Plan hat keine Weekly Rules.");
    return issues;
  }

  const allowed = SPLIT_WORKOUT_TYPES[plan.splitType];

  for (const r of plan.weeklyRules) {
    if (r.weekday < 0 || r.weekday > 6) issues.push(`Ungültiger weekday: ${String(r.weekday)}`);
    if (!allowed.includes(r.workoutType)) {
      issues.push(`WorkoutType "${r.workoutType}" passt nicht zu Split "${plan.splitType}".`);
    }
  }

  return issues;
}

// 3) Kalender: keine Doppel-Dates, Pflichtfelder etc.
export function validateCalendarWorkouts(workouts: CalendarWorkout[]): string[] {
  const issues: string[] = [];

  const byDate = new Map<string, CalendarWorkout[]>();
  for (const w of workouts) {
    if (!w.date) issues.push(`CalendarWorkout ohne date (id=${w.id})`);
    if (!w.workoutType) issues.push(`CalendarWorkout ohne workoutType (id=${w.id})`);

    const arr = byDate.get(w.date) ?? [];
    arr.push(w);
    byDate.set(w.date, arr);
  }

  // Launch: pro Datum maximal ein Eintrag
  for (const [date, arr] of byDate.entries()) {
    if (arr.length > 1) issues.push(`Mehr als ein Kalender-Eintrag für ${date} (Launch: single-entry).`);
  }

  return issues;
}