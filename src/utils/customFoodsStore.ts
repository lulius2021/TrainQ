// src/utils/customFoodsStore.ts
import type { CustomFoodItem } from "../types/nutrition";
import { getScopedItem, setScopedItem } from "./scopedStorage";
import { getActiveUserId } from "./session";
import { pushCustomFood, pushCustomFoodDelete } from "../services/nutritionSync";

const STORAGE_KEY = "trainq_custom_foods_v1";
const EVENT_NAME = "trainq:customFoodsUpdated";

function userId(): string | undefined {
  return getActiveUserId() ?? undefined;
}

function fireUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export function loadCustomFoods(): CustomFoodItem[] {
  try {
    const raw = getScopedItem(STORAGE_KEY, userId());
    if (!raw) return [];
    const all: CustomFoodItem[] = JSON.parse(raw);
    if (!Array.isArray(all)) return [];
    return all;
  } catch {
    return [];
  }
}

export function addCustomFood(food: CustomFoodItem): void {
  const all = loadCustomFoods();
  all.push(food);
  setScopedItem(STORAGE_KEY, JSON.stringify(all), userId());
  fireUpdate();
  pushCustomFood(food);
}

export function updateCustomFood(id: string, updates: Partial<CustomFoodItem>): void {
  const all = loadCustomFoods();
  const idx = all.findIndex((f) => f.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
  setScopedItem(STORAGE_KEY, JSON.stringify(all), userId());
  fireUpdate();
  pushCustomFood(all[idx]);
}

export function deleteCustomFood(id: string): void {
  const all = loadCustomFoods();
  const filtered = all.filter((f) => f.id !== id);
  if (filtered.length === all.length) return;
  setScopedItem(STORAGE_KEY, JSON.stringify(filtered), userId());
  fireUpdate();
  pushCustomFoodDelete(id);
}

export function onCustomFoodsUpdated(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, cb);
  return () => window.removeEventListener(EVENT_NAME, cb);
}
