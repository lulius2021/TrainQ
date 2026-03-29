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

const PRESETS: Record<GoalMode, { kcal: number; protein: number; carbs: number; fat: number; sugar: number; fiber: number; water: number }> = {
  deficit: { kcal: 1800, protein: 160, carbs: 180, fat: 55, sugar: 40, fiber: 30, water: 3 },
  maintenance: { kcal: 2200, protein: 150, carbs: 250, fat: 70, sugar: 50, fiber: 30, water: 3 },
  surplus: { kcal: 2800, protein: 170, carbs: 350, fat: 85, sugar: 60, fiber: 35, water: 3.5 },
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
  const [sugar, setSugar] = useState(goals.sugar ?? 50);
  const [fiber, setFiber] = useState(goals.fiber ?? 30);
  const [water, setWater] = useState(goals.water ?? 3);
  const [mode, setMode] = useState<GoalMode>(goals.mode);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKcal(goals.kcal);
    setProtein(goals.protein);
    setCarbs(goals.carbs);
    setFat(goals.fat);
    setSugar(goals.sugar ?? 50);
    setFiber(goals.fiber ?? 30);
    setWater(goals.water ?? 3);
    setMode(goals.mode);
  }, [goals]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleModeChange = (newMode: GoalMode) => {
    setMode(newMode);
    const p = PRESETS[newMode];
    setKcal(p.kcal);
    setProtein(p.protein);
    setCarbs(p.carbs);
    setFat(p.fat);
    setSugar(p.sugar);
    setFiber(p.fiber);
    setWater(p.water);
  };

  const handleSave = () => {
    onSave({ kcal, protein, carbs, fat, sugar, fiber, water, mode });
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
        className="absolute left-0 right-0 bottom-0 bg-[var(--card-bg)] rounded-t-3xl border-t border-[var(--border-color)] pb-[env(safe-area-inset-bottom)] max-h-[85vh] flex flex-col"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 shrink-0">
          <div className="h-1.5 w-10 rounded-full bg-[var(--border-color)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
          <h3 className="text-lg font-bold text-[var(--text-color)]">Tagesziele</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <X size={16} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5">
          {/* Mode selector */}
          <div className="py-3">
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">Modus</label>
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

          {/* Main macros */}
          <div className="py-2 space-y-3">
            <SectionLabel text="Hauptnährstoffe" />
            <GoalInput label="Kalorien" unit="kcal" value={kcal} onChange={setKcal} />
            <GoalInput label="Protein" unit="g" value={protein} onChange={setProtein} />
            <GoalInput label="Kohlenhydrate" unit="g" value={carbs} onChange={setCarbs} />
            <GoalInput label="Fett" unit="g" value={fat} onChange={setFat} />
          </div>

          {/* Extended macros */}
          <div className="py-2 space-y-3 mt-1">
            <SectionLabel text="Weitere Ziele" />
            <GoalInput label="Zucker (max.)" unit="g" value={sugar} onChange={setSugar} />
            <GoalInput label="Ballaststoffe" unit="g" value={fiber} onChange={setFiber} />
            <GoalInputDecimal label="Wasser" unit="L" value={water} onChange={setWater} />
          </div>
        </div>

        {/* Save button */}
        <div className="px-5 pt-4 pb-6 shrink-0">
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

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] pt-1">{text}</p>
  );
}

function GoalInput({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-[var(--text-color)] flex-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            onChange(isNaN(v) ? 0 : Math.max(0, v));
          }}
          className="w-20 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)] tabular-nums text-right"
          inputMode="numeric"
          min="0"
        />
        <span className="text-xs font-medium text-[var(--text-secondary)] w-8">{unit}</span>
      </div>
    </div>
  );
}

function GoalInputDecimal({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-[var(--text-color)] flex-1">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          step="0.5"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNaN(v) ? 0 : Math.max(0, v));
          }}
          className="w-20 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)] tabular-nums text-right"
          inputMode="decimal"
          min="0"
        />
        <span className="text-xs font-medium text-[var(--text-secondary)] w-8">{unit}</span>
      </div>
    </div>
  );
}

export default MacroGoalsSheet;
