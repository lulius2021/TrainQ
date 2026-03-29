// src/utils/avatarProgression.ts
// Body-part based avatar progression — no XP levels.
// Each muscle group grows with relevant training and slowly atrophies without it.

/* ─── Types ─── */

export interface BodyPartStats {
  /** Effective points after atrophy — drives the visual level */
  points: number;
  /** Lifetime total earned — shown as "all-time" metric */
  earned: number;
  /** ISO date string of the last workout that targeted this part */
  lastTrainedDate: string | null;
}

export interface ActivityEntry {
  date: string;           // "YYYY-MM-DD"
  sport: string;          // "Gym" | "Laufen" | "Radfahren" | "Custom" ...
  workoutType?: string;   // "Push" | "Pull" | "Upper" | "Lower"
  minutes: number;
  workoutId: string;
}

export interface AvatarState {
  bodyParts: {
    chest: BodyPartStats;
    back: BodyPartStats;
    shoulders: BodyPartStats;
    arms: BodyPartStats;
    legs: BodyPartStats;
    core: BodyPartStats;
    cardio: BodyPartStats; // running / cycling endurance
  };
  /** Rolling 90-day activity log — used for dominant-pose detection */
  activityLog: ActivityEntry[];
  lastWorkoutId?: string;
}

export type BodyPartKey = keyof AvatarState["bodyParts"];

/** Body levels (0–10 per part) used by the SVG avatar renderer. */
export interface BodyLevels {
  chest: number;
  back: number;
  shoulders: number;
  arms: number;
  legs: number;
  core: number;
  cardio: number;
}

export type ActivityPose = "stand" | "run" | "cycle" | "handstand" | "rest";

/* ─── Constants ─── */

/** Days before atrophy starts for a given body part */
const ATROPHY_GRACE_DAYS = 7;
/** Daily atrophy rate after grace period (3% per day) */
const ATROPHY_RATE = 0.03;
/** Points needed to reach level 10 */
const MAX_POINTS = 500;
/** Keep only last N days in activityLog */
const ACTIVITY_LOG_DAYS = 90;

/* ─── Defaults ─── */

function emptyPart(): BodyPartStats {
  return { points: 0, earned: 0, lastTrainedDate: null };
}

export function defaultAvatarState(): AvatarState {
  return {
    bodyParts: {
      chest: emptyPart(),
      back: emptyPart(),
      shoulders: emptyPart(),
      arms: emptyPart(),
      legs: emptyPart(),
      core: emptyPart(),
      cardio: emptyPart(),
    },
    activityLog: [],
  };
}

/* ─── Level calculation ─── */

/** Convert raw points → visual level 0–10 (square-root scale). */
export function levelFromPoints(points: number): number {
  if (points <= 0) return 0;
  return Math.min(10, Math.sqrt(points / MAX_POINTS) * 10);
}

/** Human-readable label for a body-part level. */
export function levelLabel(level: number): string {
  if (level < 1) return "Untrainiert";
  if (level < 3) return "Anfänger";
  if (level < 5) return "Hobby";
  if (level < 7) return "Fortgeschritten";
  if (level < 9) return "Stark";
  return "Elite";
}

/* ─── Atrophy ─── */

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24),
  );
}

/** Apply time-based atrophy to a single body part. */
export function applyAtrophy(part: BodyPartStats, todayISO: string): BodyPartStats {
  if (!part.lastTrainedDate || part.points <= 0) return part;

  const days = daysBetween(part.lastTrainedDate, todayISO);
  if (days <= ATROPHY_GRACE_DAYS) return part;

  const atrophyDays = days - ATROPHY_GRACE_DAYS;
  const factor = Math.pow(1 - ATROPHY_RATE, atrophyDays);
  return { ...part, points: Math.max(0, part.points * factor) };
}

