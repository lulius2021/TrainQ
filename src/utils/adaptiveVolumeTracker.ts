// src/utils/adaptiveVolumeTracker.ts
// Weekly volume tracking for adaptive training intelligence

import type { WorkoutHistoryEntry } from "./workoutHistory";
import type { WeeklyVolumeContext } from "../types/adaptive";

function getISOWeekNumber(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function weekKey(d: Date): string {
  return `${d.getFullYear()}-W${getISOWeekNumber(d)}`;
}

export function computeWeeklyVolumeContext(workouts: WorkoutHistoryEntry[]): WeeklyVolumeContext {
  const now = new Date();
  const currentWeekKey = weekKey(now);
  const prevWeekDate = new Date(now.getTime() - 7 * 86400000);
  const prevWeekKey = weekKey(prevWeekDate);

  let currentWeekVolume = 0;
  let previousWeekVolume = 0;
  let currentWeekSessions = 0;
  let mostRecentSessionTime = 0;

  for (const w of workouts) {
    const d = new Date(w.startedAt);
    const wk = weekKey(d);
    const isGym = (w.sport || "").toLowerCase() === "gym" || (!w.sport && w.totalVolume > 0);

    if (wk === currentWeekKey) {
      if (isGym) currentWeekVolume += w.totalVolume;
      currentWeekSessions++;
    } else if (wk === prevWeekKey) {
      if (isGym) previousWeekVolume += w.totalVolume;
    }

    const t = d.getTime();
    if (t > mostRecentSessionTime) mostRecentSessionTime = t;
  }

  const volumeChangePercent = previousWeekVolume > 0
    ? ((currentWeekVolume - previousWeekVolume) / previousWeekVolume) * 100
    : 0;

  const daysSinceLastSession = mostRecentSessionTime > 0
    ? Math.floor((now.getTime() - mostRecentSessionTime) / 86400000)
    : 999;

  return {
    currentWeekVolume,
    previousWeekVolume,
    volumeChangePercent: Math.round(volumeChangePercent),
    currentWeekSessions,
    daysSinceLastSession,
    needsVolumeReduction: volumeChangePercent > 10 && previousWeekVolume > 0,
    needsExtendedWarmup: daysSinceLastSession >= 3,
  };
}
