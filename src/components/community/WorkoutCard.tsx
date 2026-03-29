import React from "react";
import { Clock, Dumbbell, Layers, Flame } from "lucide-react";
import type { WorkoutData } from "../../services/community/types";

interface Props {
  data: WorkoutData;
}

export default function WorkoutCard({ data }: Props) {
  return (
    <div
      className="mt-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}
    >
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell size={16} style={{ color: "var(--accent-color)" }} />
        <span className="font-semibold text-sm" style={{ color: "var(--text-color)" }}>
          {data.title}
        </span>
        <span className="text-xs ml-auto" style={{ color: "var(--text-secondary)" }}>
          {data.sport}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Clock size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {data.durationLabel}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Dauer</span>
        </div>
        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Flame size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {data.totalVolumeKg > 0 ? `${data.totalVolumeKg.toLocaleString("de-DE")} kg` : "–"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Volumen</span>
        </div>
        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Layers size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {data.totalSets}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Sätze</span>
        </div>
      </div>

      {/* Top exercises */}
      {data.topExercises.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.topExercises.map((name) => (
            <span
              key={name}
              className="text-[11px] px-2 py-1 rounded-full font-medium"
              style={{ background: "var(--bg-color)", color: "var(--text-secondary)" }}
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
