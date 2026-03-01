// src/components/cardio/CardioSummary.tsx
// Post-workout route summary with stats

import React from "react";
import type { GpsPoint } from "../../types/cardio";
import { formatDistanceKm, formatPace, formatElevation } from "../../utils/gpsUtils";
import CardioMap from "./CardioMap";

interface CardioSummaryProps {
  points: GpsPoint[];
  distanceM: number;
  elevationGainM: number;
  durationMs: number;
  sport: "Laufen" | "Radfahren";
  onSave: () => void;
  onDiscard: () => void;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m}min ${s}s`;
  }
  return `${m}min ${s}s`;
}

const CardioSummary: React.FC<CardioSummaryProps> = ({
  points,
  distanceM,
  elevationGainM,
  durationMs,
  sport,
  onSave,
  onDiscard,
}) => {
  const distanceKm = distanceM / 1000;
  const durationSec = durationMs / 1000;
  const avgPace = distanceKm > 0 ? durationSec / distanceKm : undefined;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Map */}
      <div className="h-48 w-full">
        <CardioMap points={points} isTracking={false} />
      </div>

      {/* Title */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          {sport === "Laufen" ? "Lauf" : "Radfahrt"} abgeschlossen
        </h2>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {formatDistanceKm(distanceM)}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase">Distanz (km)</div>
        </div>
        <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {formatDuration(durationMs)}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase">Dauer</div>
        </div>
        <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {formatPace(avgPace)}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase">Ø Pace (min/km)</div>
        </div>
        <div className="bg-[var(--card-bg)] rounded-xl p-3 text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">
            {formatElevation(elevationGainM)}
          </div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase">Höhenmeter</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-4 mt-auto pb-8">
        <button
          onClick={onDiscard}
          className="flex-1 py-3 rounded-xl bg-[var(--button-bg)] text-[var(--text-secondary)] font-semibold text-sm"
        >
          Verwerfen
        </button>
        <button
          onClick={onSave}
          className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm"
        >
          Speichern
        </button>
      </div>
    </div>
  );
};

export default CardioSummary;
