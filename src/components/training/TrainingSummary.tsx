// src/components/training/TrainingSummary.tsx
import React from "react";
import type { TrainingMode, TrainingStats } from "../../lib/trainingLogic";

interface TrainingSummaryProps {
  stats: TrainingStats;
  compact?: boolean;
}

const MODE_LABEL: Record<TrainingMode, string> = {
  gym: "Gym",
  running: "Laufen",
  cycling: "Radfahren",
};

export const TrainingSummary: React.FC<TrainingSummaryProps> = ({
  stats,
  compact = false,
}) => {
  const hours = Math.floor(stats.totalMinutes / 60);
  const minutes = stats.totalMinutes % 60;

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-100">
          {MODE_LABEL[stats.mode]}
        </span>
        <span className="text-[10px] text-white/60">
          {stats.totalSessions} Einheit
          {stats.totalSessions === 1 ? "" : "en"}
        </span>
      </div>

      <div
        className={
          "grid gap-2 " + (compact ? "grid-cols-2" : "grid-cols-3 md:grid-cols-3")
        }
      >
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50">Trainingszeit</span>
          <span className="text-sm font-semibold text-slate-100">
            {hours}h {minutes}m
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-white/50">Einheiten</span>
          <span className="text-sm font-semibold text-slate-100">
            {stats.totalSessions}
          </span>
        </div>

        {(stats.mode === "running" || stats.mode === "cycling") && (
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50">Distanz</span>
            <span className="text-sm font-semibold text-slate-100">
              {stats.totalDistanceKm.toFixed(1)} km
            </span>
          </div>
        )}

        {stats.mode === "gym" && !compact && (
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50">Fokus</span>
            <span className="text-[11px] text-slate-200">
              Kraft / Hypertrophie
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingSummary;
