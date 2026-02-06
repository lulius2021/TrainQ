import React, { useMemo, useRef } from "react";
import type { LiveSet } from "../../types/training"; // Adjust import path if needed, usually ../../types/training
import { useI18n } from "../../i18n/useI18n";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Info, MoreHorizontal, X, Plus, Trash2 } from "lucide-react";

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

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// -------------------- Helpers Components --------------------

const SwipeableItem = ({ children, onDelete, className }: { children: React.ReactNode; onDelete: () => void; className?: string }) => {
  const controls = useAnimation();
  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      {/* Background Layer (Delete Reveal) */}
      <div className="absolute inset-y-0 right-0 w-full bg-red-500 flex items-center justify-end px-4 rounded-3xl">
        <Trash2 size={18} className="text-white" />
      </div>

      {/* Foreground Layer (Content) */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        // @ts-ignore
        onDragEnd={(_: any, info: any) => {
          if (info.offset.x < -75) {
            controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } }).then(() => {
              onDelete();
            });
          } else {
            controls.start({ x: 0 });
          }
        }}
        animate={controls}
        style={{ touchAction: "pan-y" }}
        className="relative z-10 bg-[#1c1c1e]" // Opaque background to hide delete button
      >
        {children}
      </motion.div>
    </div>
  );
};

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
  const isDropset = set.type === "d" || set.type === "1D"; // Treat 'd' or '1D' as dropset-capable

  // Helper to init drops if missing but type is dropset
  const ensureDrops = () => {
    if (!set.drops) {
      onSetChange(set.id, { drops: [] });
    }
  };

  const addDrop = () => {
    const newDrop = { id: Date.now().toString(), weight: null, reps: null };
    const currentDrops = set.drops || [];
    onSetChange(set.id, { drops: [...currentDrops, newDrop] });
  };

  const removeDrop = (dropId: string) => {
    const currentDrops = set.drops || [];
    onSetChange(set.id, { drops: currentDrops.filter((d: any) => d.id !== dropId) });
  };

  const updateDrop = (dropId: string, patch: any) => {
    const currentDrops = set.drops || [];
    // Ensure we parse numbers correctly
    // If patch has weight/reps, parse them
    const cleanPatch = { ...patch };
    if ('weight' in patch && typeof patch.weight === 'string') {
      const parsed = Number(patch.weight.replace(',', '.'));
      cleanPatch.weight = Number.isFinite(parsed) ? parsed : undefined;
    }
    if ('reps' in patch && typeof patch.reps === 'string') {
      const parsed = Number(patch.reps.replace(',', '.'));
      cleanPatch.reps = Number.isFinite(parsed) ? parsed : undefined;
    }

    onSetChange(set.id, {
      drops: currentDrops.map((d: any) => d.id === dropId ? { ...d, ...cleanPatch } : d)
    });
  };

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

    // If switching to dropset 'd', init drops array if empty
    const updates: any = { type: next };
    if (next === "d" && !set.drops) {
      updates.drops = [];
    }
    onSetChange(set.id, updates);
  };

  const getTypeLabel = (t?: string) => {
    if (t === "w") return "W";
    if (t === "d") return "D"; // Dropset
    if (t === "f") return "F";
    return String(idx + 1);
  };

  const getTypeColor = (t?: string) => {
    if (t === "w") return "text-yellow-500";
    if (t === "d") return "text-purple-500";
    if (t === "f") return "text-red-500";
    return set.completed ? "text-[#007AFF]" : "text-white";
  };

  const toggleDropComplete = (dropId: string) => {
    const currentDrops = set.drops || [];
    const newDrops = currentDrops.map((d: any) =>
      d.id === dropId ? { ...d, completed: !d.completed } : d
    );
    onSetChange(set.id, { drops: newDrops });
  };

  const deleteDrop = (dropId: string) => {
    const currentDrops = set.drops || [];
    const newDrops = currentDrops.filter((d: any) => d.id !== dropId);
    onSetChange(set.id, { drops: newDrops });
  };

  // --- DROPSET UI ---
  // --- DROPSET UI ---
  // Helper for rendering a single input row (Reusable for Main and Drops)
  const renderDropsetRow = (
    label: React.ReactNode,
    weightValue: number | undefined,
    repsValue: number | undefined,
    onChangeWeight: (v: string) => void,
    onChangeReps: (v: string) => void,
    isCompleted: boolean,
    onToggle: () => void,
    isDrop: boolean = false,
    onDeleteRaw?: () => void
  ) => {
    // Background logic:
    // Main set: bg-[#1c1c1e] (same as standard)
    // Drops: no bg or subtle to blend
    return (
      <div className={`grid grid-cols-[24px_1fr_80px_80px_56px] gap-3 items-center ${!isDrop ? 'bg-[#1c1c1e] rounded-3xl p-0' : 'relative pl-0'}`}>

        {/* 1. Label */}
        <div className="flex items-center justify-center cursor-pointer h-10 w-8 shrink-0">
          {typeof label === 'string' ? (
            <span className={`text-sm font-bold select-none ${isDrop ? "text-purple-400 text-[10px] uppercase" : getTypeColor(set.type)}`}>
              {label}
            </span>
          ) : label}
        </div>

        {/* 2. Previous History / Spacer */}
        <div className="text-sm font-medium text-white/40 truncate pl-1 h-10 flex items-center justify-start overflow-hidden">
          {!isDrop ? prevText : ""}
        </div>

        {/* 3. Weight */}
        <input
          type="number"
          inputMode="decimal"
          step={isCardio ? 0.1 : 0.5}
          value={typeof weightValue === "number" ? weightValue : ""}
          placeholder={isDrop ? "kg" : fmtPlaceholderNumber(last?.weight, "-")}
          onChange={(e) => onChangeWeight(e.target.value)}
          onFocus={() => !isDrop && onWeightFocus?.(set.id, set.weight)}
          onBlur={() => !isDrop && onWeightBlur?.()}
          onPointerDownCapture={(e) => e.stopPropagation()}
          className={`h-10 w-full rounded-3xl ${isDrop ? "bg-[#2c2c2e]/50" : "bg-[#2c2c2e]"} text-white text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-white/20 ${(isCompleted && !isDrop) ? "opacity-50" : ""}`}
        />

        {/* 4. Reps */}
        <input
          type="number"
          inputMode="numeric"
          value={typeof repsValue === "number" ? repsValue : ""}
          placeholder={isDrop ? "Wdh" : fmtPlaceholderNumber(last?.reps, "-")}
          onChange={(e) => onChangeReps(e.target.value)}
          onPointerDownCapture={(e) => e.stopPropagation()}
          className={`h-10 w-full rounded-3xl ${isDrop ? "bg-[#2c2c2e]/50" : "bg-[#2c2c2e]"} text-white text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-white/20 ${(isCompleted && !isDrop) ? "opacity-50" : ""}`}
        />

        {/* 5. Checkbox */}
        <div className="flex items-center justify-center w-full h-10 relative">
          {/* Delete Button for Drop */}
          {isDrop && onDeleteRaw && (
            <button
              onClick={onDeleteRaw}
              className="absolute -right-6 text-red-500/50 hover:text-red-500 flex items-center justify-center w-8 h-8"
            >
              <X size={16} />
            </button>
          )}

          {/* Actual Check Button */}
          {(!isDrop && isTimerRunning && restRemainingSec !== undefined) ? (
            <div
              className="h-10 w-14 flex items-center justify-center rounded-3xl bg-[#007AFF] border-2 border-transparent animate-pulse cursor-pointer shrink-0 flex-none"
              onPointerDownCapture={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              <span className="text-[10px] font-bold text-white tabular-nums tracking-tighter leading-none">
                {Math.floor(restRemainingSec / 60)}:{(restRemainingSec % 60).toString().padStart(2, "0")}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className={`h-10 w-14 rounded-3xl flex items-center justify-center shrink-0 flex-none transition-all border-2 ${isCompleted
                ? (isDrop ? "bg-purple-600 border-purple-600 shadow-sm" : "bg-[#007AFF] border-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.4)]")
                : (isDrop ? "bg-[#2c2c2e]/50 border-transparent hover:border-purple-500/50" : "bg-[#2c2c2e] border-transparent hover:border-[#007AFF]")
                }`}
            >
              {isCompleted ? (
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
    );
  };

  if (isDropset) {
    return (
      // @ts-ignore: Framer motion props
      <motion.div
        // @ts-ignore
        layout
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="relative mb-2"
      >
        {/* 1. MAIN ROW (Standard Look) */}
        <div className="relative z-10 bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div onClick={handleTypeCycle} className="w-full">
            {renderDropsetRow(
              getTypeLabel(set.type),
              set.weight,
              set.reps,
              (v) => onSetChange(set.id, { weight: parseOptionalNumber(v) }),
              (v) => onSetChange(set.id, { reps: parseOptionalNumber(v) }),
              set.completed,
              () => {
                // Feature: Auto-fill previous values if empty (for main set)
                let updates: any = {};
                let shouldUpdate = false;
                if (!set.weight && last?.weight) { updates.weight = last.weight; shouldUpdate = true; }
                if (!set.reps && last?.reps) { updates.reps = last.reps; shouldUpdate = true; }
                if (shouldUpdate) onSetChange(set.id, updates);
                onToggleSet(set.id);
              },
              false
            )}
          </div>

          {/* 2. DROPS LIST (Attached below) */}
          {/* 2. DROPS LIST (Attached below) */}
          {(set.drops || []).map((drop: any, i: number) => (
            <div key={drop.id} className="relative pl-0 pt-2 pb-1">
              <SwipeableItem onDelete={() => deleteDrop(drop.id)}>
                {/* Visual Connector - subtle (Inside swipeable area) */}
                <div className="absolute left-[29px] -top-3 bottom-[50%] w-0.5 bg-[#2c2c2e] -z-10"></div>
                <div className="absolute left-[29px] bottom-[25px] w-3 h-0.5 bg-[#2c2c2e] -z-10"></div>

                {renderDropsetRow(
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500/40" />, // Clean visual dot instead of text
                  drop.weight,
                  drop.reps,
                  (v) => updateDrop(drop.id, { weight: v }),
                  (v) => updateDrop(drop.id, { reps: v }),
                  !!drop.completed,
                  () => toggleDropComplete(drop.id),
                  true,
                  undefined // Remove old delete button logic if exists
                )}
              </SwipeableItem>
            </div>
          ))}

          {/* ADD DROP ACTION (Subtle at bottom) */}
          <div className="flex justify-center py-2">
            <button
              onClick={() => {
                const currentDrops = set.drops || [];
                // Determine reference values (Main Set or Last Drop)
                let refWeight = set.weight || 0;
                let refReps = set.reps || 0;

                if (currentDrops.length > 0) {
                  const lastDrop = currentDrops[currentDrops.length - 1];
                  refWeight = lastDrop.weight || 0;
                  refReps = lastDrop.reps || 0;
                }

                // Calculate smart defaults (-5kg step)
                const nextWeight = Math.max(0, refWeight - 5);
                const nextReps = refReps; // Carry over reps

                const newDrop = {
                  id: uid(),
                  weight: nextWeight,
                  reps: nextReps,
                  completed: false
                };
                onSetChange(set.id, { drops: [...currentDrops, newDrop] });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#2c2c2e]/30 text-[10px] font-bold text-white/40 hover:text-purple-400 hover:bg-purple-500/10 transition-colors border border-transparent hover:border-purple-500/20"
            >
              <Plus size={12} />
              DROP
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    // @ts-ignore: Framer motion prop types workaround
    <motion.div
      // @ts-ignore
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
      transition={{ duration: 0.2 }}
      className="relative mb-2" // Add margin bottom for spacing
    >
      {/* Background Layer (Delete Reveal) */}
      <div className="absolute inset-y-0 right-0 left-0 bg-red-500 rounded-3xl flex items-center justify-end px-4 z-0 h-full">
        {/* h-full ensures it matches the dynamic height including drops */}
        <div className="flex items-center gap-2 font-bold text-white">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span className="text-sm">Löschen</span>
        </div>
      </div>

      {/* Foreground Layer (Content) */}
      <motion.div
        // @ts-ignore
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd as any}
        animate={controls}
        style={{ touchAction: "pan-y" }}
        className={`relative z-10 bg-[#1c1c1e] rounded-3xl overflow-hidden shadow-sm flex flex-col ${isDropset ? 'border border-purple-500/20' : ''}`} // Add border for dropsets
      >
        <div className="grid grid-cols-[24px_1fr_80px_80px_56px] gap-3 items-center bg-[#1c1c1e] p-0">
          {/* Main Row Content */}

          {/* 1. Set Index (Type Selector) */}
          <div className="flex items-center justify-center cursor-pointer h-10" onClick={handleTypeCycle}>
            {/* h-10 to align with inputs */}
            <span className={`text-sm font-bold select-none ${getTypeColor(set.type)}`}>
              {getTypeLabel(set.type)}
            </span>
          </div>

          {/* 2. Previous History */}
          <div className="text-sm font-medium text-white/40 truncate pl-1 h-10 flex items-center">
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
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSet(set.id);
                }}
              >
                <span className="text-[10px] font-bold text-white tabular-nums tracking-tighter leading-none">
                  {Math.floor(restRemainingSec / 60)}:{(restRemainingSec % 60).toString().padStart(2, "0")}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  // Feature: Auto-fill previous values if empty
                  let updates: any = {};
                  let shouldUpdate = false;

                  // Check Weight (if 0 or undefined/null)
                  if (!set.weight && last?.weight) {
                    updates.weight = last.weight;
                    shouldUpdate = true;
                  }

                  // Check Reps (if 0 or undefined/null)
                  if (!set.reps && last?.reps) {
                    updates.reps = last.reps;
                    shouldUpdate = true;
                  }

                  if (shouldUpdate) {
                    console.log("Auto-filling set from history:", updates);
                    onSetChange(set.id, updates);
                  }

                  onToggleSet(set.id);
                }}
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

        {/* --- DROPS UI --- */}
        {isDropset && (
          <div className="flex flex-col gap-2 pb-3 px-3 border-t border-white/5 bg-black/10 pt-2">
            {/* Header for Drops */}
            <div className="flex justify-between items-center pl-8 text-xs text-purple-400 font-semibold uppercase tracking-wide">
              <span>Dropsets</span>
              <button onClick={addDrop} className="flex items-center gap-1 hover:text-purple-300">
                <span className="text-lg leading-none">+</span> Drop
              </button>
            </div>

            {/* Drop Rows */}
            {(set.drops || []).map((drop: any, i: number) => (
              <div key={drop.id} className="grid grid-cols-[24px_1fr_80px_80px_56px] gap-3 items-center">
                {/* 1. Spacer/Icon */}
                <div className="flex justify-center">
                  <div className="w-1 h-full bg-purple-500/20 rounded-full"></div>
                </div>

                {/* 2. Label */}
                <div className="text-xs text-right text-purple-300/50 pr-2">
                  Drop {i + 1}
                </div>

                {/* 3. Weight Input */}
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  value={typeof drop.weight === "number" ? drop.weight : ""}
                  placeholder="kg"
                  onChange={(e) => updateDrop(drop.id, { weight: e.target.value })}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="h-8 w-full rounded-2xl bg-[#2c2c2e]/50 text-white text-center text-sm font-medium outline-none border border-white/5 focus:border-purple-500/50 transition-all placeholder-white/10"
                />

                {/* 4. Reps Input */}
                <input
                  type="number"
                  inputMode="numeric"
                  value={typeof drop.reps === "number" ? drop.reps : ""}
                  placeholder="Wdh"
                  onChange={(e) => updateDrop(drop.id, { reps: e.target.value })}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  className="h-8 w-full rounded-2xl bg-[#2c2c2e]/50 text-white text-center text-sm font-medium outline-none border border-white/5 focus:border-purple-500/50 transition-all placeholder-white/10"
                />

                {/* 5. Remove Button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => removeDrop(drop.id)}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-white/5 transition-colors"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
            <span>
              {typeof exercise.restSeconds === 'number'
                ? exercise.restSeconds < 60
                  ? `${exercise.restSeconds}s`
                  : `${Math.floor(exercise.restSeconds / 60)}:${(exercise.restSeconds % 60).toString().padStart(2, '0')}`
                : "2:00"}
            </span>
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
