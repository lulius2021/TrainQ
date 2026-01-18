import type { DeloadRule } from "../../types/deload";
import type { CalendarEvent, LiveSet, SetTag, SetType } from "../../types/training";
import type { LiveTrainingSeed, ExerciseSetSeed, BlockExerciseSeed } from "../liveTrainingSeed";
import { resolveLiveSeed, writeLiveSeedForEventOrKey } from "../liveTrainingSeed";

function roundToStep(value: number, step = 0.5): number {
  return Math.round(value / step) * step;
}

function normalizeSetType(setType?: SetType): SetType | undefined {
  if (!setType) return setType;
  return setType === "failure" ? "normal" : setType;
}

function normalizeTag(tag?: SetTag | null): SetTag | null | undefined {
  if (!tag) return tag ?? null;
  return tag === "F" ? null : tag;
}

function reduceWeight(value: number, pct: number): number {
  const next = value * (1 - pct / 100);
  return roundToStep(next, 0.5);
}

function applyDeloadToSeedSet(set: ExerciseSetSeed, rules: DeloadRule): ExerciseSetSeed {
  const next: ExerciseSetSeed = { ...set };
  if (typeof next.weight === "number" && typeof rules.reduceWeightPct === "number") {
    next.weight = reduceWeight(next.weight, rules.reduceWeightPct);
  }
  return next;
}

function applyDeloadToLiveSet(set: LiveSet, rules: DeloadRule): LiveSet {
  const next: LiveSet = { ...set };
  if (rules.forceFailureToNormal) {
    next.setType = normalizeSetType(next.setType);
    next.tag = normalizeTag(next.tag) as SetTag | null;
  }
  if (typeof next.weight === "number" && typeof rules.reduceWeightPct === "number") {
    next.weight = reduceWeight(next.weight, rules.reduceWeightPct);
  }
  if (rules.applyWeightToDropsets && typeof rules.reduceWeightPct === "number" && Array.isArray(next.drops)) {
    next.drops = next.drops.map((drop) => ({
      ...drop,
      weight: typeof drop.weight === "number" ? reduceWeight(drop.weight, rules.reduceWeightPct) : drop.weight,
    }));
  }
  return next;
}

function reduceSets<T>(sets: T[] | undefined, pct?: number): T[] | undefined {
  if (!Array.isArray(sets)) return sets;
  if (typeof pct !== "number") return sets;
  const keep = Math.max(1, Math.ceil(sets.length * (1 - pct / 100)));
  return sets.slice(0, keep);
}

export function applyDeloadToWorkout(seed: LiveTrainingSeed, rules: DeloadRule): LiveTrainingSeed {
  const next: LiveTrainingSeed = {
    ...seed,
    exercises: (seed.exercises ?? []).map((ex) => {
      let sets = ex.sets ?? [];
      sets = reduceSets(sets, rules.reduceSetsPct) ?? [];
      const adjustedSets = sets.map((s) => applyDeloadToSeedSet(s, rules));
      return { ...ex, sets: adjustedSets };
    }),
  };
  return next;
}

export function applyDeloadToEvent(event: CalendarEvent, rules: DeloadRule): CalendarEvent {
  const next: CalendarEvent = { ...event, deload: true };
  const seed = resolveLiveSeed({ eventId: event.id, dateISO: event.date, title: event.title });
  if (seed) {
    const updated = applyDeloadToWorkout(seed, rules);
    writeLiveSeedForEventOrKey({ eventId: event.id, dateISO: event.date, title: event.title, seed: updated });
  }
  return next;
}

export function applyDeloadToLiveSets(sets: LiveSet[], rules: DeloadRule): LiveSet[] {
  let next = reduceSets(sets, rules.reduceSetsPct) ?? [];
  next = next.map((set) => applyDeloadToLiveSet(set, rules));
  return next;
}