/** Apply atrophy to all body parts and prune old activity log. */
export function applyDailyAtrophy(state: AvatarState, todayISO: string): AvatarState {
  const parts = {} as AvatarState["bodyParts"];
  for (const key of Object.keys(state.bodyParts) as BodyPartKey[]) {
    parts[key] = applyAtrophy(state.bodyParts[key], todayISO);
  }

  // Prune activity log to last ACTIVITY_LOG_DAYS days
  const cutoff = new Date(todayISO);
  cutoff.setDate(cutoff.getDate() - ACTIVITY_LOG_DAYS);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const activityLog = state.activityLog.filter((e) => e.date >= cutoffISO);

  return { ...state, bodyParts: parts, activityLog };
}

/* ─── Workout → muscle gains ─── */

/**
 * Points gained per body part for each workout type.
 * Base values assume a 60-minute workout; scaled by actual duration.
 */
const GAINS_TABLE: Record<string, Partial<Record<BodyPartKey, number>>> = {
  // Gym split workouts
  Push:  { chest: 5, shoulders: 3, arms: 2 },
  Pull:  { back: 5, arms: 3, shoulders: 1 },
  Upper: { chest: 3, back: 3, shoulders: 2, arms: 2, core: 1 },
  Lower: { legs: 6, core: 2 },
  // Cardio
  Laufen:    { legs: 2, cardio: 5, core: 1 },
  Radfahren: { legs: 3, cardio: 4 },
  // Bodyweight / calisthenics (Custom sport)
  Calisthenics: { arms: 3, core: 5, shoulders: 2, chest: 1 },
  // Default fallback
  Custom: { core: 2, legs: 1 },
  Gym:    { chest: 2, back: 2, shoulders: 2, arms: 2, legs: 1, core: 1 },
};

function detectCalisthenics(exercises: Array<{ name?: string }>): boolean {
  const calisthenicsKeywords = [
    "handstand", "muscle up", "pull-up", "pullup", "dip", "ring",
    "klimmzug", "liegestütz", "push-up", "pushup", "L-sit", "planche",
  ];
  return exercises.some((e) =>
    calisthenicsKeywords.some((kw) =>
      (e.name ?? "").toLowerCase().includes(kw.toLowerCase()),
    ),
  );
}

export function computeGains(
  sport: string,
  workoutType: string | undefined,
  durationMinutes: number,
  exercises?: Array<{ name?: string }>,
): Partial<Record<BodyPartKey, number>> {
  // Try: workoutType first, then sport, then "Custom"
  let key = workoutType ?? sport;

  // Detect calisthenics from exercise names
  if (
    (sport === "Custom" || !workoutType) &&
    exercises &&
    detectCalisthenics(exercises)
  ) {
    key = "Calisthenics";
  }

  const base = GAINS_TABLE[key] ?? GAINS_TABLE["Custom"]!;
  // Scale by duration — base is 60 min, cap at 2× for 120+ min
  const scale = Math.min(2.0, Math.max(0.3, durationMinutes / 60));

  const result: Partial<Record<BodyPartKey, number>> = {};
  for (const [part, gain] of Object.entries(base)) {
    result[part as BodyPartKey] = Math.round((gain as number) * scale * 10) / 10;
  }
  return result;
}

/* ─── State update ─── */

export interface WorkoutInput {
  id?: string;
  workoutType?: string;
  sport?: string;
  durationSeconds?: number;
  /** legacy field */
  durationSec?: number;
  exercises?: Array<{ name?: string }>;
}

export interface ApplyWorkoutResult {
  newState: AvatarState;
  gainedParts: Partial<Record<BodyPartKey, number>>;
  milestone: { bodyPart: BodyPartKey; newLevel: number } | null;
}

