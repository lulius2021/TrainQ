// src/data/exercises/validateExercises.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { translationsEn } from "../../i18n/translations.en.ts";
import { translationsDe } from "../../i18n/translations.de.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "core.exercises.v1.json");

const allowedMuscles = new Set([
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
]);

const allowedEquipment = new Set([
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
]);

const allowedMovement = new Set(["push", "pull", "squat", "hinge", "carry", "rotation", "locomotion"]);
const allowedType = new Set(["strength", "hypertrophy", "calisthenics", "conditioning", "mobility"]);
const allowedMetrics = new Set(["weight", "reps", "time", "distance", "pace", "rpe"]);

const allowedVariants = {
  implement: new Set([
    "barbell",
    "dumbbell",
    "machine",
    "cable",
    "bodyweight",
    "kettlebell",
    "band",
    "smith_machine",
    "trap_bar",
    "medicine_ball",
    "cardio_machine",
  ]),
  incline: new Set(["flat", "incline", "decline"]),
  grip: new Set(["standard", "close", "wide", "neutral", "supinated", "pronated"]),
  stance: new Set(["standard", "narrow", "wide", "split", "sumo"]),
};

const majorMuscles = new Set([
  "chest",
  "back",
  "lats",
  "quads",
  "hamstrings",
  "glutes",
  "front_delts",
  "side_delts",
  "rear_delts",
  "core",
]);

const translationSets = {
  muscles: Array.from(allowedMuscles).map((muscle) => `training.muscle.${muscle}`),
  equipment: Array.from(allowedEquipment).map((equipment) => `training.equipment.${equipment}`),
  types: Array.from(allowedType).map((type) => `training.exerciseType.${type}`),
  metrics: Array.from(allowedMetrics).map((metric) => `training.metric.${metric}`),
  difficulties: ["Leicht", "Mittel", "Schwer"].map((level) => `training.difficulty.${level}`),
};

function normalizeToken(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assert(condition: boolean, message: string, errors: string[]) {
  if (!condition) errors.push(message);
}

function loadOverrides(errors: string[]) {
  const overridePath = process.env.TRAINQ_ALIAS_OVERRIDES_PATH
    ? path.resolve(process.env.TRAINQ_ALIAS_OVERRIDES_PATH)
    : null;
  if (!overridePath || !fs.existsSync(overridePath)) return {};
  try {
    const raw = fs.readFileSync(overridePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      errors.push("Alias override file must contain an object.");
      return {};
    }
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== "object") {
        errors.push(`Alias overrides for '${id}' must be an object.`);
        continue;
      }
      if (!Array.isArray((entry as any).en) || !Array.isArray((entry as any).de)) {
        errors.push(`Alias overrides for '${id}' must have 'en' and 'de' arrays.`);
      }
    }
    return parsed as Record<string, { en: string[]; de: string[] }>;
  } catch (error) {
    errors.push(`Failed to read alias override file: ${(error as Error).message}`);
    return {};
  }
}

function validateTranslations(errors: string[]) {
  const missing = [] as string[];
  for (const key of Object.values(translationSets).flat()) {
    if (!(key in translationsEn)) missing.push(`en:${key}`);
    if (!(key in translationsDe)) missing.push(`de:${key}`);
  }
  if (missing.length) {
    errors.push(`Missing translation keys: ${missing.join(", ")}`);
  }
}

type CollisionEntry = {
  ids: Set<string>;
  sources: Map<string, Set<string>>;
};

function trackToken(
  map: Map<string, CollisionEntry>,
  token: string,
  id: string,
  raw: string
) {
  if (!token) return;
  const entry = map.get(token) ?? { ids: new Set(), sources: new Map() };
  entry.ids.add(id);
  const sourceSet = entry.sources.get(id) ?? new Set();
  sourceSet.add(raw);
  entry.sources.set(id, sourceSet);
  map.set(token, entry);
}

function validateAliasList(
  id: string,
  lang: "en" | "de",
  aliases: unknown,
  errors: string[]
) {
  if (!Array.isArray(aliases)) {
    errors.push(`aliases.${lang} must be array for ${id}`);
    return [] as string[];
  }
  const seen = new Map<string, string>();
  const cleaned = [] as string[];
  aliases.forEach((value, idx) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      errors.push(`aliases.${lang}[${idx}] empty for ${id}`);
      return;
    }
    const normalized = normalizeToken(trimmed);
    if (!normalized) {
      errors.push(`aliases.${lang}[${idx}] invalid for ${id}`);
      return;
    }
    if (seen.has(normalized)) {
      errors.push(`aliases.${lang} duplicate '${trimmed}' for ${id} (matches '${seen.get(normalized)}')`);
      return;
    }
    seen.set(normalized, trimmed);
    cleaned.push(trimmed);
  });
  return cleaned;
}

