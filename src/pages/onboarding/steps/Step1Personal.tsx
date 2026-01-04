// src/pages/onboarding/steps/Step1Personal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { StepWrapper } from "../StepWrapper"; // ✅ WICHTIG: nutzt src/pages/onboarding/StepWrapper.tsx
import { useOnboarding } from "../../../context/OnboardingContext";
import type { PersonalData } from "../../../types/onboarding";

interface Step1PersonalProps {
  onNext: () => void;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function parseNullableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function sanitizePersonal(input?: Partial<PersonalData> | null): PersonalData {
  const p = (input ?? {}) as Partial<PersonalData>;

  const stressLevel =
    typeof p.stressLevel === "number" ? clamp(Math.round(p.stressLevel), 1, 10) : 5;

  const sleepHours =
    typeof p.sleepHours === "number" ? clamp(Math.round(p.sleepHours), 0, 12) : 7;

  const age = typeof p.age === "number" ? clamp(Math.round(p.age), 5, 120) : null;
  const height = typeof p.height === "number" ? clamp(Math.round(p.height), 80, 250) : null;
  const weight = typeof p.weight === "number" ? clamp(Math.round(p.weight), 20, 400) : null;

  return { stressLevel, sleepHours, age, height, weight };
}

export const Step1Personal: React.FC<Step1PersonalProps> = ({ onNext }) => {
  const { data, updateData } = useOnboarding();

  const initial = useMemo(() => sanitizePersonal(data?.personal), [data?.personal]);

  const [local, setLocal] = useState<PersonalData>(() => initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setLocal(initial);
  }, [initial, dirty]);

  const setLocalSafe = (next: React.SetStateAction<PersonalData>) => {
    setDirty(true);
    setLocal(next);
  };

  const handleChangeNumber = (field: "age" | "height" | "weight", value: string) => {
    const n = parseNullableNumber(value);

    let clamped: number | null = n;
    if (n !== null) {
      if (field === "age") clamped = clamp(Math.round(n), 5, 120);
      if (field === "height") clamped = clamp(Math.round(n), 80, 250);
      if (field === "weight") clamped = clamp(Math.round(n), 20, 400);
    }

    setLocalSafe((prev) => ({ ...prev, [field]: clamped }));
  };

  const handleNext = () => {
    updateData({ personal: sanitizePersonal(local) });
    onNext();
  };

  const card: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  };

  const label: React.CSSProperties = { color: "var(--text)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  const pill = (text: string) => (
    <span
      className="px-2 py-1 rounded-full text-[11px] font-semibold"
      style={{
        background: "rgba(255,255,255,0.08)",
        color: "var(--text)",
        border: "1px solid var(--border)",
      }}
    >
      {text}
    </span>
  );

  const inputStyle =
    "w-full rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-0";
  const inputInline: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  return (
    <StepWrapper
      hideHeader
      hideProgress
      showBack={false}
      onNext={handleNext}
      nextLabel="Weiter"
    >
      {/* Stress */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold" style={label}>
            Stress
          </div>
          {pill(`${local.stressLevel}/10`)}
        </div>

        <div className="text-[11px]" style={muted}>
          1 = entspannt, 10 = sehr gestresst
        </div>

        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={local.stressLevel}
          onChange={(e) =>
            setLocalSafe((prev) => ({
              ...prev,
              stressLevel: clamp(Number(e.target.value), 1, 10),
            }))
          }
          className="w-full"
        />
      </div>

      {/* Schlaf */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold" style={label}>
            Schlaf
          </div>
          {pill(`${local.sleepHours} h`)}
        </div>

        <div className="text-[11px]" style={muted}>
          Durchschnitt pro Nacht
        </div>

        <input
          type="range"
          min={0}
          max={12}
          step={1}
          value={local.sleepHours}
          onChange={(e) =>
            setLocalSafe((prev) => ({
              ...prev,
              sleepHours: clamp(Number(e.target.value), 0, 12),
            }))
          }
          className="w-full"
        />
      </div>

      {/* Körperdaten (optional) */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold" style={label}>
            Körperdaten (optional)
          </div>
          <div className="text-[11px]" style={muted}>
            später änderbar
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <div className="text-[11px]" style={muted}>
              Alter
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={5}
              max={120}
              step={1}
              placeholder="Jahre"
              value={local.age ?? ""}
              onChange={(e) => handleChangeNumber("age", e.target.value)}
              className={inputStyle}
              style={inputInline}
            />
          </div>

          <div className="space-y-1">
            <div className="text-[11px]" style={muted}>
              Größe
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={80}
              max={250}
              step={1}
              placeholder="cm"
              value={local.height ?? ""}
              onChange={(e) => handleChangeNumber("height", e.target.value)}
              className={inputStyle}
              style={inputInline}
            />
          </div>

          <div className="space-y-1">
            <div className="text-[11px]" style={muted}>
              Gewicht
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={20}
              max={400}
              step={0.1}
              placeholder="kg"
              value={local.weight ?? ""}
              onChange={(e) => handleChangeNumber("weight", e.target.value)}
              className={inputStyle}
              style={inputInline}
            />
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};