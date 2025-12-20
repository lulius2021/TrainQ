// src/pages/onboarding/steps/Step2Goals.tsx
import React, { useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper";
import { useOnboarding } from "../../../context/OnboardingContext";
import type { Goal } from "../../../types/onboarding";

interface Step2GoalsProps {
  onNext: () => void;
  onBack: () => void;
}

const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: "structure", label: "Alltag besser strukturieren" },
  { id: "train_with_plan", label: "Mit Plan trainieren" },
  { id: "lose_weight", label: "Abnehmen" },
  { id: "build_muscle", label: "Muskelmasse aufbauen" },
  { id: "live_healthier", label: "Gesünder leben" },
  { id: "get_fitter", label: "Fitter werden" },
];

export const Step2Goals: React.FC<Step2GoalsProps> = ({ onNext, onBack }) => {
  const { data, updateData } = useOnboarding();
  const [goals, setGoals] = useState(data.goals);

  const toggleGoal = (goal: Goal) => {
    setGoals((prev) => {
      const selected = prev.selectedGoals.includes(goal)
        ? prev.selectedGoals.filter((g) => g !== goal)
        : [...prev.selectedGoals, goal];
      return { ...prev, selectedGoals: selected };
    });
  };

  const hasGoal = (g: Goal) => goals.selectedGoals.includes(g);

  const handleNext = () => {
    updateData({ goals });
    onNext();
  };

  return (
    <StepWrapper
      title="Was möchtest du mit ARVIO erreichen?"
      subtitle="Wähle deine Ziele aus – wir passen deinen Plan automatisch daran an."
      onNext={handleNext}
      onBack={onBack}
      isNextDisabled={goals.selectedGoals.length === 0}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => toggleGoal(g.id)}
              className={`w-full text-left text-sm px-3 py-2 rounded-xl border ${
                hasGoal(g.id)
                  ? "border-blue-500 bg-blue-600/20"
                  : "border-gray-700 bg-[#05060A]"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {hasGoal("lose_weight") && (
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-400">
              Zielgewicht (nur für Abnehmen):
            </p>
            <input
              type="range"
              min={55}
              max={120}
              step={1}
              value={goals.loseWeightTargetKg ?? 80}
              onChange={(e) =>
                setGoals((prev) => ({
                  ...prev,
                  loseWeightTargetKg: Number(e.target.value),
                }))
              }
              className="w-full"
            />
            <div className="text-xs text-gray-400">
              Zielgewicht: {goals.loseWeightTargetKg ?? 80} kg
            </div>
          </div>
        )}

        {hasGoal("build_muscle") && (
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-400">
              Welche Körperform kommt deinem Ziel am nächsten?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "lean", label: "Schlank & definiert" },
                { id: "athletic", label: "Athletisch" },
                { id: "muscular", label: "Muskelbetont" },
                { id: "massive", label: "Massiv" },
              ].map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  className={`flex flex-col items-center justify-center px-3 py-3 rounded-xl border text-xs ${
                    goals.buildMuscleBodyShape === (shape.id as any)
                      ? "border-blue-500 bg-blue-600/20"
                      : "border-gray-700 bg-[#05060A]"
                  }`}
                  onClick={() =>
                    setGoals((prev) => ({
                      ...prev,
                      buildMuscleBodyShape: shape.id as any,
                    }))
                  }
                >
                  <div className="w-12 h-12 bg-gray-800 rounded-full mb-2" />
                  <span>{shape.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`w-full mt-2 text-xs px-3 py-2 rounded-xl border ${
                goals.buildMuscleBodyShape === "none"
                  ? "border-blue-500 bg-blue-600/20"
                  : "border-gray-700 bg-[#05060A]"
              }`}
              onClick={() =>
                setGoals((prev) => ({
                  ...prev,
                  buildMuscleBodyShape: "none",
                }))
              }
            >
              Keine dieser Optionen
            </button>
          </div>
        )}

        {hasGoal("get_fitter") && (
          <div className="space-y-2 pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-400">
              Welches Ausdauer-Ziel hast du?
            </p>
            <input
              type="range"
              min={3}
              max={180}
              step={1}
              value={goals.fitterTargetDistanceKm ?? 10}
              onChange={(e) =>
                setGoals((prev) => ({
                  ...prev,
                  fitterTargetDistanceKm: Number(e.target.value),
                }))
              }
              className="w-full"
            />
            <div className="text-xs text-gray-400">
              Ziel:{" "}
              {(() => {
                const km = goals.fitterTargetDistanceKm ?? 10;
                if (km === 21) return "Halbmarathon";
                if (km === 42) return "Marathon";
                if (km >= 180) return "Ironman-Distanz";
                return `${km} km`;
              })()}
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2 border-t border-gray-800">
          <label className="text-xs text-gray-400">
            Welche Sportarten machst du aktuell? (z. B. Laufen, Gym, Fußball)
          </label>
          <input
            type="text"
            className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="Kommagetrennt eingeben..."
            value={goals.sports.join(", ")}
            onChange={(e) =>
              setGoals((prev) => ({
                ...prev,
                sports: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
          />
        </div>
      </div>
    </StepWrapper>
  );
};
