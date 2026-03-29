// src/components/nutrition/FoodDetailSheet.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import { hapticSheetClose, hapticButton, hapticSelect } from "../../native/haptics";
import type { FoodItem, Macros } from "../../types/nutrition";
import { resolveToGrams } from "../../features/nutrition/unitResolver";
import { computeMacros } from "../../features/nutrition/macroCalculator";

const MotionDiv = motion.div as any;

interface FoodDetailSheetProps {
  food: FoodItem | null;
  initialQty: number;
  initialUnit: string;
  onLog: (
    foodId: string,
    amountGrams: number,
    displayAmount: string,
    macros: Macros
  ) => void;
  onClose: () => void;
}

const CLOSE_OFFSET_PX = 100;
const CLOSE_VELOCITY_PX = 700;

type DragInfo = { offset: { y: number }; velocity: { y: number } };

const FoodDetailSheet: React.FC<FoodDetailSheetProps> = ({
  food,
  initialQty,
  initialUnit,
  onLog,
  onClose,
}) => {
  const [qty, setQty] = useState(initialQty);
  const [unit, setUnit] = useState(initialUnit);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Reset on food change
  useEffect(() => {
    setQty(initialQty);
    setUnit(initialUnit);
  }, [food, initialQty, initialUnit]);

  // Lock scroll
  useEffect(() => {
    if (!food) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [food]);

  // Build unit options
  const unitOptions = useMemo(() => {
    if (!food) return [{ value: "g", label: "g" }];
    const opts: { value: string; label: string }[] = [
      { value: "g", label: "g" },
      { value: "ml", label: "ml" },
    ];
    for (const s of food.servings) {
      if (!opts.find((o) => o.value === s.unit)) {
        opts.push({ value: s.unit, label: s.label });
      }
    }
    return opts;
  }, [food]);

  // Computed macros
  const amountGrams = useMemo(() => {
    if (!food) return 0;
    return resolveToGrams(qty, unit, food);
  }, [qty, unit, food]);

  const macros = useMemo(() => {
    if (!food) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return computeMacros(food.per100g, amountGrams);
  }, [food, amountGrams]);

  const handleLog = () => {
    if (!food) return;
    hapticButton();
    const selectedOption = unitOptions.find((o) => o.value === unit);
    const unitLabel = selectedOption?.label || unit;
    const displayAmount =
      unit === "g" || unit === "ml" ? `${qty}${unit}` : `${qty} ${unitLabel}`;
    onLog(food.id, amountGrams, displayAmount, macros);
  };

  const handleClose = () => {
    hapticSheetClose();
    onClose();
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: DragInfo) => {
    if (info.offset.y > CLOSE_OFFSET_PX || info.velocity.y > CLOSE_VELOCITY_PX) {
      handleClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  return (
    <AnimatePresence>
      {food && (
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
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
          >
            {/* Handle — drag zone */}
            <div
              className="flex justify-center py-3"
              onPointerDown={(e) => dragControls.start(e)}
              style={{ cursor: "grab" }}
            >
              <div className="h-1.5 w-10 rounded-full bg-[var(--border-color)]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-2">
              <h3 className="text-lg font-bold text-[var(--text-color)] truncate flex-1 mr-3">
                {food.name}
              </h3>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
              >
                <X size={16} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Macro preview */}
            <div className="px-5 py-3">
              <div className="grid grid-cols-4 gap-2">
                <MacroTile
                  label="Kcal"
                  value={macros.kcal}
                  unit=""
                  color="var(--accent-color)"
                />
                <MacroTile
                  label="Protein"
                  value={macros.protein}
                  unit="g"
                  color="#3b82f6"
                />
                <MacroTile
                  label="Carbs"
                  value={macros.carbs}
                  unit="g"
                  color="#f59e0b"
                />
                <MacroTile
                  label="Fett"
                  value={macros.fat}
                  unit="g"
                  color="#ec4899"
                />
              </div>
            </div>

            {/* Quantity + Unit */}
            <div className="px-5 py-3 flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                  Menge
                </label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setQty(isNaN(v) ? 0 : Math.max(0, v));
                  }}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)] tabular-nums"
                  inputMode="decimal"
                  min="0"
                  step="any"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                  Einheit
                </label>
                <select
                  value={unit}
                  onChange={(e) => { hapticSelect(); setUnit(e.target.value); }}
                  className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)] appearance-none"
                >
                  {unitOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount info */}
            <div className="px-5 pb-2">
              <p className="text-xs text-[var(--text-secondary)]">
                = {Math.round(amountGrams)}g
              </p>
            </div>

            {/* Log button */}
            <div className="px-5 pt-2 pb-6">
              <button
                onClick={handleLog}
                disabled={qty <= 0}
                className="w-full py-3.5 rounded-2xl bg-[var(--accent-color)] text-white font-bold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                Eintragen
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

function MacroTile({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  const displayVal =
    Number.isInteger(value) || label === "Kcal"
      ? Math.round(value)
      : value.toFixed(1);

  return (
    <div className="bg-[var(--bg-color)] rounded-xl p-2.5 text-center border border-[var(--border-color)]">
      <div className="text-lg font-bold tabular-nums" style={{ color }}>
        {displayVal}
      </div>
      <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
        {label}
        {unit && ` (${unit})`}
      </div>
    </div>
  );
}

export default FoodDetailSheet;
