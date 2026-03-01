// src/features/nutrition/unitResolver.ts
import type { FoodItem } from "../../types/nutrition";

/**
 * Kitchen measure fallback weights in grams.
 */
const KITCHEN_MEASURES: Record<string, number> = {
  tbsp: 15,
  tsp: 5,
  cup: 250,
  handful: 30,
  portion: 150,
  slice: 30, // default slice weight, overridden by food-specific servings
};

/**
 * Resolve a quantity + unit combination to grams, using food-specific servings
 * when available, falling back to generic conversions.
 *
 * @param qty - The amount (e.g., 2)
 * @param unit - Canonical unit id (e.g., "g", "piece", "tbsp")
 * @param food - The matched food item (optional, for food-specific servings)
 * @returns Weight in grams
 */
export function resolveToGrams(
  qty: number,
  unit: string,
  food?: FoodItem
): number {
  // Direct weight units
  if (unit === "g") return qty;
  if (unit === "kg") return qty * 1000;
  if (unit === "ml") return qty; // 1ml ≈ 1g for most foods
  if (unit === "l") return qty * 1000;

  // Check food-specific servings first
  if (food?.servings) {
    const serving = food.servings.find((s) => s.unit === unit);
    if (serving) return qty * serving.grams;
  }

  // Kitchen measure fallbacks
  if (KITCHEN_MEASURES[unit]) {
    return qty * KITCHEN_MEASURES[unit];
  }

  // Unknown unit: assume "piece" with food-specific serving or 100g default
  if (food?.servings) {
    const pieceFallback = food.servings.find((s) => s.unit === "piece");
    if (pieceFallback) return qty * pieceFallback.grams;
  }

  // Last resort: 100g per piece
  return qty * 100;
}
