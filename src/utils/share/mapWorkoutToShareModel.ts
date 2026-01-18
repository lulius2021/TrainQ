import type { WorkoutHistoryEntry, WorkoutHistoryExercise, WorkoutHistorySet } from "../workoutHistory";
import { EXERCISES } from "../../data/exerciseLibrary";

export type WorkoutShareHighlightItem = {
  label: string;
  value: string;
};

export type WorkoutShareHighlights = {
  prsCount?: number;
  prItems?: WorkoutShareHighlightItem[];
};

export type WorkoutShareExercise = {
  name: string;
  exerciseId?: string;
  imageSrc?: string;
  muscles?: string[];
  bestSet?: { weight: number | null; reps: number | null };
  tags?: string[];
  tagsSummary?: string;
  volume?: number;
};

export type WorkoutShareModel = {
  id: string;
  title: string;
  dateISO: string;
  dateLabel: string;
  sportType: string;
  sportLabel: string;
  durationSec?: number | null;
  totalVolumeKg?: number | null;
  distanceKm?: number | null;
  setsCount: number;
  exercisesCount: number;
  exercises: WorkoutShareExercise[];
  topExercises: string[];
  highlights?: WorkoutShareHighlights;
  prsCount?: number;
  spotlight?: {
    name: string;
    imageSrc?: string;
    bestSet?: { weight: number | null; reps: number | null };
    tags: string[];
    muscles: string[];
    volume?: number;
  };
};

type Locale = "de" | "en";

function formatDateLabel(dateISO: string, locale: Locale): string {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function computeTotalVolume(entry: WorkoutHistoryEntry): number {
  if (Number.isFinite(entry.totalVolume)) return Math.max(0, Math.round(entry.totalVolume));
  let total = 0;
  for (const ex of entry.exercises ?? []) {
    for (const s of ex.sets ?? []) {
      const reps = Number.isFinite(s.reps) ? s.reps : 0;
      const weight = Number.isFinite(s.weight) ? s.weight : 0;
      total += reps * weight;
    }
  }
  return Math.max(0, Math.round(total));
}

function buildTopExercises(entry: WorkoutHistoryEntry): string[] {
  const map = new Map<string, number>();
  for (const ex of entry.exercises ?? []) {
    const name = String(ex.name || "Übung");
    let total = map.get(name) ?? 0;
    for (const s of ex.sets ?? []) {
      const reps = Number.isFinite(s.reps) ? s.reps : 0;
      const weight = Number.isFinite(s.weight) ? s.weight : 0;
      total += reps * weight;
    }
    map.set(name, total);
  }
  const ordered = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter(Boolean);
  if (ordered.length) return ordered.slice(0, 3);
  return (entry.exercises ?? []).map((ex) => ex.name).filter(Boolean).slice(0, 3);
}

function findBestSet(sets: WorkoutHistorySet[]): { weight: number | null; reps: number | null } | undefined {
  let best: { weight: number | null; reps: number | null } | undefined;
  let bestScore = -1;
  for (const s of sets ?? []) {
    const reps = Number.isFinite(s.reps) ? s.reps : null;
    const weight = Number.isFinite(s.weight) ? s.weight : null;
    const score = (reps ?? 0) * (weight ?? 0);
    if (score > bestScore) {
      bestScore = score;
      best = { weight, reps };
    }
  }
  return best;
}

function resolveTags(sets: WorkoutHistorySet[]): string[] {
  const tags = new Set<string>();
  for (const s of sets ?? []) {
    if (s.setType === "warmup") tags.add("W");
    if (s.setType === "failure") tags.add("F");
    if (s.setType === "1D") tags.add("D");
  }
  return Array.from(tags);
}

function resolveMuscles(exerciseId?: string): string[] {
  if (!exerciseId) return [];
  const found = EXERCISES.find((ex) => ex.id === exerciseId);
  const primary = found?.primaryMuscles ?? [];
  const secondary = found?.secondaryMuscles ?? [];
  return [...primary, ...secondary].filter(Boolean);
}

function resolveExerciseImageSrc(exerciseId?: string): string | undefined {
  if (!exerciseId) return undefined;
  const found = EXERCISES.find((ex) => ex.id === exerciseId);
  if (!found) return undefined;
  return found.imageSrc ?? (found.image?.kind === "asset" ? found.image.src : undefined);
}

function computeExerciseVolume(ex: WorkoutHistoryExercise): number {
  let total = 0;
  for (const s of ex.sets ?? []) {
    const reps = Number.isFinite(s.reps) ? s.reps : 0;
    const weight = Number.isFinite(s.weight) ? s.weight : 0;
    total += reps * weight;
  }
  return Math.max(0, Math.round(total));
}

function pickSpotlightExercise(exercises: WorkoutShareExercise[]): WorkoutShareExercise | undefined {
  if (!exercises.length) return undefined;
  let best = exercises[0];
  let bestVolume = best.volume ?? 0;
  for (const ex of exercises) {
    const volume = ex.volume ?? 0;
    if (volume > bestVolume) {
      best = ex;
      bestVolume = volume;
    }
  }
  return best;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function parseHighlightItems(value: unknown): WorkoutShareHighlightItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = typeof item.label === "string" ? item.label : null;
      const valueStr = typeof item.value === "string" ? item.value : null;
      if (!label || !valueStr) return null;
      return { label, value: valueStr };
    })
    .filter(Boolean) as WorkoutShareHighlightItem[];
  return items.length ? items : undefined;
}

