// src/types/trainq-core.ts
// TrainQ Launch-Core Types
// Ziel: harte, klare Basis-Typen für Plan ↔ Kalender ↔ History.
// Keine UI-Typen, keine Legacy-Kompatibilität, keine Sportarten außer Gym.
//
// WICHTIG (Launch):
// - Adaptiv-UI (Fragen/Scoring) liegt NICHT hier, sondern in:
//   - src/types/adaptive.ts
//   - src/utils/adaptiveScoring.ts
// Hier speichern wir nur "Kalender-Wahrheit" (Status + Meta wie Profile/Reasons).

// ------------------------------
// Primitive Helpers
// ------------------------------

export type ISODate = string; // "YYYY-MM-DD"
export type ISODateTime = string;

export type PlanId = string;
export type CalendarWorkoutId = string;
export type HistoryEntryId = string;

/**
 * 0 = Montag ... 6 = Sonntag
 */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ------------------------------
// Launch Scope: Gym only
// ------------------------------

export type SportScope = "Gym";
export type SplitType = "push_pull" | "upper_lower";
export type WorkoutType = "Push" | "Pull" | "Upper" | "Lower";

// ------------------------------
// Calendar: Truth of reality
// ------------------------------

export type CalendarWorkoutStatus = "planned" | "completed" | "skipped" | "adaptive";

/**
 * A/B/C ist nur ein Marker im Kalender (Audit).
 */
export type AdaptiveProfile = "A" | "B" | "C";

// ------------------------------
// Adaptive Inputs (Core Storage Buckets)
// ✅ Core-prefixed to avoid collisions with UI types
// ------------------------------

export type CoreAdaptiveProfileType = "stabil" | "kompakt" | "fokus";

export type CoreTimeTodayBucket = "lt20" | "20to40" | "40to60" | "gt60";
export type CoreDayFormBucket = "low" | "mid" | "high";
export type CoreStressBucket = "low" | "mid" | "high";
export type CoreYesterdayEffortBucket = "low" | "mid" | "high";

export interface CoreAdaptiveAnswers {
  timeToday: CoreTimeTodayBucket;
  dayForm: CoreDayFormBucket;
  stress: CoreStressBucket;
  yesterdayEffort: CoreYesterdayEffortBucket;
}

// ------------------------------
// Common Domain Constraints
// ------------------------------

export type RestSeconds = number;
export type Reps = number;
export type WeightKg = number;

export type OptionalId<T extends string> = T | null;

// ------------------------------
// Plan (langfristige Struktur)
// ------------------------------

export interface PlanDayRule {
  weekday: WeekdayIndex;
  workoutType: WorkoutType;
}

export interface TrainingPlan {
  id: PlanId;
  name: string;

  sport: SportScope;
  splitType: SplitType;

  startDate: ISODate;

  weeklyRules: PlanDayRule[];

  isActive: boolean;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type NewTrainingPlan = Omit<TrainingPlan, "id" | "createdAt" | "updatedAt">;

// ------------------------------
// Kalender-Workout (Wahrheit des Alltags)
// ------------------------------

export interface CalendarWorkout {
  id: CalendarWorkoutId;
  date: ISODate;

  workoutType: WorkoutType;
  sourcePlanId?: PlanId;

  status: CalendarWorkoutStatus;

  notes?: string;

  historyEntryId?: HistoryEntryId;

  skippedAt?: ISODateTime;
  completedAt?: ISODateTime;

  adaptedAt?: ISODateTime;
  adaptedFromWorkoutType?: WorkoutType;

  adaptiveProfile?: AdaptiveProfile; // A/B/C Marker
  adaptiveReasons?: string[];        // kurze Gründe (UI)
  estimatedMinutes?: number;

  // Optional: Core-Audit der Antworten (wenn du es speichern willst)
  coreAdaptiveAnswers?: CoreAdaptiveAnswers;
  coreAdaptiveProfileType?: CoreAdaptiveProfileType;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type NewCalendarWorkout = Omit<CalendarWorkout, "id" | "createdAt" | "updatedAt">;

// ------------------------------
// History (abgeschlossene Workouts)
// ------------------------------

export interface WorkoutHistorySet {
  reps?: Reps;
  weightKg?: WeightKg;
  notes?: string;
  completed: boolean;
}

export interface WorkoutHistoryExercise {
  exerciseId?: string;
  name: string;
  sets: WorkoutHistorySet[];
  restSeconds?: RestSeconds;
}

export interface WorkoutHistoryEntry {
  id: HistoryEntryId;
  userId?: string;
  date: ISODate;

  workoutType: WorkoutType;

  startedAt: ISODateTime;
  endedAt: ISODateTime;

  durationSeconds: number;

  exercises: WorkoutHistoryExercise[];

  notes?: string;

  createdAt: ISODateTime;

  calendarWorkoutId?: CalendarWorkoutId;
}

export type NewWorkoutHistoryEntry = Omit<WorkoutHistoryEntry, "id" | "createdAt">;
