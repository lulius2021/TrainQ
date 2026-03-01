// src/components/nutrition/NutritionDashboardWidget.tsx
import React from "react";
import { motion } from "framer-motion";
import { ChevronRight, Apple } from "lucide-react";
import { useNutrition } from "../../hooks/useNutrition";

const MotionDiv = motion.div as any;

const NutritionDashboardWidget: React.FC = () => {
  const { entries, totals, goals, progress } = useNutrition();

  const navigateToNutrition = () => {
    window.dispatchEvent(
      new CustomEvent("trainq:navigate", { detail: { path: "/nutrition" } })
    );
  };

  const kcalPct = Math.min(100, Math.round(progress.kcal * 100));
  const hasEntries = entries.length > 0;

  if (!hasEntries) {
    // Teaser card
    return (
      <div>
        <h3 className="text-sm font-bold text-[var(--text-secondary)] mb-2 pl-1 uppercase tracking-wider text-[11px]">
          Ern&auml;hrung
        </h3>
        <button
          onClick={navigateToNutrition}
          className="w-full bg-[var(--card-bg)] rounded-[24px] p-5 border border-[var(--border-color)] flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
        >
          <div className="w-11 h-11 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
            <Apple size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[var(--text-color)]">
              Ern&auml;hrung tracken
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Kalorien und Makros im Blick behalten.
            </p>
          </div>
          <ChevronRight
            size={18}
            className="text-[var(--text-secondary)] shrink-0"
          />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 pl-1">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
          Ern&auml;hrung
        </h3>
        <button
          onClick={navigateToNutrition}
          className="text-xs font-semibold text-[var(--accent-color)]"
        >
          Details
        </button>
      </div>
      <button
        onClick={navigateToNutrition}
        className="w-full bg-[var(--card-bg)] rounded-[24px] p-5 border border-[var(--border-color)] active:scale-[0.98] transition-transform text-left"
      >
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
            <Apple size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold text-[var(--text-color)]">
                {totals.kcal} / {goals.kcal} kcal
              </span>
              <span className="text-xs font-semibold text-[var(--accent-color)]">
                {kcalPct}%
              </span>
            </div>
            {/* Mini progress bar */}
            <div className="w-full h-2 rounded-full bg-[var(--border-color)] overflow-hidden">
              <MotionDiv
                className="h-full rounded-full bg-green-500"
                initial={{ width: 0 }}
                animate={{ width: `${kcalPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-medium text-blue-500">
                {totals.protein.toFixed(0)}g Protein
              </span>
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {entries.length} Eintr&auml;ge
              </span>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
};

export default NutritionDashboardWidget;
