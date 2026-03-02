// trainq-core/src/types/index.ts
// Barrel exports (Launch-safe): explizit, um Duplicate-Exports & Missing-Exports zu vermeiden

// -------------------- Core: Plan / Calendar / History --------------------
export type {
  ISODate,
  ISODateTime,
  PlanId,
  CalendarWorkoutId,
  HistoryEntryId,
  WeekdayIndex,
  SportScope,
  SplitType,
  WorkoutType,
  PlanDayRule,
  TrainingPlan,
  NewTrainingPlan,
  CalendarWorkout,
  NewCalendarWorkout,
  WorkoutHistoryEntry,
  NewWorkoutHistoryEntry,
  CalendarWorkoutStatus,
  AdaptiveProfile,

  // ✅ Core-prefixed (verhindert Kollision mit ./adaptive)
  CoreAdaptiveProfileType,
  CoreAdaptiveAnswers,
  CoreTimeTodayBucket,
  CoreDayFormBucket,
  CoreStressBucket,
  CoreYesterdayEffortBucket,
} from "./trainq-core";

// -------------------- LiveWorkout (NUR HIER exportieren) --------------------
export type { LiveWorkout } from "./liveWorkout";

// -------------------- Adaptive UI Types (Core Package) --------------------
// WICHTIG: Nur die Types exportieren, die ./adaptive wirklich exportiert.
// Buckets NICHT exportieren, weil sie häufig NICHT existieren und TS dann meckert.
// Stattdessen überall nutzen: AdaptiveAnswers["timeToday"] etc.
export type {
  AdaptiveProfileType,
  AdaptiveAnswers,
  AdaptiveReason,
  AdaptiveSuggestion,
} from "./adaptive";

export type TabKey = "dashboard" | "calendar" | "today" | "plan" | "community" | "profile";

// -------------------- UI Types (Visual Layer) --------------------
export type { CalendarEvent, ExerciseType } from "./ui";
