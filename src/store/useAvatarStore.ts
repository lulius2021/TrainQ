// src/store/useAvatarStore.ts
// Persistence + React hook for avatar state via scopedStorage.

import { useCallback, useEffect, useState } from "react";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { loadWorkoutHistory, type WorkoutHistoryEntry } from "../utils/workoutHistory";
import {
  type AvatarState,
  computeRawXp,
  computeVariant,
  defaultAvatarState,
  grantXp,
} from "../utils/avatarProgression";

const STORAGE_KEY = "trainq_avatar_v1";
const EVENT_NAME = "trainq:avatarUpdated";

/* ─── Persistence ─── */

export function loadAvatarState(): AvatarState {
  try {
    const raw = getScopedItem(STORAGE_KEY);
    if (!raw) return defaultAvatarState();
    const parsed = JSON.parse(raw);
    return { ...defaultAvatarState(), ...parsed };
  } catch {
    return defaultAvatarState();
  }
}

function saveAvatarState(state: AvatarState): void {
  setScopedItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/* ─── Actions ─── */

export function grantWorkoutXp(
  entry: WorkoutHistoryEntry,
): { granted: number; stageUp: { stage: number; variant: "bulk" | "speed" } | null } {
  let state = loadAvatarState();

  // Dedup: skip if we already granted XP for this workout
  if (entry.id && state.lastWorkoutId === entry.id) {
    return { granted: 0, stageUp: null };
  }

  const rawXp = computeRawXp(entry);
  const now = new Date();
  const result = grantXp(state, rawXp, now);

  // Update variant from recent history
  const history = loadWorkoutHistory();
  const variant = computeVariant(history);

  const newState: AvatarState = {
    ...result.newState,
    variant,
    lastWorkoutId: entry.id,
  };

  // Update stageUp variant if there was a stage-up
  const stageUp = result.stageUp ? { ...result.stageUp, variant } : null;

  saveAvatarState(newState);

  return { granted: result.granted, stageUp };
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
