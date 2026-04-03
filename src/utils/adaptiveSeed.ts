// src/utils/adaptiveSeed.ts
// TS-safe: Seed-Shape passt zu liveTrainingSeed.ts
// Exportiert applyAdaptiveToSeed (wird von LiveTrainingPage erwartet).

import type { CalendarEvent, SportType, TrainingType } from "../types/training";
import type { LiveTrainingSeed, BlockExerciseSeed, ExerciseSetSeed } from "./liveTrainingSeed";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveProfileType } from "../types/adaptive";

// Seed darf zusätzliche Felder tragen (structural typing), ohne dass LiveTrainingPage bricht
export type LiveTrainingSeedWithAdaptiveMeta = LiveTrainingSeed & {
  adaptiveApplied?: boolean;
  adaptiveProfile?: AdaptiveProfileType;
  adaptiveEstimatedMinutes?: number;
  adaptiveReasons?: AdaptiveSuggestion["reasons"];
  adaptiveAnswers?: AdaptiveAnswers;
  adaptiveAppliedAt?: string;
};

function nowISO(): string {
  return new Date().toISOString();
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeSport(s?: SportType | string): SportType {
  const t = String(s || "").trim().toLowerCase();

  if (t === "gym") return "Gym";
  if (t === "laufen" || t === "run" || t === "running") return "Laufen";
  if (t === "radfahren" || t === "bike" || t === "cycling") return "Radfahren";
  if (t === "custom") return "Custom";

  return "Gym";
}

function trainingTypeToSport(type?: TrainingType, sport?: SportType | string): SportType {
  // expliziter Sport schlägt alles
  if (sport === "Gym") return "Gym";
  if (sport === "Laufen") return "Laufen";
  if (sport === "Radfahren") return "Radfahren";
  if (sport === "Custom") return "Custom";

  // UI trainingType
  if (type === "laufen") return "Laufen";
  if (type === "radfahren") return "Radfahren";
  if (type === "custom") return "Custom";

  return "Gym";
}

function isCardioSport(sport?: SportType | string): boolean {
  const s = normalizeSport(sport);
  return s === "Laufen" || s === "Radfahren";
}

/**
 * Profil -> Skalierung
 * stabil  = plan-nah (1.0)
 * kompakt = kurz/effizient (0.7)
 * fokus   = intensiver (1.2)
 */
function factorFromProfile(profile: AdaptiveProfileType): number {
  if (profile === "kompakt") return 0.7;
  if (profile === "fokus") return 1.2;
  return 1.0; // stabil
}

/**
 * Ermittelt eine neue NUMERISCHE Set-ID basierend auf vorhandenen numeric ids.
 * Falls keine numeric ids vorhanden sind, gibt es undefined zurück (id ist optional).
 */
function nextNumericSetId(sets: ExerciseSetSeed[]): number | undefined {
  let max = -1;
  for (const s of sets) {
    const id = (s as any)?.id;
    if (typeof id === "number" && Number.isFinite(id)) max = Math.max(max, id);
  }
  return max >= 0 ? max + 1 : undefined;
}

/**
 * Skaliert Seed-Struktur:
 * - Gym: trimmt Übungen + Sets moderat
 * - Cardio: i.d.R. 1 Einheit, Sets ggf. trimmen
 *
 * Wichtig: Keine neue Übungsauswahl/Intelligenz hier – nur skalieren.
 */
function scaleExercisesAndSets(exercises: BlockExerciseSeed[], factor: number, sport?: SportType | string): BlockExerciseSeed[] {
  const exList = Array.isArray(exercises) ? exercises : [];
  if (exList.length === 0) return [];

  const cardio = isCardioSport(sport);

  const maxExercises = cardio ? 1 : clampInt(Math.ceil(exList.length * factor), 1, exList.length);
  const picked = exList.slice(0, maxExercises);

  return picked.map((ex) => {
    const sets = Array.isArray(ex.sets) ? ex.sets : [];
    if (sets.length === 0) return ex;

    const hardMin = 1;
    const hardMax = cardio ? 4 : 8;

    const targetSetCount = clampInt(Math.ceil(sets.length * factor), hardMin, Math.max(hardMin, hardMax));
    const trimmed = sets.slice(0, Math.max(1, targetSetCount));

    // Optional: bei "fokus" und Gym: 1 Set extra (wenn sinnvoll), um Volumen leicht zu erhöhen
    if (!cardio && factor > 1.05 && trimmed.length < 6) {
      const last = trimmed[trimmed.length - 1];

      const extra: ExerciseSetSeed = {
        // ✅ id ist bei dir (laut Seed-Typ) number optional → NICHT string!
        id: nextNumericSetId(trimmed),
        reps: (last as any)?.reps,
        weight: (last as any)?.weight,
        notes: (last as any)?.notes ?? "",
      };

      trimmed.push(extra);
    }

    return { ...ex, sets: trimmed };
  });
}

// ------------------------ API ------------------------

/**
 * Minimaler Fallback: Seed aus CalendarEvent bauen.
 * Solange noch kein Plan->Seed Mapper existiert, bleiben Exercises leer.
 */
export function buildSeedFromCalendarEvent(event: CalendarEvent): LiveTrainingSeed {
  const title = event.title?.trim() ? event.title.trim() : "Training";
  const sport = trainingTypeToSport(event.trainingType, event.sport);

  return {
    title,
    sport,
    isCardio: isCardioSport(sport),
    exercises: [],
  };
}

import { readOnboardingDataFromStorage } from "../context/OnboardingContext";
import { getAdaptiveTemplate } from "../data/adaptiveTemplates";
import type { UserAdaptiveContext } from "./adaptivePersonalization";

/**
 * Wird in LiveTrainingPage importiert.
 * ✅ Patcht Seed:
 * - Titel (Adaptiv-Suffix)
 * - Meta
 * - Übungen/Sätze skaliert nach Profil (kompakt/fokus)
 * - NEU: Falls Seed leer (z.B. reines CalendarEvent), wird ein passendes Template injectet
 */
export function applyAdaptiveToSeed(
  seed: LiveTrainingSeed,
  suggestion: AdaptiveSuggestion,
  answers?: AdaptiveAnswers,
  context?: UserAdaptiveContext
): LiveTrainingSeedWithAdaptiveMeta {
  const safeSeed: LiveTrainingSeed =
    seed ?? ({ title: "Training", sport: "Gym", isCardio: false, exercises: [] } as LiveTrainingSeed);

  // 1. Titel anpassen
  const baseTitle = safeSeed.title?.trim() ? safeSeed.title.trim() : "Training";
  const suffix = suggestion.title ? ` (Adaptiv: ${suggestion.title})` : " (Adaptiv)";
  const nextTitle = baseTitle.includes("(Adaptiv") ? baseTitle : `${baseTitle}${suffix}`;

  // 2. Persona laden (für Fallback-Templates)
  const onboarding = readOnboardingDataFromStorage();
  const persona = onboarding.personal.persona || "beginner";

  // 3. Übungen bestimmen: persönliche History > Template > leeres Seed
  let currentExercises = safeSeed.exercises || [];
  const sport = normalizeSport(safeSeed.sport);

  if (sport === "Gym") {
    if (context?.topExercises && context.topExercises.length >= 2) {
      const weightMod = context.weightModifier ?? 1.0;

      // Filter by next split; fall back to all if not enough exercises in that split
      const splitFiltered = context.nextSplit && context.nextSplit !== "full"
        ? context.topExercises.filter(
            ex => (ex as any).splitType === context.nextSplit || (ex as any).splitType === "full"
          )
        : context.topExercises;
      const toUse = splitFiltered.length >= 2 ? splitFiltered : context.topExercises;

      currentExercises = toUse.map((ex) => {
        // Progressive overload: use suggestedWeight (already +2.5kg) when ready,
        // otherwise apply day-form weight modifier to avgWeight.
        const baseW = (ex as any).progressionReady
          ? ((ex as any).suggestedWeight ?? ex.avgWeight)
          : (ex.avgWeight > 0 ? Math.round(ex.avgWeight * weightMod * 10) / 10 : 0);

        return {
          name: ex.name,
          sets: Array.from({ length: Math.max(1, ex.setCount) }, (_, i) => ({
            id: i + 1,
            reps: ex.avgReps || 8,
            weight: baseW,
            notes: "",
          })),
        };
      });
    } else if (currentExercises.length === 0) {
      // Fallback: Template basierend auf Titel (z.B. "Push")
      const template = getAdaptiveTemplate(baseTitle, persona);
      currentExercises = template.map((t) => ({
        name: t.name,
        sets: t.defaultSets.map((s, i) => ({
          id: i + 1,
          reps: s.reps,
          weight: s.weight,
          notes: "",
        })),
      }));
    }
  }

  // 4. Skalieren (Volume/Intensität anpassen)
  const factor = factorFromProfile(suggestion.profile);
  const nextExercises = scaleExercisesAndSets(currentExercises, factor, sport);

  const meta: LiveTrainingSeedWithAdaptiveMeta = {
    ...safeSeed,
    sport,
    title: nextTitle,

    // defensiv: falls Seed.isCardio nicht gesetzt ist
    isCardio: typeof safeSeed.isCardio === "boolean" ? safeSeed.isCardio : isCardioSport(sport),

    exercises: nextExercises,

    adaptiveApplied: true,
    adaptiveProfile: suggestion.profile,
    adaptiveEstimatedMinutes: suggestion.estimatedMinutes,
    adaptiveReasons: (suggestion.reasons ?? []).slice(0, 5),
    adaptiveAnswers: answers,
    adaptiveAppliedAt: nowISO(),
  };

  return meta;
}

/**
 * Optional Demo-Helper (TS korrekt zum Seed-Shape)
 */
export function makeDemoExercise(name: string, setCount = 3): BlockExerciseSeed {
  const sets: ExerciseSetSeed[] = Array.from({ length: Math.max(1, setCount) }).map((_, i) => ({
    id: i + 1,
    reps: 8,
    weight: 0,
    notes: "",
  }));

  return {
    // SeedId erlaubt number|string (structural typing); wir bleiben hier numeric
    id: (1 + Math.floor(Date.now() / 1000)) as any,
    name: name?.trim() ? name.trim() : "Übung",
    sets,
  };
}