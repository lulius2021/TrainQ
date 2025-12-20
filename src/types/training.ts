// src/types/training.ts
// TrainQ – Zentrale Training Types (UI + Core kompatibel)
// ACHTUNG: Diese Datei ist die EINZIGE Quelle für Training / LiveWorkout / Plan-nahe Typen

import type { AdaptiveSuggestion } from "./adaptive";

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
 * ✅ damit category wirklich persistiert & typ-sicher ist
 */
export type AppointmentCategory = "alltag" | "arbeit" | "gesundheit" | "freizeit" | "sonstiges";

/**
 * Kalender Event
 */
export interface CalendarEvent {
  id: string;
  title: string;

  description?: string;
  notes?: string;

  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm

  type?: EventType;

  /**
   * ✅ Kategorie für "other" Events (Termine)
   * (wird in CalendarPage als (ev as any).category genutzt)
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
   * ✅ bleibt klein (TrainingType)
   */
  trainingType?: TrainingType;

  /**
   * ✅ OPTIONAL: falls irgendwo historisch "Gym"/"Laufen" etc. als trainingType gespeichert wurde.
   * Nutze das nur als Migration/Compat, nicht als neues Feld.
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
  // 🔹 Adaptive Meta (Dashboard)
  // ---------------------------------
  /**
   * Dashboard nutzt A/B/C (du zeigst das auch so im UI).
   * (Vorher war hier stabil/kompakt/fokus → das hat mit deinem Dashboard-Code gekracht)
   */
  adaptiveProfile?: "A" | "B" | "C";
  adaptiveEstimatedMinutes?: number;
  adaptiveAppliedAt?: string;
  adaptiveAnswers?: any;

  /**
   * ✅ DIE Wahrheit (vollständig)
   * Wird vom Dashboard gespeichert und von LiveTrainingPage genutzt.
   */
  adaptiveSuggestion?: AdaptiveSuggestion;
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
// 🔥 CORE PLAN / SPLIT (TrainQ Core)
// ---------------------------------------------

export type ISODate = string;
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SplitType = "push_pull" | "upper_lower";
export type WorkoutType = "Push" | "Pull" | "Upper" | "Lower";

/**
 * Regel: welcher WorkoutType an welchem Wochentag
 *
 * ✅ Update:
 * - PlanDayRule braucht sport, weil planToCalendarEvent(rule.sport) nutzt
 * - workoutType ist nur für Gym relevant → optional
 */
export interface PlanDayRule {
  weekday: WeekdayIndex;
  sport: SportType; // "Gym" | "Laufen" | "Radfahren" | "Custom"
  workoutType?: WorkoutType; // nur relevant für Gym
}

/**
 * Trainingsplan (Core)
 * 👉 für Launch bewusst NUR Gym als Plan-Sport ok,
 * aber Regeln dürfen trotzdem später Laufen/Rad enthalten (optional).
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
// 🔴 LIVE TRAINING (Session, NICHT Kalender)
// ---------------------------------------------

export interface LiveSet {
  id: string;
  reps?: number;
  weight?: number;
  notes?: string;
  completed: boolean;
  completedAt?: string;
}

export interface LiveExercise {
  id: string;
  exerciseId?: string;
  name: string;
  sets: LiveSet[];
  restSeconds: number;
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