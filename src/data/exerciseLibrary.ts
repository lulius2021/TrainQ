// src/data/exerciseLibrary.ts

import coreExercises from "./exercises/core.exercises.v1.json";
import { getAliasOverrides } from "../utils/exerciseAliasesStore";
import { getCustomExercises } from "../utils/customExercisesStore";

export type Muscle =
  | "chest"
  | "back"
  | "lats"
  | "traps"
  | "rear_delts"
  | "front_delts"
  | "side_delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "obliques"
  | "lower_back"
  | "hip_flexors";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "cable"
  | "band"
  | "bodyweight"
  | "bench"
  | "rack"
  | "pullup_bar"
  | "dip_bar"
  | "smith_machine"
  | "trap_bar"
  | "medicine_ball"
  | "cardio_machine";

export type Movement = "push" | "pull" | "squat" | "hinge" | "carry" | "rotation" | "locomotion";

export type ExerciseType = "strength" | "hypertrophy" | "calisthenics" | "conditioning" | "mobility";

export type Metric = "weight" | "reps" | "time" | "distance" | "pace" | "rpe";

export type Difficulty = "Leicht" | "Mittel" | "Schwer";

export type ExerciseTypeFilter = ExerciseType | "alle";

export type VariantImplement =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "smith_machine"
  | "trap_bar"
  | "medicine_ball"
  | "cardio_machine";

export type VariantIncline = "flat" | "incline" | "decline";
export type VariantGrip = "standard" | "close" | "wide" | "neutral" | "supinated" | "pronated";
export type VariantStance = "standard" | "narrow" | "wide" | "split" | "sumo";

export interface ExerciseVariants {
  implement?: VariantImplement[];
  incline?: VariantIncline[];
  grip?: VariantGrip[];
  stance?: VariantStance[];
  unilateral?: boolean[];
}

export interface ExerciseName {
  en: string;
  de: string;
}

export interface ExerciseAliases {
  en: string[];
  de: string[];
}

export type ExerciseImage =
  | { kind: "asset"; src: string }
  | { kind: "user"; refId: string; mime: string; updatedAt: string };

export type ExerciseMuscles = {
  primary: Muscle[];
  secondary?: Muscle[];
};

export interface CoreExercise {
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
  image?: ExerciseImage;
  imageSrc?: string;
  cues?: string[];
  muscles?: ExerciseMuscles;
}

export interface Exercise {
  id: string;
  name: string;
  nameEn: string;
  nameDe: string;
  aliases: ExerciseAliases;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  movement: Movement;
  type: ExerciseType;
  metrics: Metric[];
  variants?: ExerciseVariants;
  difficulty?: Difficulty;
  image?: ExerciseImage;
  imageSrc?: string;
  cues?: string[];
  muscles?: ExerciseMuscles;
  source?: "core" | "custom";
  searchIndex?: string;
}

export interface ExerciseFilters {
  search: string;
  muscle: Muscle | "alle";
  equipment: Equipment | "alle";
  difficulty: Difficulty | "alle";
  type: ExerciseTypeFilter;
}

export const MUSCLE_GROUPS: Muscle[] = [
  "chest",
  "back",
  "lats",
  "traps",
  "rear_delts",
  "front_delts",
  "side_delts",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "obliques",
  "lower_back",
  "hip_flexors",
];

export const EQUIPMENTS: Equipment[] = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "machine",
  "cable",
  "band",
  "bodyweight",
  "bench",
  "rack",
  "pullup_bar",
  "dip_bar",
  "smith_machine",
  "trap_bar",
  "medicine_ball",
  "cardio_machine",
];

export const DIFFICULTIES: Difficulty[] = ["Leicht", "Mittel", "Schwer"];

export const EXERCISE_TYPES: ExerciseType[] = [
  "strength",
  "hypertrophy",
  "calisthenics",
  "conditioning",
  "mobility",
];

export const METRICS: Metric[] = ["weight", "reps", "time", "distance", "pace", "rpe"];

const DEFAULT_LANG = "de";
const LANG_STORAGE_KEY = "trainq_lang_v1";

function getPreferredLang(): "de" | "en" {
  if (typeof window === "undefined") return DEFAULT_LANG;
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === "de" || stored === "en") return stored;
  const legacy = window.localStorage.getItem("trainq_language");
  if (legacy === "de" || legacy === "en") return legacy;
  return DEFAULT_LANG;
}

