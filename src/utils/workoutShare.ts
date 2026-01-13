// src/utils/workoutShare.ts
import type { WorkoutHistoryEntry } from "./workoutHistory";
import { EXERCISES } from "../data/exerciseLibrary";

export type WorkoutShareStats = {
  title: string;
  dateLabel: string;
  sport: string;
  durationMin: number;
  durationLabel: string;
  totalVolumeKg: number;
  totalSets: number;
  totalExercises: number;
  topExercises: string[];
  muscleGroups: string[];
};

function clampInt(n: number, fallback = 0): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.round(n));
}

function toDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDurationLabel(durationMin: number): string {
  const h = Math.floor(durationMin / 60);
  const m = durationMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h}:${String(m).padStart(2, "0")} h`;
}

function computeVolumeFromExercises(entry: WorkoutHistoryEntry): number {
  let total = 0;
  for (const ex of entry.exercises ?? []) {
    for (const s of ex.sets ?? []) {
      const reps = Number.isFinite(s.reps) ? s.reps : 0;
      const weight = Number.isFinite(s.weight) ? s.weight : 0;
      total += reps * weight;
    }
  }
  return clampInt(total, 0);
}

function buildExerciseVolumeMap(entry: WorkoutHistoryEntry): Map<string, number> {
  const map = new Map<string, number>();
  for (const ex of entry.exercises ?? []) {
    const name = String(ex.name ?? "Übung");
    let total = map.get(name) ?? 0;
    for (const s of ex.sets ?? []) {
      const reps = Number.isFinite(s.reps) ? s.reps : 0;
      const weight = Number.isFinite(s.weight) ? s.weight : 0;
      total += reps * weight;
    }
    map.set(name, total);
  }
  return map;
}

function isGymSport(sport?: string): boolean {
  return String(sport ?? "").trim().toLowerCase() === "gym";
}

function buildExerciseMetaMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const ex of EXERCISES) {
    if (!ex?.id) continue;
    const groups = Array.isArray(ex.primaryMuscles) ? ex.primaryMuscles.filter(Boolean) : [];
    if (groups.length) map.set(ex.id, groups);
  }
  return map;
}

function computeMuscleGroups(entry: WorkoutHistoryEntry, totalVolume: number): string[] {
  const meta = buildExerciseMetaMap();
  const counts = new Map<string, number>();
  const useVolume = isGymSport(entry.sport) && totalVolume > 0;

  for (const ex of entry.exercises ?? []) {
    const primary = meta.get(String(ex.exerciseId ?? "")) ?? [];
    const mainGroup = primary[0];
    if (!mainGroup) continue;

    for (const s of ex.sets ?? []) {
      const reps = Number.isFinite(s.reps) ? s.reps : 0;
      const weight = Number.isFinite(s.weight) ? s.weight : 0;
      const value = useVolume ? reps * weight : 1;
      if (value <= 0) continue;
      counts.set(mainGroup, (counts.get(mainGroup) ?? 0) + value);
    }
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([group]) => group)
    .filter(Boolean)
    .slice(0, 5);

  return sorted.length ? sorted : ["core"];
}

export function computeWorkoutShareStats(entry: WorkoutHistoryEntry): WorkoutShareStats {
  const title = String(entry.title ?? "Training").trim() || "Training";
  const dateISO = entry.endedAt || entry.startedAt || new Date().toISOString();
  const dateLabel = toDateLabel(dateISO);
  const sport = String(entry.sport ?? "Training");
  const durationMin = clampInt((entry.durationSec ?? 0) / 60, 0);

  const totalSets = (entry.exercises ?? []).reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0);
  const totalExercises = (entry.exercises ?? []).length;
  const totalVolumeKg = Number.isFinite(entry.totalVolume) ? clampInt(entry.totalVolume, 0) : computeVolumeFromExercises(entry);

  const volumeMap = buildExerciseVolumeMap(entry);
  const topExercises = Array.from(volumeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .filter(Boolean)
    .slice(0, 3);

  if (topExercises.length === 0) {
    topExercises.push(...(entry.exercises ?? []).map((ex) => ex.name).filter(Boolean).slice(0, 3));
  }

  const muscleGroups = computeMuscleGroups(entry, totalVolumeKg);

  return {
    title,
    dateLabel,
    sport,
    durationMin,
    durationLabel: formatDurationLabel(durationMin),
    totalVolumeKg,
    totalSets,
    totalExercises,
    topExercises,
    muscleGroups,
  };
}
