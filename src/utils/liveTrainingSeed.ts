// src/utils/liveTrainingSeed.ts
//
// Zweck:
// - Seeds für LiveTraining persistieren (global / per eventId / per stable key)
// - Robust Resolver für verschiedene Einstiegs-Pfade (Dashboard, Trainingsplan, Deep Link)
//
// Fixes/Improvements:
// 1) Stabiler Key: dateISO wird timezone-sicher auf YYYY-MM-DD normalisiert + title wird getrimmt und Whitespace komprimiert.
// 2) Defensive Normalisierung beim Lesen: verhindert “kaputte” Seeds aus LocalStorage.
// 3) Resolver probiert: eventId -> key(new) -> key(legacy) Varianten.
// 4) Robustere IDs (randomUUID fallback), verhindert seltene Date.now()-Duplikate.
// 5) isCardio Default: nur Laufen/Radfahren (Custom nicht automatisch cardio)
//
// ✅ Back-Compat:
// - liest auch alte Keys (trainq_live_seed_global_v1 / trainq_live_seed_by_event_v1 / trainq_live_seed_by_event_v1)

import type { SportType } from "../types/training";
import { getScopedItem, removeScopedItem, setScopedItem } from "./scopedStorage";

export type SeedId = string | number;

export type ExerciseSetSeed = {
  id?: SeedId; // ✅ optional (back-compat)
  reps?: number; // Gym: Wdh | Cardio: Dauer (min)
  weight?: number; // Gym: kg  | Cardio: Distanz (km)
  notes?: string;
};

export type BlockExerciseSeed = {
  id?: SeedId; // ✅ optional (back-compat)
  exerciseId?: string;
  name: string;
  sets: ExerciseSetSeed[];
};

export type LiveTrainingSeed = {
  title: string;
  sport: SportType; // ✅ Single Source of Truth
  isCardio: boolean;
  exercises: BlockExerciseSeed[];
  calendarEventId?: string;
};

// ---------------- Storage keys ----------------

// ✅ New keys
const STORAGE_KEY_GLOBAL_SEED = "trainq_live_training_seed_v1";
const STORAGE_KEY_SEEDS_BY_EVENT = "trainq_live_training_seeds_by_event_v1";
const STORAGE_KEY_SEEDS_BY_KEY = "trainq_live_training_seeds_by_key_v1";

// ✅ Old keys (back-compat)
const OLD_LS_GLOBAL = "trainq_live_seed_global_v1";
const OLD_LS_BY_EVENT = "trainq_live_seed_by_event_v1"; // (legacy naming)
const OLD_LS_BY_EVENT_2 = "trainq_live_seed_by_event_v1"; // same, kept for safety

// ---------------- Helpers ----------------

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeJSONParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (!hasWindow()) return;
  try {
    setScopedItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function safeGet(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    return getScopedItem(key);
  } catch {
    return null;
  }
}

function safeRemove(key: string): void {
  if (!hasWindow()) return;
  try {
    removeScopedItem(key);
  } catch {
    // ignore
  }
}