function detectTokenCollisions(
  items: any[],
  overrides: Record<string, { en: string[]; de: string[] }>,
  errors: string[]
) {
  const collisions = new Map<string, CollisionEntry>();

  for (const item of items) {
    if (!item?.id) continue;
    const override = overrides[item.id] || { en: [], de: [] };
    const sources = [
      item.name?.en,
      item.name?.de,
      ...(item.aliases?.en || []),
      ...(item.aliases?.de || []),
      ...(override.en || []),
      ...(override.de || []),
    ];
    for (const raw of sources) {
      const token = normalizeToken(raw);
      if (!token) continue;
      trackToken(collisions, token, item.id, String(raw));
    }
  }

  const collisionErrors = [] as string[];
  for (const [token, entry] of collisions.entries()) {
    if (entry.ids.size <= 1) continue;
    const details = Array.from(entry.sources.entries())
      .map(([id, values]) => `${id}: ${Array.from(values).join(" | ")}`)
      .join("; ");
    collisionErrors.push(`Token '${token}' across ids: ${Array.from(entry.ids).join(", ")} (${details})`);
  }

  if (collisionErrors.length) {
    errors.push(...collisionErrors);
  }

  return collisionErrors.length;
}

function runSelfTests() {
  const failures = [] as string[];

  const mockStorage = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mockStorage.set(key, value);
      },
    },
  };

  return Promise.resolve()
    .then(async () => {
      const normalized = normalizeToken("Kabel-Rudern");
      if (normalized !== "kabel rudern") {
        failures.push(`normalizeToken failed (expected 'kabel rudern', got '${normalized}')`);
      }

      const { addAliasOverride, getAliasOverrides } = await import("../../utils/exerciseAliasesStore.ts");
      addAliasOverride("ex_test", "en", "Cable Row");
      addAliasOverride("ex_test", "en", "Cable Row");
      const overrides = getAliasOverrides();
      const list = overrides.ex_test?.en ?? [];
      if (list.length !== 1) {
        failures.push(`addAliasOverride idempotency failed (expected 1, got ${list.length})`);
      }

      const sample = [
        {
          id: "ex_one",
          name: { en: "Cable Row", de: "Kabel Rudern" },
          aliases: { en: ["Row"], de: [] },
        },
        {
          id: "ex_two",
          name: { en: "Row", de: "Rudern" },
          aliases: { en: [], de: [] },
        },
      ];
      const collisionErrors: string[] = [];
      const collisionCount = detectTokenCollisions(sample, {}, collisionErrors);
      if (collisionCount === 0) {
        failures.push("Collision detection failed (expected collisions).");
      }

      if (failures.length) {
        console.error("Self-tests failed:\n" + failures.map((f) => `- ${f}`).join("\n"));
        process.exit(1);
      }
      console.log("Self-tests passed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Self-tests failed:", error);
      process.exit(1);
    });
}

const args = process.argv.slice(2);
if (args.includes("--self-test")) {
  runSelfTests();
}

