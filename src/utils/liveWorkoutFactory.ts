// src/utils/liveWorkoutFactory.ts
// TrainQ Launch-Core: LiveWorkout Factory + Converters (minimal)

import type { CalendarWorkout, ISODateTime, WorkoutHistoryEntry } from "../types";
import type { LiveWorkout } from "../types/liveWorkout";
import { generateId } from "./trainqStorage";

function nowISO(): ISODateTime {
  return new Date().toISOString();
}

export function createLiveWorkoutFromCalendar(
  calendarWorkout: CalendarWorkout,
  opts: { notes?: string; at?: ISODateTime } = {}
): LiveWorkout {
  const at = opts.at ?? nowISO();

  if (calendarWorkout.status === "completed") {
    throw new Error("createLiveWorkoutFromCalendar: cannot start a completed workout");
  }

  return {
    id: generateId("lw"),
    calendarWorkoutId: calendarWorkout.id,
    workoutType: calendarWorkout.workoutType,
    status: "active",
    startedAt: at,
    notes: opts.notes,
  };
}

export function completeLiveWorkout(
  liveWorkout: LiveWorkout,
  opts: { at?: ISODateTime; notes?: string } = {}
): LiveWorkout {
  if (liveWorkout.status !== "active") {
    throw new Error("completeLiveWorkout: workout is not active");
  }

  const at = opts.at ?? nowISO();
  const started = new Date(liveWorkout.startedAt).getTime();
  const ended = new Date(at).getTime();
  const durationSeconds = Math.max(0, Math.round((ended - started) / 1000));

  return {
    ...liveWorkout,
    status: "completed",
    endedAt: at,
    durationSeconds,
    notes: opts.notes ?? liveWorkout.notes,
  };
}

export function abortLiveWorkout(
  liveWorkout: LiveWorkout,
  opts: { at?: ISODateTime; notes?: string } = {}
): LiveWorkout {
  if (liveWorkout.status !== "active") {
    throw new Error("abortLiveWorkout: workout is not active");
  }

  const at = opts.at ?? nowISO();
  return {
    ...liveWorkout,
    status: "aborted",
    endedAt: at,
    notes: opts.notes ?? liveWorkout.notes,
  };
}

/**
 * Minimaler Converter in WorkoutHistoryEntry.
 * (Setzt nur Felder, die im Core zwingend gebraucht werden.)
 */
export function liveWorkoutToHistoryEntry(
  liveWorkout: LiveWorkout,
  calendarWorkout: CalendarWorkout
): WorkoutHistoryEntry {
  if (liveWorkout.status !== "completed" || !liveWorkout.endedAt || !liveWorkout.durationSeconds) {
    throw new Error("liveWorkoutToHistoryEntry: liveWorkout must be completed");
  }

  const createdAt = nowISO();

  // Wir nehmen das Datum aus dem Kalender (Wahrheit)
  // und den workoutType aus dem (ggf. adaptiven) Kalendereintrag.
  return {
    id: generateId("wh"),
    calendarWorkoutId: calendarWorkout.id,
    date: calendarWorkout.date,
    workoutType: calendarWorkout.workoutType,
    startedAt: liveWorkout.startedAt,
    endedAt: liveWorkout.endedAt,
    durationSeconds: liveWorkout.durationSeconds,
    notes: liveWorkout.notes,
    createdAt,
  } as WorkoutHistoryEntry;
}