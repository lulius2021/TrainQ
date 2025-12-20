// src/pages/onboarding/steps/Step5Intro.tsx
import React from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper";

interface Step5IntroProps {
  onNext: () => void;
  onBack: () => void;
}

export const Step5Intro: React.FC<Step5IntroProps> = ({ onNext, onBack }) => {
  return (
    <StepWrapper
      title="So funktioniert ARVIO"
      subtitle="Kurzer Überblick, wie die App dir hilft, deinen Alltag, dein Training und deinen Fortschritt im Blick zu behalten."
      onNext={onNext}
      onBack={onBack}
      nextLabel="Weiter"
    >
      <div className="space-y-4 text-sm text-gray-300">
        <div className="bg-[#05060A] rounded-xl p-3 border border-gray-800">
          <p className="font-medium mb-1">Dashboard & Struktur</p>
          <p className="text-xs text-gray-400">
            Behalte deine Trainings, Termine und deine Woche auf einen Blick im Dashboard.
          </p>
          <div className="mt-2 h-28 bg-gray-900 rounded-lg flex items-center justify-center text-xs text-gray-500">
            Platzhalter für kurzes Video / Animation
          </div>
        </div>

        <div className="bg-[#05060A] rounded-xl p-3 border border-gray-800">
          <p className="font-medium mb-1">Trainingspläne & Kalender</p>
          <p className="text-xs text-gray-400">
            Deine Trainingspläne werden automatisch mit deinem Kalender verknüpft.
          </p>
          <div className="mt-2 h-24 bg-gray-900 rounded-lg flex items-center justify-center text-xs text-gray-500">
            Platzhalter für Screenshot / Bild
          </div>
        </div>

        <div className="bg-[#05060A] rounded-xl p-3 border border-gray-800">
          <p className="font-medium mb-1">Statistiken & Fortschritt</p>
          <p className="text-xs text-gray-400">
            Sieh auf einen Blick, wie konsequent du trainierst und wie sich deine Form entwickelt.
          </p>
          <div className="mt-2 h-20 bg-gray-900 rounded-lg flex items-center justify-center text-xs text-gray-500">
            Platzhalter für kleines Diagramm / Bild
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};
