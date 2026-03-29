/**
 * DeloadScoreService
 * Computes a 0–100 deload decision score from multiple factors:
 *
 *  +20  Weeks since last deload ≥ cycle length
 *  +25  ACWR > 1.3
 *  +15  Performance trend negative (last 3 sessions)
 *  +15  Subjective wellbeing < 5/10
 *  +15  HRV 7-day trend negative  (Garmin, if available)
 *  +10  Resting HR > 5 bpm above baseline (Garmin, if available)
 *
 *  Score ≥ 50 → "recommended"
 *  Score ≥ 70 → "urgent"
 */

import type { DeloadScoreResult, DeloadScoreFactor, WellnessEntry } from "../types/wellness";
import { computeTrainingLoadSnapshot, getRecentPerformanceTrend } from "./TrainingLoadService";
import { getScopedItem } from "../utils/scopedStorage";
import {
  readLastDeloadStartISO,
  readLastDeloadIntervalWeeks,
} from "../utils/deload/storage";
import {
  computeAvgSessionsPerWeek,
  mapSessionsToIntervalWeeks,
} from "../utils/deload/schedule";
import type { CalendarEvent } from "../types/training";

const WELLNESS_KEY = "trainq_wellness_v1";

function loadWellnessEntries(userId?: string | null): WellnessEntry[] {
  const raw = getScopedItem(WELLNESS_KEY, userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WellnessEntry[]) : [];
  } catch {
    return [];
  }
}

function getTodayWellness(userId?: string | null): WellnessEntry | null {
  const today = new Date().toISOString().slice(0, 10);
  return loadWellnessEntries(userId).find((e) => e.date === today) ?? null;
}

/** Garmin integration: read cached daily metrics for HRV / RHR analysis */
function getGarminFactors(userId?: string | null): {
  hrv7DayNegative: boolean | null;
  rhrAboveBaseline: boolean | null;
} {
  // We look at garmin_daily_metrics cached locally (Supabase-synced data).
  // Key used by the Garmin sync service.
  const raw = getScopedItem("trainq_garmin_daily_cache_v1", userId);
  if (!raw) return { hrv7DayNegative: null, rhrAboveBaseline: null };

  try {
    const records = JSON.parse(raw) as Array<{
      calendar_date: string;
      heart_rate_resting?: number;
      hrv_weekly_avg?: number;
    }>;
    if (!Array.isArray(records) || records.length < 5)
      return { hrv7DayNegative: null, rhrAboveBaseline: null };

    const sorted = [...records].sort((a, b) =>
      b.calendar_date.localeCompare(a.calendar_date)
    );

    // RHR baseline: median of last 14 days (exclude last 3 to get true baseline)
    const rhrSamples = sorted
      .slice(3, 17)
      .map((r) => r.heart_rate_resting)
      .filter((v): v is number => typeof v === "number" && v > 0);

    let rhrAboveBaseline: boolean | null = null;
    if (rhrSamples.length >= 3) {
      const baseline = rhrSamples.reduce((a, b) => a + b, 0) / rhrSamples.length;
      const recent = sorted
        .slice(0, 3)
        .map((r) => r.heart_rate_resting)
        .filter((v): v is number => typeof v === "number" && v > 0);
      if (recent.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        rhrAboveBaseline = recentAvg > baseline + 5;
      }
    }

    // HRV 7-day trend: compare last 3 days vs days 4–7
    const hrvSamples = sorted
      .slice(0, 7)
      .map((r) => r.hrv_weekly_avg)
      .filter((v): v is number => typeof v === "number" && v > 0);

    let hrv7DayNegative: boolean | null = null;
    if (hrvSamples.length >= 6) {
      const recent = hrvSamples.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      const older  = hrvSamples.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
      hrv7DayNegative = recent < older * 0.92; // > 8% drop = negative trend
    }

    return { hrv7DayNegative, rhrAboveBaseline };
  } catch {
    return { hrv7DayNegative: null, rhrAboveBaseline: null };
  }
}

