// src/utils/workoutHistory.ts
//
// Source of Truth für Profil + Diagramme:
// - wird bei completeLiveWorkout() genau 1x pro Training geschrieben
//
// Fixes/Improvements:
// 1) Cardio/Custom wird NICHT mehr “still” verworfen, wenn exercises leer sind.
//    -> Default: Gym verlangt exercises, Cardio/Custom darf leer sein.
// 2) Hard-Dedup + Max-Limit (damit LocalStorage nicht unendlich wächst).
// 3) Robustere Normalisierung (sport casing, ISO, duration fallback).
// 4) ✅ Cardio-Metriken (Laufen/Radfahren): distanceKm + paceSecPerKm (optional, auto-berechnet)
// 5) ✅ Cardio-Ableitung aus Sets (Konvention):
//    - reps   = Minuten
//    - weight = Kilometer
//    -> distanceKm / durationSec werden (wenn fehlend) aus den Sets abgeleitet.

export type WorkoutHistorySet = {
  reps: number;
  weight: number;
  setType?: "normal" | "warmup" | "failure" | "1D";
  isWarmup?: boolean;
  rpe?: number;
  timestamp?: string;
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
  sessionRpe?: number;

  exercises: WorkoutHistoryExercise[];

  /**
   * Cardio (optional):
   * - distanceKm: Strecke in km
   * - paceSecPerKm: Ø Pace in Sekunden pro km (z.B. 300 = 5:00 / km)
   *
   * Hinweis: paceSecPerKm kann gesetzt werden ODER wird aus durationSec+distanceKm berechnet.
   */
  distanceKm?: number;
  paceSecPerKm?: number;

  /**
   * Gym: Sum(weight*reps)
   * Cardio/Custom: 0 (bewusst, sonst irreführend)
   */
  totalVolume: number;
};

const STORAGE_KEY = "trainq_workout_history_v1";
const UPDATED_EVENT = "trainq:workoutHistoryUpdated";

// Guard: begrenze Historie, damit Storage nicht explodiert
const MAX_ENTRIES = 300;

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

function clampNonNegativeInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampDistanceKm(v: any): number | undefined {
  const n = toNumber(v, NaN);
  if (!Number.isFinite(n)) return undefined;
  // 0..1000km als grobes Guardrail
  const clamped = Math.max(0, Math.min(1000, n));
  return round2(clamped);
}

function clampPaceSecPerKm(v: any): number | undefined {
  const n = toNumber(v, NaN);
  if (!Number.isFinite(n)) return undefined;
  // Pace als sec/km: 60..3600 (1:00 bis 60:00) als Guardrail
  const clamped = Math.max(60, Math.min(3600, Math.round(n)));
  return clamped;
}

function computePaceFrom(durationSec: number, distanceKm: number): number | undefined {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return undefined;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return undefined;
  const pace = durationSec / distanceKm; // sec per km
  return clampPaceSecPerKm(pace);
}

function normalizeSportString(s: any): string | undefined {
  const v = typeof s === "string" ? s.trim() : "";
  if (!v) return undefined;

  // einheitlich halten (wichtig für isGym)
  const lower = v.toLowerCase();
  if (lower === "gym") return "Gym";
  if (lower === "laufen") return "Laufen";
  if (lower === "radfahren") return "Radfahren";
  if (lower === "custom") return "Custom";

  // fallback: original mit trim
  return v;
}

function isGymSport(sport?: string): boolean {
  return (sport || "").trim().toLowerCase() === "gym";
}

function isCardioSport(sport?: string): boolean {
  const s = (sport || "").trim().toLowerCase();
  return s === "laufen" || s === "radfahren";
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
  // Volumen als Zahl (kg) reicht gerundet vollkommen
  return Math.round(total);
}

/**
 * Cardio-Konvention:
 * reps = Minuten, weight = Kilometer
 * -> Liefert Summen über alle Sets (auch wenn Übungen "komisch" strukturiert sind)
 */
