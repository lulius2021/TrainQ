// src/store/useAvatarStore.ts
// Persistence + React hook for the body-composition avatar state.

import { useCallback, useEffect, useState } from "react";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import {
  type AvatarState,
  type WorkoutInput,
  type ApplyWorkoutResult,
  defaultAvatarState,
  applyWorkout,
  applyDailyAtrophy,
} from "../utils/avatarProgression";

const STORAGE_KEY = "trainq_avatar_v2";
const EVENT_NAME = "trainq:avatarUpdated";

function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/* ─── Persistence ─── */

export function loadAvatarState(): AvatarState {
  try {
    const raw = getScopedItem(STORAGE_KEY);
    if (!raw) return defaultAvatarState();
    const parsed = JSON.parse(raw) as Partial<AvatarState>;
    const def = defaultAvatarState();
    // Merge so new body-part keys are always present
    return {
      ...def,
      ...parsed,
      bodyParts: { ...def.bodyParts, ...(parsed.bodyParts ?? {}) },
      activityLog: parsed.activityLog ?? [],
    };
  } catch {
    return defaultAvatarState();
  }
}

function saveAvatarState(state: AvatarState): void {
  setScopedItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/* ─── Actions ─── */

/**
 * Apply a completed workout to the avatar state.
 * Returns gained body parts and any milestone triggered.
 */
export function grantWorkoutXp(
  workout: WorkoutInput,
): { granted: number; stageUp: { stage: number; variant: "bulk" | "speed" } | null } {
  const state = loadAvatarState();
  const today = todayISO();

  const result: ApplyWorkoutResult = applyWorkout(state, workout, today);

  if (result.gainedParts && Object.keys(result.gainedParts).length === 0) {
    // Dedup — already processed this workout
    return { granted: 0, stageUp: null };
  }

  saveAvatarState(result.newState);

  // Map milestone to legacy stageUp interface (for AvatarStageUpModal compatibility)
  const stageUp = result.milestone
    ? {
        stage: result.milestone.newLevel,
        variant: "bulk" as const,
        bodyPart: result.milestone.bodyPart,
      }
    : null;

  const totalGained = Object.values(result.gainedParts).reduce((s, v) => s + v, 0);
  return { granted: Math.round(totalGained), stageUp };
}

/** Trigger daily atrophy recalculation (call on app resume). */
export function refreshAtrophy(): void {
  const state = loadAvatarState();
  const updated = applyDailyAtrophy(state, todayISO());
  saveAvatarState(updated);
}

/* ─── React Hook ─── */

export function useAvatarState(): AvatarState {
  const [state, setState] = useState<AvatarState>(loadAvatarState);

  const refresh = useCallback(() => {
    setState(loadAvatarState());
  }, []);

  useEffect(() => {
    window.addEventListener(EVENT_NAME, refresh);
    return () => window.removeEventListener(EVENT_NAME, refresh);
  }, [refresh]);

  return state;
}