export function applyWorkout(
  state: AvatarState,
  workout: WorkoutInput,
  todayISO: string,
): ApplyWorkoutResult {
  // Dedup
  if (workout.id && state.lastWorkoutId === workout.id) {
    return { newState: state, gainedParts: {}, milestone: null };
  }

  // Apply atrophy first
  const withAtrophy = applyDailyAtrophy(state, todayISO);

  const durationSec = workout.durationSeconds ?? workout.durationSec ?? 0;
  const durationMinutes = Math.max(1, Math.floor(durationSec / 60));
  const sport = workout.sport ?? "Gym";
  const workoutType = workout.workoutType;

  const gains = computeGains(sport, workoutType, durationMinutes, workout.exercises);

  // Apply gains to body parts
  const newParts = { ...withAtrophy.bodyParts };
  let milestone: ApplyWorkoutResult["milestone"] = null;

  for (const [partKey, gain] of Object.entries(gains) as [BodyPartKey, number][]) {
    const prev = newParts[partKey];
    const prevLevel = Math.floor(levelFromPoints(prev.points));
    const newPoints = prev.points + gain;
    const newEarned = prev.earned + gain;
    const newLevel = Math.floor(levelFromPoints(newPoints));

    newParts[partKey] = {
      points: newPoints,
      earned: newEarned,
      lastTrainedDate: todayISO,
    };

    // Milestone: whole-number level-up (only track notable ones ≥ 2)
    if (newLevel > prevLevel && newLevel >= 2 && !milestone) {
      milestone = { bodyPart: partKey, newLevel };
    }
  }

  // Add to activity log
  const newLogEntry: ActivityEntry = {
    date: todayISO,
    sport,
    workoutType,
    minutes: durationMinutes,
    workoutId: workout.id ?? todayISO,
  };

  const newState: AvatarState = {
    bodyParts: newParts,
    activityLog: [...withAtrophy.activityLog, newLogEntry],
    lastWorkoutId: workout.id,
  };

  return { newState, gainedParts: gains, milestone };
}

/* ─── Activity pose detection ─── */

/** Determine the avatar's pose from recent activity (last 30 days). */
export function detectPose(state: AvatarState, todayISO: string): ActivityPose {
  const cutoff = new Date(todayISO);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const recent = state.activityLog.filter((e) => e.date >= cutoffISO);

  // Rest: no training in last 14 days
  if (recent.length === 0) {
    const last = state.activityLog[state.activityLog.length - 1];
    if (!last || daysBetween(last.date, todayISO) >= 14) return "rest";
  }

  // Count minutes per activity type
  const minutes: Record<string, number> = {};
  let total = 0;
  for (const e of recent) {
    const key = e.workoutType === "Calisthenics" ? "Calisthenics"
      : e.sport === "Laufen"    ? "Laufen"
      : e.sport === "Radfahren" ? "Radfahren"
      : "Gym";
    minutes[key] = (minutes[key] ?? 0) + e.minutes;
    total += e.minutes;
  }

  if (total === 0) return "stand";

  const dom = Object.entries(minutes).sort(([, a], [, b]) => b - a)[0]?.[0];
  const share = (minutes[dom ?? ""] ?? 0) / total;

  // Only switch pose if dominant activity is > 35% of total time
  if (share < 0.35) return "stand";

  if (dom === "Laufen")        return "run";
  if (dom === "Radfahren")     return "cycle";
  if (dom === "Calisthenics")  return "handstand";
  if (dom === "Custom")        return "stand";
  return "stand";
}

/* ─── Legacy compat (for code that still reads stage/totalXp) ─── */

/** Approximate total level across all body parts (0–70). */
export function totalLevel(state: AvatarState): number {
  return Object.values(state.bodyParts).reduce(
    (sum, p) => sum + levelFromPoints(p.points),
    0,
  );
}

/** Overall "fitness level" 0–10 for backward compat display. */
export function overallLevel(state: AvatarState): number {
  const avg =
    Object.values(state.bodyParts).reduce((s, p) => s + levelFromPoints(p.points), 0) /
    Object.keys(state.bodyParts).length;
  return Math.round(avg * 10) / 10;
}
