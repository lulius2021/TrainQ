// src/pages/onboarding/steps/Step4Obstacles.tsx
import React, { useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper";
import { useOnboarding } from "../../../context/OnboardingContext";

interface Step4ObstaclesProps {
  onNext: () => void;
  onBack: () => void;
}

const REASONS = [
  "Keine passende App",
  "Keine Zeit",
  "Kein Fortschritt gesehen",
  "Auf dem Weg, aber will etwas ändern",
];

export const Step4Obstacles: React.FC<Step4ObstaclesProps> = ({
  onNext,
  onBack,
}) => {
  const { data, updateData } = useOnboarding();
  const [reasons, setReasons] = useState<string[]>(data.obstacles.reasons);

  const toggleReason = (reason: string) => {
    setReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const handleNext = () => {
    updateData({ obstacles: { reasons } });
    onNext();
  };

  return (
    <StepWrapper
      title="Warum hat es bisher noch nicht geklappt?"
      subtitle="Damit ARVIO dir wirklich hilft, wollen wir verstehen, wo es bisher gehakt hat."
      onNext={handleNext}
      onBack={onBack}
      isNextDisabled={reasons.length === 0}
    >
      <div className="space-y-3">
        {REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            onClick={() => toggleReason(reason)}
            className={`w-full text-left text-sm px-3 py-2 rounded-xl border ${
              reasons.includes(reason)
                ? "border-blue-500 bg-blue-600/20"
                : "border-gray-700 bg-[#05060A]"
            }`}
          >
            {reason}
          </button>
        ))}
      </div>
    </StepWrapper>
  );
};