function normalizeSearchValue(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeExerciseToken(value: string): string {
  return normalizeSearchValue(value);
}

export function getExerciseDisplayName(exercise: Exercise, lang: "de" | "en"): string {
  if (lang === "de") return exercise.nameDe || exercise.nameEn || exercise.name;
  return exercise.nameEn || exercise.nameDe || exercise.name;
}

function mergeAliases(aliases: ExerciseAliases, overrides?: ExerciseAliases): ExerciseAliases {
  if (!overrides) return aliases;
  return {
    en: Array.from(new Set([...(aliases.en || []), ...(overrides.en || [])])).filter(Boolean),
    de: Array.from(new Set([...(aliases.de || []), ...(overrides.de || [])])).filter(Boolean),
  };
}

function deriveDifficulty(exercise: Exercise): Difficulty {
  const name = `${exercise.nameEn} ${exercise.nameDe}`.toLowerCase();
  if (exercise.type === "mobility") return "Leicht";
  if (exercise.type === "conditioning") return "Mittel";
  if (
    name.includes("deadlift") ||
    name.includes("kreuzheben") ||
    name.includes("squat") ||
    name.includes("kniebeuge") ||
    name.includes("snatch") ||
    name.includes("clean") ||
    name.includes("pull-up") ||
    name.includes("klimm") ||
    name.includes("nordic") ||
    name.includes("pistol")
  ) {
    return "Schwer";
  }
  return "Mittel";
}

function buildSearchIndex(exercise: Exercise, overrides?: ExerciseAliases): string {
  const mergedAliases = mergeAliases(exercise.aliases, overrides);
  const parts = [
    exercise.nameEn,
    exercise.nameDe,
    ...(mergedAliases.en || []),
    ...(mergedAliases.de || []),
    exercise.id,
    exercise.movement,
    exercise.type,
    ...(exercise.primaryMuscles || []),
    ...(exercise.secondaryMuscles || []),
    ...(exercise.equipment || []),
  ];
  return normalizeSearchValue(parts.filter(Boolean).join(" "));
}

function buildTokenList(exercise: Exercise, overrides?: ExerciseAliases): string[] {
  const mergedAliases = mergeAliases(exercise.aliases, overrides);
  const rawTokens = [
    exercise.nameEn,
    exercise.nameDe,
    ...(mergedAliases.en || []),
    ...(mergedAliases.de || []),
  ];
  return rawTokens.map(normalizeExerciseToken).filter(Boolean);
}

function safeGetAliasOverrides(): Record<string, ExerciseAliases> {
  try {
    return getAliasOverrides();
  } catch {
    return {};
  }
}

function safeGetCustomExercises(): Exercise[] {
  try {
    return getCustomExercises();
  } catch {
    return [];
  }
}

function toExercise(core: CoreExercise, overrides?: ExerciseAliases, lang: "de" | "en" = DEFAULT_LANG): Exercise {
  const exercise: Exercise = {
    id: core.id,
    name: lang === "de" ? core.name.de : core.name.en,
    nameEn: core.name.en,
    nameDe: core.name.de,
    aliases: core.aliases,
    primaryMuscles: core.primaryMuscles || [],
    secondaryMuscles: core.secondaryMuscles || [],
    equipment: core.equipment || [],
    movement: core.movement,
    type: core.type,
    metrics: core.metrics || [],
    variants: core.variants,
    image: core.image,
    imageSrc: core.imageSrc,
    cues: core.cues,
    muscles: core.muscles,
    source: "core",
  };
  exercise.difficulty = deriveDifficulty(exercise);
  exercise.searchIndex = buildSearchIndex(exercise, overrides);
  return exercise;
}

function buildExerciseLibrary() {
  const lang = getPreferredLang();
  const aliasOverrides = safeGetAliasOverrides();
  const coreList = (coreExercises as CoreExercise[]).map((ex) =>
    toExercise(ex, aliasOverrides[ex.id], lang)
  );

  const tokenIndex = new Map<string, string>();
  const merged: Exercise[] = [];

  for (const ex of coreList) {
    merged.push(ex);
    for (const token of buildTokenList(ex, aliasOverrides[ex.id])) {
      if (!tokenIndex.has(token)) tokenIndex.set(token, ex.id);
    }
  }

  const customExercises = safeGetCustomExercises();
  for (const custom of customExercises) {
    const overrides = aliasOverrides[custom.id];
    const candidate: Exercise = {
      ...custom,
      name: lang === "de" ? custom.nameDe : custom.nameEn,
      difficulty: custom.difficulty ?? deriveDifficulty(custom),
      searchIndex: buildSearchIndex(custom, overrides),
      source: "custom",
    };
    const tokens = buildTokenList(candidate, overrides);
    const hasCollision = tokens.some((token) => tokenIndex.has(token));
    if (hasCollision) continue;
    merged.push(candidate);
    for (const token of tokens) {
      if (!tokenIndex.has(token)) tokenIndex.set(token, candidate.id);
    }
  }

  return { exercises: merged, tokenIndex };
}

export const EXERCISES: Exercise[] = [];
let tokenIndexCache = new Map<string, string>();

export function refreshExerciseLibrary(): void {
  const { exercises, tokenIndex } = buildExerciseLibrary();
  EXERCISES.splice(0, EXERCISES.length, ...exercises);
  tokenIndexCache = tokenIndex;
}

refreshExerciseLibrary();

export function findExerciseByToken(input: string): Exercise | undefined {
  const token = normalizeExerciseToken(input);
  const id = tokenIndexCache.get(token);
  if (!id) return undefined;
  return EXERCISES.find((ex) => ex.id === id);
}

export function filterExercises(exercises: Exercise[], filters: ExerciseFilters): Exercise[] {
  const term = filters.search.trim().length > 0 ? normalizeSearchValue(filters.search) : "";

  return (exercises || []).filter((ex) => {
    if (filters.muscle !== "alle" && !ex.primaryMuscles.includes(filters.muscle)) return false;
    if (filters.equipment !== "alle" && !ex.equipment.includes(filters.equipment)) return false;
    if (filters.difficulty !== "alle" && ex.difficulty !== filters.difficulty) return false;
    if (filters.type !== "alle" && ex.type !== filters.type) return false;

    if (term) {
      const index = ex.searchIndex ?? buildSearchIndex(ex);
      if (!index.includes(term)) return false;
    }

    return true;
  });
}
