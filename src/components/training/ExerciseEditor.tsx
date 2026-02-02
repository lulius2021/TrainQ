import React, { useMemo, useRef } from "react";
import type { LiveSet } from "../../types/training"; // Adjust import path if needed, usually ../../types/training
import { useI18n } from "../../i18n/useI18n";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Info } from "lucide-react";

// -------------------- Helpers --------------------
function parseOptionalNumber(v: string): number | undefined {
  const t = String(v ?? "").trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function fmtPlaceholderNumber(v: unknown, fallback = ""): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : fallback;
}

// -------------------- Swipeable Row Component --------------------

const SwipeableSetRow = ({
  set,
  idx,
  last,
  isCardio,
  activeRest,
  restRemainingSec,
  exerciseId,
  onSetChange,
  onToggleSet,
  onRemoveSet,
  onWeightFocus,
  onWeightBlur,
  weightUnit, // passed from parent to avoid re-hooking
  repsUnit,   // passed from parent
}: any) => {
  const controls = useAnimation();
  const isTimerRunning = activeRest?.exerciseId === exerciseId && activeRest?.setId === set.id;

  // Format "Previous" text
  let prevText = "-";
  if (last) {
    if (last.weight && last.reps) prevText = `${last.weight}kg × ${last.reps}`;
    else if (last.reps) prevText = `${last.reps} Wdh`;
    else if (last.weight) prevText = `${last.weight}kg`;
  }

  const handleDragEnd = (_event: any, info: any) => {
    // Threshold for delete: drag distance < -100px
    if (info.offset.x < -100) {
      // Animate further left to imply deletion
      controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
      onRemoveSet(set.id);
    } else {
      // Snap back if not swiped far enough
      controls.start({ x: 0 });
    }
  };

  const handleTypeCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = set.type || "n";
    const order = ["n", "w", "f", "d"];
    const nextFn = (c: string) => {
      const idx = order.indexOf(c);
      if (idx === -1) return "n";
      return order[(idx + 1) % order.length];
    };
    const next = nextFn(current);
    onSetChange(set.id, { type: next });
  };

  const getTypeLabel = (t?: string) => {
    if (t === "w") return "W";
    if (t === "d") return "D";
    if (t === "f") return "F";
    return String(idx + 1);
  };

  const getTypeColor = (t?: string) => {
    if (t === "w") return "text-yellow-500";
    if (t === "d") return "text-purple-500";
    if (t === "f") return "text-red-500";
    return set.completed ? "text-[#007AFF]" : "text-white";
  };

  return (
    // @ts-ignore: Framer motion prop types workaround
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
      transition={{ duration: 0.2 }}
      className="relative"
    >
      {/* Background Layer (Delete Reveal) */}
      <div className="absolute inset-y-0 right-0 left-0 bg-red-500 rounded-3xl flex items-center justify-end px-4 z-0">
        <div className="flex items-center gap-2 font-bold text-white">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span className="text-sm">Löschen</span>
        </div>
      </div>

      {/* Foreground Layer (Content) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd as any}
        animate={controls}
        style={{ touchAction: "pan-y" }}
        className="relative z-10 bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-sm"
      >
        <div className="grid grid-cols-[24px_1fr_80px_80px_56px] gap-3 items-center bg-[#1c1c1e]">
          {/* 1. Set Index (Type Selector) */}
          <div className="flex items-center justify-center cursor-pointer" onClick={handleTypeCycle}>
            <span className={`text-sm font-bold select-none ${getTypeColor(set.type)}`}>
              {getTypeLabel(set.type)}
            </span>
          </div>

          {/* 2. Previous History */}
          <div className="text-sm font-medium text-white/40 truncate pl-1">
            {prevText}
          </div>

          {/* 3. Input 1 (Weight) */}
          <input
            type="number"
            inputMode="decimal"
            step={isCardio ? 0.1 : 0.5}
            value={typeof set.weight === "number" ? set.weight : ""}
            placeholder={fmtPlaceholderNumber(last?.weight, "-")}
            onChange={(e) => onSetChange(set.id, { weight: parseOptionalNumber(e.target.value) })}
            onFocus={() => onWeightFocus?.(set.id, set.weight)}
            onBlur={() => onWeightBlur?.()}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className={`h-10 w-full rounded-3xl bg-[#2c2c2e] text-white text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-white/20 ${set.completed ? "opacity-50" : ""
              }`}
          />

          {/* 4. Input 2 (Reps) */}
          <input
            type="number"
            value={typeof set.reps === "number" ? set.reps : ""}
            placeholder={fmtPlaceholderNumber(last?.reps, "-")}
            onChange={(e) => onSetChange(set.id, { reps: parseOptionalNumber(e.target.value) })}
            onPointerDownCapture={(e) => e.stopPropagation()}
            className={`h-10 w-full rounded-3xl bg-[#2c2c2e] text-white text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-white/20 ${set.completed ? "opacity-50" : ""
              }`}
            inputMode="numeric"
          />

          {/* 5. Check Button / Timer */}
          <div className="flex items-center justify-center w-full h-10">
            {isTimerRunning && restRemainingSec !== undefined ? (
              <div
                className="h-10 w-14 flex items-center justify-center rounded-3xl bg-[#007AFF] border-2 border-transparent animate-pulse cursor-pointer shrink-0 flex-none"
                onPointerDownCapture={(e) => e.stopPropagation()}
                onClick={() => onToggleSet(set.id)}
              >
                <span className="text-[10px] font-bold text-white tabular-nums tracking-tighter leading-none">
                  {Math.floor(restRemainingSec / 60)}:{(restRemainingSec % 60).toString().padStart(2, "0")}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onToggleSet(set.id)}
                onPointerDownCapture={(e) => e.stopPropagation()}
                className={`h-10 w-14 rounded-3xl flex items-center justify-center shrink-0 flex-none transition-all border-2 ${set.completed
                  ? "bg-[#007AFF] border-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.4)]"
                  : "bg-[#2c2c2e] border-transparent hover:border-[#007AFF]"
                  }`}
              >
                {set.completed ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Optional Notes Row */}
        {set.notes && (
          <div className="mt-1 pl-[36px] pb-1">
            <span className="inline-block text-[10px] font-medium text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded border border-[#007AFF]/20">
              {set.notes}
            </span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// -------------------- Main Component --------------------

export default function ExerciseEditor({
  exercise,
  history,
  isCardio,
  onChange,
  onRemove,
  onAddSet,
  onRemoveSet,
  onSetChange,
  onToggleSet,
  onWeightFocus,
  onWeightBlur,
  activeRest,
  restRemainingSec,
  onOpenExerciseDetails, // New Prop
  onOpenTimer,           // New Prop
}: any) {
  // const { t } = useI18n(); // Removed i18n
  const nameRef = useRef<HTMLInputElement | null>(null);

  const lastSets = useMemo(() => history?.sets ?? [], [history?.sets]);
  const repsUnit = isCardio ? "Min" : "Wdh.";
  const weightUnit = isCardio ? "km" : "kg";
  const addSetLabel = isCardio ? "Intervall hinzufügen" : "Satz hinzufügen";
  const sets = Array.isArray(exercise.sets) ? exercise.sets : [];

  const handleTitleClick = () => {
    if (onOpenExerciseDetails) onOpenExerciseDetails(exercise.id);
  };

  const handleTimerClick = () => {
    if (onOpenTimer) onOpenTimer(exercise.id);
  };

  return (
    <div className="space-y-4 rounded-3xl p-5 bg-[#1c1c1e] border-[1.5px] border-white/5 shadow-2xl">
      {/* Exercise Header */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenExerciseDetails) onOpenExerciseDetails(exercise.id);
          }}
          className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer hover:opacity-75 transition-opacity"
        >
          <h3 className="text-xl font-bold text-white truncate w-full">
            {exercise.name || "Neue Übung"}
          </h3>
          <Info size={20} className="text-[#007AFF] shrink-0" />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timer Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleTimerClick(); }}
            className="h-9 px-3 flex items-center justify-center rounded-2xl bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-colors text-sm font-medium gap-1.5"
          >
            <span>⏱️</span>
            <span>{exercise.restSeconds ? `${Math.floor(exercise.restSeconds / 60)}:${(exercise.restSeconds % 60).toString().padStart(2, '0')}` : "2:00"}</span>
          </button>

          {/* Remove Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="h-9 w-9 flex items-center justify-center rounded-2xl bg-white/5 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors"
            title="Übung entfernen"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="grid grid-cols-[24px_1fr_80px_80px_56px] gap-3 items-center px-1">
        <span className="text-xs font-semibold text-center text-white/30 uppercase tracking-wider">#</span>
        <span className="text-xs font-semibold text-left text-white/30 uppercase tracking-wider pl-1">Vorher</span>
        <span className="text-xs font-semibold text-center text-white/30 uppercase tracking-wider">{weightUnit}</span>
        <span className="text-xs font-semibold text-center text-white/30 uppercase tracking-wider">{repsUnit}</span>
        <div className="flex justify-center items-center w-full">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#007AFF]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col gap-3 relative">
        <AnimatePresence initial={false} mode="popLayout">
          {sets.map((set: LiveSet, idx: number) => {
            const last = lastSets[idx] as any;
            return (
              <SwipeableSetRow
                key={set.id}
                set={set}
                idx={idx}
                last={last}
                isCardio={isCardio}
                exerciseId={exercise.id}
                activeRest={activeRest}
                restRemainingSec={restRemainingSec}
                onSetChange={onSetChange}
                onToggleSet={onToggleSet}
                onRemoveSet={onRemoveSet}
                onWeightFocus={onWeightFocus}
                onWeightBlur={onWeightBlur}
                weightUnit={weightUnit}
                repsUnit={repsUnit}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onAddSet}
          className="w-full h-10 flex items-center justify-center rounded-3xl bg-white/5 text-white/30 hover:bg-white/10 hover:text-white transition-all active:scale-95"
          aria-label={addSetLabel}
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
