// src/components/nutrition/FoodSuggestionList.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { FoodItem, FoodMatchResult } from "../../types/nutrition";

const MotionDiv = motion.div as any;

interface FoodSuggestionListProps {
  results: FoodMatchResult[];
  onSelect: (food: FoodItem) => void;
  visible: boolean;
}

const FoodSuggestionList: React.FC<FoodSuggestionListProps> = ({
  results,
  onSelect,
  visible,
}) => {
  if (!visible || results.length === 0) return null;

  const shown = results.slice(0, 8);

  return (
    <AnimatePresence>
      {visible && (
        <MotionDiv
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-lg z-20"
        >
          {shown.map((result, idx) => {
            const isHighConfidence = result.score >= 0.9;
            return (
              <button
                key={result.food.id + idx}
                onClick={() => onSelect(result.food)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-[var(--border-color)] transition-colors ${
                  idx > 0 ? "border-t border-[var(--border-color)]" : ""
                }`}
              >
                {isHighConfidence && (
                  <div className="w-5 h-5 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-green-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-color)] truncate">
                    {result.food.name}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {result.food.per100g.kcal} kcal / 100g
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    {result.food.per100g.protein}g P
                  </span>
                </div>
              </button>
            );
          })}
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

export default FoodSuggestionList;
