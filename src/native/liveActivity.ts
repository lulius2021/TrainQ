import { Capacitor, registerPlugin } from "@capacitor/core";

export type LiveActivityPayload = {
  workoutId: string;
  badge: string;
  title: string;
  subtitle: string;
  primaryLine: string;
  avatarLetter: string;
  deepLink?: string;
  updatedAt: number;
};

type TrainQLiveActivityPlugin = {
  setLiveTrainingState(payload: LiveActivityPayload): Promise<void>;
  clearLiveTrainingState(): Promise<void>;
  refresh(): Promise<void>;
  debugStart(): Promise<{ ok?: boolean; id?: string; error?: string }>;
  debugEnd(): Promise<{ ok?: boolean }>;
};

const LiveActivity = registerPlugin<TrainQLiveActivityPlugin>("TrainQLiveActivity");

const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

export async function setLiveTrainingState(payload: LiveActivityPayload): Promise<void> {
  if (!isNativeIOS) return;
  try {
    await LiveActivity.setLiveTrainingState(payload);
  } catch {
    return;
  }
}

export async function clearLiveTrainingState(): Promise<void> {
  if (!isNativeIOS) return;
  try {
    await LiveActivity.clearLiveTrainingState();
  } catch {
    return;
  }
}

export async function refreshLiveActivity(): Promise<void> {
  if (!isNativeIOS) return;
  try {
    await LiveActivity.refresh();
  } catch {
    return;
  }
}

export async function debugStartLiveActivity(): Promise<{ ok?: boolean; id?: string; error?: string } | undefined> {
  if (!isNativeIOS) return;
  try {
    return await LiveActivity.debugStart();
  } catch {
    return;
  }
}

export async function debugEndLiveActivity(): Promise<{ ok?: boolean } | undefined> {
  if (!isNativeIOS) return;
  try {
    return await LiveActivity.debugEnd();
  } catch {
    return;
  }
}
