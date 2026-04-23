// src/features/nutrition/macroCalculator.ts
import type { Macros, DiaryEntry, NutritionGoals, DailyProgress } from "../../types/nutrition";

/**
 * Compute macros for a given food amount from per-100g values.
 */
export function computeMacros(per100g: Macros, amountGrams: number): Macros {
  const factor = amountGrams / 100;
  return {
    kcal: Math.round(per100g.kcal * factor),
    protein: Math.round(per100g.protein * factor * 10) / 10,
    carbs: Math.round(per100g.carbs * factor * 10) / 10,
    fat: Math.round(per100g.fat * factor * 10) / 10,
    sugar: per100g.sugar != null ? Math.round(per100g.sugar * factor * 10) / 10 : undefined,
    fiber: per100g.fiber != null ? Math.round(per100g.fiber * factor * 10) / 10 : undefined,
  };
}

/**
 * Sum macros from multiple diary entries.
 */
export function sumMacros(entries: DiaryEntry[]): Macros {
  const totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 };
  let hasSugar = false;
  let hasFiber = false;
  for (const entry of entries) {
    totals.kcal += entry.macros.kcal;
    totals.protein += entry.macros.protein;
    totals.carbs += entry.macros.carbs;
    totals.fat += entry.macros.fat;
    if (entry.macros.sugar != null) { totals.sugar += entry.macros.sugar; hasSugar = true; }
    if (entry.macros.fiber != null) { totals.fiber += entry.macros.fiber; hasFiber = true; }
  }
  return {
    kcal: Math.round(totals.kcal),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    sugar: hasSugar ? Math.round(totals.sugar * 10) / 10 : undefined,
    fiber: hasFiber ? Math.round(totals.fiber * 10) / 10 : undefined,
  };
}

/**
 * Compute progress ratios (0–1+) for each macro against goals.
 */
export function computeProgress(
  totals: Macros,
  goals: NutritionGoals
): DailyProgress {
  return {
    kcal: goals.kcal > 0 ? totals.kcal / goals.kcal : 0,
    protein: goals.protein > 0 ? totals.protein / goals.protein : 0,
    carbs: goals.carbs > 0 ? totals.carbs / goals.carbs : 0,
    fat: goals.fat > 0 ? totals.fat / goals.fat : 0,
  };
}
