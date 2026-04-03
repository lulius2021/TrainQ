// src/utils/adaptivePersonalization.ts
// Builds a personalized context from the user's workout history for adaptive training.

import { loadWorkoutHistory } from "./workoutHistory";
import type { AdaptiveAnswers } from "../types/adaptive";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SplitType = "push" | "pull" | "legs" | "full";
export type CardioSessionType = "long" | "normal" | "recovery";

export interface PersonalizedExercise {
  name: string;
  exerciseId?: string;
  avgWeight: number;    // kg, 0 = bodyweight
  avgReps: number;
  setCount: number;
  usageCount: number;
  splitType: SplitType;
  progressionReady: boolean;   // same weight×reps in last 2 sessions
  suggestedWeight: number;     // avgWeight + increment if progressionReady, else avgWeight
}

export interface UserAdaptiveContext {
  sport: "gym" | "laufen" | "radfahren";
  topExercises: PersonalizedExercise[];  // top 12, all splits (filtering done in seed)
  avgDurationMin: number;                // 0 = no history
  weightModifier: number;                // 0.7–1.15 based on dayForm + stress
  nextSplit: SplitType;                  // next split in push→pull→legs rotation
  suggestedCardioType: CardioSessionType;
  typicalPaceSecPerKm: number;           // 0 = no history
}

// ─── Exercise Split Lookup Table ──────────────────────────────────────────────

/** Maps lowercase exercise name keywords → split type */
const SPLIT_KEYWORDS: Record<SplitType, string[]> = {
  push: [
    // Chest
    "bench", "bankdrück", "bankdrucken", "bankdrücken",
    "incline", "schrägbank", "schragbank", "decline", "negativbank",
    "chest", "brust", "fly", "flieg", "pec deck", "brustpresse", "butterfly",
    // Shoulders
    "shoulder press", "schulterdrück", "schulterdrücken", "schulterdrucken",
    "overhead press", "ohp", "military press",
    "lateral raise", "seitheben", "front raise", "frontheben",
    "arnold press", "arnold", "pike press",
    // Triceps
    "tricep", "trizep", "pushdown", "skull crusher", "french press",
    "trizepsstrecken", "trizepsdrücken", "trizepsdrucken",
    // Bodyweight push
    "dip", "push-up", "pushup", "liegestütz", "liegestutz",
    // Cable
    "cable fly", "kabelzug kreuz",
  ],
  pull: [
    // Deadlift variants
    "deadlift", "kreuzheben",
    "romanian", "rumänisch", "rumanisch", "rumänisches",
    // Pull-up/chin-up
    "pull-up", "pullup", "pull up", "klimmzug",
    "chin-up", "chinup", "chin up",
    // Lat
    "lat pulldown", "latziehen", "lat pull",
    // Rows
    "row", "rudern", "rudermaschine", "t-bar", "tbar",
    // Face pull
    "face pull", "facepull",
    // Biceps
    "bicep", "bizeps", "curl", "hammer curl", "hammercurl", "preacher",
    // Upper back / traps
    "shrug", "pullover",
    "back extension", "rückenstreck", "ruckenstreck", "hyperextension",
    "good morning",
    // General cable (when not fly)
    "kabelzug",
  ],
  legs: [
    // Squat family
    "squat", "kniebeuge", "kniebeugen",
    "bulgarian", "bulgarisch", "split squat",
    "hack squat", "hackenschmidt",
    "leg press", "beinpresse",
    // RDL (also shows in pull but legs wins)
    "rdl",
    // Lunges
    "lunge", "ausfallschritt",
    // Isolation
    "leg extension", "beinstrecker",
    "leg curl", "beincurl", "beinbeuger",
    "calf raise", "wadenheben",
    // Glutes
    "hip thrust", "hüftstrecken", "hufstrecken",
    "glute bridge", "gesäßbrücke", "gesassbrucke", "po-brücke",
    // Other
    "sumo",
    "step up", "stepaufstieg",
    "box jump",
  ],
  full: [
    "burpee",
    "clean", "hang clean",
    "snatch",
    "thruster",
    "turkish get-up", "turkish getup",
    "plank", "brett",
    "crunch", "bauchcrunch",
    "ab wheel", "bauchrad",
    "hanging leg raise",
    "mountain climber",
    "kettlebell swing", "kb swing",
    "cable crunch",
    "sit-up", "situp",
  ],
};

/** Classify a single exercise by name into a split. */
export function classifyExercise(name: string): SplitType {
  const lower = name.toLowerCase();
  // Check legs first (rdl would otherwise match pull too)
  for (const split of ["legs", "push", "pull", "full"] as SplitType[]) {
    for (const keyword of SPLIT_KEYWORDS[split]) {
      if (lower.includes(keyword)) return split;
    }
  }
  return "full"; // default: treat as full-body
}

