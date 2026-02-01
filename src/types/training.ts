// src/types/training.ts
// TrainQ – Zentrale Training Types (UI + Core kompatibel)
// ACHTUNG: Diese Datei ist die EINZIGE Quelle für Training / LiveWorkout / Plan-nahe Typen

import type { AdaptiveSuggestion, AdaptiveAnswers } from "./adaptive";

// ---------------------------------------------
// Kalender / Planung (Backwards Compatible)
// ---------------------------------------------

export type EventType = "training" | "other";
export type CalendarView = "day" | "week" | "month";

/**
 * TrainingType für Kalenderfarben (UI)
 * (klein geschrieben → Alt-Code kompatibel)
 */
export type TrainingType = "gym" | "laufen" | "radfahren" | "custom";

/**
 * Sportarten (Auswertung / LiveWorkout)
 */
export type SportType = "Gym" | "Laufen" | "Radfahren" | "Custom";

/**
 * Status eines Trainings im Kalender
 */
export type TrainingStatus = "open" | "completed" | "skipped";

/**
 * Kategorien für Nicht-Training-Termine (Kalender)
 *
 * WICHTIG:
 * - In Dashboard/Calendar können User eigene Kategorien anlegen.
 * - Deshalb darf das KEIN festes Union sein, sondern muss string sein.
 */
export type AppointmentCategory = string;

/**
 * Zeitangabe:
 * - HH:mm (z.B. "09:30")
 * - oder "" (optional / nicht gesetzt)
 *
 * Hintergrund: In der App werden fehlende Zeiten beim Laden/Normalisieren auf "" gesetzt,
 * damit überall stabile Strings existieren (keine undefined/null).
 */
export type OptionalTime = string; // "HH:mm" | "" (MVP: bewusst string, aber dokumentiert)

/**
 * Kalender Event
 */
export interface CalendarEvent {
  id: string;
  userId?: string;
  title: string;

  description?: string;
  notes?: string;

  date: string; // YYYY-MM-DD

  /** optional im UI -> leerer String erlaubt */
  startTime: OptionalTime; // "HH:mm" | ""
  /** optional im UI -> leerer String erlaubt */
  endTime: OptionalTime; // "HH:mm" | ""

  type?: EventType;

  /**
   * Kategorie für "other" Events (Termine)
   */
  category?: AppointmentCategory;

  // Legacy / UI Felder
  dayLabel?: string;
  details?: string;

  /**
   * Legacy kompatibel:
   * - bisher string
   * - neu: sauberer SportType möglich
   */
  sport?: SportType | string;

  /**
   * UI Training Typ (Farben, Labels)
   * bleibt klein (TrainingType)
   */
  trainingType?: TrainingType;

  /**
   * OPTIONAL: falls historisch "Gym"/"Laufen" etc. als trainingType gespeichert wurde.
   * Nur für Migration/Compat, nicht als neues Feld verwenden.
   */
  trainingTypeLegacy?: SportType | string;

  /**
   * Kalender-Status
   */
  trainingStatus?: TrainingStatus;

  skippedAt?: string;
  completedAt?: string;

  /**
   * History-Verknüpfung
   */
  workoutId?: string;

  /**
   * Optional: Plan / Template
   */
  templateId?: string;

  // ---------------------------------
  // Adaptive Meta (Dashboard)
  // ---------------------------------

  /**
   * Dashboard nutzt A/B/C.
   */
  adaptiveProfile?: "A" | "B" | "C";

  /**
   * Optional: kompakte Gründe (Dashboard zeigt max. 3)
   */
  adaptiveReasons?: string[];

  adaptiveEstimatedMinutes?: number;
  adaptiveAppliedAt?: string;

  /** ✅ vorher any -> jetzt korrekt typisiert */
  adaptiveAnswers?: AdaptiveAnswers;

  /**
   * DIE Wahrheit (vollständig)
   * Wird vom Dashboard gespeichert und von LiveTrainingPage genutzt.
   */
  adaptiveSuggestion?: AdaptiveSuggestion;

  /**
   * Optional: Geplantes Training (adhoc oder from template)
   * Damit das Dashboard weiß, was ansteht.
   */
  workoutData?: {
    exercises: LiveExercise[];
    templateId?: string;
  };

  /**
   * Deload Markierung (UI/Modifier, kein Status)
   */
  deload?: boolean;
}