const runValidation = !args.includes("--self-test");
if (!runValidation) {
  // Self-test run exits via runSelfTests().
} else {
  const raw = fs.readFileSync(dataPath, "utf8");
  const data = JSON.parse(raw);
  const errors: string[] = [];
  const overrides = loadOverrides(errors);

  if (!Array.isArray(data)) {
    errors.push("Dataset is not an array.");
  }

  const idSet = new Set<string>();
  const equipmentCounts = new Map<string, number>();
  const muscleCounts = new Map<string, number>();
  let totalAliasEn = 0;
  let totalAliasDe = 0;

  for (const item of data) {
    if (!item || typeof item !== "object") {
      errors.push("Invalid exercise entry: not an object.");
      continue;
    }

    const id = String(item.id || "").trim();
    assert(id.length > 0, "Missing id for entry.", errors);
    if (id) {
      if (idSet.has(id)) {
        errors.push(`Duplicate id: ${id}`);
      }
      idSet.add(id);
    }

    assert(
      item.name && typeof item.name.en === "string" && item.name.en.trim().length > 0,
      `Missing name.en for ${id}`,
      errors
    );
    assert(
      item.name && typeof item.name.de === "string" && item.name.de.trim().length > 0,
      `Missing name.de for ${id}`,
      errors
    );

    const aliasesEn = validateAliasList(id, "en", item.aliases?.en, errors);
    const aliasesDe = validateAliasList(id, "de", item.aliases?.de, errors);
    totalAliasEn += aliasesEn.length;
    totalAliasDe += aliasesDe.length;

    assert(
      Array.isArray(item.primaryMuscles) && item.primaryMuscles.length > 0,
      `primaryMuscles missing for ${id}`,
      errors
    );
    assert(Array.isArray(item.equipment) && item.equipment.length > 0, `equipment missing for ${id}`, errors);
    assert(typeof item.movement === "string", `movement missing for ${id}`, errors);
    assert(typeof item.type === "string", `type missing for ${id}`, errors);
    assert(Array.isArray(item.metrics) && item.metrics.length > 0, `metrics missing for ${id}`, errors);

    for (const muscle of item.primaryMuscles || []) {
      if (!allowedMuscles.has(muscle)) {
        errors.push(`Invalid primaryMuscle '${muscle}' for ${id}`);
      }
      muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + 1);
    }

    for (const muscle of item.secondaryMuscles || []) {
      if (!allowedMuscles.has(muscle)) {
        errors.push(`Invalid secondaryMuscle '${muscle}' for ${id}`);
      }
    }

    for (const eq of item.equipment || []) {
      if (!allowedEquipment.has(eq)) {
        errors.push(`Invalid equipment '${eq}' for ${id}`);
      }
      equipmentCounts.set(eq, (equipmentCounts.get(eq) || 0) + 1);
    }

    if (!allowedMovement.has(item.movement)) {
      errors.push(`Invalid movement '${item.movement}' for ${id}`);
    }

    if (!allowedType.has(item.type)) {
      errors.push(`Invalid type '${item.type}' for ${id}`);
    }

    for (const metric of item.metrics || []) {
      if (!allowedMetrics.has(metric)) {
        errors.push(`Invalid metric '${metric}' for ${id}`);
      }
    }

    if (item.variants) {
      const variants = item.variants;
      if (variants.implement) {
        for (const v of variants.implement) {
          if (!allowedVariants.implement.has(v)) errors.push(`Invalid variant implement '${v}' for ${id}`);
        }
      }
      if (variants.incline) {
        for (const v of variants.incline) {
          if (!allowedVariants.incline.has(v)) errors.push(`Invalid variant incline '${v}' for ${id}`);
        }
      }
      if (variants.grip) {
        for (const v of variants.grip) {
          if (!allowedVariants.grip.has(v)) errors.push(`Invalid variant grip '${v}' for ${id}`);
        }
      }
      if (variants.stance) {
        for (const v of variants.stance) {
          if (!allowedVariants.stance.has(v)) errors.push(`Invalid variant stance '${v}' for ${id}`);
        }
      }
      if (variants.unilateral) {
        if (
          !Array.isArray(variants.unilateral) ||
          variants.unilateral.some((value: unknown) => typeof value !== "boolean")
        ) {
          errors.push(`Invalid variant unilateral for ${id}`);
        }
      }
    }
  }

  validateTranslations(errors);
  const collisionCount = detectTokenCollisions(data, overrides, errors);

  const total = Array.isArray(data) ? data.length : 0;
  if (total < 450) {
    errors.push(`Total exercises ${total} < 450.`);
  }

  const equipmentTargets: Record<string, number> = {
    barbell: 80,
    dumbbell: 80,
    machine: 80,
    cable: 60,
    bodyweight: 60,
    kettlebell: 20,
    band: 20,
  };

  for (const [key, min] of Object.entries(equipmentTargets)) {
    const count = equipmentCounts.get(key) || 0;
    if (count < min) {
      errors.push(`Equipment '${key}' count ${count} < ${min}`);
    }
  }

  for (const muscle of allowedMuscles) {
    const count = muscleCounts.get(muscle) || 0;
    const min = majorMuscles.has(muscle) ? 20 : 10;
    if (count < min) {
      errors.push(`Primary muscle '${muscle}' count ${count} < ${min}`);
    }
  }

  const avgAliasEn = total > 0 ? totalAliasEn / total : 0;
  const avgAliasDe = total > 0 ? totalAliasDe / total : 0;

  if (avgAliasEn < 1.5) {
    errors.push(`Average aliases.en ${avgAliasEn.toFixed(2)} < 1.5`);
  }
  if (avgAliasDe < 1.5) {
    errors.push(`Average aliases.de ${avgAliasDe.toFixed(2)} < 1.5`);
  }

  console.log("Exercise dataset validation report");
  console.log(`Total exercises: ${total}`);
  console.log(`Avg aliases.en: ${avgAliasEn.toFixed(2)}`);
  console.log(`Avg aliases.de: ${avgAliasDe.toFixed(2)}`);
  console.log(`Token collisions: ${collisionCount}`);
  console.log("Equipment counts:", Object.fromEntries(equipmentCounts.entries()));
  console.log("Primary muscle counts:", Object.fromEntries(muscleCounts.entries()));

  if (errors.length) {
    console.error("Validation failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
    process.exit(1);
  }

  console.log("Validation passed.");
}
