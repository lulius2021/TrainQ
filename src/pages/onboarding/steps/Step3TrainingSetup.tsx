// src/pages/onboarding/steps/Step3TrainingSetup.tsx
import React, { useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper";
import { useOnboarding } from "../../../context/OnboardingContext";
import type { TrainingLocation } from "../../../types/onboarding";

interface Step3TrainingSetupProps {
  onNext: () => void;
  onBack: () => void;
}

const LOCATION_OPTIONS: { id: TrainingLocation; label: string }[] = [
  { id: "treadmill", label: "Laufband" },
  { id: "gym", label: "Gym" },
  { id: "outdoor_park", label: "Outdoor Fitnesspark" },
  { id: "no_gym", label: "Kein Gym" },
  { id: "no_equipment", label: "Kein Equipment" },
];

export const Step3TrainingSetup: React.FC<Step3TrainingSetupProps> = ({
  onNext,
  onBack,
}) => {
  const { data, updateData } = useOnboarding();
  const [training, setTraining] = useState(data.training);

  const toggleLocation = (loc: TrainingLocation) => {
    setTraining((prev) => {
      const exists = prev.locations.includes(loc);
      const locations = exists
        ? prev.locations.filter((l) => l !== loc)
        : [...prev.locations, loc];
      return { ...prev, locations };
    });
  };

  const handleNext = () => {
    updateData({ training });
    onNext();
  };

  return (
    <StepWrapper
      title="Wie möchtest du trainieren?"
      subtitle="Wir richten deine Pläne nach deiner verfügbaren Zeit und deinen Trainingsorten aus."
      onNext={handleNext}
      onBack={onBack}
      isNextDisabled={
        !training.hoursPerWeek ||
        !training.sessionsPerWeek ||
        training.locations.length === 0
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">
              Wie viele Stunden willst du pro Woche trainieren?
            </label>
            <input
              type="number"
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-2 py-2 text-sm"
              placeholder="z. B. 4"
              value={training.hoursPerWeek ?? ""}
              onChange={(e) =>
                setTraining((prev) => ({
                  ...prev,
                  hoursPerWeek:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">
              Wie oft willst du pro Woche trainieren?
            </label>
            <input
              type="number"
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-2 py-2 text-sm"
              placeholder="z. B. 3"
              value={training.sessionsPerWeek ?? ""}
              onChange={(e) =>
                setTraining((prev) => ({
                  ...prev,
                  sessionsPerWeek:
                    e.target.value === "" ? null : Number(e.target.value),
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            Wo kannst du überall trainieren?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {LOCATION_OPTIONS.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => toggleLocation(loc.id)}
                className={`text-xs px-3 py-2 rounded-xl border text-left ${
                  training.locations.includes(loc.id)
                    ? "border-blue-500 bg-blue-600/20"
                    : "border-gray-700 bg-[#05060A]"
                }`}
              >
                {loc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};
