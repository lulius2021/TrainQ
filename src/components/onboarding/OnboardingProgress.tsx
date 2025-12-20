// src/components/onboarding/OnboardingProgress.tsx
import React from "react";

interface OnboardingProgressProps {
  currentStep: number; // 1-basiert
  totalSteps: number;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  totalSteps,
}) => {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full max-w-md mx-auto mb-4">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Schritt {currentStep} von {totalSteps}</span>
      </div>
      <div className="h-2 bg-[#111827] rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
