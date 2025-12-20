// src/utils/liveTrainingSeed.ts

export type WeeklySportType = "Gym" | "Laufen" | "Radfahren" | "Custom";

export type ExerciseSetSeed = {
  id: number;
  reps?: number; // Gym: Wdh | Cardio: Dauer (min)
  weight?: number; // Gym: kg  | Cardio: Distanz (km)
  notes?: string;
};

export type BlockExerciseSeed = {
  id: number;
  exerciseId?: string;
  name: string;
  sets: ExerciseSetSeed[];
};

export type LiveTrainingSeed = {
  title: string;
  sport: WeeklySportType | "Gym";
  isCardio: boolean;
  exercises: BlockExerciseSeed[];
};

// Globaler Seed (LiveTrainingPage liest das)
const STORAGE_KEY_GLOBAL_SEED = "trainq_live_training_seed_v1";

// Seeds pro Kalender-Event
const STORAGE_KEY_SEEDS_BY_EVENT = "trainq_live_training_seeds_by_event_v1";

// Seeds stabil per Key
const STORAGE_KEY_SEEDS_BY_KEY = "trainq_live_training_seeds_by_key_v1";

// ---------------- Helpers ----------------

function safeJSONParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ---------------- Global Seed ----------------

export function writeGlobalLiveSeed(seed: LiveTrainingSeed) {
  safeSet(STORAGE_KEY_GLOBAL_SEED, seed);
}

export function readGlobalLiveSeed(): LiveTrainingSeed | null {
  const raw = safeGet(STORAGE_KEY_GLOBAL_SEED);
  if (!raw) return null;
  return safeJSONParse<LiveTrainingSeed | null>(raw, null);
}

export function clearGlobalLiveSeed() {
  safeRemove(STORAGE_KEY_GLOBAL_SEED);
}

// ---------------- Seeds by EventId ----------------

type SeedsByEventId = Record<string, LiveTrainingSeed>;

function readSeedsByEventId(): SeedsByEventId {
  const raw = safeGet(STORAGE_KEY_SEEDS_BY_EVENT);
  return safeJSONParse<SeedsByEventId>(raw, {});
}

function writeSeedsByEventId(map: SeedsByEventId) {
  safeSet(STORAGE_KEY_SEEDS_BY_EVENT, map);
}

export function writeLiveSeedForEvent(eventId: string, seed: LiveTrainingSeed) {
  if (!eventId) return;
  const map = readSeedsByEventId();
  map[eventId] = seed;
  writeSeedsByEventId(map);
}

export function readLiveSeedForEvent(eventId: string): LiveTrainingSeed | null {
  if (!eventId) return null;
  const map = readSeedsByEventId();
  return map[eventId] ?? null;
}

export function deleteLiveSeedForEvent(eventId: string) {
  if (!eventId) return;
  const map = readSeedsByEventId();
  if (!(eventId in map)) return;
  delete map[eventId];
  writeSeedsByEventId(map);
}

// ---------------- Seeds by Key ----------------

type SeedsByKey = Record<string, LiveTrainingSeed>;

/** ✅ Aktueller Key (stabil) */
export function makeSeedKey(dateISO: string, title: string): string {
  const safeTitle = (title || "").trim();
  return `${dateISO}|${safeTitle}`;
}

/** ✅ Legacy-Key (falls früher ohne Pipe gespeichert wurde) */
function makeSeedKeyLegacy(dateISO: string, title: string): string {
  const safeTitle = (title || "").trim();
  return `${dateISO}${safeTitle}`;
}

function readSeedsByKey(): SeedsByKey {
  const raw = safeGet(STORAGE_KEY_SEEDS_BY_KEY);
  return safeJSONParse<SeedsByKey>(raw, {});
}

function writeSeedsByKey(map: SeedsByKey) {
  safeSet(STORAGE_KEY_SEEDS_BY_KEY, map);
}

export function writeLiveSeedForKey(key: string, seed: LiveTrainingSeed) {
  if (!key) return;
  const map = readSeedsByKey();
  map[key] = seed;
  writeSeedsByKey(map);
}

/**
 * ✅ Robust: findet Seed sowohl über neuen Key (date|title) als auch Legacy (date+title)
 */
export function readLiveSeedForKey(key: string): LiveTrainingSeed | null {
  if (!key) return null;

  const map = readSeedsByKey();
  if (map[key]) return map[key];

  // fallback: wenn caller schon date|title liefert, probier legacy
  const legacy = key.includes("|") ? key.replace("|", "") : key;
  return map[legacy] ?? null;
}

// ---------------- ✅ Robust Resolver ----------------

/**
 * Findet den Seed robust:
 * 1) per eventId (wenn vorhanden)
 * 2) per key (date|title)
 * 3) legacy key (date+title)
 */
export function resolveLiveSeed(input: { eventId?: string; dateISO?: string; title?: string }): LiveTrainingSeed | null {
  if (input.eventId) {
    const byEvent = readLiveSeedForEvent(input.eventId);
    if (byEvent) return byEvent;
  }

  if (input.dateISO && input.title) {
    const key = makeSeedKey(input.dateISO, input.title);
    const byKey = readLiveSeedForKey(key);
    if (byKey) return byKey;

    const legacyKey = makeSeedKeyLegacy(input.dateISO, input.title);
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
export function writeLiveSeedForEventOrKey(input: { eventId?: string; dateISO?: string; title?: string; seed: LiveTrainingSeed }) {
  const { eventId, dateISO, title, seed } = input;

  if (eventId) writeLiveSeedForEvent(eventId, seed);

  if (dateISO && title) {
    // new stable
    writeLiveSeedForKey(makeSeedKey(dateISO, title), seed);
    // legacy (migration)
    writeLiveSeedForKey(makeSeedKeyLegacy(dateISO, title), seed);
  }
}

// ---------------- Navigation ----------------

/**
 * Navigiert ins Live-Training.
 * ✅ eventId wird optional mitgegeben, damit App.tsx
 * STORAGE_KEY_ACTIVE_LIVE_EVENT_ID setzen kann.
 */
export function navigateToLiveTraining(eventId?: string) {
  window.dispatchEvent(
    new CustomEvent("trainq:navigate", {
      detail: { path: "/live-training", eventId },
    })
  );
}