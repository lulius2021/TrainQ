// src/data/exercises/validateExercises.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadOverrides() {
  const overridePath = process.env.TRAINQ_ALIAS_OVERRIDES_PATH
    ? path.resolve(process.env.TRAINQ_ALIAS_OVERRIDES_PATH)
    : null;
  if (!overridePath || !fs.existsSync(overridePath)) return {};
  try {
    const raw = fs.readFileSync(overridePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

const raw = fs.readFileSync(dataPath, "utf8");
const data = JSON.parse(raw);
const overrides = loadOverrides();
const errors = [];

if (!Array.isArray(data)) {
  errors.push("Dataset is not an array.");
}

const idSet = new Set();
const tokenToId = new Map();
const collisions = new Map();

const equipmentCounts = new Map();
const muscleCounts = new Map();
let totalAliasEn = 0;
let totalAliasDe = 0;

for (const item of data) {
  if (!item || typeof item !== "object") {
    errors.push("Invalid exercise entry: not an object.");
    continue;
  }

  assert(typeof item.id === "string" && item.id.trim().length > 0, `Missing id for entry.`, errors);
  if (item.id) {
    if (idSet.has(item.id)) {
      errors.push(`Duplicate id: ${item.id}`);
    }
    idSet.add(item.id);
  }

  assert(item.name && typeof item.name.en === "string" && item.name.en.trim().length > 0, `Missing name.en for ${item.id}`, errors);
  assert(item.name && typeof item.name.de === "string" && item.name.de.trim().length > 0, `Missing name.de for ${item.id}`, errors);

  assert(Array.isArray(item.aliases?.en), `aliases.en must be array for ${item.id}`, errors);
  assert(Array.isArray(item.aliases?.de), `aliases.de must be array for ${item.id}`, errors);

  totalAliasEn += Array.isArray(item.aliases?.en) ? item.aliases.en.length : 0;
  totalAliasDe += Array.isArray(item.aliases?.de) ? item.aliases.de.length : 0;

  assert(Array.isArray(item.primaryMuscles) && item.primaryMuscles.length > 0, `primaryMuscles missing for ${item.id}`, errors);
  assert(Array.isArray(item.equipment) && item.equipment.length > 0, `equipment missing for ${item.id}`, errors);
  assert(typeof item.movement === "string", `movement missing for ${item.id}`, errors);
  assert(typeof item.type === "string", `type missing for ${item.id}`, errors);
  assert(Array.isArray(item.metrics) && item.metrics.length > 0, `metrics missing for ${item.id}`, errors);

  for (const muscle of item.primaryMuscles || []) {
    if (!allowedMuscles.has(muscle)) {
      errors.push(`Invalid primaryMuscle '${muscle}' for ${item.id}`);
    }
    muscleCounts.set(muscle, (muscleCounts.get(muscle) || 0) + 1);
  }

  for (const muscle of item.secondaryMuscles || []) {
    if (!allowedMuscles.has(muscle)) {
      errors.push(`Invalid secondaryMuscle '${muscle}' for ${item.id}`);
    }
  }

  for (const eq of item.equipment || []) {
    if (!allowedEquipment.has(eq)) {
      errors.push(`Invalid equipment '${eq}' for ${item.id}`);
    }
    equipmentCounts.set(eq, (equipmentCounts.get(eq) || 0) + 1);
  }

  if (!allowedMovement.has(item.movement)) {
    errors.push(`Invalid movement '${item.movement}' for ${item.id}`);
  }

  if (!allowedType.has(item.type)) {
    errors.push(`Invalid type '${item.type}' for ${item.id}`);
  }

  for (const metric of item.metrics || []) {
    if (!allowedMetrics.has(metric)) {
      errors.push(`Invalid metric '${metric}' for ${item.id}`);
    }
  }

  if (item.variants) {
    const variants = item.variants;
    if (variants.implement) {
      for (const v of variants.implement) {
        if (!allowedVariants.implement.has(v)) errors.push(`Invalid variant implement '${v}' for ${item.id}`);
      }
    }
    if (variants.incline) {
      for (const v of variants.incline) {
        if (!allowedVariants.incline.has(v)) errors.push(`Invalid variant incline '${v}' for ${item.id}`);
      }
    }
    if (variants.grip) {
      for (const v of variants.grip) {
        if (!allowedVariants.grip.has(v)) errors.push(`Invalid variant grip '${v}' for ${item.id}`);
      }
    }
    if (variants.stance) {
      for (const v of variants.stance) {
        if (!allowedVariants.stance.has(v)) errors.push(`Invalid variant stance '${v}' for ${item.id}`);
      }
    }
    if (variants.unilateral && !Array.isArray(variants.unilateral)) {
      errors.push(`Invalid variant unilateral for ${item.id}`);
    }
  }

  const override = overrides[item.id] || { en: [], de: [] };
  const tokenSources = [
    item.name?.en,
    item.name?.de,
    ...(item.aliases?.en || []),
    ...(item.aliases?.de || []),
    ...(override.en || []),
    ...(override.de || []),
  ];

  for (const rawToken of tokenSources) {
    const token = normalizeToken(rawToken);
    if (!token) continue;
    const existing = tokenToId.get(token);
    if (existing && existing !== item.id) {
      if (!collisions.has(token)) collisions.set(token, new Set([existing]));
      collisions.get(token).add(item.id);
    } else {
      tokenToId.set(token, item.id);
    }
  }
}

if (collisions.size > 0) {
  for (const [token, ids] of collisions.entries()) {
    errors.push(`Token collision '${token}' across ids: ${Array.from(ids).join(", ")}`);
  }
}

const total = data.length;
if (total < 450) {
  errors.push(`Total exercises ${total} < 450.`);
}

const equipmentTargets = {
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
console.log("Equipment counts:", Object.fromEntries(equipmentCounts.entries()));
console.log("Primary muscle counts:", Object.fromEntries(muscleCounts.entries()));

if (errors.length) {
  console.error("Validation failed:\n" + errors.map((e) => `- ${e}`).join("\n"));
  process.exit(1);
}

console.log("Validation passed.");
