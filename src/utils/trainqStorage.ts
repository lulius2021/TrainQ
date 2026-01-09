// src/utils/trainqStorage.ts
// TrainQ Launch-Core: localStorage Persistence
//
// Ziel:
// - Kleine, robuste Storage-Schicht für Plan / Kalender / History + Active LiveWorkout (minimal)
// - Versioniert, migrationsfähig (minimal)
// - Keine UI-Abhängigkeiten, keine Magie
//
// Regeln:
// - load*() gibt IMMER sinnvolle Defaults zurück
// - save*() schreibt atomar (ein Key pro Domain)
// - IDs werden hier generiert (Runtime), nicht in Types

import type { CalendarWorkout, TrainingPlan, WorkoutHistoryEntry } from "../types";
import type { LiveWorkout } from "../types/liveWorkout";
import { getScopedItem, removeScopedItem, setScopedItem } from "./scopedStorage";

const STORAGE_VERSION = 1;

// Keys (bewusst getrennt, damit du bei Bedarf einzeln resetten kannst)
const KEY_PLANS = "trainq.core.plans.v1";
const KEY_CALENDAR = "trainq.core.calendarWorkouts.v1";
const KEY_HISTORY = "trainq.core.workoutHistory.v1";

// ✅ Active LiveWorkout (Launch-minimal: max 1 gleichzeitig)
const KEY_ACTIVE_LIVE_WORKOUT = "trainq.core.activeLiveWorkout.v1";

// Optional: Meta-Key, falls du später Migrationen sauber fahren willst
const KEY_META = "trainq.core.meta";

type Meta = {
  version: number;
  updatedAt: string;
};

function nowISO(): string {
  return new Date().toISOString();
}

function safeParseJSON<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeMeta() {
  const meta: Meta = { version: STORAGE_VERSION, updatedAt: nowISO() };
  setScopedItem(KEY_META, JSON.stringify(meta));
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

// ------------------------------
// ID Generator
// ------------------------------

/**
 * Simple unique-ish ID generator (no external deps).
 * Format: "<prefix>_<time>_<rand>"
 */
export function generateId(prefix = "tq"): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${t}_${r}`;
}

// ------------------------------
// Plans
// ------------------------------

export function loadPlans(): TrainingPlan[] {
  const parsed = safeParseJSON<unknown>(getScopedItem(KEY_PLANS));
  return ensureArray<TrainingPlan>(parsed);
}

export function savePlans(plans: TrainingPlan[]): void {
  setScopedItem(KEY_PLANS, JSON.stringify(plans));
  writeMeta();
}

export function clearPlans(): void {
  removeScopedItem(KEY_PLANS);
  writeMeta();
}

// ------------------------------
// Calendar Workouts
// ------------------------------

export function loadCalendarWorkouts(): CalendarWorkout[] {
  const parsed = safeParseJSON<unknown>(getScopedItem(KEY_CALENDAR));
  return ensureArray<CalendarWorkout>(parsed);
}

export function saveCalendarWorkouts(workouts: CalendarWorkout[]): void {
  setScopedItem(KEY_CALENDAR, JSON.stringify(workouts));
  writeMeta();
}

export function clearCalendarWorkouts(): void {
  removeScopedItem(KEY_CALENDAR);
  writeMeta();
}

// ------------------------------
// Workout History
// ------------------------------

export function loadWorkoutHistory(): WorkoutHistoryEntry[] {
  const parsed = safeParseJSON<unknown>(getScopedItem(KEY_HISTORY));
  return ensureArray<WorkoutHistoryEntry>(parsed);
}

export function saveWorkoutHistory(history: WorkoutHistoryEntry[]): void {
  setScopedItem(KEY_HISTORY, JSON.stringify(history));
  writeMeta();
}

export function clearWorkoutHistory(): void {
  removeScopedItem(KEY_HISTORY);
  writeMeta();
}

// ------------------------------
// Active LiveWorkout (minimal)
// ------------------------------

export function loadActiveLiveWorkout(): LiveWorkout | null {
  const parsed = safeParseJSON<LiveWorkout>(getScopedItem(KEY_ACTIVE_LIVE_WORKOUT));
  return parsed ?? null;
}

export function saveActiveLiveWorkout(workout: LiveWorkout | null): void {
  if (!workout) {
    removeScopedItem(KEY_ACTIVE_LIVE_WORKOUT);
    return;
  }
  setScopedItem(KEY_ACTIVE_LIVE_WORKOUT, JSON.stringify(workout));
}

export function clearActiveLiveWorkout(): void {
  removeScopedItem(KEY_ACTIVE_LIVE_WORKOUT);
}

// ------------------------------
// Full Reset (optional helper)
// ------------------------------

export function clearAllTrainQCore(): void {
  removeScopedItem(KEY_PLANS);
  removeScopedItem(KEY_CALENDAR);
  removeScopedItem(KEY_HISTORY);
  removeScopedItem(KEY_ACTIVE_LIVE_WORKOUT);
  removeScopedItem(KEY_META);
  writeMeta();
}

// ------------------------------
// Meta (optional read)
// ------------------------------

export function loadMeta(): Meta | null {
  return safeParseJSON<Meta>(getScopedItem(KEY_META));
}
