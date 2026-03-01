// src/components/cardio/CardioStatsPanel.tsx
// Live stats display for cardio tracking: distance, pace, duration, elevation

import React from "react";
import { formatDistanceKm, formatPace, formatElevation } from "../../utils/gpsUtils";

interface CardioStatsPanelProps {
  distanceM: number;
  paceSecPerKm: number | undefined;
  elapsedMs: number;
  elevationGainM: number;
  sport: "Laufen" | "Radfahren";
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const CardioStatsPanel: React.FC<CardioStatsPanelProps> = ({
  distanceM,
  paceSecPerKm,
  elapsedMs,
  elevationGainM,
  sport,
}) => {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {/* Distance */}
      <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {formatDistanceKm(distanceM)}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">km</div>
      </div>

      {/* Pace / Speed */}
      <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {formatPace(paceSecPerKm)}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
          {sport === "Laufen" ? "min/km" : "min/km"}
        </div>
      </div>

      {/* Duration */}
      <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {formatElapsed(elapsedMs)}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">Dauer</div>
      </div>

      {/* Elevation */}
      <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {formatElevation(elevationGainM)}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">Höhenmeter</div>
      </div>
    </div>
  );
};

export default CardioStatsPanel;
