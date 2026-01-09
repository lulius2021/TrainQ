// src/utils/trainingHistory.ts
//
// Zentrale Live-Workout Recovery + Completion-Flow
// ✅ Source of Truth fürs Profil/Diagramme: src/utils/workoutHistory.ts
// ✅ Genau 1 Write pro Training: completeLiveWorkout() -> addWorkoutEntry()

import type {
  CalendarEvent,
  ExerciseHistoryEntry,
  LiveExercise,
  LiveSet,
  LiveWorkout,
  SportType,
  TrainingStatus,
} from "../types/training";
import { getScopedItem, removeScopedItem, setScopedItem } from "./scopedStorage";

import {
  addWorkoutEntry,
  loadWorkoutHistory,
  type WorkoutHistoryEntry,
  type WorkoutHistoryExercise,
} from "./workoutHistory";

// ------------------------ storage keys ------------------------

const LS_ACTIVE = "trainq_active_live_workout_v1";
const LS_CORE_HISTORY = "trainq_training_history_store_v1"; // optional/back-compat store
const CORE_VERSION = 1;

// ------------------------ small helpers ------------------------

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeStringify(v: unknown): string | null {
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * ✅ Restzeit ist OPTIONAL:
 * - undefined/null/""/NaN => kein Timer
 * - sonst clamp 10s..300s
 */
function normalizeRestSeconds(input: unknown): number | undefined {
  if (input == null) return undefined;

  const n =
    typeof input === "number"
      ? input
      : typeof input === "string"
      ? Number(input.trim())
      : Number(String(input).trim());

  if (!Number.isFinite(n)) return undefined;

  const rounded = Math.round(n);
  if (rounded <= 0) return undefined;

  return Math.max(10, Math.min(300, rounded));
}

function normalizeSport(s?: SportType | string): SportType {
  const t = String(s || "").trim().toLowerCase();

  if (t === "gym") return "Gym";
  if (t === "laufen" || t === "run" || t === "running") return "Laufen";
  if (t === "radfahren" || t === "bike" || t === "cycling") return "Radfahren";
  if (t === "custom") return "Custom";

  // fallback (wenn unklar): Gym
  return "Gym";
}

function isCardioSport(sport: SportType | string | undefined): boolean {
  const s = normalizeSport(sport);
  return s === "Laufen" || s === "Radfahren";
}

function clampNonNegativeInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function computeDurationSeconds(startedAt: string, endedAt: string): number {
  const a = new Date(startedAt).getTime();
  const b = new Date(endedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 1000));
}

function sanitizeSetsForHistory(sets: LiveSet[]): Array<{ reps?: number; weight?: number; notes?: string }> {
  return (sets || []).map((s) => ({
    reps: typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : undefined,
    weight: typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : undefined,
    notes: typeof (s as any).notes === "string" ? (s as any).notes : undefined,
  }));
}

// Gym total volume: Sum(reps*weight) (kg*reps)
function computeTotalVolumeKg(exercises: LiveExercise[]): number {
  let total = 0;
  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      const reps = typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : 0;
      const w = typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : 0;
      total += reps * w;
    }
  }
  return Math.round(total);
}

// Cardio convention: reps = minutes, weight = km
function computeCardioFromSets(exercises: LiveExercise[]): { minutes: number; km: number } {
  let minutes = 0;
  let km = 0;

  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      const reps = typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : 0;
      const w = typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : 0;

      minutes += Math.max(0, reps);
      km += Math.max(0, w);
    }
  }

  return {
    minutes: Math.max(0, Math.round(minutes)),
    km: Math.round(km * 100) / 100,
  };
}

function computePaceSecPerKm(durationSec: number, distanceKm: number): number | undefined {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return undefined;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return undefined;

  const pace = durationSec / distanceKm; // sec/km
  if (!Number.isFinite(pace)) return undefined;

  // Guardrail: 60..3600
  const clamped = Math.max(60, Math.min(3600, Math.round(pace)));
  return clamped;
}

// ------------------------ core store (optional/back-compat) ------------------------

type TrainingHistoryStore = {
  version: number;
  workouts: any[]; // wir halten es bewusst weich (du nutzt primär workoutHistory.ts)
  exerciseHistory: Record<string, ExerciseHistoryEntry>;
};

