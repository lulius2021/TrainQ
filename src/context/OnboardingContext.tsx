// src/context/OnboardingContext.tsx
//
// ✅ Single Source of Truth: trainq_onboarding_data_v1
// ✅ Defensive Normalize + Patch-Merge
// ✅ Global Change Event: trainq:onboarding_changed
// ✅ Export: readOnboardingDataFromStorage / writeOnboardingDataToStorage / resetOnboardingInStorage / getDefaultOnboardingData
//
// IMPORTANT FIX:
// - Verhindert Event/Sync-Feedback-Loop innerhalb derselben Session (emit -> sync -> setData -> persist -> emit ...)

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { OnboardingData } from "../types/onboarding";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";

const STORAGE_KEY_ONBOARDING_DATA = "trainq_onboarding_data_v1";
const ONBOARDING_CHANGED_EVENT = "trainq:onboarding_changed";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeStringify(v: unknown): string | null {
  try {
    return JSON.stringify(v);
  } catch {
    return null;
  }
}

function emitOnboardingChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(ONBOARDING_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function getDefaultOnboardingData(): OnboardingData {
  return {
    personal: {
      stressLevel: 5,
      sleepHours: 7,
      age: null,
      height: null,
      weight: null,
      fitnessLevel: 3,
      persona: undefined,
    },
    goals: {
      selectedGoals: [],
      sports: [],
      loseWeightTargetKg: undefined,
      buildMuscleBodyShape: "none",
      fitterTargetDistanceKm: undefined,
    },
    training: {
      hoursPerWeek: null,
      sessionsPerWeek: null,
      locations: [],
      timeBudget: undefined,
    },
    obstacles: {
      reasons: [],
    },
    profile: {
      username: "",
      bio: "", // ✅ Profil-Bio persistent
      profileImageUrl: undefined,
      stravaUrl: undefined,
      isPublic: true,
    },
    isCompleted: false,
  };
}

function normalizeOnboardingData(input: Partial<OnboardingData>): OnboardingData {
  const base = getDefaultOnboardingData();

  const merged: OnboardingData = {
    ...base,
    ...input,
    personal: { ...base.personal, ...(input.personal ?? {}) },
    goals: { ...base.goals, ...(input.goals ?? {}) },
    training: { ...base.training, ...(input.training ?? {}) },
    obstacles: { ...base.obstacles, ...(input.obstacles ?? {}) },
    profile: { ...base.profile, ...(input.profile ?? {}) },
    isCompleted: typeof input.isCompleted === "boolean" ? input.isCompleted : base.isCompleted,
  };

  // defensive arrays
  merged.goals.selectedGoals = Array.isArray(merged.goals.selectedGoals) ? merged.goals.selectedGoals : [];
  merged.goals.sports = Array.isArray(merged.goals.sports) ? merged.goals.sports : [];
  merged.training.locations = Array.isArray(merged.training.locations) ? merged.training.locations : [];
  merged.obstacles.reasons = Array.isArray(merged.obstacles.reasons) ? merged.obstacles.reasons : [];

  // numeric guards
  if (typeof merged.personal.stressLevel !== "number") merged.personal.stressLevel = base.personal.stressLevel;
  if (typeof merged.personal.sleepHours !== "number") merged.personal.sleepHours = base.personal.sleepHours;
  if (typeof merged.personal.fitnessLevel !== "number") merged.personal.fitnessLevel = base.personal.fitnessLevel;

  // string guards (defensive)
  if (typeof merged.profile.username !== "string") merged.profile.username = base.profile.username;
  if (typeof (merged.profile as any).bio !== "string") (merged.profile as any).bio = (base.profile as any).bio;
  if (merged.training.timeBudget && typeof merged.training.timeBudget !== "string") merged.training.timeBudget = undefined;

  return merged;
}

export function readOnboardingDataFromStorage(): OnboardingData {
  if (typeof window === "undefined") return getDefaultOnboardingData();
  const raw = getScopedItem(STORAGE_KEY_ONBOARDING_DATA);
  const parsed = safeParse<Partial<OnboardingData>>(raw, {});
  return normalizeOnboardingData(parsed);
}

export function writeOnboardingDataToStorage(data: OnboardingData): void {
  if (typeof window === "undefined") return;

  const raw = safeStringify(data);
  if (!raw) return;

  try {
    // ✅ No-op wenn identisch (verhindert Event/Sync-Schleifen)
    const currentRaw = getScopedItem(STORAGE_KEY_ONBOARDING_DATA);
    if (currentRaw === raw) return;

    setScopedItem(STORAGE_KEY_ONBOARDING_DATA, raw);
  } catch {
    return;
  }

  // ✅ sofortiges Update innerhalb derselben Session/Tab
  emitOnboardingChanged();
}

export function resetOnboardingInStorage(): void {
  writeOnboardingDataToStorage(getDefaultOnboardingData());
}

// -------------------- Context --------------------

// Helper type for deep partial updates
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

type OnboardingContextValue = {
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  updateData: (patch: DeepPartial<OnboardingData>) => void;
  reset: () => void;

  // ✅ klarer Completion-Pfad (wird von Step5Profile/OnboardingPage genutzt)
  complete: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<OnboardingData>(() => readOnboardingDataFromStorage());

  // ✅ persist + broadcast
  useEffect(() => {
    writeOnboardingDataToStorage(data);
  }, [data]);

  // ✅ Sync, wenn andere Teile der App (z.B. Settings/Profile) in den Storage schreiben
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => {
      const raw = getScopedItem(STORAGE_KEY_ONBOARDING_DATA);
      if (!raw) return;

      setData((prev) => {
        const prevRaw = safeStringify(prev);
        if (prevRaw === raw) return prev;

        const parsed = safeParse<Partial<OnboardingData>>(raw, {});
        return normalizeOnboardingData(parsed);
      });
    };

    window.addEventListener(ONBOARDING_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(ONBOARDING_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const updateData = (patch: DeepPartial<OnboardingData>) => {
    setData((prev) =>
      normalizeOnboardingData({
        ...prev,
        ...patch,
        personal: { ...(prev.personal ?? {}), ...(patch.personal ?? {}) } as any,
        goals: { ...(prev.goals ?? {}), ...(patch.goals ?? {}) } as any,
        training: { ...(prev.training ?? {}), ...(patch.training ?? {}) } as any,
        obstacles: { ...(prev.obstacles ?? {}), ...(patch.obstacles ?? {}) } as any,
        profile: { ...(prev.profile ?? {}), ...(patch.profile ?? {}) } as any,
      })
    );
  };

  const complete = () => {
    setData((prev) => {
      if (prev.isCompleted === true) return prev;
      return normalizeOnboardingData({ ...prev, isCompleted: true });
    });
  };

  // ✅ Reset muss Storage + Event bedienen, damit AuthGate sofort umschaltet
  const reset = () => {
    const next = getDefaultOnboardingData();
    setData(next); // triggert persist via useEffect
    // Zusätzlich sofort broadcasten (falls UI vor persist reagieren soll)
    // (writeOnboardingDataToStorage wird ohnehin im nächsten Tick durch useEffect laufen)
    try {
      const raw = safeStringify(next);
      if (raw && typeof window !== "undefined") {
        const cur = getScopedItem(STORAGE_KEY_ONBOARDING_DATA);
        if (cur !== raw) setScopedItem(STORAGE_KEY_ONBOARDING_DATA, raw);
      }
    } catch {
      // ignore
    }
    emitOnboardingChanged();
  };

  const value = useMemo<OnboardingContextValue>(() => ({ data, setData, updateData, reset, complete }), [data]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};
