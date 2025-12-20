// src/utils/workoutHistory.ts

export type WorkoutHistorySet = {
  reps: number;
  weight: number;
};

export type WorkoutHistoryExercise = {
  name: string;
  exerciseId?: string;
  sets: WorkoutHistorySet[];
};

export type WorkoutHistoryEntry = {
  id: string;
  calendarEventId?: string;

  title: string;
  sport?: string;

  startedAt: string;
  endedAt: string;
  durationSec: number;

  exercises: WorkoutHistoryExercise[];
  totalVolume: number; // Sum(weight*reps)
};

const STORAGE_KEY = "trainq_workout_history_v1";
const UPDATED_EVENT = "trainq:workoutHistoryUpdated";

// ------------------------ helpers ------------------------

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

function safeStringify(value: any): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function emitUpdated(): void {
  if (!hasWindow()) return;
  try {
    if (typeof (window as any).CustomEvent === "function") {
      window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
    } else {
      window.dispatchEvent(new Event(UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
}

function toNumber(v: any, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toISO(v: any): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function computeTotalVolume(exercises: WorkoutHistoryExercise[]): number {
  let total = 0;
  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      const reps = Number.isFinite(s.reps) ? s.reps : 0;
      const weight = Number.isFinite(s.weight) ? s.weight : 0;
      total += reps * weight;
    }
  }
  return Math.round(total * 100) / 100;
}

function sanitizeExercise(ex: any): WorkoutHistoryExercise | null {
  if (!ex || typeof ex !== "object") return null;

  const name = typeof ex.name === "string" && ex.name.trim() ? ex.name.trim() : "Übung";
  const exerciseId =
    typeof ex.exerciseId === "string" && ex.exerciseId.trim() ? ex.exerciseId.trim() : undefined;

  const rawSets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
  const sets: WorkoutHistorySet[] = rawSets
    // ✅ FIX: s typisieren, damit ts(7006) weg ist
    .map((s: any) => ({
      reps: Math.max(0, Math.round(toNumber(s?.reps, 0))),
      weight: Math.max(0, Math.round(toNumber(s?.weight, 0) * 100) / 100),
    }))
    .filter((s: WorkoutHistorySet) => s.reps > 0 || s.weight > 0);

  return { name, exerciseId, sets };
}

function sanitizeEntry(raw: any): WorkoutHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : uid();
  const calendarEventId =
    typeof raw.calendarEventId === "string" && raw.calendarEventId.trim()
      ? raw.calendarEventId.trim()
      : undefined;

  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Training";
  const sport = typeof raw.sport === "string" && raw.sport.trim() ? raw.sport.trim() : undefined;

  const startedAt = toISO(raw.startedAt);
  const endedAt = toISO(raw.endedAt);

  const durationSec = Math.max(0, Math.round(toNumber(raw.durationSec, 0)));

  const exercises: WorkoutHistoryExercise[] = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .map((x: any) => sanitizeExercise(x))
    .filter(Boolean) as WorkoutHistoryExercise[];

  const totalVolume = computeTotalVolume(exercises);

  return {
    id,
    calendarEventId,
    title,
    sport,
    startedAt,
    endedAt,
    durationSec,
    exercises,
    totalVolume,
  };
}

// ------------------------ public API ------------------------

export function loadWorkoutHistory(): WorkoutHistoryEntry[] {
  if (!hasWindow()) return [];

  const parsed = safeParse<any>(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];

  const sanitized = parsed.map((x: any) => sanitizeEntry(x)).filter(Boolean) as WorkoutHistoryEntry[];

  return sanitized.sort((a, b) => {
    const ta = new Date(a.endedAt || a.startedAt || 0).getTime();
    const tb = new Date(b.endedAt || b.startedAt || 0).getTime();
    return tb - ta;
  });
}

export function saveWorkoutHistory(list: WorkoutHistoryEntry[]): void {
  if (!hasWindow()) return;

  const sanitized = (Array.isArray(list) ? list : []).map((x: any) => sanitizeEntry(x)).filter(Boolean) as WorkoutHistoryEntry[];

  const raw = safeStringify(sanitized);
  if (!raw) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    emitUpdated();
  } catch {
    // ignore
  }
}

export function addWorkoutEntry(
  entry: Omit<WorkoutHistoryEntry, "id" | "totalVolume"> & { id?: string },
  options?: { allowEmptyExercises?: boolean }
): WorkoutHistoryEntry {
  const id = entry.id || uid();

  const sanitized =
    sanitizeEntry({ ...entry, id }) ??
    ({
      id,
      title: entry.title || "Training",
      sport: entry.sport,
      startedAt: toISO(entry.startedAt),
      endedAt: toISO(entry.endedAt),
      durationSec: Math.max(0, Math.round(toNumber(entry.durationSec, 0))),
      exercises: Array.isArray(entry.exercises) ? entry.exercises : [],
      totalVolume: computeTotalVolume(Array.isArray(entry.exercises) ? entry.exercises : []),
      calendarEventId: entry.calendarEventId,
    } as WorkoutHistoryEntry);

  const allowEmpty = options?.allowEmptyExercises ?? true;
  if (!allowEmpty && (sanitized.exercises?.length ?? 0) === 0) {
    emitUpdated();
    return sanitized;
  }

  const current = loadWorkoutHistory();
  const next = [sanitized, ...current.filter((x) => x.id !== sanitized.id)];

  saveWorkoutHistory(next);
  return sanitized;
}

export function clearWorkoutHistory(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    emitUpdated();
  } catch {
    // ignore
  }
}

export function onWorkoutHistoryUpdated(cb: () => void): () => void {
  if (!hasWindow()) return () => {};
  window.addEventListener(UPDATED_EVENT, cb as EventListener);
  return () => window.removeEventListener(UPDATED_EVENT, cb as EventListener);
}

export function __debugGetStorageKey(): string {
  return STORAGE_KEY;
}