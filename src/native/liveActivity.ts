import { Capacitor } from "@capacitor/core";
import { LiveActivity } from "capacitor-live-activity";
import { FEATURE_FLAGS } from "../config/featureFlags";

export type LiveActivityPayload = {
  exerciseName: string;
  setInfo: string;       // "Satz 2 von 4"
  setDetail: string;     // "80 kg × 8 Wdh"
  completedSets: number;
  totalSetsCount: number;
  restEndsAt: number;    // unix timestamp (seconds), 0 = no rest
  progress: number;      // 0.0–1.0
};

const isNativeIOS = FEATURE_FLAGS.widgets && Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
const ACTIVITY_LOGICAL_ID = "TRAINQ_LIVE_WORKOUT";

let activityStarted = false;
let lastPayload: LiveActivityPayload | null = null;

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

async function ensureActivityStarted(payload: LiveActivityPayload): Promise<void> {
  const contentState = buildContentState(payload);

  // Try update first (faster if already running)
  if (activityStarted) {
    try {
      await LiveActivity.updateActivity({
        id: ACTIVITY_LOGICAL_ID,
        contentState: contentState as any,
      });
      return;
    } catch {
      // Activity might have been killed — fall through to restart
      activityStarted = false;
    }
  }

  // Check if activity is still running
  try {
    const status = await LiveActivity.isRunning({ id: ACTIVITY_LOGICAL_ID });
    if (status.value) {
      activityStarted = true;
      await LiveActivity.updateActivity({
        id: ACTIVITY_LOGICAL_ID,
        contentState: contentState as any,
      });
      return;
    }
  } catch { /* ignore */ }

  // Start fresh
  try {
    activityStarted = true;
    await LiveActivity.startActivity({
      id: ACTIVITY_LOGICAL_ID,
      attributes: { customId: ACTIVITY_LOGICAL_ID },
      contentState: contentState as any,
    });
  } catch (error) {
    activityStarted = false;
    if (import.meta.env.DEV) console.error("[LiveActivity] start failed:", error);
  }
}

/**
 * Called ONCE at the start of training.
 */
export async function startFreshLiveActivity(payload: LiveActivityPayload): Promise<void> {
  if (!isNativeIOS) return;
  lastPayload = payload;

  // End any stale activity
  try {
    await LiveActivity.endActivity({
      id: ACTIVITY_LOGICAL_ID,
      contentState: buildContentState(payload) as any,
      dismissalDate: 0,
    });
  } catch { /* no activity to end */ }

  activityStarted = false;
  await new Promise((r) => setTimeout(r, 150));

  await ensureActivityStarted(payload);
}

/**
 * Called periodically during training to update the widget content.
 * Throttled to 1.5s intervals by the caller.
 */
export async function setLiveTrainingState(payload: LiveActivityPayload): Promise<void> {
  if (!isNativeIOS) return;
  lastPayload = payload;
  await ensureActivityStarted(payload);
}

/**
 * Called when training ends.
 */
export async function clearLiveTrainingState(): Promise<void> {
  if (!isNativeIOS) return;

  activityStarted = false;
  lastPayload = null;

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
      dismissalDate: Math.floor(Date.now() / 1000) + 3,
    });
  } catch { /* ignore */ }
}

/**
 * Re-ensure the activity is alive. Call this when app resumes from background.
 */
export async function refreshLiveActivity(): Promise<void> {
  if (!isNativeIOS || !lastPayload) return;
  await ensureActivityStarted(lastPayload);
}