function computeCardioFromExercises(exercises: WorkoutHistoryExercise[]): {
  minutesFromSets: number;
  distanceFromSetsKm: number;
} {
  let minutes = 0;
  let km = 0;

  for (const ex of exercises || []) {
    for (const s of ex.sets || []) {
      const reps = Number.isFinite(s.reps) ? s.reps : 0;
      const weight = Number.isFinite(s.weight) ? s.weight : 0;

      // reps = Minuten (int)
      minutes += Math.max(0, reps);

      // weight = Kilometer (float)
      km += Math.max(0, weight);
    }
  }

  return {
    minutesFromSets: Math.max(0, Math.round(minutes)),
    distanceFromSetsKm: round2(Math.max(0, km)),
  };
}

function sanitizeExercise(ex: any): WorkoutHistoryExercise | null {
  if (!ex || typeof ex !== "object") return null;

  const name = typeof ex.name === "string" && ex.name.trim() ? ex.name.trim() : "Übung";
  const exerciseId =
    typeof ex.exerciseId === "string" && ex.exerciseId.trim() ? ex.exerciseId.trim() : undefined;

  const rawSets: any[] = Array.isArray(ex.sets) ? ex.sets : [];
  const sets: WorkoutHistorySet[] = rawSets
    .map((s: any) => ({
      reps: Math.max(0, Math.round(toNumber(s?.reps, 0))),
      weight: Math.max(0, Math.round(toNumber(s?.weight, 0) * 100) / 100),
      setType: typeof s?.setType === "string" ? s.setType : undefined,
      isWarmup: s?.isWarmup === true || s?.setType === "warmup",
      rpe: Number.isFinite(Number(s?.rpe)) ? Math.max(0, Math.min(10, Number(s?.rpe))) : undefined,
      timestamp:
        typeof s?.timestamp === "string"
          ? s.timestamp
          : typeof s?.completedAt === "string"
            ? s.completedAt
            : undefined,
    }))
    // akzeptiere Sets, sobald reps>0 ODER weight>0 (damit nicht alles rausfällt)
    .filter((s: WorkoutHistorySet) => s.reps > 0 || s.weight > 0);

  return { name, exerciseId, sets };
}

function computeDurationFallbackSec(startedAtISO: string, endedAtISO: string): number {
  const a = new Date(startedAtISO).getTime();
  const b = new Date(endedAtISO).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const diff = Math.round((b - a) / 1000);
  return Math.max(0, diff);
}

function sanitizeEntry(raw: any): WorkoutHistoryEntry | null {
  if (!raw || typeof raw !== "object") return null;

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : uid();

  const calendarEventId =
    typeof raw.calendarEventId === "string" && raw.calendarEventId.trim()
      ? raw.calendarEventId.trim()
      : undefined;

  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Training";
  const sport = normalizeSportString(raw.sport);

  const startedAt = toISO(raw.startedAt);
  const endedAt = toISO(raw.endedAt);

  let durationSec = clampNonNegativeInt(toNumber(raw.durationSec, 0));
  if (durationSec <= 0) {
    durationSec = computeDurationFallbackSec(startedAt, endedAt);
  }

  const sessionRpeRaw = Number(raw.sessionRpe);
  const sessionRpe =
    Number.isFinite(sessionRpeRaw) && sessionRpeRaw > 0
      ? Math.min(10, Math.max(0, sessionRpeRaw))
      : undefined;

  const exercises: WorkoutHistoryExercise[] = (Array.isArray(raw.exercises) ? raw.exercises : [])
    .map((x: any) => sanitizeExercise(x))
    .filter(Boolean) as WorkoutHistoryExercise[];

  // ✅ Cardio-Felder (optional)
  let distanceKm = clampDistanceKm(raw.distanceKm);
  let paceSecPerKm = clampPaceSecPerKm(raw.paceSecPerKm);

  // ✅ Ableitung aus Sets (wenn Cardio und Werte fehlen)
  if (isCardioSport(sport)) {
    const derived = computeCardioFromExercises(exercises);

    // distance: nur überschreiben, wenn nicht vorhanden
    if (distanceKm == null && derived.distanceFromSetsKm > 0) {
      distanceKm = clampDistanceKm(derived.distanceFromSetsKm);
    }

    // duration: nur fallbacken, wenn noch 0/leer
    if ((!Number.isFinite(durationSec) || durationSec <= 0) && derived.minutesFromSets > 0) {
      durationSec = derived.minutesFromSets * 60;
    }

    // pace: wenn fehlt, aus duration+distance berechnen
    if (paceSecPerKm == null && distanceKm != null) {
      paceSecPerKm = computePaceFrom(durationSec, distanceKm);
    }
  } else {
    // Wenn NICHT Cardio, aber Pace/Distance fälschlich drin waren: trotzdem sanitizen, aber nicht erzwingen.
    // (bewusst keine automatische Berechnung)
    if (paceSecPerKm != null && distanceKm != null) {
      // ok
    }
  }

  // ✅ Gym-only volume, sonst 0 (sonst irreführend bei Cardio)
  const totalVolume = isGymSport(sport) ? computeTotalVolume(exercises) : 0;

  return {
    id,
    calendarEventId,
    title,
    sport,
    startedAt,
    endedAt,
    durationSec,
    sessionRpe,
    exercises,
    distanceKm,
    paceSecPerKm,
    totalVolume,
  };
}

