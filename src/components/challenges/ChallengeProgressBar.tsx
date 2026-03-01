// src/components/challenges/ChallengeProgressBar.tsx
import React from "react";
import { motion } from "framer-motion";

// Workaround for Framer Motion typing issues with motion.div
const MotionDiv = motion.div as any;

interface ChallengeProgressBarProps {
  progress01: number; // 0-1
  current: number;
  target: number;
  unit?: string;
}

const ChallengeProgressBar: React.FC<ChallengeProgressBarProps> = ({
  progress01,
  current,
  target,
  unit = "",
}) => {
  const pct = Math.round(progress01 * 100);
  const displayCurrent =
    unit === "km" ? current.toFixed(1) : current.toLocaleString("de-DE");
  const displayTarget =
    unit === "km" ? target.toFixed(1) : target.toLocaleString("de-DE");

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-[var(--text-secondary)]">
          {displayCurrent} / {displayTarget} {unit}
        </span>
        <span className="text-xs font-bold text-[var(--accent-color)]">
          {pct}%
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-[var(--border-color)] overflow-hidden">
        <MotionDiv
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

export default ChallengeProgressBar;
