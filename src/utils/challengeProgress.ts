// src/utils/challengeProgress.ts
import { loadWorkoutHistory } from "./workoutHistory";
import type { ChallengeDefinition, UserChallengeState } from "../types/challenge";

export interface ChallengeProgressResult {
  current: number;
  target: number;
  progress01: number; // 0-1
  isComplete: boolean;
}

export function computeChallengeProgress(
  challenge: ChallengeDefinition,
  userState: UserChallengeState
): ChallengeProgressResult {
  const history = loadWorkoutHistory();
  const { startDate, endDate } = userState;
  const { goal } = challenge;

  // Filter workouts within the challenge date range
  const filtered = history.filter((w) => {
    const wDate = (w.startedAt || "").slice(0, 10);
    if (!wDate) return false;
    if (wDate < startDate || wDate > endDate) return false;

    // Apply sport filter if specified
    if (goal.sportFilter) {
      const wSport = (w.sport || "").toLowerCase();
      const filterSport = goal.sportFilter.toLowerCase();
      if (wSport !== filterSport) return false;
    }

    return true;
  });

  let current = 0;

  switch (goal.type) {
    case "workout_count":
      current = filtered.length;
      break;

    case "distance_km":
      current = filtered.reduce((sum, w) => sum + (w.distanceKm ?? 0), 0);
      // Round to 1 decimal
      current = Math.round(current * 10) / 10;
      break;

    case "volume_kg":
      current = filtered.reduce((sum, w) => sum + (w.totalVolume ?? 0), 0);
      current = Math.round(current);
      break;
  }

  const progress01 = goal.target > 0 ? Math.min(1, current / goal.target) : 0;
  const isComplete = current >= goal.target;

  return { current, target: goal.target, progress01, isComplete };
}
