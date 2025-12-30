// src/pages/onboarding/steps/Step4Obstacles.tsx
import React, { useMemo, useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper.tsx";
import { useOnboarding } from "../../../context/OnboardingContext.tsx";

interface Step4ObstaclesProps {
  onNext: () => void;
  onBack: () => void;
}

const REASONS = [
  "Keine passende App",
  "Keine Zeit",
  "Kein Fortschritt gesehen",
  "Auf dem Weg, aber will etwas ändern",
] as const;

function normalizeReasons(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  // trim + dedupe + limit
  const cleaned = input
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  return Array.from(new Set(cleaned)).slice(0, 12);
}

export const Step4Obstacles: React.FC<Step4ObstaclesProps> = ({ onNext, onBack }) => {
  const { data, updateData } = useOnboarding();

  const initialReasons = useMemo<string[]>(
    () => normalizeReasons(data?.obstacles?.reasons),
    [data?.obstacles?.reasons]
  );

  const [reasons, setReasons] = useState<string[]>(initialReasons);

  const toggleReason = (reason: string) => {
    const r = String(reason ?? "").trim();
    if (!r) return;

    setReasons((prev) => {
      const next = prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r];
      return normalizeReasons(next);
    });
  };

  const handleNext = () => {
    updateData({ obstacles: { reasons: normalizeReasons(reasons) } });
    onNext();
  };

  return (
    <StepWrapper
      title="Warum hat es bisher noch nicht geklappt?"
      subtitle="Damit TrainQ dir wirklich hilft, wollen wir verstehen, wo es bisher gehakt hat."
      onNext={handleNext}
      onBack={onBack}
      isNextDisabled={normalizeReasons(reasons).length === 0}
    >
      <div className="space-y-3">
        {REASONS.map((reason) => {
          const active = reasons.includes(reason);
          return (
            <button
              key={reason}
              type="button"
              onClick={() => toggleReason(reason)}
              className={`w-full text-left text-sm px-3 py-2 rounded-xl border ${
                active ? "border-blue-500 bg-blue-600/20" : "border-gray-700 bg-[#05060A]"
              }`}
            >
              {reason}
            </button>
          );
        })}
      </div>
    </StepWrapper>
  );
};