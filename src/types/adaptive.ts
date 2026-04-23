// trainq-core/src/types/adaptive.ts
// TrainQ Launch: Adaptive Types (single source of truth)

export type AdaptiveProfileType = "stabil" | "kompakt" | "fokus";

// Buckets (UI-Antworten)
export type TimeTodayBucket = "lt20" | "20to40" | "40to60" | "gt60";
export type DayFormBucket = "low" | "mid" | "high";
export type StressBucket = "low" | "mid" | "high";
export type YesterdayEffortBucket = "low" | "mid" | "high";

// Post-Workout Feedback
export type PerceivedIntensity = "too_easy" | "right" | "too_hard";
export type PostFeeling = "exhausted" | "good" | "energized";

export interface PostWorkoutFeedback {
  perceivedIntensity: PerceivedIntensity;
  postFeeling: PostFeeling;
}

// Weekly Volume Context
export interface WeeklyVolumeContext {
  currentWeekVolume: number;
  previousWeekVolume: number;
  volumeChangePercent: number;
  currentWeekSessions: number;
  daysSinceLastSession: number;
  needsVolumeReduction: boolean;
  needsExtendedWarmup: boolean;
}

// Exercise Rotation Context
export interface StalledExercise {
  name: string;
  sessionsAtSameWeight: number;
}

export interface ExerciseRotationContext {
  recentExerciseNames: string[];
  stalledExercises: StalledExercise[];
}

// Week Split History
export interface WeekSplitEntry {
  day: string;
  split: string;
}

// Reasons (für Erklärbarkeit in UI)
export type AdaptiveReason =
  | "time_low"
  | "time_high"
  | "form_low"
  | "form_high"
  | "stress_low"
  | "stress_high"
  | "effort_low"
  | "effort_high"
  | "recovery_low"
  | "recovery_good"
  | "volume_high"
  | "rest_gap"
  | "last_too_hard"
  | "last_too_easy"
  | "split_covered";

// Antworten aus dem Modal
export interface AdaptiveAnswers {
  sport: "gym" | "laufen" | "radfahren";
  timeToday: TimeTodayBucket;
  dayForm: DayFormBucket;
  stress: StressBucket;
  yesterdayEffort: YesterdayEffortBucket;
}

// Vorschlag, der in der UI angezeigt wird
export interface AdaptiveSuggestion {
  profile: AdaptiveProfileType;
  title: string;
  subtitle: string;

  estimatedMinutes: number; // 0 => “blockiert”
  exercisesCount: number;
  setsPerExercise: number;

  intensityHint: string;
  reasons?: AdaptiveReason[];
}