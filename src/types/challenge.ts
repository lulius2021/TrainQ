// src/types/challenge.ts

export type ChallengeGoalType = "workout_count" | "distance_km" | "volume_kg";

export interface ChallengeGoal {
  type: ChallengeGoalType;
  target: number;
  sportFilter?: string; // e.g., "Gym", "Laufen", "Radfahren"
}

export interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  goal: ChallengeGoal;
  durationDays: number;
  emoji: string;
  reward?: { type: "pro_days"; days: number };
  isAdmin: boolean; // true = bundled, false = user-created solo
}

export interface UserChallengeState {
  challengeId: string;
  joinedAt: string; // ISO
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
  rewardClaimed: boolean;
}

export interface ProGrant {
  grantedAt: string;
  expiresAt: string;
  source: string; // challengeId
}

export interface ChallengesUserData {
  joined: UserChallengeState[];
  soloDefinitions: ChallengeDefinition[];
  proGrants: ProGrant[];
}
