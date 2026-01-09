// src/utils/stats.ts
import { loadWorkoutHistory, type WorkoutHistoryEntry, type WorkoutHistoryExercise, type WorkoutHistorySet } from "./workoutHistory";

export type DateRange = { from: Date; to: Date };

export type DailyValue = { date: string; value: number };
export type WeeklyValue = { weekStart: string; value: number };

export type FlatSet = {
  workoutId: string;
  date: string;
  exerciseName: string;
  exerciseId?: string;
  set: WorkoutHistorySet;
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 So – 6 Sa
  const diff = (day + 6) % 7; // 0 = Mo
  d.setDate(d.getDate() - diff);
  return d;
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(input: string): Date {
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) return new Date();
  return d;
}

function inRange(d: Date, from: Date, to: Date): boolean {
  const t = d.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function getWorkoutsForRange(
  userId: string | undefined,
  from: Date,
  to: Date,
  workoutsOverride?: WorkoutHistoryEntry[]
): WorkoutHistoryEntry[] {
  void userId;
  const source = workoutsOverride ?? loadWorkoutHistory();
  return source.filter((w) => {
    const d = parseISODate(w.endedAt || w.startedAt);
    return inRange(d, from, to);
  });
}

export function getSetsForRange(workouts: WorkoutHistoryEntry[]): FlatSet[] {
  const sets: FlatSet[] = [];
  for (const w of workouts) {
    const date = dateKey(parseISODate(w.endedAt || w.startedAt));
    for (const ex of w.exercises || []) {
      for (const set of ex.sets || []) {
        sets.push({
          workoutId: w.id,
          date,
          exerciseName: ex.name,
          exerciseId: ex.exerciseId,
          set,
        });
      }
    }
  }
  return sets;
}

export function isWorkingSet(set: WorkoutHistorySet): boolean {
  const isWarmup = (set as any).isWarmup === true || (set as any).setType === "warmup";
  return !isWarmup;
}

export function computeVolumeByDay(workouts: WorkoutHistoryEntry[], includeWarmup = false): DailyValue[] {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const day = dateKey(parseISODate(w.endedAt || w.startedAt));
    let sum = 0;
    for (const ex of w.exercises || []) {
      for (const set of ex.sets || []) {
        if (!includeWarmup && !isWorkingSet(set)) continue;
        const reps = Number(set.reps ?? 0);
        const weight = Number((set as any).weight ?? 0);
        if (reps <= 0 || weight <= 0) continue;
        sum += reps * weight;
      }
    }
    map.set(day, (map.get(day) ?? 0) + sum);
  }

  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeVolumeByWeek(workouts: WorkoutHistoryEntry[], includeWarmup = false): WeeklyValue[] {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const d = parseISODate(w.endedAt || w.startedAt);
    const weekKey = dateKey(startOfWeekMonday(d));
    let sum = 0;
    for (const ex of w.exercises || []) {
      for (const set of ex.sets || []) {
        if (!includeWarmup && !isWorkingSet(set)) continue;
        const reps = Number(set.reps ?? 0);
        const weight = Number((set as any).weight ?? 0);
        if (reps <= 0 || weight <= 0) continue;
        sum += reps * weight;
      }
    }
    map.set(weekKey, (map.get(weekKey) ?? 0) + sum);
  }

  return Array.from(map.entries())
    .map(([weekStart, value]) => ({ weekStart, value }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function e1RMFromSet(set: WorkoutHistorySet): number | null {
  const reps = Number(set.reps ?? 0);
  const weight = Number((set as any).weight ?? 0);
  if (!Number.isFinite(reps) || !Number.isFinite(weight)) return null;
  if (reps < 1 || reps > 10) return null;
  if (weight <= 0) return null;
  return weight * (1 + reps / 30);
}

export function computeBestE1RMByDay(
  workouts: WorkoutHistoryEntry[],
  exerciseName: string,
  includeWarmup = false
): DailyValue[] {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const day = dateKey(parseISODate(w.endedAt || w.startedAt));
    let best = map.get(day) ?? 0;
    for (const ex of w.exercises || []) {
      if (ex.name !== exerciseName) continue;
      for (const set of ex.sets || []) {
        if (!includeWarmup && !isWorkingSet(set)) continue;
        const val = e1RMFromSet(set);
        if (val && val > best) best = val;
      }
    }
    if (best > 0) map.set(day, best);
  }

  return Array.from(map.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeBestE1RMInRange(
  workouts: WorkoutHistoryEntry[],
  exerciseName: string,
  from: Date,
  to: Date,
  includeWarmup = false
): number {
  let best = 0;
  for (const w of workouts) {
    const d = parseISODate(w.endedAt || w.startedAt);
    if (d.getTime() < from.getTime() || d.getTime() > to.getTime()) continue;
    for (const ex of w.exercises || []) {
      if (ex.name !== exerciseName) continue;
      for (const set of ex.sets || []) {
        if (!includeWarmup && !isWorkingSet(set)) continue;
        const val = e1RMFromSet(set);
        if (val && val > best) best = val;
      }
    }
  }
  return best;
}

export function computeAllTimeE1RMPR(
  workouts: WorkoutHistoryEntry[],
  includeWarmup = false
): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      let best = map.get(ex.name) ?? 0;
      for (const set of ex.sets || []) {
        if (!includeWarmup && !isWorkingSet(set)) continue;
        const val = e1RMFromSet(set);
        if (val && val > best) best = val;
      }
      if (best > 0) map.set(ex.name, best);
    }
  }
  return map;
}

export function computeTrainingDays(workouts: WorkoutHistoryEntry[]): string[] {
  const days = new Set<string>();
  for (const w of workouts) {
    const day = dateKey(parseISODate(w.endedAt || w.startedAt));
    days.add(day);
  }
  return Array.from(days).sort();
}

export function computeStreaks(workouts: WorkoutHistoryEntry[]): { current: number; longest: number } {
  const days = computeTrainingDays(workouts).map((d) => parseISODate(`${d}T00:00:00`));
  if (!days.length) return { current: 0, longest: 0 };

  const sorted = days.sort((a, b) => a.getTime() - b.getTime());
  let longest = 1;
  let current = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].getTime();
    const next = sorted[i].getTime();
    const diffDays = Math.round((next - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      run += 1;
    } else if (diffDays > 1) {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  const today = startOfDay(new Date()).getTime();
  const last = startOfDay(sorted[sorted.length - 1]).getTime();
  if (today === last) {
    current = run;
  } else if (today - last === 24 * 60 * 60 * 1000) {
    current = run;
  } else {
    current = 0;
  }

  return { current, longest };
}

export function computeWeeklyTrainingDays(workouts: WorkoutHistoryEntry[]): WeeklyValue[] {
  const map = new Map<string, Set<string>>();
  for (const w of workouts) {
    const d = parseISODate(w.endedAt || w.startedAt);
    const weekKey = dateKey(startOfWeekMonday(d));
    const dayKey = dateKey(d);
    if (!map.has(weekKey)) map.set(weekKey, new Set());
    map.get(weekKey)!.add(dayKey);
  }

  return Array.from(map.entries())
    .map(([weekStart, days]) => ({ weekStart, value: days.size }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function computeLoadByWeek(workouts: WorkoutHistoryEntry[]): WeeklyValue[] {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const sessionRpe = Number((w as any).sessionRpe ?? 0);
    if (!Number.isFinite(sessionRpe) || sessionRpe <= 0) continue;
    const minutes = Math.max(0, Math.round((w.durationSec ?? 0) / 60));
    const load = minutes * sessionRpe;
    const weekKey = dateKey(startOfWeekMonday(parseISODate(w.endedAt || w.startedAt)));
    map.set(weekKey, (map.get(weekKey) ?? 0) + load);
  }

  return Array.from(map.entries())
    .map(([weekStart, value]) => ({ weekStart, value }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function listExercises(workouts: WorkoutHistoryEntry[]): string[] {
  const set = new Set<string>();
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      if (ex.name) set.add(ex.name);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function sumVolume(workouts: WorkoutHistoryEntry[], includeWarmup = false): number {
  return computeVolumeByDay(workouts, includeWarmup).reduce((acc, d) => acc + d.value, 0);
}
