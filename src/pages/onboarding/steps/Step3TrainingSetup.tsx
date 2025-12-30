// src/pages/onboarding/steps/Step3TrainingSetup.tsx
import React, { useMemo, useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper.tsx";
import { useOnboarding } from "../../../context/OnboardingContext.tsx";
import type { TrainingLocation, TrainingSetupData } from "../../../types/onboarding";

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

function toNumberOrNull(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clampInt(n: number | null, min: number, max: number): number | null {
  if (n == null) return null;
  const v = Math.round(n);
  return Math.min(max, Math.max(min, v));
}

function normalizeLocations(list: TrainingLocation[]): TrainingLocation[] {
  // dedupe + einfache Konfliktauflösung (gym vs no_gym)
  const set = new Set<TrainingLocation>((list ?? []).filter(Boolean));

  if (set.has("gym") && set.has("no_gym")) set.delete("no_gym");
  // "no_equipment" lassen wir bewusst zu (kann "home/no_equipment" bedeuten)

  return Array.from(set);
}

export const Step3TrainingSetup: React.FC<Step3TrainingSetupProps> = ({ onNext, onBack }) => {
  const { data, updateData } = useOnboarding();

  const initialTraining = useMemo<TrainingSetupData>(() => {
    const t = (data?.training ?? {}) as Partial<TrainingSetupData>;

    const hoursPerWeek = typeof t.hoursPerWeek === "number" ? t.hoursPerWeek : null;
    const sessionsPerWeek = typeof t.sessionsPerWeek === "number" ? t.sessionsPerWeek : null;

    const locationsRaw = Array.isArray(t.locations) ? (t.locations as TrainingLocation[]) : [];
    const locations = normalizeLocations(locationsRaw);

    return {
      hoursPerWeek,
      sessionsPerWeek,
      locations,
    };
  }, [data?.training?.hoursPerWeek, data?.training?.sessionsPerWeek, data?.training?.locations]);

  const [training, setTraining] = useState<TrainingSetupData>(initialTraining);

  const toggleLocation = (loc: TrainingLocation) => {
    setTraining((prev) => {
      const current = prev.locations ?? [];
      const exists = current.includes(loc);

      const next = exists ? current.filter((l) => l !== loc) : [...current, loc];
      return { ...prev, locations: normalizeLocations(next) };
    });
  };

  const hours = training.hoursPerWeek;
  const sessions = training.sessionsPerWeek;

  const isNextDisabled =
    hours == null ||
    sessions == null ||
    hours <= 0 ||
    sessions <= 0 ||
    (training.locations ?? []).length === 0;

  const handleNext = () => {
    const nextTraining: TrainingSetupData = {
      ...training,
      hoursPerWeek: clampInt(training.hoursPerWeek, 1, 40),
      sessionsPerWeek: clampInt(training.sessionsPerWeek, 1, 14),
      locations: normalizeLocations((training.locations ?? []).filter(Boolean) as TrainingLocation[]),
    };

    updateData({ training: nextTraining });
    onNext();
  };

  return (
    <StepWrapper
      title="Wie möchtest du trainieren?"
      subtitle="Wir richten deine Pläne nach deiner verfügbaren Zeit und deinen Trainingsorten aus."
      onNext={handleNext}
      onBack={onBack}
      isNextDisabled={isNextDisabled}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400">Wie viele Stunden willst du pro Woche trainieren?</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              step={1}
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-2 py-2 text-sm"
              placeholder="z. B. 4"
              value={training.hoursPerWeek ?? ""}
              onChange={(e) =>
                setTraining((prev) => ({
                  ...prev,
                  hoursPerWeek: toNumberOrNull(e.target.value),
                }))
              }
              onBlur={() =>
                setTraining((prev) => ({
                  ...prev,
                  hoursPerWeek: clampInt(prev.hoursPerWeek, 1, 40),
                }))
              }
            />
          </div>

          <div>
            <label className="text-xs text-gray-400">Wie oft willst du pro Woche trainieren?</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={14}
              step={1}
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-2 py-2 text-sm"
              placeholder="z. B. 3"
              value={training.sessionsPerWeek ?? ""}
              onChange={(e) =>
                setTraining((prev) => ({
                  ...prev,
                  sessionsPerWeek: toNumberOrNull(e.target.value),
                }))
              }
              onBlur={() =>
                setTraining((prev) => ({
                  ...prev,
                  sessionsPerWeek: clampInt(prev.sessionsPerWeek, 1, 14),
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-gray-400">Wo kannst du überall trainieren?</p>
          <div className="grid grid-cols-2 gap-2">
            {LOCATION_OPTIONS.map((loc) => {
              const active = (training.locations ?? []).includes(loc.id);
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => toggleLocation(loc.id)}
                  className={`text-xs px-3 py-2 rounded-xl border text-left ${
                    active ? "border-blue-500 bg-blue-600/20" : "border-gray-700 bg-[#05060A]"
                  }`}
                >
                  {loc.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] text-gray-500">Tipp: Du kannst später jederzeit alles im Profil ändern.</div>
      </div>
    </StepWrapper>
  );
};