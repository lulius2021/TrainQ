/**
 * TrainingLoadService
 * Computes ATL, CTL, TSB, ACWR and training status from workout history.
 *
 * Training load unit (arbitrary, ~Session-RPE × hours × 10):
 *   load = RPE × (durationSec / 3600) × 10
 * When RPE is missing, a sport-based default is used.
 */

import { loadWorkoutHistory } from "../utils/workoutHistory";
import type { TrainingLoadSnapshot, TrainingStatus } from "../types/wellness";

const DEFAULT_RPE_BY_SPORT: Record<string, number> = {
  gym: 6,
  laufen: 7,
  radfahren: 6,
  custom: 5,
};

function getDefaultRpe(sport?: string): number {
  return DEFAULT_RPE_BY_SPORT[(sport ?? "").toLowerCase()] ?? 6;
}

export function computeSessionLoad(
  durationSec: number,
  sessionRpe?: number,
  sport?: string
): number {
  const rpe = sessionRpe ?? getDefaultRpe(sport);
  const hours = Math.max(0, durationSec) / 3600;
  return Math.round(rpe * hours * 10 * 10) / 10; // 1 decimal
}

export type DailyLoad = {
  date: string; // YYYY-MM-DD
  load: number;
};

export function computeDailyLoads(): DailyLoad[] {
  const history = loadWorkoutHistory();
  const byDate = new Map<string, number>();

  for (const w of history) {
    const dateStr = (w.endedAt || w.startedAt || "").slice(0, 10);
    if (!dateStr || dateStr.length < 10) continue;
    const load = computeSessionLoad(w.durationSec, w.sessionRpe, w.sport);
    byDate.set(dateStr, (byDate.get(dateStr) ?? 0) + load);
  }

  return Array.from(byDate.entries())
    .map(([date, load]) => ({ date, load }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function ewmaFactor(timeconstant: number): number {
  return 2 / (timeconstant + 1);
}

export function computeTrainingLoadSnapshot(targetDate?: string): TrainingLoadSnapshot {
  const todayISO = targetDate ?? new Date().toISOString().slice(0, 10);
  const daily = computeDailyLoads();
  const loadMap = new Map<string, number>(daily.map((d) => [d.date, d.load]));

  const aFast = ewmaFactor(7);  // ATL
  const aSlow = ewmaFactor(42); // CTL

  let ctl = 0;
  let atl = 0;

  const today = new Date(todayISO + "T00:00:00");
  let nonZeroDays = 0;

  for (let i = 59; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const load = loadMap.get(iso) ?? 0;
    if (load > 0) nonZeroDays++;
    ctl = aSlow * load + (1 - aSlow) * ctl;
    atl = aFast  * load + (1 - aFast)  * atl;
  }

  const tsb  = ctl - atl;
  const acwr = ctl > 0 ? atl / ctl : 0;
  const hasEnoughData = nonZeroDays >= 7;

  return {
    date: todayISO,
    ctl:  Math.round(ctl  * 10) / 10,
    atl:  Math.round(atl  * 10) / 10,
    tsb:  Math.round(tsb  * 10) / 10,
    acwr: Math.round(acwr * 100) / 100,
    status: computeTrainingStatus(tsb, acwr, hasEnoughData),
    hasEnoughData,
  };
}

function computeTrainingStatus(tsb: number, acwr: number, hasData: boolean): TrainingStatus {
  if (!hasData) return "Unknown";
  if (acwr > 1.5 || tsb < -25) return "Overreaching";
  if (acwr < 0.3 && tsb > 10)  return "Detraining";
  if (tsb  > 10 && acwr < 1.2) return "Peaking";
  if (acwr > 1.3)               return "Recovery";
  if (tsb >= -10 && tsb <= 10 && acwr >= 0.8) return "Productive";
  if (tsb < -10)                return "Recovery";
  return "Unknown";
}

/**
 * Compare average session load: recent 3 vs previous 3.
 * Returns negative if load decreased (possibly fatigue/overtraining),
 * positive if load increased.
 */
export function getRecentPerformanceTrend(): "positive" | "negative" | "neutral" {
  const history = loadWorkoutHistory().slice(0, 6);
  if (history.length < 3) return "neutral";

  const recent   = history.slice(0, 3);
  const previous = history.slice(3, 6);
  if (previous.length === 0) return "neutral";

  const avg = (arr: typeof history) =>
    arr.reduce((s, w) => s + computeSessionLoad(w.durationSec, w.sessionRpe, w.sport), 0) / arr.length;

  const diff = avg(recent) - avg(previous);
  const threshold = avg(previous) * 0.07; // 7% change = meaningful

  if (diff < -threshold) return "negative";
  if (diff >  threshold) return "positive";
  return "neutral";
}

/**
 * Compute average performance metric for the N sessions
 * most recent before a given ISO date.
 * Gym → total volume; Cardio → distance or estimated load.
 */
export function getAvgPerformanceBefore(dateISO: string, n = 3): number {
  const history = loadWorkoutHistory().filter(
    (w) => (w.endedAt || w.startedAt) < dateISO
  );
  const slice = history.slice(0, n);
  if (slice.length === 0) return 0;

  return (
    slice.reduce((sum, w) => {
      if (w.totalVolume > 0) return sum + w.totalVolume;
      if (w.distanceKm && w.distanceKm > 0) return sum + w.distanceKm * 1000;
      return sum + computeSessionLoad(w.durationSec, w.sessionRpe, w.sport);
    }, 0) / slice.length
  );
}

export function getAvgPerformanceAfter(dateISO: string, n = 3): number {
  const history = loadWorkoutHistory().filter(
    (w) => (w.endedAt || w.startedAt) >= dateISO
  );
  const slice = history.slice(0, n);
  if (slice.length === 0) return 0;

  return (
    slice.reduce((sum, w) => {
      if (w.totalVolume > 0) return sum + w.totalVolume;
      if (w.distanceKm && w.distanceKm > 0) return sum + w.distanceKm * 1000;
      return sum + computeSessionLoad(w.durationSec, w.sessionRpe, w.sport);
    }, 0) / slice.length
  );
}
