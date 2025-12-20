// src/types/liveWorkout.ts
// TrainQ Launch-Core: LiveWorkout (minimal)
//
// Scope jetzt:
// - Start / Abort / Complete Lifecycle
// - Keine Übungen/Sätze/Timer in diesem Schritt

import type { CalendarWorkoutId, ISODateTime, WorkoutType } from "./trainq-core";

export type LiveWorkoutStatus = "active" | "completed" | "aborted";

export interface LiveWorkout {
  id: string;

  calendarWorkoutId: CalendarWorkoutId;

  // Snapshot vom Typ beim Start (wichtig, falls später adaptiv überschrieben wird)
  workoutType: WorkoutType;

  status: LiveWorkoutStatus;

  startedAt: ISODateTime;
  endedAt?: ISODateTime;

  durationSeconds?: number;

  notes?: string;
}