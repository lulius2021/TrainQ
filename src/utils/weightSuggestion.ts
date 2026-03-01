import { loadWorkoutHistory, type WorkoutHistoryEntry } from "./workoutHistory";
import { isWorkingSet } from "./stats";

export interface WeightSuggestion {
  lastWeight: number;
  lastReps: number;
  lastDate: string;
  allSetsCompleted: boolean;
  suggestedWeight: number;
  increment: number;
}

export function getWeightSuggestion(
  exerciseName: string,
  options?: { increment?: number; exerciseId?: string }
): WeightSuggestion | null {
  const increment = options?.increment ?? 2.5;
  const history = loadWorkoutHistory();

  // Find the most recent workout containing this exercise
  for (const workout of history) {
    for (const ex of workout.exercises) {
      const nameMatch = ex.name === exerciseName;
      const idMatch = options?.exerciseId && ex.exerciseId === options.exerciseId;

      if (!nameMatch && !idMatch) continue;

      // Filter to working sets only
      const workingSets = ex.sets.filter(s => isWorkingSet(s));
      if (workingSets.length === 0) continue;

      // Find max weight and corresponding reps
      let maxWeight = 0;
      let maxReps = 0;
      for (const s of workingSets) {
        const w = Number(s.weight ?? 0);
        const r = Number(s.reps ?? 0);
        if (w > maxWeight) {
          maxWeight = w;
          maxReps = r;
        }
      }

      if (maxWeight <= 0) continue;

      // Check if all working sets were completed (have reps > 0 and weight > 0)
      const allCompleted = workingSets.every(s => {
        const w = Number(s.weight ?? 0);
        const r = Number(s.reps ?? 0);
        return w > 0 && r > 0;
      });

      const suggestedWeight = allCompleted ? maxWeight + increment : maxWeight;
      const date = workout.endedAt || workout.startedAt;

      return {
        lastWeight: maxWeight,
        lastReps: maxReps,
        lastDate: date,
        allSetsCompleted: allCompleted,
        suggestedWeight,
        increment,
      };
    }
  }

  return null;
}
