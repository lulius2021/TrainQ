// src/utils/adaptiveExerciseRotation.ts
// Smart exercise rotation: avoid repeats, detect stalls, balance muscles

import type { WorkoutHistoryEntry } from "./workoutHistory";
import type { ExerciseRotationContext, StalledExercise } from "../types/adaptive";

/**
 * Get exercises done in the last 24 hours (to avoid repeats).
 */
function getRecentExerciseNames(workouts: WorkoutHistoryEntry[]): string[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const names = new Set<string>();

  for (const w of workouts) {
    if (new Date(w.startedAt).getTime() < cutoff) continue;
    for (const ex of w.exercises ?? []) {
      names.add(ex.name.toLowerCase());
    }
  }

  return Array.from(names);
}

/**
 * Detect exercises that have stalled (same weight for 4+ consecutive sessions).
 */
function detectStalledExercises(workouts: WorkoutHistoryEntry[]): StalledExercise[] {
  // Build per-exercise weight history (most recent first)
  const exerciseHistory = new Map<string, number[]>();

  // Sort workouts by date descending
  const sorted = [...workouts]
    .filter((w) => (w.sport || "").toLowerCase() === "gym" || (!w.sport && w.totalVolume > 0))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  for (const w of sorted) {
    for (const ex of w.exercises ?? []) {
      const key = ex.name.toLowerCase();
      const maxWeight = Math.max(0, ...ex.sets.map((s) => s.weight || 0));
      if (maxWeight <= 0) continue;

      const history = exerciseHistory.get(key) || [];
      if (history.length < 6) {
        history.push(maxWeight);
        exerciseHistory.set(key, history);
      }
    }
  }

  const stalled: StalledExercise[] = [];

  exerciseHistory.forEach((weights, name) => {
    if (weights.length < 4) return;

    // Check if the last 4 sessions have the same max weight
    const recent4 = weights.slice(0, 4);
    const allSame = recent4.every((w) => w === recent4[0]);

    if (allSame) {
      stalled.push({
        name,
        sessionsAtSameWeight: recent4.length,
      });
    }
  });

  return stalled;
}

/**
 * Build exercise rotation context from workout history.
 */
export function getExerciseRotationContext(workouts: WorkoutHistoryEntry[]): ExerciseRotationContext {
  return {
    recentExerciseNames: getRecentExerciseNames(workouts),
    stalledExercises: detectStalledExercises(workouts),
  };
}
