// src/services/settingsSync.ts
// Offline-first sync for user settings, preferences, deload data, and training seeds.
// Pattern: fire-and-forget push + pull-and-merge on login.

import { getSupabaseClient } from "../lib/supabaseClient";
import { getActiveUserId } from "../utils/session";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";

function getUserId(): string | null { return getActiveUserId(); }
function isLocalUser(): boolean { const uid = getUserId(); return !uid || uid.startsWith("local_"); }
function getClient() { if (isLocalUser()) return null; return getSupabaseClient(); }

function logSyncError(context: string, err: unknown): void {
  if (import.meta.env.DEV) console.error(`[SettingsSync] ${context}:`, err);
}

function readLocal(key: string, uid: string | null): string | null {
  return getScopedItem(key, uid);
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ==================== PUSH ====================

export async function pushSettings(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();
  if (!uid) return;

  try {
    const row = buildSettingsRow(uid);
    const { error } = await client.from("user_settings").upsert(row, { onConflict: "user_id" });
    if (error) logSyncError("pushSettings", error);
  } catch (err) {
    logSyncError("pushSettings", err);
  }
}

/** Push only a specific field (partial update) */
export async function pushSettingsPartial(fields: Record<string, unknown>): Promise<void> {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();
  if (!uid) return;

  try {
    const { error } = await client
      .from("user_settings")
      .upsert({ user_id: uid, ...fields, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) logSyncError("pushSettingsPartial", error);
  } catch (err) {
    logSyncError("pushSettingsPartial", err);
  }
}

// ==================== PULL ====================

export async function pullAndMergeSettings(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();
  if (!uid) return;

  try {
    const { data, error } = await client
      .from("user_settings")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) { logSyncError("pullSettings", error); return; }
    if (!data) return; // No remote settings yet

    // Merge: remote wins if updated_at is newer, otherwise keep local
    // For settings, remote always wins (single source of truth after login)

    // Theme
    if (data.theme) {
      setScopedItem("trainq_theme_v1", data.theme, uid);
    }

    // Notification prefs
    if (data.notification_prefs && Object.keys(data.notification_prefs).length > 0) {
      localStorage.setItem("trainq_notification_prefs_v1", JSON.stringify(data.notification_prefs));
    }

    // Deload data
    if (data.deload_plan !== null) {
      setScopedItem("trainq_deload_v1", JSON.stringify(data.deload_plan), uid);
    }
    if (data.deload_dismissed_until !== null) {
      setScopedItem("trainq_deload_dismissed_until_v1", data.deload_dismissed_until, uid);
    }
    if (data.deload_last_start !== null) {
      setScopedItem("trainq_deload_last_start_v1", data.deload_last_start, uid);
    }
    if (data.deload_last_interval_weeks !== null) {
      setScopedItem("trainq_deload_last_interval_weeks_v1", String(data.deload_last_interval_weeks), uid);
    }
    if (Array.isArray(data.deload_history) && data.deload_history.length > 0) {
      setScopedItem("trainq_deload_history_v1", JSON.stringify(data.deload_history), uid);
    }
    if (Array.isArray(data.deload_feedback_given) && data.deload_feedback_given.length > 0) {
      setScopedItem("trainq_deload_feedback_given_v1", JSON.stringify(data.deload_feedback_given), uid);
    }

    // Live training seeds
    if (data.live_training_seed !== null) {
      setScopedItem("trainq_live_training_seed_v1", JSON.stringify(data.live_training_seed), uid);
    }
    if (data.live_training_seeds_by_event && Object.keys(data.live_training_seeds_by_event).length > 0) {
      setScopedItem("trainq_live_training_seeds_by_event_v1", JSON.stringify(data.live_training_seeds_by_event), uid);
    }
    if (data.live_training_seeds_by_key && Object.keys(data.live_training_seeds_by_key).length > 0) {
      setScopedItem("trainq_live_training_seeds_by_key_v1", JSON.stringify(data.live_training_seeds_by_key), uid);
    }

    // Exercise alias overrides
    if (data.exercise_alias_overrides && Object.keys(data.exercise_alias_overrides).length > 0) {
      localStorage.setItem("trainq_exercise_alias_overrides_v1", JSON.stringify(data.exercise_alias_overrides));
    }
  } catch (err) {
    logSyncError("pullSettings", err);
  }
}

// ==================== INITIAL PUSH (first login migration) ====================

export async function pushAllLocalSettings(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();
  if (!uid) return;

  try {
    const row = buildSettingsRow(uid);
    // Only push if there's actual data to push
    const hasData = row.theme !== "dark"
      || Object.keys(row.notification_prefs as object).length > 0
      || row.deload_plan !== null
      || row.live_training_seed !== null
      || Object.keys(row.live_training_seeds_by_event as object).length > 0
      || Object.keys(row.exercise_alias_overrides as object).length > 0;

    if (!hasData) return;

    const { error } = await client.from("user_settings").upsert(row, { onConflict: "user_id" });
    if (error) logSyncError("pushAllLocalSettings", error);
  } catch (err) {
    logSyncError("pushAllLocalSettings", err);
  }
}

// ==================== Debounced auto-push ====================
// Call this after any local settings mutation. It debounces to avoid spamming Supabase.

let _pushTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 3000;

export function scheduleSettingsPush(): void {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pushSettings();
  }, DEBOUNCE_MS);
}

// ==================== Helpers ====================

function buildSettingsRow(uid: string): Record<string, unknown> {
  return {
    user_id: uid,
    theme: readLocal("trainq_theme_v1", uid) || "dark",
    notification_prefs: parseJson(localStorage.getItem("trainq_notification_prefs_v1"), {}),
    deload_plan: parseJson(readLocal("trainq_deload_v1", uid), null),
    deload_dismissed_until: readLocal("trainq_deload_dismissed_until_v1", uid) || null,
    deload_last_start: readLocal("trainq_deload_last_start_v1", uid) || null,
    deload_last_interval_weeks: (() => {
      const v = readLocal("trainq_deload_last_interval_weeks_v1", uid);
      return v ? parseInt(v, 10) : null;
    })(),
    deload_history: parseJson(readLocal("trainq_deload_history_v1", uid), []),
    deload_feedback_given: parseJson(readLocal("trainq_deload_feedback_given_v1", uid), []),
    live_training_seed: parseJson(readLocal("trainq_live_training_seed_v1", uid), null),
    live_training_seeds_by_event: parseJson(readLocal("trainq_live_training_seeds_by_event_v1", uid), {}),
    live_training_seeds_by_key: parseJson(readLocal("trainq_live_training_seeds_by_key_v1", uid), {}),
    exercise_alias_overrides: parseJson(localStorage.getItem("trainq_exercise_alias_overrides_v1"), {}),
    updated_at: new Date().toISOString(),
  };
}