/**
 * Neuer Kalender-Eintrag
 */
export type NewCalendarEvent = Omit<CalendarEvent, "id">;

/**
 * Kommende Trainings fürs Dashboard
 */
export interface UpcomingTraining {
  id: string;
  title: string;
  date: string;
  time: string;
  notes?: string;
  [key: string]: any;
}

// ---------------------------------------------
// CORE PLAN / SPLIT (TrainQ Core)
// ---------------------------------------------

export type ISODate = string;
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SplitType = "push_pull" | "upper_lower";
export type WorkoutType = "Push" | "Pull" | "Upper" | "Lower";

/**
 * Regel: welcher WorkoutType an welchem Wochentag
 * workoutType ist nur für Gym relevant → optional
 */
export interface PlanDayRule {
  weekday: WeekdayIndex;
  sport: SportType; // "Gym" | "Laufen" | "Radfahren" | "Custom"
  workoutType?: WorkoutType; // nur relevant für Gym
}

/**
 * Trainingsplan (Core)
 */
export interface TrainingPlan {
  id: string;
  name: string;
  sport: "Gym"; // Launch-Fokus
  splitType: SplitType;
  startDate: ISODate;
  weeklyRules: PlanDayRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NewTrainingPlan = Omit<TrainingPlan, "id" | "createdAt" | "updatedAt">;

// ---------------------------------------------
// LIVE TRAINING (Session, NICHT Kalender)
// ---------------------------------------------

export type SetType = "normal" | "warmup" | "failure" | "1D";
export type SetTag = "W" | "F" | "D";

export type DropEntry = {
  id: string;
  weight: number | null;
  reps: number | null;
};

export interface LiveSet {
  id: string;
  reps?: number;
  weight?: number;
  notes?: string;
  completed: boolean;
  completedAt?: string;
  setType?: SetType; // ✅ Satztyp: Warmup (W), Failure (F), 1D, normal
  tag?: SetTag | null;
  drops?: DropEntry[];
}

export interface LiveExercise {
  id: string;
  exerciseId?: string;
  name: string;
  sets: LiveSet[];

  /**
   * ✅ Optional:
   * - undefined / null / "" im UI bedeutet: kein Pausentimer aktiv
   * - wenn gesetzt: Sekunden (später clamp/validierung in UI/Logic)
   */
  restSeconds?: number;
}

export interface LiveWorkout {
  id: string;

  calendarEventId?: string;

  title: string;
  sport: SportType;

  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;

  isActive: boolean;

  /**
   * ✅ Minimiert / Vollbild
   * wird von LiveTrainingPage/App genutzt, um das Fenster nach unten zu „dock’en“
   */
  isMinimized?: boolean;

  exercises: LiveExercise[];
  notes?: string;

  abortedAt?: string;
}

export interface CompletedWorkout extends Omit<LiveWorkout, "isActive"> {
  isActive: false;
  endedAt: string;
  durationSeconds: number;

  totalVolumeKg?: number;
  totalDistanceKm?: number;
}

// ---------------------------------------------
// Backwards-Compatible Aliases
// ---------------------------------------------

export type TrainingExercise = LiveExercise;
export type TrainingSet = LiveSet;

// ---------------------------------------------
// History / Stats
// ---------------------------------------------

export interface ExerciseHistoryEntry {
  exerciseId?: string;
  exerciseName: string;
  lastPerformedAt: string;
  sets: Array<{
    reps?: number;
    weight?: number;
    notes?: string;
  }>;
}

export interface TrainingHistoryStore {
  version: number;
  workouts: CompletedWorkout[];
  exerciseHistory: Record<string, ExerciseHistoryEntry>;
}

export interface TrainingGoals {
  weeklyMinutes?: number;
  monthlyMinutes?: number;
}

export interface ProfileStats {
  range: "week" | "month" | "5weeks";

  countBySport: Record<SportType, number>;
  minutesBySport: Record<SportType, number>;

  gymTotalVolumeKg?: number;

  runTotalKm?: number;
  bikeTotalKm?: number;

  goalMinutes?: number;
  completedMinutes?: number;
  goalProgress01?: number;
}

export interface WeeklyTrendPoint {
  weekStartDate: string;
  label: string;
  sport: SportType;
  minutes: number;
  gymVolumeKg?: number;
  distanceKm?: number;
}
