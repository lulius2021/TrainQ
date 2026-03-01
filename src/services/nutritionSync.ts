// src/services/nutritionSync.ts
// Offline-first sync layer for nutrition data.
// All push operations are fire-and-forget. Bails silently if no Supabase client or local-only user.

import { getSupabaseClient } from "../lib/supabaseClient";
import { getActiveUserId } from "../utils/session";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import {
  loadDiaryEntries,
  loadGoals,
  saveGoals,
} from "../utils/nutritionStore";
import { loadCustomFoods } from "../utils/customFoodsStore";
import type { DiaryEntry, NutritionGoals, CustomFoodItem } from "../types/nutrition";

const SYNC_TS_KEY = "trainq_nutrition_last_sync_v1";

function getUserId(): string | null {
  return getActiveUserId();
}

function isLocalUser(): boolean {
  const uid = getUserId();
  return !uid || uid.startsWith("local_");
}

function getClient() {
  if (isLocalUser()) return null;
  return getSupabaseClient();
}

function getLastSync(): string {
  const uid = getUserId();
  const raw = getScopedItem(SYNC_TS_KEY, uid);
  return raw || "1970-01-01T00:00:00Z";
}

function setLastSync(ts: string): void {
  const uid = getUserId();
  setScopedItem(SYNC_TS_KEY, ts, uid);
}

// ==================== PUSH ====================

export function pushEntry(entry: DiaryEntry): void {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();

  client
    .from("nutrition_entries")
    .upsert({
      id: entry.id,
      user_id: uid,
      date_iso: entry.dateISO,
      food_id: entry.foodId,
      food_name: entry.foodName,
      amount_grams: entry.amountGrams,
      display_amount: entry.displayAmount,
      kcal: entry.macros.kcal,
      protein: entry.macros.protein,
      carbs: entry.macros.carbs,
      fat: entry.macros.fat,
      source: entry.source,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt || entry.createdAt,
    })
    .then(() => {}, () => {});
}

export function pushEntryDelete(id: string): void {
  const client = getClient();
  if (!client) return;

  client
    .from("nutrition_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .then(() => {}, () => {});
}

export function pushGoals(goals: NutritionGoals): void {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();

  client
    .from("nutrition_goals")
    .upsert({
      user_id: uid,
      kcal: goals.kcal,
      protein: goals.protein,
      carbs: goals.carbs,
      fat: goals.fat,
      mode: goals.mode,
      updated_at: new Date().toISOString(),
    })
    .then(() => {}, () => {});
}

export function pushCustomFood(food: CustomFoodItem): void {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();

  client
    .from("custom_foods")
    .upsert({
      id: food.id,
      user_id: uid,
      name: food.name,
      category: food.category,
      kcal: food.per100g.kcal,
      protein: food.per100g.protein,
      carbs: food.per100g.carbs,
      fat: food.per100g.fat,
      servings: food.servings,
      created_at: food.createdAt,
      updated_at: food.updatedAt,
    })
    .then(() => {}, () => {});
}

export function pushCustomFoodDelete(id: string): void {
  const client = getClient();
  if (!client) return;

  client
    .from("custom_foods")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .then(() => {}, () => {});
}

// ==================== PULL ====================

export async function pullAndMerge(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();
  if (!uid) return;

  const lastSync = getLastSync();
  const now = new Date().toISOString();

  try {
    // Pull entries
    const { data: remoteEntries } = await client
      .from("nutrition_entries")
      .select("*")
      .eq("user_id", uid)
      .gt("updated_at", lastSync);

    if (remoteEntries && remoteEntries.length > 0) {
      const localEntries = loadDiaryEntries();
      const localMap = new Map(localEntries.map((e) => [e.id, e]));

      for (const re of remoteEntries) {
        if (re.deleted_at) {
          // Soft-deleted remotely — remove locally if exists
          localMap.delete(re.id);
          continue;
        }

        const local = localMap.get(re.id);
        const remoteUpdatedAt = re.updated_at || re.created_at;
        const localUpdatedAt = local?.updatedAt || local?.createdAt || "";

        if (!local || remoteUpdatedAt > localUpdatedAt) {
          const entry: DiaryEntry = {
            id: re.id,
            dateISO: re.date_iso,
            createdAt: re.created_at,
            updatedAt: re.updated_at || re.created_at,
            foodId: re.food_id,
            foodName: re.food_name,
            amountGrams: re.amount_grams,
            displayAmount: re.display_amount,
            macros: {
              kcal: re.kcal,
              protein: re.protein,
              carbs: re.carbs,
              fat: re.fat,
            },
            source: re.source,
          };
          localMap.set(re.id, entry);
        }
      }

      // Write merged entries back
      const merged = Array.from(localMap.values());
      setScopedItem("trainq_nutrition_diary_v1", JSON.stringify(merged), uid);
    }

    // Pull goals
    const { data: remoteGoals } = await client
      .from("nutrition_goals")
      .select("*")
      .eq("user_id", uid)
      .single();

    if (remoteGoals) {
      const localGoals = loadGoals();
      // Simple: remote wins if it exists (server is source of truth for goals)
      const goals: NutritionGoals = {
        kcal: remoteGoals.kcal,
        protein: remoteGoals.protein,
        carbs: remoteGoals.carbs,
        fat: remoteGoals.fat,
        mode: remoteGoals.mode as NutritionGoals["mode"],
      };
      if (!localGoals || remoteGoals.updated_at > lastSync) {
        saveGoals(goals);
      }
    }

    // Pull custom foods
    const { data: remoteFoods } = await client
      .from("custom_foods")
      .select("*")
      .eq("user_id", uid)
      .gt("updated_at", lastSync);

    if (remoteFoods && remoteFoods.length > 0) {
      const localFoods = loadCustomFoods();
      const localFoodMap = new Map(localFoods.map((f) => [f.id, f]));

      for (const rf of remoteFoods) {
        if (rf.deleted_at) {
          localFoodMap.delete(rf.id);
          continue;
        }

        const local = localFoodMap.get(rf.id);
        const remoteUpdatedAt = rf.updated_at || rf.created_at;
        const localUpdatedAt = local?.updatedAt || "";

        if (!local || remoteUpdatedAt > localUpdatedAt) {
          const food: CustomFoodItem = {
            id: rf.id,
            name: rf.name,
            nameEn: "",
            aliases: [],
            category: rf.category,
            per100g: {
              kcal: rf.kcal,
              protein: rf.protein,
              carbs: rf.carbs,
              fat: rf.fat,
            },
            servings: Array.isArray(rf.servings) ? rf.servings : [],
            createdAt: rf.created_at,
            updatedAt: rf.updated_at,
          };
          localFoodMap.set(rf.id, food);
        }
      }

      const mergedFoods = Array.from(localFoodMap.values());
      setScopedItem("trainq_custom_foods_v1", JSON.stringify(mergedFoods), uid);
    }

    setLastSync(now);
  } catch {
    // Sync failure is non-fatal
  }
}
