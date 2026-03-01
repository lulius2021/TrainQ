// src/components/nutrition/MacroGoalsSheet.tsx
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { NutritionGoals } from "../../types/nutrition";

const MotionDiv = motion.div as any;

interface MacroGoalsSheetProps {
  goals: NutritionGoals;
  onSave: (goals: NutritionGoals) => void;
  onClose: () => void;
}

type GoalMode = NutritionGoals["mode"];

const MODE_OPTIONS: { value: GoalMode; label: string; emoji: string }[] = [
  { value: "deficit", label: "Defizit", emoji: "🔥" },
  { value: "maintenance", label: "Erhalt", emoji: "⚖️" },
  { value: "surplus", label: "Aufbau", emoji: "💪" },
];

const PRESETS: Record<GoalMode, { kcal: number; protein: number; carbs: number; fat: number }> = {
  deficit: { kcal: 1800, protein: 160, carbs: 180, fat: 55 },
  maintenance: { kcal: 2200, protein: 150, carbs: 250, fat: 70 },
  surplus: { kcal: 2800, protein: 170, carbs: 350, fat: 85 },
};

const MacroGoalsSheet: React.FC<MacroGoalsSheetProps> = ({
  goals,
  onSave,
  onClose,
}) => {
  const [kcal, setKcal] = useState(goals.kcal);
  const [protein, setProtein] = useState(goals.protein);
  const [carbs, setCarbs] = useState(goals.carbs);
  const [fat, setFat] = useState(goals.fat);
  const [mode, setMode] = useState<GoalMode>(goals.mode);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKcal(goals.kcal);
    setProtein(goals.protein);
    setCarbs(goals.carbs);
    setFat(goals.fat);
    setMode(goals.mode);
  }, [goals]);

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleModeChange = (newMode: GoalMode) => {
    setMode(newMode);
    const preset = PRESETS[newMode];
    setKcal(preset.kcal);
    setProtein(preset.protein);
    setCarbs(preset.carbs);
    setFat(preset.fat);
  };

  const handleSave = () => {
    onSave({ kcal, protein, carbs, fat, mode });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <MotionDiv
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <MotionDiv
        className="absolute left-0 right-0 bottom-0 bg-[var(--card-bg)] rounded-t-3xl border-t border-[var(--border-color)] pb-[env(safe-area-inset-bottom)]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-10 rounded-full bg-[var(--border-color)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h3 className="text-lg font-bold text-[var(--text-color)]">
            Tagesziele
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <X size={16} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="px-5 py-3">
          <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
            Modus
          </label>
          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleModeChange(opt.value)}
                className={`py-2.5 rounded-xl text-center transition-all text-sm font-semibold ${
                  mode === opt.value
                    ? "bg-[var(--accent-color)] text-white"
                    : "bg-[var(--bg-color)] text-[var(--text-secondary)] border border-[var(--border-color)]"
                }`}
              >
                <span className="mr-1">{opt.emoji}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="px-5 py-2 space-y-3">
          <GoalInput
            label="Kalorien (kcal)"
            value={kcal}
            onChange={setKcal}
          />
          <GoalInput
            label="Protein (g)"
            value={protein}
            onChange={setProtein}
          />
          <GoalInput
            label="Kohlenhydrate (g)"
            value={carbs}
            onChange={setCarbs}
          />
          <GoalInput
            label="Fett (g)"
            value={fat}
            onChange={setFat}
          />
        </div>

        {/* Save button */}
        <div className="px-5 pt-4 pb-6">
          <button
            onClick={handleSave}
            className="w-full py-3.5 rounded-2xl bg-[var(--accent-color)] text-white font-bold text-[15px] active:scale-[0.98] transition-transform"
          >
            Speichern
          </button>
        </div>
      </MotionDiv>
    </MotionDiv>
  );
};

function GoalInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(isNaN(v) ? 0 : Math.max(0, v));
        }}
        className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)] tabular-nums"
        inputMode="numeric"
        min="0"
      />
    </div>
  );
}

export default MacroGoalsSheet;
