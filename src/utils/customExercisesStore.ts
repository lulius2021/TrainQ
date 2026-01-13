// src/utils/customExercisesStore.ts

import type { Exercise, ExerciseAliases, ExerciseName, ExerciseType, Metric, Movement, Muscle, Equipment, ExerciseVariants } from "../data/exerciseLibrary";

const STORAGE_KEY = "trainq_custom_exercises_v1";

type StoredCustomExercise = {
  id: string;
  name: ExerciseName;
  aliases: ExerciseAliases;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  movement: Movement;
  type: ExerciseType;
  metrics: Metric[];
  variants?: ExerciseVariants;
};

export type CustomExerciseInput = {
  name: string;
  lang: "de" | "en";
  primaryMuscles: Muscle[];
  secondaryMuscles?: Muscle[];
  equipment: Equipment[];
  movement: Movement;
  type: ExerciseType;
  metrics: Metric[];
  variants?: ExerciseVariants;
};

export type CustomExercisePatch = Partial<Omit<StoredCustomExercise, "id">> & {
  name?: ExerciseName;
};

function safeParse(raw: string | null): StoredCustomExercise[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadAll(): StoredCustomExercise[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function saveAll(items: StoredCustomExercise[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function toExercise(stored: StoredCustomExercise): Exercise {
  return {
    id: stored.id,
    name: stored.name.de || stored.name.en,
    nameEn: stored.name.en,
    nameDe: stored.name.de,
    aliases: stored.aliases,
    primaryMuscles: stored.primaryMuscles,
    secondaryMuscles: stored.secondaryMuscles,
    equipment: stored.equipment,
    movement: stored.movement,
    type: stored.type,
    metrics: stored.metrics,
    variants: stored.variants,
    source: "custom",
  };
}

export function getCustomExercises(): Exercise[] {
  return loadAll().map(toExercise);
}

export function addCustomExercise(input: CustomExerciseInput): Exercise {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const id = `cus_${now}_${rand}`;
  const name: ExerciseName = input.lang === "de"
    ? { de: input.name.trim(), en: input.name.trim() }
    : { en: input.name.trim(), de: input.name.trim() };

  const entry: StoredCustomExercise = {
    id,
    name,
    aliases: { en: [], de: [] },
    primaryMuscles: input.primaryMuscles,
    secondaryMuscles: input.secondaryMuscles ?? [],
    equipment: input.equipment,
    movement: input.movement,
    type: input.type,
    metrics: input.metrics,
    variants: input.variants,
  };

  const all = loadAll();
  all.push(entry);
  saveAll(all);
  return toExercise(entry);
}

export function updateCustomExercise(id: string, patch: CustomExercisePatch): Exercise | undefined {
  const all = loadAll();
  const idx = all.findIndex((item) => item.id === id);
  if (idx < 0) return undefined;
  const current = all[idx];
  const next: StoredCustomExercise = {
    ...current,
    ...patch,
    name: patch.name ?? current.name,
    aliases: patch.aliases ?? current.aliases,
    primaryMuscles: patch.primaryMuscles ?? current.primaryMuscles,
    secondaryMuscles: patch.secondaryMuscles ?? current.secondaryMuscles,
    equipment: patch.equipment ?? current.equipment,
    movement: patch.movement ?? current.movement,
    type: patch.type ?? current.type,
    metrics: patch.metrics ?? current.metrics,
    variants: patch.variants ?? current.variants,
  };
  all[idx] = next;
  saveAll(all);
  return toExercise(next);
}

export function deleteCustomExercise(id: string): void {
  const all = loadAll().filter((item) => item.id !== id);
  saveAll(all);
}
