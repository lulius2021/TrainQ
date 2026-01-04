// src/pages/onboarding/steps/Step4Obstacles.tsx
import React, { useEffect, useMemo, useState } from "react";
import { StepWrapper } from "../StepWrapper"; // ✅ gleiche Wrapper-Quelle wie Step1–3
import { useOnboarding } from "../../../context/OnboardingContext";

interface Step4ObstaclesProps {
  onNext: () => void;
  onBack: () => void;
}

const REASONS = [
  "Keine Zeit",
  "Keine Struktur",
  "Keine Motivation",
  "Zu viel Stress",
  "Zu wenig Energie",
  "Unregelmäßig dran geblieben",
] as const;

function normalizeReasons(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input.map((x) => String(x ?? "").trim()).filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 12);
}

export const Step4Obstacles: React.FC<Step4ObstaclesProps> = ({ onNext, onBack }) => {
  const { data, updateData } = useOnboarding();

  const initial = useMemo<string[]>(
    () => normalizeReasons(data?.obstacles?.reasons),
    [data?.obstacles?.reasons]
  );

  const [reasons, setReasons] = useState<string[]>(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setReasons(initial);
  }, [initial, dirty]);

  const toggleReason = (reason: string) => {
    const r = String(reason ?? "").trim();
    if (!r) return;

    setDirty(true);
    setReasons((prev) => {
      const next = prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r];
      return normalizeReasons(next);
    });
  };

  const selectedCount = normalizeReasons(reasons).length;
  const isNextDisabled = selectedCount === 0;

  const handleNext = () => {
    updateData({ obstacles: { reasons: normalizeReasons(reasons) } });
    onNext();
  };

  const card: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  };

  const text: React.CSSProperties = { color: "var(--text)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  const tileBase =
    "w-full rounded-2xl px-3 py-3 text-sm font-semibold transition hover:opacity-95 text-left";

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
      hideProgress
      // ✅ Motivations-Sinn der Seite: keine "Probleme erklären", sondern Commitment
      title="Mach dieses Jahr zu deinem Jahr."
      subtitle="Wähle, was dich bisher ausgebremst hat – TrainQ passt sich daran an."
      onNext={handleNext}
      onBack={onBack}
      showBack
      nextLabel="Weiter"
      nextDisabled={isNextDisabled}
    >
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold" style={text}>
            Was hält dich am meisten zurück?
          </div>
          <div className="text-[11px]" style={muted}>
            {selectedCount > 0 ? `${selectedCount} gewählt` : "wählen"}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {REASONS.map((reason) => {
            const active = reasons.includes(reason);
            return (
              <button
                key={reason}
                type="button"
                onClick={() => toggleReason(reason)}
                className={tileBase}
                style={tileStyle(active)}
              >
                <div className="flex items-center justify-between">
                  <span>{reason}</span>
                  <span style={checkBadgeStyle(active)}>{active ? "✓" : ""}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-[11px]" style={muted}>
          Kein Perfekt. Nur Start.
        </div>
      </div>
    </StepWrapper>
  );
};