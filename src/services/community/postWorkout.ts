import { computeWorkoutShareStats } from "../../utils/workoutShare";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { createPost } from "./api";
import type { WorkoutData } from "./types";

/**
 * Auto-post a completed workout to the community feed.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export function postWorkoutToFeed(entry: WorkoutHistoryEntry, userId: string): void {
  (async () => {
    try {
      const stats = computeWorkoutShareStats(entry);

      const workoutData: WorkoutData = {
        title: stats.title,
        sport: stats.sport,
        durationMin: stats.durationMin,
        durationLabel: stats.durationLabel,
        totalVolumeKg: stats.totalVolumeKg,
        totalSets: stats.totalSets,
        totalExercises: stats.totalExercises,
        topExercises: stats.topExercises,
        muscleGroups: stats.muscleGroups,
      };

      const text = `${stats.title} abgeschlossen — ${stats.durationLabel}, ${stats.totalSets} Sätze`;

      await createPost(userId, {
        type: "workout_share",
        text,
        visibility: "public",
        workoutRefId: entry.id,
        workoutData,
      });
    } catch {
      // Silently ignore — community post failure must never crash the app
    }
  })();
}
