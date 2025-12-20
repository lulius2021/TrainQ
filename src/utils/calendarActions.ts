// src/utils/calendarActions.ts
// TrainQ Launch-Core: Calendar Actions (pure state updates)

import type {
  CalendarWorkout,
  CalendarWorkoutId,
  CalendarWorkoutStatus,
  HistoryEntryId,
  ISODateTime,
  WorkoutType,
  AdaptiveProfile,
} from "../types";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function findOrThrow(
  workouts: CalendarWorkout[],
  id: CalendarWorkoutId,
  actionName: string
): { workout: CalendarWorkout; index: number } {
  const idx = workouts.findIndex((w) => w.id === id);
  if (idx === -1) {
    throw new Error(`${actionName}: CalendarWorkout not found: ${id}`);
  }
  return { workout: workouts[idx], index: idx };
}

function assertNotAlreadyCompleted(w: CalendarWorkout, actionName: string) {
  if (w.status === "completed") {
    throw new Error(`${actionName}: workout is already completed (${w.id})`);
  }
}

function assertNotAlreadySkipped(w: CalendarWorkout, actionName: string) {
  if (w.status === "skipped") {
    throw new Error(`${actionName}: workout is already skipped (${w.id})`);
  }
}

// ---------------------------------------------
// 1) Skip
// ---------------------------------------------

export interface SkipOptions {
  at?: ISODateTime;
  note?: string;
}

export function skipCalendarWorkout(
  workouts: CalendarWorkout[],
  id: CalendarWorkoutId,
  options: SkipOptions = {}
): CalendarWorkout[] {
  const at = options.at ?? nowISO();

  const next = clone(workouts);
  const { workout, index } = findOrThrow(next, id, "skipCalendarWorkout");

  assertNotAlreadySkipped(workout, "skipCalendarWorkout");

  if (workout.status === "completed") {
    throw new Error("skipCalendarWorkout: cannot skip a completed workout");
  }

  next[index] = {
    ...workout,
    status: "skipped",
    skippedAt: at,
    notes: options.note ?? workout.notes,
    updatedAt: at,
  };

  return next;
}

// ---------------------------------------------
// 2) Complete
// ---------------------------------------------

export interface CompleteOptions {
  at?: ISODateTime;
  historyEntryId: HistoryEntryId;
  note?: string;
}

export function completeCalendarWorkout(
  workouts: CalendarWorkout[],
  id: CalendarWorkoutId,
  options: CompleteOptions
): CalendarWorkout[] {
  const at = options.at ?? nowISO();

  const next = clone(workouts);
  const { workout, index } = findOrThrow(next, id, "completeCalendarWorkout");

  assertNotAlreadyCompleted(workout, "completeCalendarWorkout");

  if (workout.status === "skipped") {
    throw new Error(
      "completeCalendarWorkout: cannot complete a skipped workout (use adaptive overwrite first)"
    );
  }

  next[index] = {
    ...workout,
    status: "completed",
    completedAt: at,
    historyEntryId: options.historyEntryId,
    notes: options.note ?? workout.notes,
    updatedAt: at,
  };

  return next;
}

// ---------------------------------------------
// 3) Overwrite (Adaptiv / Quick Pick outcome)
// ---------------------------------------------

export interface OverwriteAdaptiveOptions {
  at?: ISODateTime;

  // In Launch: WorkoutType kann bei Quick Pick ggf. wechseln,
  // bei Adaptiv bleibt er meist gleich. Wir lassen es flexibel.
  newWorkoutType: WorkoutType;

  note?: string;
  keepPlanReference?: boolean;

  newStatus?: Extract<CalendarWorkoutStatus, "adaptive" | "planned">;

  // NEW: Adaptive Meta
  adaptiveProfile?: AdaptiveProfile; // "A"|"B"|"C"
  adaptiveReasons?: string[];
  estimatedMinutes?: number;
}

export function overwriteCalendarWorkoutAdaptive(
  workouts: CalendarWorkout[],
  id: CalendarWorkoutId,
  options: OverwriteAdaptiveOptions
): CalendarWorkout[] {
  const at = options.at ?? nowISO();

  const next = clone(workouts);
  const { workout: original, index } = findOrThrow(next, id, "overwriteCalendarWorkoutAdaptive");

  if (original.status === "completed") {
    throw new Error("overwriteCalendarWorkoutAdaptive: cannot overwrite a completed workout");
  }

  const keepPlan = options.keepPlanReference ?? true;

  next[index] = {
    ...original,
    status: options.newStatus ?? "adaptive",

    // Audit ohne zweiten Eintrag
    adaptedAt: at,
    adaptedFromWorkoutType: original.workoutType,

    // eigentliche Überschreibung
    workoutType: options.newWorkoutType,

    // Plan-Referenz
    sourcePlanId: keepPlan ? original.sourcePlanId : undefined,

    // Adaptive Meta (neu)
    adaptiveProfile: options.adaptiveProfile ?? original.adaptiveProfile,
    adaptiveReasons: options.adaptiveReasons ?? original.adaptiveReasons,
    estimatedMinutes:
      typeof options.estimatedMinutes === "number" ? options.estimatedMinutes : original.estimatedMinutes,

    notes: options.note ?? original.notes,
    updatedAt: at,
  };

  return next;
}