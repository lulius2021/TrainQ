// src/types/nutrition.ts

export type FoodCategory =
  | "dairy"
  | "meat"
  | "fish"
  | "eggs"
  | "grains"
  | "bread"
  | "pasta"
  | "legumes"
  | "vegetables"
  | "fruits"
  | "nuts"
  | "oils"
  | "sweets"
  | "beverages"
  | "snacks"
  | "sauces"
  | "supplements"
  | "fastfood"
  | "plantbased"
  | "seeds"
  | "alcohol"
  | "readymeals"
  | "other";

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodServing {
  unit: string; // canonical unit id: "piece", "slice", "tbsp", etc.
  label: string; // display: "1 Stück", "1 Scheibe"
  grams: number;
}

export interface FoodItem {
  id: string; // "egg_chicken"
  name: string; // "Ei (Huhn)"
  nameEn: string; // "Egg (chicken)"
  aliases: string[]; // ["Eier", "Hühnerei"]
  category: FoodCategory;
  per100g: Macros;
  servings: FoodServing[];
}

export interface DiaryEntry {
  id: string;
  dateISO: string; // "2026-03-01"
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime — fallback to createdAt for legacy entries
  foodId: string;
  foodName: string; // denormalized for display
  amountGrams: number;
  displayAmount: string; // "2 Eier" - what user typed/selected
  macros: Macros;
  source: "manual" | "barcode" | "parser";
}

export interface CustomFoodItem {
  id: string; // "cf_<timestamp>_<rand>"
  name: string;
  nameEn: string;
  aliases: string[];
  category: FoodCategory;
  per100g: Macros;
  servings: FoodServing[];
  createdAt: string;
  updatedAt: string;
}

export interface NutritionGoals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  mode: "deficit" | "maintenance" | "surplus";
}

export interface BarcodeCacheEntry {
  ean: string;
  foodName: string;
  per100g: Macros;
  servingGrams?: number;
  fetchedAt: string;
}

export interface ParsedFoodInput {
  qty: number;
  unit: string; // canonical: "g", "ml", "piece", "tbsp", "tsp", "slice", etc.
  query: string; // the food name portion
}

export interface FoodMatchResult {
  food: FoodItem;
  score: number; // 0–1
  matchedOn: "name" | "alias" | "nameEn";
}

export interface DailyProgress {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