function makeId(prefix = "id"): string {
  try {
    if (typeof crypto !== "undefined" && crypto?.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * ✅ Timezone-sicher:
 * - Wenn "YYYY-MM-DD..." => schneidet stabil YYYY-MM-DD
 * - Sonst: versucht Date() und nutzt UTC-ISO slice(0,10)
 */
function normalizeDateISO(dateISO: string): string {
  const s = String(dateISO || "").trim();
  if (!s) return "";

  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m?.[1]) return m[1];

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeTitle(title: string): string {
  return String(title || "").trim().replace(/\s+/g, " ");
}

function normalizeSport(s: any): SportType {
  const v = typeof s === "string" ? s.trim() : "";
  if (!v) return "Gym";

  const lower = v.toLowerCase();

  if (lower === "gym") return "Gym";
  if (lower === "laufen") return "Laufen";
  if (lower === "radfahren") return "Radfahren";
  if (lower === "custom") return "Custom";

  // legacy / english mapping
  if (lower === "run" || lower === "running") return "Laufen";
  if (lower === "bike" || lower === "cycling") return "Radfahren";

  // fallback (falls SportType künftig erweitert wird)
  return v as SportType;
}

function normalizeSeed(raw: any): LiveTrainingSeed | null {
  if (!raw || typeof raw !== "object") return null;

  const title = normalizeTitle(raw.title || "Training");
  const sport = normalizeSport(raw.sport);

  const isCardio =
    typeof raw.isCardio === "boolean" ? raw.isCardio : sport === "Laufen" || sport === "Radfahren";

  const exercisesRaw = Array.isArray(raw.exercises) ? raw.exercises : [];
  const exercises: BlockExerciseSeed[] = exercisesRaw
    .map((ex: any) => {
      if (!ex || typeof ex !== "object") return null;

      const setsRaw = Array.isArray(ex.sets) ? ex.sets : [];
      const sets: ExerciseSetSeed[] = setsRaw
        .map((s: any) => {
          if (!s || typeof s !== "object") return null;

          const id = (s.id ?? undefined) as SeedId | undefined;
          const reps = typeof s.reps === "number" && Number.isFinite(s.reps) ? s.reps : undefined;
          const weight = typeof s.weight === "number" && Number.isFinite(s.weight) ? s.weight : undefined;
          const notes = typeof s.notes === "string" ? s.notes : undefined;

          return { id, reps, weight, notes } as ExerciseSetSeed;
        })
        .filter(Boolean) as ExerciseSetSeed[];

      const id = (ex.id ?? undefined) as SeedId | undefined;
      const exerciseId =
        typeof ex.exerciseId === "string" && ex.exerciseId.trim() ? ex.exerciseId.trim() : undefined;
      const name = normalizeTitle(ex.name || "Übung");

      return { id, exerciseId, name, sets } as BlockExerciseSeed;
    })
    .filter(Boolean) as BlockExerciseSeed[];

  return { title, sport, isCardio, exercises };
}

/**
 * ✅ Map-Normalisierung:
 * - entfernt ungültige keys
 * - normalisiert jeden Seed defensiv
 * - verhindert, dass „kaputte“ LS-Einträge später sporadisch resolve() brechen
 */
function normalizeSeedRecord(input: any): Record<string, LiveTrainingSeed> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, LiveTrainingSeed> = {};

  for (const [k, v] of Object.entries(input)) {
    const nk = String(k || "").trim();
    if (!nk) continue;
    const n = normalizeSeed(v);
    if (n) out[nk] = n;
  }

  return out;
}

// ---------------- Global Seed ----------------

export function writeGlobalLiveSeed(seed: LiveTrainingSeed): void {
  const normalized = normalizeSeed(seed) ?? seed;
  safeSet(STORAGE_KEY_GLOBAL_SEED, normalized);

  // optional: migrate write (nicht nötig), aber harmless:
  // safeSet(OLD_LS_GLOBAL, normalized);
}

export function readGlobalLiveSeed(): LiveTrainingSeed | null {
  // new first
  const rawNew = safeGet(STORAGE_KEY_GLOBAL_SEED);
  if (rawNew) {
    const parsed = safeJSONParse<any>(rawNew, null);
    const n = normalizeSeed(parsed);
    if (n) return n;
  }

  // back-compat old
  const rawOld = safeGet(OLD_LS_GLOBAL);
  if (rawOld) {
    const parsed = safeJSONParse<any>(rawOld, null);
    const n = normalizeSeed(parsed);
    if (n) {
      // migrate forward once
      safeSet(STORAGE_KEY_GLOBAL_SEED, n);
      return n;
    }
  }

  return null;
}

export function clearGlobalLiveSeed(): void {
  safeRemove(STORAGE_KEY_GLOBAL_SEED);
  safeRemove(OLD_LS_GLOBAL);
}

// ---------------- Seeds by EventId ----------------

type SeedsByEventId = Record<string, LiveTrainingSeed>;

function readSeedsByEventId(): SeedsByEventId {
  // new first
  const rawNew = safeGet(STORAGE_KEY_SEEDS_BY_EVENT);
  const parsedNew = safeJSONParse<any>(rawNew, null);
  if (parsedNew && typeof parsedNew === "object") {
    const normalized = normalizeSeedRecord(parsedNew);
    // self-heal writeback (optional, aber praktisch)
    safeSet(STORAGE_KEY_SEEDS_BY_EVENT, normalized);
    return normalized as SeedsByEventId;
  }

  // old back-compat
  const rawOld = safeGet(OLD_LS_BY_EVENT) ?? safeGet(OLD_LS_BY_EVENT_2);
  const parsedOld = safeJSONParse<any>(rawOld, {});
  const normalizedOld = normalizeSeedRecord(parsedOld);

  // migrate forward once (normalisiert)
  safeSet(STORAGE_KEY_SEEDS_BY_EVENT, normalizedOld);
  return normalizedOld as SeedsByEventId;
}

function writeSeedsByEventId(map: SeedsByEventId): void {
  // ensure only valid seeds persist
  safeSet(STORAGE_KEY_SEEDS_BY_EVENT, normalizeSeedRecord(map));
}

export function writeLiveSeedForEvent(eventId: string, seed: LiveTrainingSeed): void {
  const id = String(eventId || "").trim();
  if (!id) return;

  const normalized = normalizeSeed(seed) ?? seed;

  const map = readSeedsByEventId();
  map[id] = normalized;
  writeSeedsByEventId(map);
}

export function readLiveSeedForEvent(eventId: string): LiveTrainingSeed | null {
  const id = String(eventId || "").trim();
  if (!id) return null;

  const map = readSeedsByEventId();
  return normalizeSeed(map[id]) ?? null;
}

export function deleteLiveSeedForEvent(eventId: string): void {
  const id = String(eventId || "").trim();
  if (!id) return;

  const map = readSeedsByEventId();
  if (!(id in map)) return;

  delete map[id];
  writeSeedsByEventId(map);
}

// ---------------- Seeds by Key ----------------

type SeedsByKey = Record<string, LiveTrainingSeed>;

/** ✅ Aktueller Key (stabil) */
export function makeSeedKey(dateISO: string, title: string): string {
  const d = normalizeDateISO(dateISO);
  const t = normalizeTitle(title);
  return `${d}|${t}`;
}

/** ✅ Legacy-Key (falls früher ohne Pipe gespeichert wurde) */
function makeSeedKeyLegacy(dateISO: string, title: string): string {
  const d = normalizeDateISO(dateISO);
  const t = normalizeTitle(title);
  return `${d}${t}`;
}

function readSeedsByKey(): SeedsByKey {
  const raw = safeGet(STORAGE_KEY_SEEDS_BY_KEY);
  const parsed = safeJSONParse<any>(raw, {});
  const normalized = normalizeSeedRecord(parsed);
  // self-heal writeback (optional)
  safeSet(STORAGE_KEY_SEEDS_BY_KEY, normalized);
  return normalized as SeedsByKey;
}

function writeSeedsByKey(map: SeedsByKey): void {
  safeSet(STORAGE_KEY_SEEDS_BY_KEY, normalizeSeedRecord(map));
}

export function writeLiveSeedForKey(key: string, seed: LiveTrainingSeed): void {
  const k = String(key || "").trim();
  if (!k) return;

  const normalized = normalizeSeed(seed) ?? seed;

  const map = readSeedsByKey();
  map[k] = normalized;
  writeSeedsByKey(map);
}

/**
 * ✅ Robust: findet Seed sowohl über neuen Key (date|title) als auch Legacy (date+title)
 */
export function readLiveSeedForKey(key: string): LiveTrainingSeed | null {
  const k = String(key || "").trim();
  if (!k) return null;

  const map = readSeedsByKey();

  const direct = map[k];
  if (direct) return normalizeSeed(direct) ?? null;

  // fallback: wenn caller schon date|title liefert, probier legacy (remove first "|")
  if (k.includes("|")) {
    const legacy = k.replace("|", "");
    const byLegacy = map[legacy];
    if (byLegacy) return normalizeSeed(byLegacy) ?? null;
  }

  return null;
}

// ✅ NEW: Key-Seeds gezielt löschen (für sauberes Cleanup bei Event-Delete)
export function deleteLiveSeedForKey(key: string): void {
  const k = String(key || "").trim();
  if (!k) return;

  const map = readSeedsByKey();
  if (!(k in map)) return;

  delete map[k];
  writeSeedsByKey(map);
}

// ---------------- ✅ Robust Resolver ----------------

/**
 * Findet den Seed robust:
 * 1) per eventId (wenn vorhanden)
 * 2) per key (date|title) (normalisiert)
 * 3) legacy key (date+title) (normalisiert)
 */
export function resolveLiveSeed(input: { eventId?: string; dateISO?: string; title?: string }): LiveTrainingSeed | null {
  if (input.eventId) {
    const byEvent = readLiveSeedForEvent(input.eventId);
    if (byEvent) return byEvent;
  }

  const dateISO = input.dateISO ? normalizeDateISO(input.dateISO) : "";
  const title = input.title ? normalizeTitle(input.title) : "";

  if (dateISO && title) {
    const key = makeSeedKey(dateISO, title);
    const byKey = readLiveSeedForKey(key);
    if (byKey) return byKey;

    const legacyKey = makeSeedKeyLegacy(dateISO, title);
    const byLegacy = readLiveSeedForKey(legacyKey);
    if (byLegacy) return byLegacy;
  }

  return null;
}

/**
 * ✅ Speichert Seed bewusst mehrfach:
 * - EventId (wichtig für Dashboard/Preview)
 * - Key (date|title)
 * - Legacy Key (date+title) => Migration
 */
export function writeLiveSeedForEventOrKey(input: {
  eventId?: string;
  dateISO?: string;
  title?: string;
  seed: LiveTrainingSeed;
}): void {
  const { eventId, seed } = input;

  const dateISO = input.dateISO ? normalizeDateISO(input.dateISO) : "";
  const title = input.title ? normalizeTitle(input.title) : "";

  const normalized = normalizeSeed(seed) ?? seed;

  if (eventId) writeLiveSeedForEvent(eventId, normalized);

  if (dateISO && title) {
    writeLiveSeedForKey(makeSeedKey(dateISO, title), normalized);
    writeLiveSeedForKey(makeSeedKeyLegacy(dateISO, title), normalized);
  }
}

// ---------------- Navigation ----------------

/**
 * Navigiert ins Live-Training.
 * ✅ eventId optional (Dashboard hat sie, Kalender hat sie, TrainingsplanPage oft nicht)
 */
export function navigateToLiveTraining(eventId?: string): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("trainq:navigate", {
      detail: { path: "/live-training", eventId },
    })
  );
}