// ─── Split Rotation ───────────────────────────────────────────────────────────

const SPLIT_CYCLE: SplitType[] = ["push", "pull", "legs"];

function detectSessionSplit(exercises: { name: string }[]): SplitType | null {
  if (exercises.length === 0) return null;
  const counts: Record<SplitType, number> = { push: 0, pull: 0, legs: 0, full: 0 };
  for (const ex of exercises) counts[classifyExercise(ex.name)]++;
  const [top] = (Object.entries(counts) as [SplitType, number][])
    .filter(([s]) => s !== "full")
    .sort((a, b) => b[1] - a[1]);
  return top && top[1] > 0 ? top[0] : null;
}

function getNextSplit(sessions: { exercises?: { name: string }[] }[]): SplitType {
  for (const session of sessions.slice(0, 5)) {
    const split = detectSessionSplit(session.exercises ?? []);
    if (split && SPLIT_CYCLE.includes(split)) {
      return SPLIT_CYCLE[(SPLIT_CYCLE.indexOf(split) + 1) % 3];
    }
  }
  return "push"; // default start
}

// ─── Progressive Overload Detection ──────────────────────────────────────────

interface ExerciseSnapshot {
  weight: number;
  reps: number;
}

/** Returns last 2 avg-weight×avg-reps snapshots per exercise across sessions. */
function buildProgressionMap(
  sessions: {
    exercises?: {
      name: string;
      sets?: { weight: number; reps: number; isWarmup?: boolean; setType?: string }[];
    }[];
  }[]
): Map<string, ExerciseSnapshot[]> {
  const map = new Map<string, ExerciseSnapshot[]>();
  for (const session of sessions) {
    for (const ex of session.exercises ?? []) {
      const key = ex.name.trim().toLowerCase();
      const existing = map.get(key) ?? [];
      if (existing.length >= 2) continue; // already have 2 data points

      const working = (ex.sets ?? []).filter(
        s => !s.isWarmup && s.setType !== "warmup" && s.reps > 0
      );
      if (working.length === 0) continue;

      const avgW = Math.round((working.reduce((s, v) => s + v.weight, 0) / working.length) * 10) / 10;
      const avgR = Math.round(working.reduce((s, v) => s + v.reps, 0) / working.length);
      map.set(key, [...existing, { weight: avgW, reps: avgR }]);
    }
  }
  return map;
}

/** Two identical weight×reps snapshots = ready for next progression step. */
function isProgressionReady(snapshots: ExerciseSnapshot[]): boolean {
  if (snapshots.length < 2) return false;
  return snapshots[0].weight === snapshots[1].weight && snapshots[0].reps === snapshots[1].reps;
}

/** +1.25 kg for light weights, +2.5 kg otherwise. 0 kg stays 0 (bodyweight). */
function nextProgressionWeight(weight: number): number {
  if (weight <= 0) return 0;
  if (weight < 20) return Math.round((weight + 1.25) * 10) / 10;
  return Math.round((weight + 2.5) * 10) / 10;
}

// ─── Cardio Session Type ──────────────────────────────────────────────────────

/**
 * Suggests a session type based on recent history and available time.
 * Long → Recovery → Normal → (repeat), time-gated.
 */
function getCardioSessionType(
  sessions: { durationSec?: number }[],
  timeBucket?: string
): CardioSessionType {
  if (sessions.length === 0) return "normal";
  if (timeBucket === "lt20") return "recovery"; // no time for anything else

  const durations = sessions
    .map(s => (s.durationSec ?? 0) / 60)
    .filter(m => m > 5)
    .slice(0, 8);

  if (durations.length === 0) return "normal";

  const avgDur = durations.reduce((a, b) => a + b, 0) / durations.length;
  const maxDur = Math.max(...durations);
  const lastDur = durations[0];

  if (lastDur > maxDur * 0.75) return "recovery"; // last was long → recover
  if (lastDur < avgDur * 0.5) return "normal";    // last was recovery → normal

  // After 2 normal sessions suggest long (only if user has the time)
  if (durations.length >= 2 && timeBucket === "gt60") {
    if (lastDur >= avgDur * 0.5 && durations[1] >= avgDur * 0.5) return "long";
  }

  return "normal";
}

