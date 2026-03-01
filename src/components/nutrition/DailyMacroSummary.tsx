// src/components/nutrition/DailyMacroSummary.tsx
import React from "react";
import { motion } from "framer-motion";
import type { Macros, NutritionGoals, DailyProgress } from "../../types/nutrition";

const MotionCircle = motion.circle as any;
const MotionDiv = motion.div as any;

interface DailyMacroSummaryProps {
  totals: Macros;
  goals: NutritionGoals;
  progress: DailyProgress;
}

interface MacroBarProps {
  label: string;
  current: number;
  goal: number;
  progress: number;
  color: string;
  bgColor: string;
  unit: string;
}

const MacroBar: React.FC<MacroBarProps> = ({
  label,
  current,
  goal,
  progress,
  color,
  bgColor,
  unit,
}) => {
  const pct = Math.min(100, Math.max(0, progress * 100));
  const displayCurrent =
    unit === "g" ? current.toFixed(0) : current.toLocaleString("de-DE");
  const displayGoal =
    unit === "g" ? goal.toFixed(0) : goal.toLocaleString("de-DE");

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-xs font-semibold text-[var(--text-secondary)] shrink-0">
        {label}
      </div>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: bgColor }}>
        <MotionDiv
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <div className="w-20 text-right text-xs font-semibold text-[var(--text-color)] tabular-nums shrink-0">
        {displayCurrent} / {displayGoal}{unit}
      </div>
    </div>
  );
};

const DailyMacroSummary: React.FC<DailyMacroSummaryProps> = ({
  totals,
  goals,
  progress,
}) => {
  const kcalPct = Math.min(100, Math.max(0, progress.kcal * 100));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (kcalPct / 100) * circumference;

  const isOver = totals.kcal > goals.kcal;
  const ringColor = isOver ? "#ef4444" : "var(--accent-color)";
  const remaining = Math.max(0, goals.kcal - totals.kcal);

  return (
    <div className="bg-[var(--card-bg)] rounded-[24px] p-5 border border-[var(--border-color)]">
      {/* Kcal ring */}
      <div className="flex items-center justify-center mb-5">
        <div className="relative w-[140px] h-[140px]">
          <svg
            width="140"
            height="140"
            viewBox="0 0 140 140"
            className="transform -rotate-90"
          >
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="10"
            />
            <MotionCircle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-[var(--text-color)] tabular-nums leading-none">
              {totals.kcal}
            </span>
            <span className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">
              / {goals.kcal} kcal
            </span>
            {!isOver && remaining > 0 && (
              <span className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                {remaining} ubrig
              </span>
            )}
            {isOver && (
              <span className="text-[10px] font-semibold text-red-500 mt-1">
                +{totals.kcal - goals.kcal} uber
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Macro bars */}
      <div className="space-y-3">
        <MacroBar
          label="Protein"
          current={totals.protein}
          goal={goals.protein}
          progress={progress.protein}
          color="#3b82f6"
          bgColor="rgba(59,130,246,0.15)"
          unit="g"
        />
        <MacroBar
          label="Carbs"
          current={totals.carbs}
          goal={goals.carbs}
          progress={progress.carbs}
          color="#f59e0b"
          bgColor="rgba(245,158,11,0.15)"
          unit="g"
        />
        <MacroBar
          label="Fett"
          current={totals.fat}
          goal={goals.fat}
          progress={progress.fat}
          color="#ec4899"
          bgColor="rgba(236,72,153,0.15)"
          unit="g"
        />
      </div>
    </div>
  );
};

export default DailyMacroSummary;
