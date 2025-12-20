// src/pages/onboarding/steps/Step1Personal.tsx
import React, { useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper";
import { useOnboarding } from "../../../context/OnboardingContext";

interface Step1PersonalProps {
  onNext: () => void;
}

export const Step1Personal: React.FC<Step1PersonalProps> = ({ onNext }) => {
  const { data, updateData } = useOnboarding();
  const [local, setLocal] = useState(data.personal);

  const handleChangeNumber = (field: keyof typeof local, value: string) => {
    const num = value === "" ? null : Number(value);
    setLocal((prev) => ({ ...prev, [field]: num }));
  };

  const handleNext = () => {
    updateData({ personal: local });
    onNext();
  };

  return (
    <StepWrapper
      title="Willkommen bei ARVIO 👋"
      subtitle="Lass uns mit ein paar persönlichen Infos starten, damit wir dein Training perfekt auf dich anpassen können."
      onNext={handleNext}
      showBack={false}
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-300">
            Wie gestresst fühlst du dich aktuell? (1 = entspannt, 10 = sehr gestresst)
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={local.stressLevel}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                stressLevel: Number(e.target.value),
              }))
            }
            className="w-full"
          />
          <div className="text-xs text-gray-400 mt-1">
            Stress-Level: {local.stressLevel}/10
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-300">
            Wie viele Stunden schläfst du durchschnittlich pro Nacht?
          </label>
          <input
            type="range"
            min={0}
            max={12}
            value={local.sleepHours}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                sleepHours: Number(e.target.value),
              }))
            }
            className="w-full"
          />
          <div className="text-xs text-gray-400 mt-1">
            Schlaf: {local.sleepHours} Stunden
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-400">Alter</label>
            <input
              type="number"
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-2 py-1 text-sm"
              placeholder="Jahre"
              value={local.age ?? ""}
              onChange={(e) => handleChangeNumber("age", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Größe (cm)</label>
            <input
              type="number"
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-2 py-1 text-sm"
              placeholder="cm"
              value={local.height ?? ""}
              onChange={(e) => handleChangeNumber("height", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Gewicht (kg)</label>
            <input
              type="number"
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-2 py-1 text-sm"
              placeholder="kg"
              value={local.weight ?? ""}
              onChange={(e) => handleChangeNumber("weight", e.target.value)}
            />
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};
