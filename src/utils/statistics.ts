// src/utils/statistics.ts
//
// Zweck:
// - Aggregation für Profil-Module:
//   1) Balkendiagramm: Anzahl Trainings (nach SportType)
//   2) Kreisdiagramm: Trainierte Minuten vs. Ziel
//   3) 5-Wochen Trend: Gym = Volumen, Laufen/Rad = Minuten (optional Distanz)
//
// Datenquelle:
// - CompletedWorkout[] aus trainingHistory.ts / TrainingHistoryStore
//
// Wichtige Regel (Variante A):
// - SportType sitzt am Workout (Gym dominiert), Stats basieren auf workout.sport.

import type {
  CompletedWorkout,
  ProfileStats,
  SportType,
  TrainingGoals,
  WeeklyTrendPoint,
} from "../types/training";

/* ---------------------------------------------
   Helpers
--------------------------------------------- */

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso: string): Date {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

function minutesFromSeconds(sec: number): number {
  if (!Number.isFinite(sec) || sec < 0) return 0;
  return Math.round(sec / 60);
}

function isoWeekYearAndNumber(date: Date): { year: number; week: number } {
  const d = startOfDay(date);
  // Thursday decides year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const week1Thursday = new Date(week1);
  week1Thursday.setDate(week1.getDate() + 3 - ((week1.getDay() + 6) % 7));

  const diffMs = d.getTime() - week1Thursday.getTime();
  const week = 1 + Math.round(diffMs / (7 * 24 * 3600 * 1000));
  return { year: d.getFullYear(), week };
}

function mondayOfISOWeek(date: Date): Date {
  const d = startOfDay(date);
  const diff = (d.getDay() + 6) % 7; // 0=Mo
  d.setDate(d.getDate() - diff);
  return d;
}

function kwLabel(date: Date): string {
  const { week } = isoWeekYearAndNumber(date);
  return `KW ${week}`;
}

/* ---------------------------------------------
   Core: per-workout values
--------------------------------------------- */

export function getWorkoutMinutes(w: CompletedWorkout): number {
  return minutesFromSeconds(w.durationSeconds);
}

export function getWorkoutGymVolumeKg(w: CompletedWorkout): number {
  return typeof w.totalVolumeKg === "number" && isFinite(w.totalVolumeKg)
    ? w.totalVolumeKg
    : 0;
}

export function getWorkoutDistanceKm(w: CompletedWorkout): number {
  return typeof w.totalDistanceKm === "number" && isFinite(w.totalDistanceKm)
    ? w.totalDistanceKm
    : 0;
}

/* ---------------------------------------------
   Range helpers
--------------------------------------------- */

export type StatsRange = "week" | "month" | "5weeks";

export function getRangeStart(range: StatsRange, now = new Date()): Date {
  const d = startOfDay(now);

  if (range === "week") {
    // week start = Monday
    return mondayOfISOWeek(d);
  }

  if (range === "month") {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  // 5weeks: start = Monday 4 weeks before current week
  const start = mondayOfISOWeek(d);
  start.setDate(start.getDate() - 28);
  return start;
}

export function filterWorkoutsInRange(
  workouts: CompletedWorkout[],
  range: StatsRange,
  now = new Date()
): CompletedWorkout[] {
  const start = getRangeStart(range, now).getTime();
  const end = now.getTime();

  return (workouts || []).filter((w) => {
    const t = parseISO(w.endedAt || w.startedAt).getTime();
    return t >= start && t <= end;
  });
}

/* ---------------------------------------------
   Profile aggregates
--------------------------------------------- */

function emptyCountBySport(): Record<SportType, number> {
  return { Gym: 0, Laufen: 0, Radfahren: 0, Custom: 0 };
}

function emptyMinutesBySport(): Record<SportType, number> {
  return { Gym: 0, Laufen: 0, Radfahren: 0, Custom: 0 };
}

/**
 * Main stats object for Profile.
 * - range: "week" | "month" | "5weeks"
 * - goals: optional (weeklyMinutes/monthlyMinutes)
 */
export function buildProfileStats(params: {
  workouts: CompletedWorkout[];
  range: StatsRange;
  goals?: TrainingGoals;
  now?: Date;
}): ProfileStats {
  const now = params.now ?? new Date();
  const slice = filterWorkoutsInRange(params.workouts, params.range, now);

  const countBySport = emptyCountBySport();
  const minutesBySport = emptyMinutesBySport();

  let gymTotalVolumeKg = 0;
  let runTotalKm = 0;
  let bikeTotalKm = 0;

  for (const w of slice) {
    countBySport[w.sport] += 1;

    const minutes = getWorkoutMinutes(w);
    minutesBySport[w.sport] += minutes;

    if (w.sport === "Gym") {
      gymTotalVolumeKg += getWorkoutGymVolumeKg(w);
    } else if (w.sport === "Laufen") {
      runTotalKm += getWorkoutDistanceKm(w);
    } else if (w.sport === "Radfahren") {
      bikeTotalKm += getWorkoutDistanceKm(w);
    }
    // Custom: aktuell keine Distanz/Volumen-Aggregation
  }

  const completedMinutes =
    minutesBySport.Gym +
    minutesBySport.Laufen +
    minutesBySport.Radfahren +
    minutesBySport.Custom;

  const goalMinutes =
    params.range === "month"
      ? params.goals?.monthlyMinutes
      : params.goals?.weeklyMinutes;

  const goalProgress01 =
    typeof goalMinutes === "number" && goalMinutes > 0
      ? clamp01(completedMinutes / goalMinutes)
      : undefined;

  const out: ProfileStats = {
    range: params.range,
    countBySport,
    minutesBySport,
    gymTotalVolumeKg: gymTotalVolumeKg > 0 ? Math.round(gymTotalVolumeKg) : 0,
    runTotalKm: runTotalKm > 0 ? Math.round(runTotalKm * 10) / 10 : 0,
    bikeTotalKm: bikeTotalKm > 0 ? Math.round(bikeTotalKm * 10) / 10 : 0,
    goalMinutes,
    completedMinutes,
    goalProgress01,
  };

  return out;
}

/* ---------------------------------------------
   5-Wochen Trend
--------------------------------------------- */

/**
 * Erzeugt Trendpunkte pro Woche (5 Wochen) und Sport.
 * - minutes immer gesetzt (für alle Sportarten)
 * - gymVolumeKg nur für Gym
 * - distanceKm optional (wenn totalDistanceKm genutzt wird)
 *
 * Output:
 * - enthält nur Punkte für Sportarten, die vorkommen
 * - innerhalb pro Sport: 5 Punkte (älteste -> neueste)
 */
export function buildFiveWeekTrend(params: {
  workouts: CompletedWorkout[];
  now?: Date;
}): WeeklyTrendPoint[] {
  const now = params.now ?? new Date();
  const start = getRangeStart("5weeks", now);

  const slice = (params.workouts || []).filter((w) => {
    const t = parseISO(w.endedAt || w.startedAt).getTime();
    return t >= start.getTime() && t <= now.getTime();
  });

  // Group by sport + weekStart
  const bucket = new Map<string, { minutes: number; gymKg: number; km: number }>();

  for (const w of slice) {
    const ended = parseISO(w.endedAt || w.startedAt);
    const weekStart = mondayOfISOWeek(ended);
    const weekStartKey = toLocalDateKey(weekStart);

    const key = `${w.sport}__${weekStartKey}`;
    const cur = bucket.get(key) ?? { minutes: 0, gymKg: 0, km: 0 };

    cur.minutes += getWorkoutMinutes(w);

    if (w.sport === "Gym") {
      cur.gymKg += getWorkoutGymVolumeKg(w);
    } else if (w.sport === "Laufen" || w.sport === "Radfahren") {
      cur.km += getWorkoutDistanceKm(w);
    }
    // Custom: bleibt nur Minuten

    bucket.set(key, cur);
  }

  // Build fixed 5 weeks timeline (oldest -> newest)
  const weeks: Date[] = [];
  const firstMonday = mondayOfISOWeek(start);
  for (let i = 0; i < 5; i++) {
    const d = new Date(firstMonday);
    d.setDate(firstMonday.getDate() + i * 7);
    weeks.push(d);
  }

  const sports: SportType[] = ["Gym", "Laufen", "Radfahren", "Custom"];
  const out: WeeklyTrendPoint[] = [];

  for (const sport of sports) {
    const hasSport = slice.some((w) => w.sport === sport);
    if (!hasSport) continue;

    for (const wStart of weeks) {
      const weekStartKey = toLocalDateKey(wStart);
      const key = `${sport}__${weekStartKey}`;
      const data = bucket.get(key);

      out.push({
        weekStartDate: weekStartKey,
        label: kwLabel(wStart),
        sport,
        minutes: data ? Math.round(data.minutes) : 0,
        gymVolumeKg: sport === "Gym" ? (data ? Math.round(data.gymKg) : 0) : undefined,
        distanceKm:
          sport === "Laufen" || sport === "Radfahren"
            ? data
              ? Math.round(data.km * 10) / 10
              : 0
            : undefined,
      });
    }
  }

  return out;
}