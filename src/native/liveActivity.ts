import { Capacitor } from "@capacitor/core";
import { LiveActivity } from "capacitor-live-activity";

export type LiveActivityPayload = {
  exerciseName: string;
  setInfo: string;
  nextSet: string;
  progress: number; // 0.0 to 1.0
};

const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

const ACTIVITY_LOGICAL_ID = "TRAINQ_LIVE_WORKOUT";

export async function setLiveTrainingState(payload: LiveActivityPayload): Promise<void> {
  if (!isNativeIOS) return;

  try {
    // Check if running first
    let isRuns = false;
    try {
      const status = await LiveActivity.isRunning({ id: ACTIVITY_LOGICAL_ID });
      isRuns = status.value;
    } catch {
      // ignore
    }

    const contentState = {
      exerciseName: payload.exerciseName,
      setInfo: payload.setInfo,
      nextSet: payload.nextSet,
      progress: payload.progress,
    };

    if (isRuns) {
      await LiveActivity.updateActivity({
        id: ACTIVITY_LOGICAL_ID,
        contentState: contentState as any,
      });
    } else {
      await LiveActivity.startActivity({
        id: ACTIVITY_LOGICAL_ID,
        attributes: {
          customId: ACTIVITY_LOGICAL_ID // Example static attribute
        },
        contentState: contentState as any,
      });
    }
  } catch (error) {
  }
}

export async function clearLiveTrainingState(): Promise<void> {
  if (!isNativeIOS) return;
  try {
    await LiveActivity.endActivity({
      id: ACTIVITY_LOGICAL_ID,
      contentState: {
        exerciseName: "Training beendet",
        setInfo: "Gut gemacht!",
        nextSet: "",
        progress: 1.0,
      } as any,
      dismissalDate: Math.floor(Date.now() / 1000) + 2, // Dismiss after 2s
    });
  } catch (error) {
  }
}