function resolveHighlights(raw: WorkoutHistoryEntry): WorkoutShareHighlights | undefined {
  const record = raw as Record<string, unknown>;
  // Only consumes PR/highlight fields if they already exist on the raw payload.
  const directCount = typeof record.prsCount === "number" ? record.prsCount : undefined;
  const highlights = isRecord(record.highlights) ? record.highlights : undefined;
  const highlightCount =
    typeof highlights?.prsCount === "number" ? highlights.prsCount : typeof highlights?.prCount === "number" ? highlights.prCount : undefined;
  const directItems = parseHighlightItems(record.prs);
  const highlightItems = parseHighlightItems(highlights?.prItems) ?? parseHighlightItems(highlights?.items);

  const prsCount = directCount ?? highlightCount ?? (directItems ? directItems.length : undefined);
  const prItems = highlightItems ?? directItems;

  if (prsCount === undefined && !prItems) return undefined;
  return { prsCount, prItems };
}

export function mapWorkoutToShareModel(entry: WorkoutHistoryEntry, locale: Locale): WorkoutShareModel {
  const title = String(entry.title ?? "Workout");
  const dateISO = entry.endedAt || entry.startedAt || new Date().toISOString();
  const sportType = String(entry.sport ?? "Training");
  const totalVolumeKg = computeTotalVolume(entry);
  const distanceKm = Number.isFinite(entry.distanceKm) ? entry.distanceKm : null;
  const setsCount = (entry.exercises ?? []).reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0);
  const exercisesCount = (entry.exercises ?? []).length;
  const topExercises = buildTopExercises(entry);
  const highlights = resolveHighlights(entry);

  const exercises: WorkoutShareExercise[] = (entry.exercises ?? []).map((ex) => {
    const tags = resolveTags(ex.sets ?? []);
    return {
      name: ex.name || (locale === "de" ? "Übung" : "Exercise"),
      exerciseId: ex.exerciseId,
      imageSrc: resolveExerciseImageSrc(ex.exerciseId),
      muscles: resolveMuscles(ex.exerciseId),
      bestSet: findBestSet(ex.sets ?? []),
      tags,
      tagsSummary: tags.length ? tags.join(" · ") : undefined,
      volume: computeExerciseVolume(ex),
    };
  });

  const spotlightEx = pickSpotlightExercise(exercises);
  const spotlight = spotlightEx
    ? {
        name: spotlightEx.name,
        imageSrc: spotlightEx.imageSrc,
        bestSet: spotlightEx.bestSet,
        tags: spotlightEx.tags ?? [],
        muscles: spotlightEx.muscles ?? [],
        volume: spotlightEx.volume,
      }
    : undefined;

  return {
    id: entry.id,
    title,
    dateISO,
    dateLabel: formatDateLabel(dateISO, locale),
    sportType,
    sportLabel: sportType,
    durationSec: Number.isFinite(entry.durationSec) ? entry.durationSec : null,
    totalVolumeKg,
    distanceKm,
    setsCount,
    exercisesCount,
    exercises,
    topExercises,
    highlights,
    prsCount: highlights?.prsCount,
    spotlight,
  };
}
