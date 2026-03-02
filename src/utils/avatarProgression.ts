// src/utils/avatarProgression.ts
// Pure functions for robot avatar XP progression — no side effects.

import type { WorkoutHistoryEntry } from "./workoutHistory";

/* ─── Types ─── */

export interface AvatarState {
  totalXp: number;
  stage: number; // 0-11
  variant: "bulk" | "speed";
  dailyLog: Record<string, number>; // "2026-03-02" → xp granted that day
  weeklyLog: Record<string, number>; // "2026-W09" → xp granted that week
  lastWorkoutId?: string; // dedup guard
}

/* ─── Constants ─── */

export const STAGE_THRESHOLDS = [
  0, 100, 300, 600, 1000, 1600, 2400, 3500, 5000, 7000, 10000, 14000,
] as const;

export const STAGE_NAMES = [
  "Prototyp",
  "Basis-Bot",
  "Lehrling",
  "Arbeiter",
  "Krieger",
  "Veteran",
  "Elite",
  "Champion",
  "Titan",
  "Legende",
  "Meister",
  "Omega",
] as const;

const DAILY_CAP = 120;
const WEEKLY_CAP = 500;
const MAX_STAGE = STAGE_THRESHOLDS.length - 1;

/* ─── Helpers ─── */

export function defaultAvatarState(): AvatarState {
  return {
    totalXp: 0,
    stage: 0,
    variant: "bulk",
    dailyLog: {},
    weeklyLog: {},
  };
}

/** ISO date string "2026-03-02" */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO week key "2026-W09" (Mon–Sun) */
function weekKey(d: Date): string {
  // ISO week: Monday = start
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7; // Sun=7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Remove log entries older than 14 days */
function pruneLog(log: Record<string, number>, now: Date): Record<string, number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffStr = dateKey(cutoff);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(log)) {
    if (k >= cutoffStr) out[k] = v;
  }
  return out;
}

function pruneWeekLog(log: Record<string, number>, now: Date): Record<string, number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 14);
  const cutoffWk = weekKey(cutoff);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(log)) {
    if (k >= cutoffWk) out[k] = v;
  }
  return out;
}

/* ─── Core Functions ─── */

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function isCardio(sport?: string): boolean {
  const s = (sport || "").trim().toLowerCase();
  return s === "laufen" || s === "radfahren";
}

function isGym(sport?: string): boolean {
  return (sport || "").trim().toLowerCase() === "gym";
}

/** Compute raw (uncapped) XP for a single workout. */
export function computeRawXp(entry: WorkoutHistoryEntry): number {
  const minutes = Math.floor(entry.durationSec / 60);

  if (isGym(entry.sport)) {
    const base = 20;
    const timePart = minutes * 0.5;
    const exPart = (entry.exercises?.length ?? 0) * 2;
    const volPart = Math.min((entry.totalVolume ?? 0) / 500, 10);
    return clamp(Math.floor(base + timePart + exPart + volPart), 20, 60);
  }

  if (isCardio(entry.sport)) {
    const base = 20;
    const timePart = minutes * 0.8;
    const distPart = Math.min((entry.distanceKm ?? 0) * 3, 15);
    return clamp(Math.floor(base + timePart + distPart), 20, 60);
  }

  // Custom / unknown
  const base = 15;
  const timePart = minutes * 0.5;
  return clamp(Math.floor(base + timePart), 15, 40);
}

/** Binary search for stage from total XP. */
export function stageFromXp(totalXp: number): number {
  let lo = 0;
  let hi = MAX_STAGE;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (STAGE_THRESHOLDS[mid] <= totalXp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Grant XP with daily/weekly caps. Returns new state + metadata. */
export function grantXp(
  state: AvatarState,
  rawXp: number,
  date: Date,
): {
  newState: AvatarState;
  granted: number;
  dailyRemaining: number;
  weeklyRemaining: number;
  stageUp: { stage: number; variant: "bulk" | "speed" } | null;
} {
  const dk = dateKey(date);
  const wk = weekKey(date);

  // Prune old entries
  const dailyLog = pruneLog({ ...state.dailyLog }, date);
  const weeklyLog = pruneWeekLog({ ...state.weeklyLog }, date);

  const dailyUsed = dailyLog[dk] ?? 0;
  const weeklyUsed = weeklyLog[wk] ?? 0;

  const dailyRoom = Math.max(0, DAILY_CAP - dailyUsed);
  const weeklyRoom = Math.max(0, WEEKLY_CAP - weeklyUsed);
  const granted = Math.min(rawXp, dailyRoom, weeklyRoom);

  const newTotalXp = state.totalXp + granted;
  const newStage = stageFromXp(newTotalXp);
  const stageUp = newStage > state.stage ? { stage: newStage, variant: state.variant } : null;

  dailyLog[dk] = dailyUsed + granted;
  weeklyLog[wk] = weeklyUsed + granted;

  return {
    newState: {
      ...state,
      totalXp: newTotalXp,
      stage: newStage,
      dailyLog,
      weeklyLog,
    },
    granted,
    dailyRemaining: Math.max(0, DAILY_CAP - (dailyUsed + granted)),
    weeklyRemaining: Math.max(0, WEEKLY_CAP - (weeklyUsed + granted)),
    stageUp,
  };
}

/** Determine bulk vs speed variant from recent workout history. */
export function computeVariant(
  workoutHistory: WorkoutHistoryEntry[],
): "bulk" | "speed" {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const recent = workoutHistory.filter((w) => {
    try {
      return new Date(w.startedAt) >= cutoff;
    } catch {
      return false;
    }
  });

  if (recent.length === 0) return "bulk";

  let gym = 0;
  let cardio = 0;
  for (const w of recent) {
    if (isGym(w.sport)) gym++;
    else if (isCardio(w.sport)) cardio++;
  }

  const total = gym + cardio;
  if (total === 0) return "bulk";
  if (cardio / total >= 0.6) return "speed";
  return "bulk";
}

/** Progress within current stage as 0..1 fraction. */
export function stageProgress(totalXp: number, stage: number): number {
  const current = STAGE_THRESHOLDS[stage] ?? 0;
  const next = STAGE_THRESHOLDS[stage + 1] ?? current;
  if (next <= current) return 1; // max stage
  return Math.min(1, (totalXp - current) / (next - current));
}