export function computeDeloadScore(userId?: string | null): DeloadScoreResult {
  const todayISO  = new Date().toISOString().slice(0, 10);
  const snapshot  = computeTrainingLoadSnapshot(todayISO);
  const wellness  = getTodayWellness(userId);
  const trend     = getRecentPerformanceTrend();
  const garmin    = getGarminFactors(userId);

  // --- Factor 1: Weeks since last deload vs cycle length ---
  const lastDeloadISO = readLastDeloadStartISO(userId);
  const rawEvents = getScopedItem("trainq_calendar_events", userId);
  let calEvents: CalendarEvent[] = [];
  if (rawEvents) {
    try { calEvents = JSON.parse(rawEvents); } catch { /* ignore */ }
  }
  const avg = computeAvgSessionsPerWeek(calEvents);
  const cycleLength = readLastDeloadIntervalWeeks(userId) ?? mapSessionsToIntervalWeeks(avg);

  let weeksSinceDeload = 0;
  if (lastDeloadISO) {
    const msPerWeek = 7 * 24 * 3600 * 1000;
    weeksSinceDeload = Math.floor(
      (new Date(todayISO + "T00:00:00").getTime() -
        new Date(lastDeloadISO + "T00:00:00").getTime()) / msPerWeek
    );
  } else {
    const firstDate = calEvents
      .filter((e) => e.type === "training")
      .map((e) => e.date)
      .sort()[0];
    if (firstDate) {
      const msPerWeek = 7 * 24 * 3600 * 1000;
      weeksSinceDeload = Math.floor(
        (new Date(todayISO + "T00:00:00").getTime() -
          new Date(firstDate + "T00:00:00").getTime()) / msPerWeek
      );
    }
  }

  const factors: DeloadScoreFactor[] = [
    {
      key: "cycle",
      label: `${weeksSinceDeload}/${cycleLength} Wo. seit letztem Deload`,
      points: 20,
      applies: weeksSinceDeload >= cycleLength,
    },
    {
      key: "acwr",
      label: `Trainingsbelastung: ACWR ${snapshot.acwr.toFixed(2)}${snapshot.acwr > 1.5 ? " ⚠️" : ""}`,
      points: 25,
      applies: snapshot.acwr > 1.3,
      detail: snapshot.acwr > 1.5 ? "Verletzungsrisiko erhöht" : undefined,
    },
    {
      key: "performance",
      label: "Performance-Trend negativ (letzte 3 Sessions)",
      points: 15,
      applies: trend === "negative",
    },
    {
      key: "wellbeing",
      label: wellness
        ? `Wohlbefinden ${wellness.wellbeingScore}/10`
        : "Wohlbefinden nicht erfasst",
      points: 15,
      applies: wellness != null && wellness.wellbeingScore < 5,
    },
    {
      key: "hrv",
      label: garmin.hrv7DayNegative !== null
        ? "HRV-Trend negativ (letzte 7 Tage)"
        : "HRV nicht verfügbar",
      points: 15,
      applies: garmin.hrv7DayNegative === true,
    },
    {
      key: "rhr",
      label: garmin.rhrAboveBaseline !== null
        ? "Ruheherzfrequenz > 5 bpm über Baseline"
        : "Ruheherzfrequenz nicht verfügbar",
      points: 10,
      applies: garmin.rhrAboveBaseline === true,
    },
  ];

  const score = factors.reduce((sum, f) => sum + (f.applies ? f.points : 0), 0);
  const level = score >= 70 ? "urgent" : score >= 50 ? "recommended" : "none";
  const hasEnoughHistory = snapshot.hasEnoughData;

  return {
    score,
    level,
    factors,
    snapshot,
    wellbeing: wellness?.wellbeingScore,
    hasEnoughHistory,
  };
}
