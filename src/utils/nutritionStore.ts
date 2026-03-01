// src/utils/nutritionStore.ts
import type { DiaryEntry, NutritionGoals } from "../types/nutrition";
import { getScopedItem, setScopedItem } from "./scopedStorage";
import { getActiveUserId } from "./session";
import { pushEntry, pushEntryDelete, pushGoals } from "../services/nutritionSync";

const DIARY_KEY = "trainq_nutrition_diary_v1";
const GOALS_KEY = "trainq_nutrition_goals_v1";
const EVENT_NAME = "trainq:nutritionUpdated";

function userId(): string | undefined {
  return getActiveUserId() ?? undefined;
}

function fireUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

// --- Diary ---

export function loadDiaryEntries(dateISO?: string): DiaryEntry[] {
  try {
    const raw = getScopedItem(DIARY_KEY, userId());
    if (!raw) return [];
    const all: DiaryEntry[] = JSON.parse(raw);
    if (!Array.isArray(all)) return [];
    // Backfill updatedAt for legacy entries
    for (const e of all) {
      if (!e.updatedAt) e.updatedAt = e.createdAt;
    }
    if (dateISO) return all.filter((e) => e.dateISO === dateISO);
    return all;
  } catch {
    return [];
  }
}

export function addDiaryEntry(entry: DiaryEntry): void {
  if (!entry.updatedAt) entry.updatedAt = entry.createdAt || new Date().toISOString();
  const all = loadDiaryEntries();
  all.push(entry);
  setScopedItem(DIARY_KEY, JSON.stringify(all), userId());
  fireUpdate();
  pushEntry(entry);
}

export function updateDiaryEntry(
  id: string,
  updates: Partial<Pick<DiaryEntry, "amountGrams" | "displayAmount" | "macros">>
): void {
  const all = loadDiaryEntries();
  const idx = all.findIndex((e) => e.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  setScopedItem(DIARY_KEY, JSON.stringify(all), userId());
  fireUpdate();
  pushEntry(all[idx]);
}

export function deleteDiaryEntry(id: string): void {
  const all = loadDiaryEntries();
  const filtered = all.filter((e) => e.id !== id);
  if (filtered.length === all.length) return;
  setScopedItem(DIARY_KEY, JSON.stringify(filtered), userId());
  fireUpdate();
  pushEntryDelete(id);
}

// --- Goals ---

export function loadGoals(): NutritionGoals | null {
  try {
    const raw = getScopedItem(GOALS_KEY, userId());
    if (!raw) return null;
    return JSON.parse(raw) as NutritionGoals;
  } catch {
    return null;
  }
}

export function saveGoals(goals: NutritionGoals): void {
  setScopedItem(GOALS_KEY, JSON.stringify(goals), userId());
  fireUpdate();
  pushGoals(goals);
}

// --- Event listener ---

export function onNutritionUpdated(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, cb);
  return () => window.removeEventListener(EVENT_NAME, cb);
}
