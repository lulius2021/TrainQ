// src/components/avatar/MuscleAvatarFront.tsx
import React from "react";
import type { Muscle } from "../../data/exerciseLibrary";
import { FRONT_PATHS, BODY_OUTLINE_FRONT, FRONT_DETAIL_LINES } from "./avatarPaths";

interface MuscleAvatarFrontProps {
  volumeMap: Record<Muscle, number>;
  intensityToColor: (intensity: number) => string;
}

const MuscleAvatarFront: React.FC<MuscleAvatarFrontProps> = ({ volumeMap, intensityToColor }) => {
  return (
    <svg viewBox="0 0 200 440" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Body outline */}
      <path
        d={BODY_OUTLINE_FRONT}
        fill="var(--card-bg)"
        stroke="var(--border-color)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Muscle regions */}
      {(Object.entries(FRONT_PATHS) as [Muscle, { d: string }][]).map(([muscle, pathData]) => {
        const intensity = volumeMap[muscle] ?? 0;
        const color = intensityToColor(intensity);
        return (
          <path
            key={muscle}
            d={pathData.d}
            fill={color}
            fillOpacity={intensity > 0 ? 0.85 : 0.1}
            stroke="none"
          />
        );
      })}

      {/* Anatomical detail lines */}
      {FRONT_DETAIL_LINES.map((d, i) => (
        <path
          key={`detail-${i}`}
          d={d}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth="0.5"
          strokeOpacity="0.35"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};

export default MuscleAvatarFront;
