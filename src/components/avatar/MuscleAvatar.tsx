// src/components/avatar/MuscleAvatar.tsx
// Feature 8: Stylized muscle avatar with front/back views

import React, { useMemo, useState } from "react";
import type { Muscle } from "../../data/exerciseLibrary";
import MuscleAvatarFront from "./MuscleAvatarFront";
import MuscleAvatarBack from "./MuscleAvatarBack";
import { getMuscleDetailMode } from "../../utils/muscleGrouping";
import { SIMPLE_GROUP_MAP } from "../../utils/muscleGrouping";

type ViewSide = "front" | "back";
type Period = 7 | 30 | 90;

interface MuscleAvatarProps {
  volumeMap: Record<Muscle, number>;
  period: Period;
  onPeriodChange: (p: Period) => void;
}

function intensityToColor(intensity: number): string {
  if (intensity <= 0) return "rgba(128,128,128,0.15)";

  // HSL interpolation: grey (0) → yellow (0.3) → orange (0.6) → red (1.0)
  const clamped = Math.min(1, Math.max(0, intensity));

  if (clamped < 0.3) {
    // grey-ish to yellow
    const t = clamped / 0.3;
    const h = 60; // yellow hue
    const s = Math.round(20 + t * 80);
    const l = Math.round(70 - t * 20);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  if (clamped < 0.7) {
    // yellow to orange
    const t = (clamped - 0.3) / 0.4;
    const h = Math.round(60 - t * 30); // 60 → 30
    const s = Math.round(80 + t * 20);
    const l = Math.round(50 - t * 5);
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  // orange to red
  const t = (clamped - 0.7) / 0.3;
  const h = Math.round(30 - t * 25); // 30 → 5
  const s = 100;
  const l = Math.round(45 - t * 5);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function applySimpleGrouping(volumeMap: Record<Muscle, number>): Record<Muscle, number> {
  // In "einfach" mode, muscles in the same group get the same (max) intensity
  const allMuscles = Object.keys(volumeMap) as Muscle[];
  const groupMax: Record<string, number> = {};

  for (const m of allMuscles) {
    const group = SIMPLE_GROUP_MAP[m];
    const val = volumeMap[m] ?? 0;
    groupMax[group] = Math.max(groupMax[group] ?? 0, val);
  }

  const result = { ...volumeMap };
  for (const m of allMuscles) {
    const group = SIMPLE_GROUP_MAP[m];
    result[m] = groupMax[group] ?? 0;
  }
  return result;
}

const MuscleAvatar: React.FC<MuscleAvatarProps> = ({ volumeMap, period, onPeriodChange }) => {
  const [view, setView] = useState<ViewSide>("front");
  const mode = getMuscleDetailMode();

  const effectiveVolumeMap = useMemo(() => {
    if (mode === "einfach") return applySimpleGrouping(volumeMap);
    return volumeMap;
  }, [volumeMap, mode]);

  const periods: Period[] = [7, 30, 90];

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="flex items-center justify-between mb-3">
        {/* View toggle */}
        <div className="flex bg-[var(--button-bg)] p-0.5 rounded-lg">
          <button
            onClick={() => setView("front")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              view === "front" ? "bg-blue-500 text-white shadow-sm" : "text-[var(--text-secondary)]"
            }`}
          >
            Vorne
          </button>
          <button
            onClick={() => setView("back")}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
              view === "back" ? "bg-blue-500 text-white shadow-sm" : "text-[var(--text-secondary)]"
            }`}
          >
            Hinten
          </button>
        </div>

        {/* Period selector */}
        <div className="flex bg-[var(--button-bg)] p-0.5 rounded-lg">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                period === p ? "bg-blue-500 text-white shadow-sm" : "text-[var(--text-secondary)]"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Avatar */}
      <div className="flex justify-center items-center" style={{ minHeight: 320 }}>
        <div className="w-52">
          {view === "front" ? (
            <MuscleAvatarFront volumeMap={effectiveVolumeMap} intensityToColor={intensityToColor} />
          ) : (
            <MuscleAvatarBack volumeMap={effectiveVolumeMap} intensityToColor={intensityToColor} />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 mt-2">
        <span className="text-[10px] text-[var(--text-secondary)]">Wenig</span>
        <div className="flex gap-0.5">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div
              key={v}
              className="w-4 h-2 rounded-sm"
              style={{ backgroundColor: intensityToColor(v) }}
            />
          ))}
        </div>
        <span className="text-[10px] text-[var(--text-secondary)]">Viel</span>
      </div>
    </div>
  );
};

export default MuscleAvatar;
