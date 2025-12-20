// src/utils/adaptiveSeed.ts
// TS-safe: Seed-Shape passt zu liveTrainingSeed.ts
// Exportiert applyAdaptiveToSeed (wird von LiveTrainingPage erwartet).

import type { CalendarEvent } from "../types/training";
import type { LiveTrainingSeed, BlockExerciseSeed, ExerciseSetSeed } from "./liveTrainingSeed";
import type { AdaptiveAnswers, AdaptiveSuggestion } from "../types/adaptive";

// Seed darf zusätzliche Felder tragen (structural typing), ohne dass LiveTrainingPage bricht
export type LiveTrainingSeedWithAdaptiveMeta = LiveTrainingSeed & {
  adaptiveApplied?: boolean;
  adaptiveProfile?: AdaptiveSuggestion["profile"];
  adaptiveEstimatedMinutes?: number;
  adaptiveReasons?: string[];
  adaptiveAnswers?: AdaptiveAnswers;
  adaptiveAppliedAt?: string;
};

function numId(i: number): number {
  return i + 1;
}

/**
 * Minimaler Fallback: Seed aus CalendarEvent bauen.
 * Solange noch kein Plan->Seed Mapper existiert, bleiben Exercises leer.
 */
export function buildSeedFromCalendarEvent(event: CalendarEvent): LiveTrainingSeed {
  const title = event.title?.trim() ? event.title.trim() : "Training";

  const exercises: BlockExerciseSeed[] = [];

  return {
    title,
    sport: "Gym",
    isCardio: false,
    exercises,
  };
}

/**
 * Wird in LiveTrainingPage importiert.
 * Patcht den Seed nur mit Meta + Titel (keine Übungs-Änderung),
 * damit Plan/Seed Source of Truth bleibt.
 */
export function applyAdaptiveToSeed(
  seed: LiveTrainingSeed,
  suggestion: AdaptiveSuggestion,
  answers?: AdaptiveAnswers
): LiveTrainingSeedWithAdaptiveMeta {
  const safeTitle = seed?.title?.trim() ? seed.title.trim() : "Training";

  const suffix = suggestion?.title ? ` (Adaptiv: ${suggestion.title})` : " (Adaptiv)";
  const nextTitle = safeTitle.includes("(Adaptiv") ? safeTitle : `${safeTitle}${suffix}`;

  const meta: LiveTrainingSeedWithAdaptiveMeta = {
    ...seed,
    title: nextTitle,

    adaptiveApplied: true,
    adaptiveProfile: suggestion?.profile,
    adaptiveEstimatedMinutes: suggestion?.estimatedMinutes,
    adaptiveReasons: (suggestion?.reasons ?? []).slice(0, 5),
    adaptiveAnswers: answers,
    adaptiveAppliedAt: new Date().toISOString(),
  };

  return meta;
}

/**
 * Optional Demo-Helper (TS korrekt zum Seed-Shape)
 */
export function makeDemoExercise(name: string, setCount = 3): BlockExerciseSeed {
  const sets: ExerciseSetSeed[] = Array.from({ length: Math.max(1, setCount) }).map((_, i) => ({
    id: numId(i),
    reps: 8,
    weight: 0,
    notes: "",
  }));

  return {
    id: numId(0) + Math.floor(Date.now() / 1000), // stabil genug fürs Demo
    name: name?.trim() ? name.trim() : "Übung",
    sets,
  };
}