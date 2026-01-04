// src/pages/onboarding/steps/Step3TrainingSetup.tsx
import React, { useEffect, useMemo, useState } from "react";
import { StepWrapper } from "../StepWrapper"; // ✅ gleiche Wrapper-Quelle wie Step1/2
import { useOnboarding } from "../../../context/OnboardingContext";
import type { TrainingLocation, TrainingSetupData } from "../../../types/onboarding";

interface Step3TrainingSetupProps {
  onNext: () => void;
  onBack: () => void;
}

const LOCATION_OPTIONS: { id: TrainingLocation; label: string }[] = [
  { id: "treadmill", label: "Laufband" },
  { id: "gym", label: "Gym" },
  { id: "outdoor_park", label: "Outdoor Park" },
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
  const set = new Set<TrainingLocation>((list ?? []).filter(Boolean) as TrainingLocation[]);
  if (set.has("gym") && set.has("no_gym")) set.delete("no_gym");
  return Array.from(set);
}

function sanitizeTraining(input?: Partial<TrainingSetupData> | null): TrainingSetupData {
  const t = (input ?? {}) as Partial<TrainingSetupData>;

  const hoursPerWeek = typeof t.hoursPerWeek === "number" ? clampInt(t.hoursPerWeek, 1, 40) : null;
  const sessionsPerWeek = typeof t.sessionsPerWeek === "number" ? clampInt(t.sessionsPerWeek, 1, 14) : null;

  const locationsRaw = Array.isArray(t.locations) ? (t.locations as TrainingLocation[]) : [];
  const locations = normalizeLocations(locationsRaw);

  return { hoursPerWeek, sessionsPerWeek, locations };
}

export const Step3TrainingSetup: React.FC<Step3TrainingSetupProps> = ({ onNext, onBack }) => {
  const { data, updateData } = useOnboarding();

  const initial = useMemo(() => sanitizeTraining(data?.training), [data?.training]);

  const [training, setTraining] = useState<TrainingSetupData>(() => initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setTraining(initial);
  }, [initial, dirty]);

  const setTrainingSafe = (next: React.SetStateAction<TrainingSetupData>) => {
    setDirty(true);
    setTraining(next);
  };

  const toggleLocation = (loc: TrainingLocation) => {
    setTrainingSafe((prev) => {
      const current = prev.locations ?? [];
      const exists = current.includes(loc);
      const next = exists ? current.filter((l) => l !== loc) : [...current, loc];
      return { ...prev, locations: normalizeLocations(next) };
    });
  };

  const hours = training.hoursPerWeek;
  const sessions = training.sessionsPerWeek;
  const locationsCount = (training.locations ?? []).length;

  const isNextDisabled = !hours || !sessions || hours <= 0 || sessions <= 0 || locationsCount === 0;

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

  const card: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  };

  const muted: React.CSSProperties = { color: "var(--muted)" };
  const text: React.CSSProperties = { color: "var(--text)" };

  const fieldStyle =
    "w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-offset-0";
  const fieldInline: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  const tileBase =
    "px-3 py-3 rounded-2xl text-sm font-semibold transition hover:opacity-95 w-full text-left";
  const tileStyle = (active: boolean): React.CSSProperties =>
    active
      ? { background: "rgba(255,255,255,0.10)", border: "1px solid var(--border)", color: "var(--text)" }
      : { background: "transparent", border: "1px solid var(--border)", color: "var(--text)" };

  const checkBadgeStyle = (active: boolean): React.CSSProperties => ({
    height: 20,
    width: 20,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    border: "1px solid var(--border)",
    background: active ? "var(--primary)" : "rgba(255,255,255,0.08)",
    color: active ? "#061226" : "transparent",
  });

  return (
    <StepWrapper
      hideHeader
      hideProgress
      onNext={handleNext}
      onBack={onBack}
      showBack
      nextLabel="Weiter"
      nextDisabled={isNextDisabled}
    >
      {/* Zeit */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="text-sm font-semibold" style={text}>
          Zeit
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-[11px]" style={muted}>
              Stunden / Woche
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              step={1}
              placeholder="4"
              value={training.hoursPerWeek ?? ""}
              onChange={(e) =>
                setTrainingSafe((prev) => ({
                  ...prev,
                  hoursPerWeek: toNumberOrNull(e.target.value),
                }))
              }
              onBlur={() =>
                setTrainingSafe((prev) => ({
                  ...prev,
                  hoursPerWeek: clampInt(prev.hoursPerWeek, 1, 40),
                }))
              }
              className={fieldStyle}
              style={fieldInline}
            />
          </div>

          <div className="space-y-1">
            <div className="text-[11px]" style={muted}>
              Einheiten / Woche
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={14}
              step={1}
              placeholder="3"
              value={training.sessionsPerWeek ?? ""}
              onChange={(e) =>
                setTrainingSafe((prev) => ({
                  ...prev,
                  sessionsPerWeek: toNumberOrNull(e.target.value),
                }))
              }
              onBlur={() =>
                setTrainingSafe((prev) => ({
                  ...prev,
                  sessionsPerWeek: clampInt(prev.sessionsPerWeek, 1, 14),
                }))
              }
              className={fieldStyle}
              style={fieldInline}
            />
          </div>
        </div>

        <div className="text-[11px]" style={muted}>
          {hours && sessions ? `${hours} h • ${sessions}×` : "—"}
        </div>
      </div>

      {/* Orte */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold" style={text}>
            Orte
          </div>
          <div className="text-[11px]" style={muted}>
            {locationsCount > 0 ? `${locationsCount} gewählt` : "wählen"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {LOCATION_OPTIONS.map((loc) => {
            const active = (training.locations ?? []).includes(loc.id);
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => toggleLocation(loc.id)}
                className={tileBase}
                style={tileStyle(active)}
              >
                <div className="flex items-center justify-between">
                  <span>{loc.label}</span>
                  <span style={checkBadgeStyle(active)}>{active ? "✓" : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </StepWrapper>
  );
};