// src/types/onboarding.ts

export type Goal =
  | "structure"
  | "train_with_plan"
  | "lose_weight"
  | "build_muscle"
  | "live_healthier"
  | "get_fitter";

export type TrainingLocation =
  | "treadmill"
  | "gym"
  | "outdoor_park"
  | "no_gym"
  | "no_equipment";

export interface PersonalData {
  stressLevel: number; // 1–10
  sleepHours: number; // 0–12
  age: number | null;
  height: number | null; // in cm
  weight: number | null; // in kg
}

export interface GoalsData {
  selectedGoals: Goal[];
  loseWeightTargetKg?: number; // 55–120
  buildMuscleBodyShape?: "lean" | "athletic" | "muscular" | "massive" | "none";
  fitterTargetDistanceKm?: number; // 3 bis Ironman
  sports: string[];
}

export interface TrainingSetupData {
  hoursPerWeek: number | null;
  sessionsPerWeek: number | null;
  locations: TrainingLocation[];
}

export interface ObstaclesData {
  reasons: string[]; // siehe Seite 4
}

export interface ProfileData {
  username: string;
  bio?: string; // ✅ NEU: Profil-Bio persistent
  profileImageUrl?: string;
  stravaUrl?: string;
  isPublic: boolean;
}

export interface OnboardingData {
  personal: PersonalData;
  goals: GoalsData;
  training: TrainingSetupData;
  obstacles: ObstaclesData;
  profile: ProfileData;
  isCompleted: boolean;
}