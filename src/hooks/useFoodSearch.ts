// src/hooks/useFoodSearch.ts
import { useCallback, useEffect, useRef } from "react";
import type { FoodItem, FoodMatchResult, ParsedFoodInput } from "../types/nutrition";
import { CORE_FOODS } from "../data/foods/coreFoods";
import { loadCustomFoods, onCustomFoodsUpdated } from "../utils/customFoodsStore";
import { parseFoodInput } from "../features/nutrition/foodParser";
import { searchFoods } from "../features/nutrition/foodMatcher";

// Build merged DB: custom foods first (higher search priority), then core
let cachedDb: FoodItem[] | null = null;
function getFoodDb(): FoodItem[] {
  if (!cachedDb) {
    const custom = loadCustomFoods().map<FoodItem>((cf) => ({
      id: cf.id,
      name: cf.name,
      nameEn: cf.nameEn,
      aliases: cf.aliases,
      category: cf.category,
      per100g: cf.per100g,
      servings: cf.servings,
    }));
    cachedDb = [...custom, ...CORE_FOODS];
  }
  return cachedDb;
}

function refreshDb(): FoodItem[] {
  cachedDb = null;
  return getFoodDb();
}

export function useFoodSearch() {
  const dbRef = useRef<FoodItem[]>(getFoodDb());

  // Invalidate cache when custom foods change
  useEffect(() => {
    const unsub = onCustomFoodsUpdated(() => {
      dbRef.current = refreshDb();
    });
    return unsub;
  }, []);

  const search = useCallback((query: string): FoodMatchResult[] => {
    return searchFoods(dbRef.current, query);
  }, []);

  const parseInput = useCallback((raw: string): ParsedFoodInput => {
    return parseFoodInput(raw);
  }, []);

  const findById = useCallback((id: string): FoodItem | undefined => {
    return dbRef.current.find((f) => f.id === id);
  }, []);

  return { search, parseInput, findById };
}
