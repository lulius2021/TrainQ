// src/utils/muscleVolumeCalculator.ts
// Feature 8: Berechnet Muskelvolumen aus Workout-History für den Avatar

import type { Muscle } from "../data/exerciseLibrary";
import { EXERCISES } from "../data/exerciseLibrary";
import { loadWorkoutHistory, type WorkoutHistoryEntry } from "./workoutHistory";

export type MuscleVolumeMap = Partial<Record<Muscle, number>>;

function parseISODate(input: string): Date {
  const d = new Date(input);
  return Number.isFinite(d.getTime()) ? d : new Date();
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export function computeMuscleVolume(
  workouts: WorkoutHistoryEntry[],
  periodDays: number
): MuscleVolumeMap {
  const cutoff = daysAgo(periodDays);
  const volumes: MuscleVolumeMap = {};

  for (const w of workouts) {
    const d = parseISODate(w.endedAt || w.startedAt);
    if (d < cutoff) continue;

    for (const ex of w.exercises || []) {
      // Find exercise definition
      const exDef = ex.exerciseId
        ? EXERCISES.find((e) => e.id === ex.exerciseId)
        : EXERCISES.find((e) =>
            e.name.toLowerCase() === ex.name.toLowerCase() ||
            e.nameDe?.toLowerCase() === ex.name.toLowerCase() ||
            e.nameEn?.toLowerCase() === ex.name.toLowerCase()
          );

      if (!exDef) continue;

      const setCount = (ex.sets || []).length;
      if (setCount === 0) continue;

      // Primary muscles get full credit
      for (const m of exDef.primaryMuscles || []) {
        const muscle = m as Muscle;
        volumes[muscle] = (volumes[muscle] ?? 0) + setCount;
      }

      // Secondary muscles get half credit
      for (const m of exDef.secondaryMuscles || []) {
        const muscle = m as Muscle;
        volumes[muscle] = (volumes[muscle] ?? 0) + setCount * 0.5;
      }
    }
  }

  return volumes;
}

export function normalizeVolumeMap(volumes: MuscleVolumeMap): Record<Muscle, number> {
  const allMuscles: Muscle[] = [
    "chest", "back", "lats", "traps", "rear_delts", "front_delts", "side_delts",
    "biceps", "triceps", "forearms", "quads", "hamstrings", "glutes", "calves",
    "core", "obliques", "lower_back", "hip_flexors",
  ];

  let max = 0;
  for (const v of Object.values(volumes)) {
    if (typeof v === "number" && v > max) max = v;
  }

  const result = {} as Record<Muscle, number>;
  for (const m of allMuscles) {
    const raw = volumes[m] ?? 0;
    result[m] = max > 0 ? raw / max : 0;
  }

  return result;
}

export function loadMuscleVolumeForPeriod(periodDays: number): Record<Muscle, number> {
  const history = loadWorkoutHistory();
  const volumes = computeMuscleVolume(history, periodDays);
  return normalizeVolumeMap(volumes);
}
