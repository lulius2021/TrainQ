import { loadWorkoutHistory } from "./workoutHistory";
import { isWorkingSet } from "./stats";

export type PRType = "weight" | "e1rm" | "both";

export interface PRBaseline {
  bestWeight: number;
  bestE1RM: number;
}

export interface PRCheckResult {
  isPR: boolean;
  prType?: PRType;
}

export function buildPRBaseline(excludeWorkoutId?: string): Map<string, PRBaseline> {
  const history = loadWorkoutHistory();
  const map = new Map<string, PRBaseline>();

  for (const w of history) {
    if (excludeWorkoutId && w.id === excludeWorkoutId) continue;
    for (const ex of w.exercises || []) {
      let current = map.get(ex.name) ?? { bestWeight: 0, bestE1RM: 0 };
      for (const set of ex.sets || []) {
        if (!isWorkingSet(set)) continue;
        const weight = Number(set.weight ?? 0);
        const reps = Number(set.reps ?? 0);
        if (weight > 0 && weight > current.bestWeight) {
          current.bestWeight = weight;
        }
        // e1RM calculation (Epley: weight * (1 + reps/30))
        if (weight > 0 && reps >= 1 && reps <= 10) {
          const e1rm = weight * (1 + reps / 30);
          if (e1rm > current.bestE1RM) current.bestE1RM = e1rm;
        }
      }
      map.set(ex.name, current);
    }
  }
  return map;
}

export function checkSetPR(
  exerciseName: string,
  set: { weight?: number; reps?: number },
  baseline: Map<string, PRBaseline>
): PRCheckResult {
  const weight = Number(set.weight ?? 0);
  const reps = Number(set.reps ?? 0);
  if (weight <= 0 || reps <= 0) return { isPR: false };

  const base = baseline.get(exerciseName);
  if (!base) {
    // First time doing this exercise - it's a PR by definition if we have data
    return weight > 0 ? { isPR: true, prType: "weight" } : { isPR: false };
  }

  const isWeightPR = weight > base.bestWeight;

  let isE1RMPR = false;
  if (reps >= 1 && reps <= 10) {
    const e1rm = weight * (1 + reps / 30);
    isE1RMPR = e1rm > base.bestE1RM;
  }

  if (isWeightPR && isE1RMPR) return { isPR: true, prType: "both" };
  if (isWeightPR) return { isPR: true, prType: "weight" };
  if (isE1RMPR) return { isPR: true, prType: "e1rm" };
  return { isPR: false };
}
