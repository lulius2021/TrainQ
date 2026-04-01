// src/hooks/useNutrition.ts
import { useState, useEffect, useCallback } from "react";
import type { DiaryEntry, NutritionGoals, Macros, DailyProgress } from "../types/nutrition";
import {
  loadDiaryEntries,
  addDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
  loadGoals,
  saveGoals,
  onNutritionUpdated,
} from "../utils/nutritionStore";
import { sumMacros, computeProgress } from "../features/nutrition/macroCalculator";
import { pullAndMerge } from "../services/nutritionSync";

const DEFAULT_GOALS: NutritionGoals = {
  kcal: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
  sugar: 50,
  fiber: 30,
  water: 3,
  mode: "maintenance",
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useNutrition(dateISO?: string) {
  const date = dateISO || todayISO();
  const [entries, setEntries] = useState<DiaryEntry[]>(() => loadDiaryEntries(date));
  const [goals, setGoalsState] = useState<NutritionGoals>(() => loadGoals() || DEFAULT_GOALS);

  // Pull from Supabase on mount (fire-and-forget; bails silently for local users)
  useEffect(() => {
    pullAndMerge().then(() => {
      setEntries(loadDiaryEntries(date));
      const g = loadGoals();
      if (g) setGoalsState(g);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload on external updates
  useEffect(() => {
    const reload = () => {
      setEntries(loadDiaryEntries(date));
      const g = loadGoals();
      if (g) setGoalsState(g);
    };
    const unsub = onNutritionUpdated(reload);
    return unsub;
  }, [date]);

  // Recompute when date changes
  useEffect(() => {
    setEntries(loadDiaryEntries(date));
  }, [date]);

  const totals: Macros = sumMacros(entries);
  const progress: DailyProgress = computeProgress(totals, goals);

  const addEntry = useCallback((entry: DiaryEntry) => {
    addDiaryEntry(entry);
  }, []);

  const removeEntry = useCallback((id: string) => {
    deleteDiaryEntry(id);
  }, []);

  const editEntry = useCallback(
    (id: string, updates: Partial<Pick<DiaryEntry, "amountGrams" | "displayAmount" | "macros">>) => {
      updateDiaryEntry(id, updates);
    },
    []
  );

  const setGoals = useCallback((g: NutritionGoals) => {
    saveGoals(g);
    setGoalsState(g);
  }, []);

  return {
    date,
    entries,
    goals,
    totals,
    progress,
    addEntry,
    removeEntry,
    editEntry,
    setGoals,
  };
}
