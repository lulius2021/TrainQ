// src/utils/trainingHistory.ts
//
// Zweck:
// - Persistenz für Trainings-History (CompletedWorkouts + Übungs-History)
// - API für LiveTraining: start/save/complete/skip + graue History-Werte je Übung
//
// Zusatz (NEU):
// - Beim "Training beenden" wird 1 Strava-like Beitrag in src/utils/workoutHistory.ts geschrieben
//   => Source of Truth für Profil + Diagramme

import type {
  CalendarEvent,
  CompletedWorkout,
  ExerciseHistoryEntry,
  LiveExercise,
  LiveWorkout,
  SportType,
  TrainingHistoryStore,
  TrainingStatus,
} from "../types/training";

import { addWorkoutEntry } from "./workoutHistory";

const STORAGE_KEY_HISTORY = "trainq:history:v1";
const STORAGE_KEY_ACTIVE = "trainq:liveWorkout:active:v1";

const STORE_VERSION = 1;

// Debug (optional, aber hilfreich)
const DEBUG_KEY_LAST_COMPLETE = "trainq:debug:lastComplete";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeJsonStringify(value: any): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function safeNowIso(): string {
  return new Date().toISOString();
}

function safeUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + ":" + Math.random().toString(16).slice(2);
}

function getExerciseKey(ex: { exerciseId?: string; name: string }): string {
  const id = ex.exerciseId?.trim();
  if (id) return `id:${id}`;
  return `name:${ex.name.trim().toLowerCase()}`;
}

function clampRestSeconds(v: number): number {
  if (!Number.isFinite(v)) return 90;
  return Math.min(300, Math.max(30, Math.round(v)));
}

function normalizeSport(sport: SportType): SportType {
  return sport;
}

function computeGymVolumeKg(workout: LiveWorkout): number {
  let total = 0;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (!s.completed) continue;
      const reps = typeof s.reps === "number" ? s.reps : 0;
      const weight = typeof s.weight === "number" ? s.weight : 0;
      if (reps > 0 && weight > 0) total += reps * weight;
    }
  }
  return total;
}

function computeDistanceKm(workout: LiveWorkout): number | undefined {
  let total = 0;
  let hasAny = false;

  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (!s.completed) continue;
      const km = typeof s.weight === "number" ? s.weight : undefined;
      if (typeof km === "number" && km > 0) {
        total += km;
        hasAny = true;
      }
    }
  }

  return hasAny ? total : undefined;
}

// ---------------------------------------------
// Store Load/Save
// ---------------------------------------------

function createEmptyStore(): TrainingHistoryStore {
  return {
    version: STORE_VERSION,
    workouts: [],
    exerciseHistory: {},
  };
}

function loadHistoryStore(): TrainingHistoryStore {
  if (typeof window === "undefined") return createEmptyStore();

  const parsed = safeJsonParse<TrainingHistoryStore>(window.localStorage.getItem(STORAGE_KEY_HISTORY));

  if (
    !parsed ||
    parsed.version !== STORE_VERSION ||
    !Array.isArray(parsed.workouts) ||
    typeof parsed.exerciseHistory !== "object" ||
    parsed.exerciseHistory === null
  ) {
    return createEmptyStore();
  }

  return parsed;
}

function saveHistoryStore(store: TrainingHistoryStore): void {
  if (typeof window === "undefined") return;
  const raw = safeJsonStringify(store);
  if (!raw) return;

  try {
    window.localStorage.setItem(STORAGE_KEY_HISTORY, raw);
  } catch {
    // ignore storage errors
  }
}

function loadActiveWorkout(): LiveWorkout | null {
  if (typeof window === "undefined") return null;

  const parsed = safeJsonParse<LiveWorkout>(window.localStorage.getItem(STORAGE_KEY_ACTIVE));

  if (!parsed || typeof parsed !== "object") return null;
  if (!parsed.id || !parsed.startedAt || !Array.isArray(parsed.exercises)) return null;

  return parsed;
}

function saveActiveWorkout(workout: LiveWorkout | null): void {
  if (typeof window === "undefined") return;

  try {
    if (!workout) {
      window.localStorage.removeItem(STORAGE_KEY_ACTIVE);
      return;
    }
    const raw = safeJsonStringify(workout);
    if (!raw) return;
    window.localStorage.setItem(STORAGE_KEY_ACTIVE, raw);
  } catch {
    // ignore storage errors
  }
}

// ---------------------------------------------
// Public API
// ---------------------------------------------

export function getHistoryStore(): TrainingHistoryStore {
  return loadHistoryStore();
}

export function getCompletedWorkouts(): CompletedWorkout[] {
  return loadHistoryStore().workouts;
}

export function getActiveLiveWorkout(): LiveWorkout | null {
  return loadActiveWorkout();
}

export function persistActiveLiveWorkout(workout: LiveWorkout): void {
  saveActiveWorkout(workout);
}

export function startLiveWorkout(params: {
  title: string;
  sport: SportType;
  calendarEventId?: string;
  initialExercises?: Array<{
    exerciseId?: string;
    name: string;
    sets: Array<{ reps?: number; weight?: number; notes?: string }>;
    restSeconds?: number;
  }>;
}): LiveWorkout {
  const workout: LiveWorkout = {
    id: safeUUID(),
    calendarEventId: params.calendarEventId,
    title: params.title,
    sport: normalizeSport(params.sport),
    startedAt: safeNowIso(),
    isActive: true,
    isMinimized: false,
    exercises: (params.initialExercises ?? []).map((ex) => ({
      id: safeUUID(),
      exerciseId: ex.exerciseId,
      name: ex.name,
      restSeconds: clampRestSeconds(ex.restSeconds ?? 90),
      sets: ex.sets.map((s) => ({
        id: safeUUID(),
        reps: s.reps,
        weight: s.weight,
        notes: s.notes,
        completed: false,
      })),
    })),
  };

  saveActiveWorkout(workout);
  return workout;
}