function loadCoreStore(): TrainingHistoryStore {
  if (!hasWindow()) return { version: CORE_VERSION, workouts: [], exerciseHistory: {} };
  const parsed = safeParse<TrainingHistoryStore>(getScopedItem(LS_CORE_HISTORY));
  if (!parsed || typeof parsed !== "object") {
    return { version: CORE_VERSION, workouts: [], exerciseHistory: {} };
  }
  return {
    version: CORE_VERSION,
    workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
    exerciseHistory: parsed.exerciseHistory && typeof parsed.exerciseHistory === "object" ? parsed.exerciseHistory : {},
  };
}

function saveCoreStore(next: TrainingHistoryStore): void {
  if (!hasWindow()) return;
  const raw = safeStringify(next);
  if (!raw) return;
  try {
    setScopedItem(LS_CORE_HISTORY, raw);
  } catch {
    // ignore
  }
}

function updateExerciseHistoryFromWorkout(workout: LiveWorkout, endedAtISO: string): void {
  const store = loadCoreStore();
  const eh = { ...(store.exerciseHistory || {}) };

  for (const ex of workout.exercises || []) {
    const key = ex.exerciseId || ex.name || ex.id;
    if (!key) continue;

    eh[key] = {
      exerciseId: ex.exerciseId,
      exerciseName: ex.name || "Übung",
      lastPerformedAt: endedAtISO,
      sets: sanitizeSetsForHistory(ex.sets),
    };
  }

  saveCoreStore({ ...store, exerciseHistory: eh });
}

// ------------------------ public API used by pages ------------------------

export function getActiveLiveWorkout(): LiveWorkout | null {
  if (!hasWindow()) return null;
  const parsed = safeParse<LiveWorkout>(getScopedItem(LS_ACTIVE));
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.isActive !== true) return null;

  // ✅ Defensive normalize: Sport + Restzeiten aus alten Saves
  const sport = normalizeSport((parsed as any).sport);

  const exercises = Array.isArray((parsed as any).exercises) ? (parsed as any).exercises : [];
  const normalizedExercises = exercises.map((ex: any) => ({
    ...ex,
    restSeconds: normalizeRestSeconds(ex?.restSeconds),
  }));

  return { ...parsed, sport, exercises: normalizedExercises } as LiveWorkout;
}

export function persistActiveLiveWorkout(workout: LiveWorkout): void {
  if (!hasWindow()) return;
  if (!workout || typeof workout !== "object") return;

  if (!workout.isActive) return;

  // ✅ Defensive: sport immer normalisiert persistieren
  const toPersist: LiveWorkout = { ...workout, sport: normalizeSport(workout.sport) };

  const raw = safeStringify(toPersist);
  if (!raw) return;

  try {
    setScopedItem(LS_ACTIVE, raw);
  } catch {
    // ignore
  }
}

export function clearActiveLiveWorkout(): void {
  if (!hasWindow()) return;
  try {
    removeScopedItem(LS_ACTIVE);
  } catch {
    // ignore
  }
}

/**
 * Startet ein LiveWorkout (und persistiert als Active)
 */
export function startLiveWorkout(args: {
  title: string;
  sport: SportType;
  calendarEventId?: string;
  initialExercises?: Array<{
    exerciseId?: string;
    name: string;
    sets: Array<{ reps?: number; weight?: number; notes?: string }>;
    restSeconds?: number; // ✅ optional: undefined => kein Timer
  }>;
}): LiveWorkout {
  const startedAt = nowISO();

  const exercises: LiveExercise[] = (args.initialExercises || []).map((e) => ({
    id: uid(),
    exerciseId: e.exerciseId,
    name: e.name || "Übung",
    // ✅ OPTIONAL: undefined => kein Timer
    restSeconds: normalizeRestSeconds(e.restSeconds),
    sets: (e.sets || []).map((s) => ({
      id: uid(),
      reps: typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : undefined,
      weight: typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : undefined,
      notes: typeof (s as any).notes === "string" ? (s as any).notes : undefined,
      completed: false,
      completedAt: undefined,
    })),
  }));

  const workout: LiveWorkout = {
    id: uid(),
    calendarEventId: args.calendarEventId,
    title: args.title || "Training",
    sport: normalizeSport(args.sport),
    startedAt,
    endedAt: undefined,
    durationSeconds: undefined,
    isActive: true,
    isMinimized: false,
    exercises,
    notes: "",
    abortedAt: undefined,
  };

  persistActiveLiveWorkout(workout);
  return workout;
}

/**
 * Bricht ein Workout ab (ohne History-Eintrag in workoutHistory)
 */
