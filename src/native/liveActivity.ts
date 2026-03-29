import { Capacitor } from "@capacitor/core";
import { LiveActivity } from "capacitor-live-activity";

export type LiveActivityPayload = {
  exerciseName: string;
  setInfo: string;       // "Satz 2 von 4"
  setDetail: string;     // "80 kg × 8 Wdh"
  completedSets: number;
  totalSetsCount: number;
  restEndsAt: number;    // unix timestamp (seconds), 0 = no rest
  progress: number;      // 0.0–1.0
};

const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
const ACTIVITY_LOGICAL_ID = "TRAINQ_LIVE_WORKOUT";

// Module-level flag — set BEFORE the async call to prevent concurrent starts.
let activityStarted = false;

function buildContentState(payload: LiveActivityPayload): Record<string, string> {
  return {
    exerciseName: payload.exerciseName,
    setInfo: payload.setInfo,
    setDetail: payload.setDetail,
    completedSets: String(payload.completedSets),
    totalSetsCount: String(payload.totalSetsCount),
    restEndsAt: String(payload.restEndsAt),
    progress: String(payload.progress),
  };
}

/**
 * Called ONCE at the start of training.
 * Always ends any stale activity first, then starts a fresh one.
 * This guarantees the widget appears immediately on the lock screen.
 */
export async function startFreshLiveActivity(payload: LiveActivityPayload): Promise<void> {
  if (!isNativeIOS) return;

  // End any stale activity from a previous session (silently ignore errors)
  try {
    await LiveActivity.endActivity({
      id: ACTIVITY_LOGICAL_ID,
      contentState: buildContentState(payload) as any,
      dismissalDate: 0, // dismiss immediately
    });
  } catch { /* no activity to end — that's fine */ }

  activityStarted = false; // reset after end

  // Small delay to let iOS process the end before starting fresh
  await new Promise((r) => setTimeout(r, 100));

  try {
    activityStarted = true; // set before await to block concurrent calls
    await LiveActivity.startActivity({
      id: ACTIVITY_LOGICAL_ID,
      attributes: { customId: ACTIVITY_LOGICAL_ID },
      contentState: buildContentState(payload) as any,
    });
  } catch (error) {
    activityStarted = false;
    if (import.meta.env.DEV) console.error("[LiveActivity] startFreshLiveActivity failed:", error);
  }
}

/**
 * Called periodically during training to update the widget content.
 */
export async function setLiveTrainingState(payload: LiveActivityPayload): Promise<void> {
  if (!isNativeIOS) return;

  try {
    if (activityStarted) {
      // Fast path: just update
      await LiveActivity.updateActivity({
        id: ACTIVITY_LOGICAL_ID,
        contentState: buildContentState(payload) as any,
      });
      return;
    }

    // Fallback: activity wasn't started via startFreshLiveActivity (e.g. resumed session)
    let isRunning = false;
    try {
      const status = await LiveActivity.isRunning({ id: ACTIVITY_LOGICAL_ID });
      isRunning = status.value;
    } catch { /* ignore */ }

    activityStarted = true; // set before await

    if (isRunning) {
      await LiveActivity.updateActivity({
        id: ACTIVITY_LOGICAL_ID,
        contentState: buildContentState(payload) as any,
      });
    } else {
      await LiveActivity.startActivity({
        id: ACTIVITY_LOGICAL_ID,
        attributes: { customId: ACTIVITY_LOGICAL_ID },
        contentState: buildContentState(payload) as any,
      });
    }
  } catch (error) {
    activityStarted = false; // reset so next call can retry
    if (import.meta.env.DEV) console.error("[LiveActivity] setLiveTrainingState failed:", error);
  }
}

/**
 * Called when training ends (complete or abort).
 * Always attempts to end — does NOT rely on activityStarted flag,
 * which may have been reset to false by error handling mid-session.
 */
export async function clearLiveTrainingState(): Promise<void> {
  if (!isNativeIOS) return;

  activityStarted = false; // reset immediately regardless

  try {
    await LiveActivity.endActivity({
      id: ACTIVITY_LOGICAL_ID,
      contentState: {
        exerciseName: "Training beendet",
        setInfo: "Gut gemacht!",
        setDetail: "",
        completedSets: "0",
        totalSetsCount: "0",
        restEndsAt: "0",
        progress: "1.0",
      } as any,
      dismissalDate: Math.floor(Date.now() / 1000) + 2,
    });
  } catch {
    // Activity may not exist (e.g. first session, or already ended) — that's fine
  }
}
