// src/components/cardio/GpsSignalIndicator.tsx
import React from "react";
import { useI18n } from "../../i18n/useI18n";

export type GpsSignalStrength = "searching" | "weak" | "good";

interface GpsSignalIndicatorProps {
  signal: GpsSignalStrength;
}

const SIGNAL_COLORS: Record<GpsSignalStrength, { color: string; pulse: boolean }> = {
  searching: { color: "#ef4444", pulse: true },
  weak:      { color: "#f59e0b", pulse: false },
  good:      { color: "#22c55e", pulse: false },
};

const GpsSignalIndicator: React.FC<GpsSignalIndicatorProps> = ({ signal }) => {
  const { t } = useI18n();
  const { color, pulse } = SIGNAL_COLORS[signal];
  const label = t(`gps.signal.${signal}`);

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex items-center justify-center" style={{ width: 10, height: 10 }}>
        {pulse && (
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: color, opacity: 0.4 }}
          />
        )}
        <div
          className="w-2.5 h-2.5 rounded-full relative"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  );
};

export default GpsSignalIndicator;