export function abortLiveWorkout(workout: LiveWorkout): LiveWorkout {
  const endedAt = nowISO();
  const next: LiveWorkout = {
    ...workout,
    isActive: false,
    abortedAt: endedAt,
    endedAt,
    durationSeconds: clampNonNegativeInt(
      typeof workout.durationSeconds === "number" && Number.isFinite(workout.durationSeconds)
        ? workout.durationSeconds
        : computeDurationSeconds(workout.startedAt, endedAt)
    ),
  };

  clearActiveLiveWorkout();
  return next;
}

/**
 * ✅ Beendet ein Workout und schreibt GENAU 1 Eintrag in workoutHistory.ts
 */
export function completeLiveWorkout(workout: LiveWorkout): WorkoutHistoryEntry {
  const endedAt = nowISO();
  const sport = normalizeSport(workout.sport);

  const durationSeconds =
    typeof workout.durationSeconds === "number" && Number.isFinite(workout.durationSeconds) && workout.durationSeconds > 0
      ? clampNonNegativeInt(workout.durationSeconds)
      : clampNonNegativeInt(computeDurationSeconds(workout.startedAt, endedAt));

  const whExercises: WorkoutHistoryExercise[] = (workout.exercises || []).map((ex) => ({
    name: ex.name || "Übung",
    exerciseId: ex.exerciseId,
    sets: (ex.sets || [])
      .map((s) => ({
        reps: typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : 0,
        weight: typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : 0,
        setType: s.setType,
        timestamp: s.completedAt,
      }))
      .filter((s) => (s.reps ?? 0) > 0 || (s.weight ?? 0) > 0),
  }));

  let distanceKm: number | undefined = undefined;
  let paceSecPerKm: number | undefined = undefined;

  if (isCardioSport(sport)) {
    const derived = computeCardioFromSets(workout.exercises || []);
    if (derived.km > 0) distanceKm = derived.km;
    if (distanceKm && durationSeconds > 0) {
      paceSecPerKm = computePaceSecPerKm(durationSeconds, distanceKm);
    }
  } else {
    computeTotalVolumeKg(workout.exercises || []);
  }

  const entry = addWorkoutEntry({
    calendarEventId: workout.calendarEventId,
    title: workout.title || "Training",
    sport,
    startedAt: workout.startedAt,
    endedAt,
    durationSec: durationSeconds,
    sessionRpe: (workout as any).sessionRpe,
    exercises: whExercises,
    distanceKm,
    paceSecPerKm,
  });

  updateExerciseHistoryFromWorkout(workout, endedAt);

  clearActiveLiveWorkout();

  return entry;
}

export function applyTrainingStatusToEvent(
  e: CalendarEvent,
  status: TrainingStatus,
  opts?: { workoutId?: string }
): CalendarEvent {
  const now = nowISO();

  const base: CalendarEvent = {
    ...e,
    trainingStatus: status,
  };

  if (status === "completed") {
    return {
      ...base,
      completedAt: now,
      skippedAt: undefined,
      workoutId: opts?.workoutId ?? base.workoutId,
    };
  }

  if (status === "skipped") {
    return {
      ...base,
      skippedAt: now,
      completedAt: undefined,
      workoutId: undefined,
    };
  }

  return {
    ...base,
    skippedAt: undefined,
    completedAt: undefined,
    workoutId: undefined,
  };
}

/**
 * Graue Werte (History) für ExerciseEditor
 */
export function getLastSetsForExercise(ex: { exerciseId?: string; name: string }): ExerciseHistoryEntry | null {
  const key = ex.exerciseId || ex.name;
  if (!key) return null;

  const store = loadCoreStore();
  const hit = store.exerciseHistory?.[key];
  if (hit) return hit;

  const list = loadWorkoutHistory();
  for (const w of list) {
    for (const e2 of w.exercises || []) {
      const match =
        (ex.exerciseId && e2.exerciseId && e2.exerciseId === ex.exerciseId) ||
        (!ex.exerciseId && e2.name && e2.name === ex.name);

      if (!match) continue;

      return {
        exerciseId: e2.exerciseId,
        exerciseName: e2.name || ex.name,
        lastPerformedAt: w.endedAt || w.startedAt,
        sets: (e2.sets || []).map((s) => ({
          reps: typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : undefined,
          weight: typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : undefined,
          notes: undefined,
        })),
      };
    }
  }

  return null;
}
