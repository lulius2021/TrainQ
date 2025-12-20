// src/context/OnboardingContext.tsx
import React, { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { OnboardingData } from "../types/onboarding";

interface OnboardingContextValue {
  data: OnboardingData;
  updateData: (partial: Partial<OnboardingData>) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

const getDefaultData = (): OnboardingData => ({
  personal: {
    stressLevel: 5,
    sleepHours: 7,
    age: null,
    height: null,
    weight: null,
  },
  goals: {
    selectedGoals: [],
    sports: [],
  },
  training: {
    hoursPerWeek: null,
    sessionsPerWeek: null,
    locations: [],
  },
  obstacles: {
    reasons: [],
  },
  profile: {
    username: "",
    profileImageUrl: "",
    stravaUrl: "",
    isPublic: true,
  },
  isCompleted: false,
});

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [data, setData] = useState<OnboardingData>(getDefaultData);

  const updateData = (partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  };

  const reset = () => setData(getDefaultData());

  return (
    <OnboardingContext.Provider value={{ data, updateData, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextValue => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
};
