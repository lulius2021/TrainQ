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

// --- Server-side types (Supabase) ---

export interface ServerChallenge {
  id: string;
  slug: string;
  title: string;
  description: string;
  emoji: string;
  goal: ChallengeGoal;
  durationDays: number;
  reward?: { type: "pro_days"; days: number };
  activeFrom: string;
  activeUntil: string;
  maxWinners: number;
  currentWinners: number;
}

export interface ServerParticipation {
  id: string;
  challengeId: string;
  startDate: string;
  endDate: string;
  progressCurrent: number;
  progressTarget: number;
  completed: boolean;
  completedAt?: string;
  rewardEligible: boolean;
  rewardClaimed: boolean;
  rewardExpiresAt?: string;
}

export interface ServerProGrant {
  id: string;
  grantedAt: string;
  expiresAt: string;
  sourceChallengeId: string;
  isActive: boolean;
}