/** Weighted average of last 5 pace values (most recent = 40% weight). */
function getTypicalPace(sessions: { paceSecPerKm?: number }[]): number {
  const paces = sessions
    .map(s => s.paceSecPerKm ?? 0)
    .filter(p => p > 60 && p < 3600)
    .slice(0, 5);

  if (paces.length === 0) return 0;

  const weights = [0.4, 0.25, 0.15, 0.12, 0.08];
  let total = 0;
  let totalWeight = 0;
  for (let i = 0; i < paces.length; i++) {
    const w = weights[i] ?? 0.08;
    total += paces[i] * w;
    totalWeight += w;
  }
  return Math.round(total / totalWeight);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSportKey(sport?: string): "gym" | "laufen" | "radfahren" | null {
  const s = (sport ?? "").toLowerCase().trim();
  if (s === "gym") return "gym";
  if (s === "laufen" || s === "run" || s === "running") return "laufen";
  if (s === "radfahren" || s === "bike" || s === "cycling" || s === "rad") return "radfahren";
  return null;
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns a weight modifier (0.7–1.15) based on day form & stress answers. */
export function computeWeightModifier(
  answers?: Pick<AdaptiveAnswers, "dayForm" | "stress">
): number {
  let modifier = 1.0;
  if (answers?.dayForm === "low") modifier -= 0.10;
  if (answers?.dayForm === "high") modifier += 0.05;
  if (answers?.stress === "high") modifier -= 0.05;
  return Math.max(0.7, Math.min(1.15, modifier));
}

/**
 * Reads workout history for the given sport and returns a rich context
 * for adaptive training: split rotation, progressive overload flags,
 * cardio session type, and typical pace.
 */
export function buildUserAdaptiveContext(
  sport: "gym" | "laufen" | "radfahren",
  answers?: Partial<AdaptiveAnswers>
): UserAdaptiveContext {
  const history = loadWorkoutHistory();
  const weightModifier = computeWeightModifier(answers as Pick<AdaptiveAnswers, "dayForm" | "stress">);

  const sessions = history
    .filter(e => normalizeSportKey(e.sport) === sport)
    .slice(0, 20);

  const durations = sessions
    .map(e => Math.round((e.durationSec ?? 0) / 60))
    .filter(m => m > 5);
  const avgDurationMin = durations.length > 0 ? Math.round(avg(durations)) : 0;

  // ── Gym ──────────────────────────────────────────────────────────────────
  const topExercises: PersonalizedExercise[] = [];
  let nextSplit: SplitType = "push";

  if (sport === "gym" && sessions.length > 0) {
    nextSplit = getNextSplit(sessions);
    const progressionMap = buildProgressionMap(sessions);

    const exerciseMap = new Map<string, {
      displayName: string;
      exerciseId?: string;
      weights: number[];
      repsArr: number[];
      setCountArr: number[];
      usageCount: number;
      splitType: SplitType;
    }>();

    for (const session of sessions) {
      for (const ex of session.exercises ?? []) {
        const key = ex.name.trim().toLowerCase();
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            displayName: ex.name.trim(),
            exerciseId: ex.exerciseId,
            weights: [],
            repsArr: [],
            setCountArr: [],
            usageCount: 0,
            splitType: classifyExercise(ex.name),
          });
        }
        const entry = exerciseMap.get(key)!;
        entry.usageCount += 1;

        const workingSets = (ex.sets ?? []).filter(
          s => !s.isWarmup && s.setType !== "warmup" && s.reps > 0
        );
        for (const s of workingSets) {
          if (s.weight > 0) entry.weights.push(s.weight);
          entry.repsArr.push(s.reps);
        }
        if (workingSets.length > 0) entry.setCountArr.push(workingSets.length);
      }
    }

    // Keep top 12 by usage (split filtering happens in seed/UI)
    const sorted = Array.from(exerciseMap.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 12);

    for (const data of sorted) {
      const snapshots = progressionMap.get(data.displayName.toLowerCase()) ?? [];
      const ready = isProgressionReady(snapshots);
      const baseWeight = data.weights.length > 0 ? Math.round(avg(data.weights) * 10) / 10 : 0;

      topExercises.push({
        name: data.displayName,
        exerciseId: data.exerciseId,
        avgWeight: baseWeight,
        avgReps: data.repsArr.length > 0 ? Math.round(avg(data.repsArr)) : 8,
        setCount: data.setCountArr.length > 0 ? Math.round(avg(data.setCountArr)) : 3,
        usageCount: data.usageCount,
        splitType: data.splitType,
        progressionReady: ready,
        suggestedWeight: ready ? nextProgressionWeight(baseWeight) : baseWeight,
      });
    }
  }

  // ── Cardio ────────────────────────────────────────────────────────────────
  const suggestedCardioType: CardioSessionType =
    sport !== "gym"
      ? getCardioSessionType(sessions, (answers as AdaptiveAnswers | undefined)?.timeToday)
      : "normal";

  const typicalPaceSecPerKm =
    sport !== "gym" ? getTypicalPace(sessions) : 0;

  return {
    sport,
    topExercises,
    avgDurationMin,
    weightModifier,
    nextSplit,
    suggestedCardioType,
    typicalPaceSecPerKm,
  };
}
