// src/components/training/TrainingModeSelector.tsx
import React from "react";
import type { TrainingMode } from "../../lib/trainingLogic";
import { useI18n } from "../../i18n/useI18n";

interface TrainingModeSelectorProps {
  value: TrainingMode;
  onChange: (mode: TrainingMode) => void;
  className?: string;
}

export const TrainingModeSelector: React.FC<TrainingModeSelectorProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const { t } = useI18n();

  const LABELS: Record<TrainingMode, string> = {
    gym: t("training.mode.gym"),
    running: t("training.mode.running"),
    cycling: t("training.mode.cycling"),
  };

  return (
    <div
      className={
        "inline-flex rounded-full bg-black/40 border border-white/15 p-1 text-[11px] " +
        className
      }
    >
      {(Object.keys(LABELS) as TrainingMode[]).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={
              "px-3 py-1 rounded-full transition " +
              (active
                ? "bg-brand-primary text-black shadow-sm"
                : "text-white/80 hover:bg-white/5")
            }
          >
            {LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
};

export default TrainingModeSelector;
