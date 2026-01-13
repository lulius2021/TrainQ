// src/components/onboarding/OnboardingProgress.tsx
import React from "react";
import { useI18n } from "../../i18n/useI18n";

interface OnboardingProgressProps {
  currentStep: number; // 1-basiert
  totalSteps: number;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  totalSteps,
}) => {
  const { t } = useI18n();
  const safeTotal = Math.max(1, Number.isFinite(totalSteps) ? totalSteps : 1);
  const safeCurrent = Math.min(
    safeTotal,
    Math.max(1, Number.isFinite(currentStep) ? currentStep : 1)
  );

  const percentage = (safeCurrent / safeTotal) * 100;

  return (
    <div className="w-full max-w-md mx-auto mb-4">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{t("onboarding.progress", { current: safeCurrent, total: safeTotal })}</span>
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