function sortByMostRecent(a: WorkoutHistoryEntry, b: WorkoutHistoryEntry): number {
  const ta = new Date(a.endedAt || a.startedAt || 0).getTime();
  const tb = new Date(b.endedAt || b.startedAt || 0).getTime();
  return tb - ta;
}

function dedupByIdKeepFirst(list: WorkoutHistoryEntry[]): WorkoutHistoryEntry[] {
  const seen = new Set<string>();
  const out: WorkoutHistoryEntry[] = [];
  for (const item of list) {
    if (!item?.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

// ------------------------ public API ------------------------

export function loadWorkoutHistory(): WorkoutHistoryEntry[] {
  if (!hasWindow()) return [];

  const parsed = safeParse<any>(window.localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];

  const sanitized = parsed.map((x: any) => sanitizeEntry(x)).filter(Boolean) as WorkoutHistoryEntry[];

  // Stabil: dedup + sort
  return dedupByIdKeepFirst(sanitized).sort(sortByMostRecent);
}

export function saveWorkoutHistory(list: WorkoutHistoryEntry[]): void {
  if (!hasWindow()) return;

  const sanitized = (Array.isArray(list) ? list : [])
    .map((x: any) => sanitizeEntry(x))
    .filter(Boolean) as WorkoutHistoryEntry[];

  const next = dedupByIdKeepFirst(sanitized).sort(sortByMostRecent).slice(0, MAX_ENTRIES);

  const raw = safeStringify(next);
  if (!raw) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    emitUpdated();
  } catch {
    // ignore
  }
}

/**
 * Add/Dedup by id (1 Entry pro Workout).
 *
 * Default-Regel (Bugfix):
 * - Gym: verlangt exercises (sonst vermutlich “leeres” Workout)
 * - Cardio/Custom: darf leer sein (sonst werden Lauf/Rad-Workouts oft “unsichtbar”)
 */
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
      distanceKm: clampDistanceKm((entry as any).distanceKm),
      paceSecPerKm: clampPaceSecPerKm((entry as any).paceSecPerKm),
      totalVolume: 0,
      calendarEventId: entry.calendarEventId,
    } as WorkoutHistoryEntry);

  // ✅ Finaler Guard: falls Cardio und noch keine distance/duration da sind, aus Sets ableiten
  if (isCardioSport(sanitized.sport)) {
    const derived = computeCardioFromExercises(sanitized.exercises);

    if (sanitized.distanceKm == null && derived.distanceFromSetsKm > 0) {
      sanitized.distanceKm = clampDistanceKm(derived.distanceFromSetsKm);
    }

    if ((!Number.isFinite(sanitized.durationSec) || sanitized.durationSec <= 0) && derived.minutesFromSets > 0) {
      sanitized.durationSec = derived.minutesFromSets * 60;
    }

    if (sanitized.paceSecPerKm == null && sanitized.distanceKm != null) {
      sanitized.paceSecPerKm = computePaceFrom(sanitized.durationSec, sanitized.distanceKm);
    }
  }

  const autoAllowEmpty = !isGymSport(sanitized.sport); // Cardio/Custom default: true
  const allowEmpty = options?.allowEmptyExercises ?? autoAllowEmpty;

  if (!allowEmpty && (sanitized.exercises?.length ?? 0) === 0) {
    // bewusst: nichts speichern, aber UI darf refreshen
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