/**
 * Markiert ein Workout als abgeschlossen und schreibt es in die History.
 * Zusätzlich: schreibt 1 "Beitrag" in workoutHistory (Strava-like).
 */
export function completeLiveWorkout(workout: LiveWorkout): CompletedWorkout {
  const endedAt = safeNowIso();
  const durationSeconds = Math.max(
    1,
    Math.round((new Date(endedAt).getTime() - new Date(workout.startedAt).getTime()) / 1000)
  );

  const completed: CompletedWorkout = {
    ...workout,
    isActive: false,
    endedAt,
    durationSeconds,
    sport: normalizeSport(workout.sport),
    totalVolumeKg: workout.sport === "Gym" ? computeGymVolumeKg(workout) : undefined,
    totalDistanceKm: workout.sport !== "Gym" ? computeDistanceKm(workout) : undefined,
  };

  // 1) Interne History
  const store = loadHistoryStore();
  store.workouts = [...store.workouts, completed];
  store.exerciseHistory = {
    ...store.exerciseHistory,
    ...buildExerciseHistoryPatch(completed),
  };
  saveHistoryStore(store);

  // 2) ✅ Strava-like Beitrag (Source of Truth)
  //    Wichtig:
  //    - nur COMPLETED Sets
  //    - nur Exercises, die mindestens 1 Set enthalten
  const mappedExercises = (completed.exercises ?? [])
    .map((ex) => {
      const sets = (ex.sets ?? [])
        .filter((s) => s.completed)
        .map((s) => ({
          reps: typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : 0,
          weight: typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : 0,
        }))
        // akzeptiere Sets, sobald reps>0 ODER weight>0 (damit nicht alles rausfällt)
        .filter((s) => s.reps > 0 || s.weight > 0);

      return {
        name: ex.name || "Übung",
        exerciseId: ex.exerciseId,
        sets,
      };
    })
    .filter((ex) => ex.sets.length > 0);

  // Debug: zeigt dir, ob complete wirklich feuert und was gemappt wird
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        DEBUG_KEY_LAST_COMPLETE,
        JSON.stringify({
          at: endedAt,
          workoutId: completed.id,
          title: completed.title,
          durationSeconds,
          mappedExercisesCount: mappedExercises.length,
        })
      );
    }
  } catch {
    // ignore
  }

  try {
    addWorkoutEntry({
      id: completed.id, // Dedup: 1 Beitrag pro Workout
      calendarEventId: completed.calendarEventId,
      title: completed.title || "Training",
      sport: completed.sport,
      startedAt: completed.startedAt,
      endedAt: completed.endedAt!,
      durationSec: durationSeconds,
      exercises: mappedExercises,
    });
  } catch {
    // wenn workoutHistory aus irgendeinem Grund crasht, soll das Completion nicht killen
  }

  // aktive Session entfernen
  saveActiveWorkout(null);

  return completed;
}

export function abortLiveWorkout(workout: LiveWorkout): LiveWorkout {
  const updated: LiveWorkout = {
    ...workout,
    isActive: false,
    abortedAt: safeNowIso(),
    endedAt: safeNowIso(),
  };
  saveActiveWorkout(null);
  return updated;
}

export function applyTrainingStatusToEvent(
  ev: CalendarEvent,
  status: TrainingStatus,
  options?: { workoutId?: string }
): CalendarEvent {
  const nowIso = safeNowIso();

  if (status === "completed") {
    return {
      ...ev,
      type: "training",
      trainingStatus: "completed",
      completedAt: nowIso,
      skippedAt: undefined,
      workoutId: options?.workoutId ?? ev.workoutId,
    };
  }

  if (status === "skipped") {
    return {
      ...ev,
      type: "training",
      trainingStatus: "skipped",
      skippedAt: nowIso,
      completedAt: undefined,
      workoutId: undefined,
    };
  }

  return {
    ...ev,
    type: "training",
    trainingStatus: "open",
    skippedAt: undefined,
    completedAt: undefined,
    workoutId: undefined,
  };
}

export function getExerciseHistory(exerciseIdOrName: string): ExerciseHistoryEntry | null {
  const store = loadHistoryStore();

  const key =
    exerciseIdOrName.startsWith("id:") || exerciseIdOrName.startsWith("name:")
      ? exerciseIdOrName
      : `id:${exerciseIdOrName}`;

  return store.exerciseHistory[key] ?? null;
}

export function getLastSetsForExercise(ex: LiveExercise): ExerciseHistoryEntry | null {
  const key = getExerciseKey(ex);
  const store = loadHistoryStore();
  return store.exerciseHistory[key] ?? null;
}

export function clearTrainingHistory(): void {
  saveHistoryStore(createEmptyStore());
  saveActiveWorkout(null);
}

// ---------------------------------------------
// Internal: Exercise History Builder
// ---------------------------------------------

function buildExerciseHistoryPatch(workout: CompletedWorkout): Record<string, ExerciseHistoryEntry> {
  const patch: Record<string, ExerciseHistoryEntry> = {};

  for (const ex of workout.exercises) {
    const completedSets = ex.sets
      .filter((s) => s.completed)
      .map((s) => ({
        reps: s.reps,
        weight: s.weight,
        notes: s.notes,
      }));

    if (completedSets.length === 0) continue;

    const key = getExerciseKey(ex);

    patch[key] = {
      exerciseId: ex.exerciseId,
      exerciseName: ex.name,
      lastPerformedAt: workout.endedAt,
      sets: completedSets,
    };
  }

  return patch;
}