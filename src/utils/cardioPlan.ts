import type { CardioPlanSegment, CardioTarget } from "../types/cardio";
import type { SportType } from "../types/training";

type CardioPlanInputExercise = {
  name: string;
  sets?: Array<{
    reps?: number;
    weight?: number;
    notes?: string;
  }>;
};

function isCardioSport(sport: SportType): boolean {
  return sport === "Laufen" || sport === "Radfahren";
}

function normalizeText(input: string | undefined): string {
  return String(input || "").trim().toLowerCase();
}

function parsePaceSecPerKm(notes?: string): number | undefined {
  const text = normalizeText(notes).replace(",", ".");
  const colonMatch = text.match(/(\d{1,2}):(\d{2})\s*(?:min\/?km|\/km|pace)?/i);
  if (colonMatch) {
    const min = Number(colonMatch[1]);
    const sec = Number(colonMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(sec)) return min * 60 + sec;
  }

  const decimalMatch = text.match(/(\d{1,2}(?:\.\d+)?)\s*(?:min\/?km|\/km|pace)/i);
  if (decimalMatch) {
    const min = Number(decimalMatch[1]);
    if (Number.isFinite(min) && min > 0) return Math.round(min * 60);
  }

  return undefined;
}

function inferSegmentType(name: string, notes?: string): CardioPlanSegment["type"] {
  const text = `${normalizeText(name)} ${normalizeText(notes)}`;
  if (text.includes("warm")) return "warmup";
  if (text.includes("cool")) return "cooldown";
  if (text.includes("pause") || text.includes("erholung")) return "rest";
  if (text.includes("intervall")) return "work";
  return "steady";
}

function makeSegmentId(index: number, name: string): string {
  return `cardio_segment_${index}_${normalizeText(name).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "unit"}`;
}

function firstSet(exercise: CardioPlanInputExercise) {
  return Array.isArray(exercise.sets) ? exercise.sets[0] : undefined;
}

export function buildCardioTargetFromLiveExercises(
  exercises: CardioPlanInputExercise[] | undefined,
  sport: SportType
): CardioTarget | undefined {
  if (!isCardioSport(sport) || !Array.isArray(exercises) || exercises.length === 0) return undefined;

  const segments: CardioPlanSegment[] = exercises
    .map((exercise, index) => {
      const set = firstSet(exercise);
      const durationSec =
        typeof set?.reps === "number" && Number.isFinite(set.reps) && set.reps > 0
          ? Math.round(set.reps * 60)
          : undefined;
      const distanceM =
        typeof set?.weight === "number" && Number.isFinite(set.weight) && set.weight > 0
          ? Math.round(set.weight * 1000)
          : undefined;
      const notePace = parsePaceSecPerKm(set?.notes);
      const derivedPace =
        distanceM && durationSec
          ? Math.round(durationSec / (distanceM / 1000))
          : undefined;
      const targetPaceSecPerKm = notePace ?? derivedPace;
      const targetSpeedKmh =
        targetPaceSecPerKm && targetPaceSecPerKm > 0
          ? 3600 / targetPaceSecPerKm
          : durationSec && distanceM
            ? (distanceM / 1000) / (durationSec / 3600)
            : undefined;

      const segment: CardioPlanSegment = {
        id: makeSegmentId(index + 1, exercise.name),
        type: inferSegmentType(exercise.name, set?.notes),
        label: exercise.name || `Abschnitt ${index + 1}`,
        durationSec,
        distanceM,
        targetPaceSecPerKm,
        targetSpeedKmh,
      };

      return segment;
    })
    .filter((segment) => segment.durationSec || segment.distanceM);

  if (segments.length === 0) return undefined;

  return {
    segments,
    targetPaceSecPerKm: segments.find((segment) => segment.targetPaceSecPerKm)?.targetPaceSecPerKm,
  };
}
