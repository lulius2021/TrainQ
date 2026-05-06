// src/utils/scopedStorage.ts
import { getActiveUserId, userScopedKey } from "./session";

function warnNoUser(baseKey: string) {
  if (!import.meta.env.DEV) return;
  if (typeof console === "undefined") return;
  console.warn(`[scopedStorage] No active user for key "${baseKey}". Using unscoped key.`);
}

export function scopedKey(baseKey: string, userId?: string | null): string {
  const key = userScopedKey(baseKey, userId);
  if (!userId && key === baseKey) warnNoUser(baseKey);
  return key;
}

export function getScopedItem(baseKey: string, userId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(scopedKey(baseKey, userId));
}

export function setScopedItem(baseKey: string, value: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(baseKey, userId), value);
}

export function removeScopedItem(baseKey: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(scopedKey(baseKey, userId));
}

export function migrateLegacyKey(baseKey: string, userId?: string | null): void {
  if (typeof window === "undefined") return;
  const uid = userId ?? getActiveUserId();
  if (!uid) return;

  const scoped = scopedKey(baseKey, uid);
  const existingScoped = window.localStorage.getItem(scoped);
  const legacy = window.localStorage.getItem(baseKey);
  if (existingScoped == null && legacy != null) {
    window.localStorage.setItem(scoped, legacy);
    window.localStorage.removeItem(baseKey);
  }
}

export function migrateUserStorage(userId: string): void {
  const keys = [
    "trainq_calendar_events",
    "trainq_calendar_view",
    "trainq_calendar_categories_v1",
    "trainq_plan_shift_usage_v1",
    "trainq_weekly_plan_templates",
    "trainq_routine_plan_templates",
    "trainq_workout_templates_v1",
    "trainq_plan_start_date_iso",
    "trainq_deload_v1",
    "trainq_deload_dismissed_until_v1",
    "trainq_deload_last_start_v1",
    "trainq_deload_last_interval_weeks_v1",
    "trainq_last_import_template_id_v1",
    "trainq_workout_history_v1",
    "trainq_live_training_seed_v1",
    "trainq_live_training_seeds_by_event_v1",
    "trainq_live_training_seeds_by_key_v1",
    "trainq_live_seed_global_v1",
    "trainq_live_seed_by_event_v1",
    "trainq.core.plans.v1",
    "trainq.core.calendarWorkouts.v1",
    "trainq.core.workoutHistory.v1",
    "trainq.core.activeLiveWorkout.v1",
    "trainq.core.meta",
    "trainq_active_live_workout_v1",
    "trainq_training_history_store_v1",
    "trainq_onboarding_data_v1",
    "trainq_theme_v1",
    "trainq_language",
    "trainq_units",
    "trainq_platecalc_available_v1",
    "trainq_platecalc_bar_v1",
    "trainq_custom_exercises_v1",
    "trainq_exercise_alias_overrides_v1",
  ];

  keys.forEach((k) => migrateLegacyKey(k, userId));
}

export function clearUserScopedData(userId: string): void {
  // IDB-backed stores need their own cleanup paths. Imported lazily to avoid
  // pulling IDB code into modules that don't use it and to dodge module-init
  // order issues.
  //
  // For exerciseImageStore: keys are prefixed with userId, so a prefix scan
  // works directly (clearExerciseImagesForUser).
  //
  // For workoutImageStore: images are keyed by workout-id, not user. We must
  // first read the user's workout history to know which IDs to delete BEFORE
  // we clear the localStorage entry below.
  let workoutIdsForUser: string[] = [];
  try {
    const raw = getScopedItem("trainq_workout_history_v1", userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        workoutIdsForUser = parsed
          .map((w: any) => (typeof w?.id === "string" ? w.id.trim() : ""))
          .filter(Boolean);
      }
    }
  } catch {
    // ignore — best-effort
  }

  void import("./exerciseImageStore")
    .then((m) => m.clearExerciseImagesForUser(userId))
    .catch(() => {});

  if (workoutIdsForUser.length > 0) {
    void import("./workoutImageStore").then((m) => {
      for (const id of workoutIdsForUser) {
        void m.deleteWorkoutImage(id);
      }
    }).catch(() => {});
  }

  const keys = [
    "trainq_calendar_events",
    "trainq_calendar_view",
    "trainq_calendar_categories_v1",
    "trainq_plan_shift_usage_v1",
    "trainq_weekly_plan_templates",
    "trainq_routine_plan_templates",
    "trainq_workout_templates_v1",
    "trainq_plan_start_date_iso",
    "trainq_deload_v1",
    "trainq_deload_dismissed_until_v1",
    "trainq_deload_last_start_v1",
    "trainq_deload_last_interval_weeks_v1",
    "trainq_last_import_template_id_v1",
    "trainq_workout_history_v1",
    "trainq_live_training_seed_v1",
    "trainq_live_training_seeds_by_event_v1",
    "trainq_live_training_seeds_by_key_v1",
    "trainq_live_seed_global_v1",
    "trainq_live_seed_by_event_v1",
    "trainq.core.plans.v1",
    "trainq.core.calendarWorkouts.v1",
    "trainq.core.workoutHistory.v1",
    "trainq.core.activeLiveWorkout.v1",
    "trainq.core.meta",
    "trainq_active_live_workout_v1",
    "trainq_training_history_store_v1",
    "trainq_onboarding_data_v1",
    "trainq_theme_v1",
    "trainq_language",
    "trainq_units",
    "trainq_platecalc_available_v1",
    "trainq_platecalc_bar_v1",
    "trainq_custom_exercises_v1",
    "trainq_exercise_alias_overrides_v1",
  ];

  keys.forEach((k) => removeScopedItem(k, userId));
}
