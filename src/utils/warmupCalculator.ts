// src/utils/warmupCalculator.ts
// Feature 4: Aufwärmsätze berechnen

export interface WarmupStep {
  percentOfWorking: number; // 0 = bar only, 50 = 50%, etc.
  reps: number;
}

export interface WarmupConfig {
  barWeight: number;       // default 20kg
  plateIncrement: number;  // default 2.5kg
  steps: WarmupStep[];
}

export interface WarmupSet {
  weight: number;
  reps: number;
  isBarOnly: boolean;
}

const STORAGE_KEY = "trainq_warmup_config_v1";

const DEFAULT_STEPS: WarmupStep[] = [
  { percentOfWorking: 0, reps: 10 },   // Empty bar
  { percentOfWorking: 50, reps: 8 },
  { percentOfWorking: 70, reps: 5 },
  { percentOfWorking: 85, reps: 3 },
];

const DEFAULT_CONFIG: WarmupConfig = {
  barWeight: 20,
  plateIncrement: 2.5,
  steps: DEFAULT_STEPS,
};

function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function loadWarmupConfig(): WarmupConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_CONFIG;
    return {
      barWeight: Number.isFinite(parsed.barWeight) ? parsed.barWeight : DEFAULT_CONFIG.barWeight,
      plateIncrement: Number.isFinite(parsed.plateIncrement) ? parsed.plateIncrement : DEFAULT_CONFIG.plateIncrement,
      steps: Array.isArray(parsed.steps) && parsed.steps.length > 0
        ? parsed.steps.map((s: any) => ({
            percentOfWorking: Number.isFinite(s?.percentOfWorking) ? s.percentOfWorking : 0,
            reps: Number.isFinite(s?.reps) ? Math.max(1, Math.round(s.reps)) : 5,
          }))
        : DEFAULT_CONFIG.steps,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveWarmupConfig(config: WarmupConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function resetWarmupConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function calculateWarmupSets(workingWeight: number, config?: WarmupConfig): WarmupSet[] {
  const cfg = config ?? loadWarmupConfig();
  const { barWeight, plateIncrement, steps } = cfg;

  if (!Number.isFinite(workingWeight) || workingWeight <= 0) return [];
  if (workingWeight <= barWeight) return [];

  const sets: WarmupSet[] = [];
  const seenWeights = new Set<number>();

  for (const step of steps) {
    let weight: number;
    if (step.percentOfWorking <= 0) {
      weight = barWeight;
    } else {
      weight = roundToStep(workingWeight * (step.percentOfWorking / 100), plateIncrement);
      weight = Math.max(barWeight, weight);
    }

    // Skip duplicates and weights >= working weight
    if (weight >= workingWeight) continue;
    if (seenWeights.has(weight)) continue;
    seenWeights.add(weight);

    sets.push({
      weight,
      reps: step.reps,
      isBarOnly: weight <= barWeight,
    });
  }

  return sets;
}

export function getDefaultConfig(): WarmupConfig {
  return { ...DEFAULT_CONFIG, steps: DEFAULT_CONFIG.steps.map(s => ({ ...s })) };
}
