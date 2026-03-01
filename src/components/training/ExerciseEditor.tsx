import React, { useMemo, useRef, useState, useCallback } from "react";
import type { LiveSet } from "../../types/training"; // Adjust import path if needed, usually ../../types/training
import { useI18n } from "../../i18n/useI18n";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Info, MoreHorizontal, X, Plus, Trash2 } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { WeightSuggestion } from "../../utils/weightSuggestion";

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

function useSwipeToDismiss(onDelete: () => void) {
  const contentRef = useRef<HTMLDivElement>(null);
  const state = useRef({
    startX: 0,
    startY: 0,
    currentX: 0,
    locked: null as "h" | "v" | null,
    active: false,
  });

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = contentRef.current;
    if (!el) return;
    const t = e.touches[0];
    state.current = { startX: t.clientX, startY: t.clientY, currentX: 0, locked: null, active: true };
    el.style.transition = "none";
    el.style.willChange = "transform";
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const s = state.current;
    if (!s.active) return;
    const t = e.touches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;

    if (!s.locked) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        s.locked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (s.locked === "h" && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      return;
    }
    if (s.locked === "v") return;

    // Only allow swiping left
    const clamped = Math.min(0, dx);
    s.currentX = clamped;
    if (contentRef.current) {
      contentRef.current.style.transform = `translateX(${clamped}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    const s = state.current;
    const el = contentRef.current;
    s.active = false;

    if (!el) return;
    el.style.willChange = "";

    if (s.locked !== "h") {
      el.style.transition = "transform 0.2s ease";
      el.style.transform = "translateX(0)";
      return;
    }

    if (s.currentX < -70) {
      // Dismiss — slide out and delete
      el.style.transition = "transform 0.18s ease-out, opacity 0.18s ease-out";
      el.style.transform = "translateX(-110%)";
      el.style.opacity = "0";
      setTimeout(() => onDelete(), 180);
    } else {
      // Snap back
      el.style.transition = "transform 0.2s ease";
      el.style.transform = "translateX(0)";
    }
  }, [onDelete]);

  return { contentRef, onTouchStart, onTouchMove, onTouchEnd };
}

const SwipeableItem = ({ children, onDelete, className }: { children: React.ReactNode; onDelete: () => void; className?: string }) => {
  const { contentRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeToDismiss(onDelete);
  return (
    <div className={`relative overflow-hidden ${className || ""}`}>
      <div className="absolute inset-y-0 right-0 w-full bg-red-500 flex items-center justify-end px-4 rounded-3xl">
        <Trash2 size={18} className="text-white" />
      </div>
      <div
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative z-10"
      >
        {children}
      </div>
    </div>
  );
};

// -------------------- Swipeable Drop Row --------------------

const SwipeableDropRow = ({ drop, theme, onUpdate, onToggle, onDelete, label, isMain }: {
  drop: any; theme: any;
  onUpdate: (patch: any) => void;
  onToggle: () => void;
  onDelete: () => void;
  label?: React.ReactNode;
  isMain?: boolean;
}) => {
  const { contentRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeToDismiss(onDelete);
  const isCompleted = !!drop.completed;

  return (
    <div className="relative overflow-hidden">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 left-0 bg-red-500 flex items-center justify-end px-4 z-0">
        <Trash2 size={14} className="text-white" />
      </div>
      {/* Foreground */}
      <div
        ref={contentRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="relative z-10 grid grid-cols-[40px_1fr_1fr_50px] gap-3 items-center px-0 py-1"
        style={{ backgroundColor: theme.colors.card }}
      >
        <div className="flex items-center justify-center">
          {label || <div className="w-1.5 h-1.5 rounded-full bg-purple-500/40" />}
        </div>
        <input
          type="number" inputMode="decimal" step={0.5}
          value={typeof drop.weight === "number" ? drop.weight : ""} placeholder="kg"
          onChange={(e) => {
            const parsed = Number(e.target.value.replace(",", "."));
            onUpdate({ weight: Number.isFinite(parsed) ? parsed : undefined });
          }}
          style={{ backgroundColor: theme.colors.inputBackground, color: theme.colors.text }}
          className={`${isMain ? "h-10 text-base" : "h-9 text-sm"} w-full rounded-3xl text-center font-bold outline-none border-2 border-transparent ${isMain ? "focus:border-[#007AFF]/50" : "focus:border-purple-500/50"} transition-all placeholder-zinc-400 ${isCompleted ? "opacity-50" : ""}`}
        />
        <input
          type="number" inputMode="numeric"
          value={typeof drop.reps === "number" ? drop.reps : ""} placeholder="Wdh"
          onChange={(e) => {
            const parsed = Number(e.target.value.replace(",", "."));
            onUpdate({ reps: Number.isFinite(parsed) ? parsed : undefined });
          }}
          style={{ backgroundColor: theme.colors.inputBackground, color: theme.colors.text }}
          className={`${isMain ? "h-10 text-base" : "h-9 text-sm"} w-full rounded-3xl text-center font-bold outline-none border-2 border-transparent ${isMain ? "focus:border-[#007AFF]/50" : "focus:border-purple-500/50"} transition-all placeholder-zinc-400 ${isCompleted ? "opacity-50" : ""}`}
        />
        <div className="flex items-center justify-center">
          <button type="button" onClick={onToggle}
            className={`${isMain ? "h-10 w-14" : "h-9 w-12"} rounded-3xl flex items-center justify-center shrink-0 flex-none transition-all border-2 ${isCompleted
              ? (isMain ? "bg-[#007AFF] border-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.4)]" : "bg-purple-600 border-purple-600 shadow-sm")
              : (isMain ? "border-transparent hover:border-[#007AFF]" : "border-transparent hover:border-purple-500/50")
            }`}
            style={{ backgroundColor: !isCompleted ? theme.colors.inputBackground : undefined }}
          >
            {isCompleted ? (
              <svg viewBox="0 0 24 24" className={`${isMain ? "h-5 w-5" : "h-4 w-4"} text-white`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            ) : (
              <div className="h-2 w-2 rounded-full bg-[var(--border-color)]" />
            )}
          </button>
        </div>
      </div>
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
  prSets,     // Set<string> of set IDs that are PRs
}: any) => {
  const { theme } = useTheme();
  const isTimerRunning = activeRest?.exerciseId === exerciseId && activeRest?.setId === set.id;
  const isDropset = set.type === "d" || set.type === "1D"; // Treat 'd' or '1D' as dropset-capable

  const { contentRef: swipeRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeToDismiss(
    () => onRemoveSet(set.id)
  );

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
    return set.completed ? "text-[#007AFF]" : "text-[var(--text-color)]";
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
    // Main set: theme.colors.card
    // Drops: no bg or subtle
    return (
      <div
        className={`grid grid-cols-[40px_1fr_1fr_50px] gap-3 items-center ${!isDrop ? 'rounded-3xl p-0' : 'relative pl-0'}`}
        style={{ backgroundColor: !isDrop ? theme.colors.card : 'transparent' }}
      >

        {/* 1. Label */}
        <div className="flex items-center justify-center cursor-pointer h-10 w-8 shrink-0">
          {typeof label === 'string' ? (
            <span className={`text-sm font-bold select-none ${isDrop ? "text-purple-400 text-[10px] uppercase" : getTypeColor(set.type)}`}>
              {label}
            </span>
          ) : label}
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

          style={{
            backgroundColor: isDrop ? (theme.mode === 'dark' ? 'rgba(44, 44, 46, 0.5)' : '#E5E5EA') : theme.colors.inputBackground,
            color: theme.colors.text
          }}
          className={`h-10 w-full rounded-3xl text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-zinc-400 ${(isCompleted && !isDrop) ? "opacity-50" : ""}`}
        />

        {/* 4. Reps */}
        <input
          type="number"
          inputMode="numeric"
          value={typeof repsValue === "number" ? repsValue : ""}
          placeholder={isDrop ? "Wdh" : fmtPlaceholderNumber(last?.reps, "-")}
          onChange={(e) => onChangeReps(e.target.value)}

          style={{
            backgroundColor: isDrop ? (theme.mode === 'dark' ? 'rgba(44, 44, 46, 0.5)' : '#E5E5EA') : theme.colors.inputBackground,
            color: theme.colors.text
          }}
          className={`h-10 w-full rounded-3xl text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-zinc-400 ${(isCompleted && !isDrop) ? "opacity-50" : ""}`}
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
    
              className={`h-10 w-14 rounded-3xl flex items-center justify-center shrink-0 flex-none transition-all border-2 ${isCompleted
                ? (isDrop ? "bg-purple-600 border-purple-600 shadow-sm" : (prSets?.has(set.id) ? "bg-[#FFD700] border-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.5)]" : "bg-[#007AFF] border-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.4)]"))
                : (isDrop ? "border-transparent hover:border-purple-500/50" : "border-transparent hover:border-[#007AFF]")
                }`}
              style={{
                backgroundColor: !isCompleted ? (isDrop ? (theme.mode === 'dark' ? 'rgba(44,44,46,0.5)' : '#E5E5EA') : theme.colors.inputBackground) : undefined
              }}
            >
              {isCompleted ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <div className="h-2 w-2 rounded-full bg-[var(--border-color)]" />
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
        className="mb-2"
        style={{ backgroundColor: theme.colors.card, borderRadius: 16, overflow: "hidden" }}
      >
        {/* Main set row — individually swipeable */}
        <SwipeableDropRow
          drop={{ ...set, weight: set.weight, reps: set.reps, completed: set.completed }}
          theme={theme}
          onUpdate={(patch) => onSetChange(set.id, patch)}
          onToggle={() => {
            let updates: any = {};
            if (!set.weight && last?.weight) updates.weight = last.weight;
            if (!set.reps && last?.reps) updates.reps = last.reps;
            if (Object.keys(updates).length) onSetChange(set.id, updates);
            onToggleSet(set.id);
          }}
          onDelete={() => onRemoveSet(set.id)}
          label={
            <div className="flex items-center justify-center cursor-pointer h-10" onClick={handleTypeCycle}>
              <span className={`text-sm font-bold select-none ${getTypeColor(set.type)}`}>{getTypeLabel(set.type)}</span>
            </div>
          }
          isMain
        />

        {/* Drop rows — individually swipeable */}
        {(set.drops || []).map((drop: any) => (
          <SwipeableDropRow
            key={drop.id}
            drop={drop}
            theme={theme}
            onUpdate={(patch) => updateDrop(drop.id, patch)}
            onToggle={() => toggleDropComplete(drop.id)}
            onDelete={() => deleteDrop(drop.id)}
          />
        ))}

        {/* Add drop button */}
        <div className="flex justify-center py-2">
          <button
            onClick={() => {
              const currentDrops = set.drops || [];
              let refWeight = set.weight || 0;
              let refReps = set.reps || 0;
              if (currentDrops.length > 0) {
                const lastDrop = currentDrops[currentDrops.length - 1];
                refWeight = lastDrop.weight || 0;
                refReps = lastDrop.reps || 0;
              }
              onSetChange(set.id, { drops: [...currentDrops, { id: uid(), weight: Math.max(0, refWeight - 5), reps: refReps, completed: false }] });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors"
            style={{ backgroundColor: theme.colors.inputBackground, color: "var(--text-secondary)" }}
          >
            <Plus size={12} />
            DROP
          </button>
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
      <div className="absolute inset-y-0 right-0 left-0 bg-red-500 rounded-2xl flex items-center justify-end px-4 z-0 h-full">
        <div className="flex items-center gap-2 font-bold text-white">
          <Trash2 size={16} />
          <span className="text-sm">Löschen</span>
        </div>
      </div>

      {/* Foreground Layer (Content) */}
      <div
        ref={swipeRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ backgroundColor: theme.colors.card }}
        className={`relative z-10 rounded-2xl overflow-hidden flex flex-col ${isDropset ? 'border border-purple-500/20' : ''}`}
      >
        <div className="grid grid-cols-[40px_1fr_1fr_50px] gap-3 items-center p-0">

          {/* 1. Set Index (Type Selector) */}
          <div className="flex items-center justify-center cursor-pointer h-10" onClick={handleTypeCycle}>
            {/* h-10 to align with inputs */}
            <span className={`text-sm font-bold select-none ${getTypeColor(set.type)}`}>
              {getTypeLabel(set.type)}
            </span>
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
            style={{ backgroundColor: theme.colors.inputBackground, color: theme.colors.text }}
            className={`h-10 w-full rounded-3xl text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-zinc-400 ${set.completed ? "opacity-50" : ""
              }`}
          />

          {/* 4. Input 2 (Reps) */}
          <input
            type="number"
            value={typeof set.reps === "number" ? set.reps : ""}
            placeholder={fmtPlaceholderNumber(last?.reps, "-")}
            onChange={(e) => onSetChange(set.id, { reps: parseOptionalNumber(e.target.value) })}
            style={{ backgroundColor: theme.colors.inputBackground, color: theme.colors.text }}
            className={`h-10 w-full rounded-3xl text-center text-base font-bold outline-none border-2 border-transparent focus:border-[#007AFF]/50 transition-all placeholder-zinc-400 ${set.completed ? "opacity-50" : ""
              }`}
            inputMode="numeric"
          />

          {/* 5. Check Button / Timer */}
          <div className="flex items-center justify-center w-full h-10">
            {isTimerRunning && restRemainingSec !== undefined ? (
              <div
                className="h-10 w-14 flex items-center justify-center rounded-3xl bg-[#007AFF] border-2 border-transparent animate-pulse cursor-pointer shrink-0 flex-none"
                onClick={() => onToggleSet(set.id)}
              >
                <span className="text-[10px] font-bold text-white tabular-nums tracking-tighter leading-none">
                  {Math.floor(restRemainingSec / 60)}:{(restRemainingSec % 60).toString().padStart(2, "0")}
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  // Feature: Auto-fill previous values if empty
                  let updates: any = {};
                  let shouldUpdate = false;

                  if (!set.weight && last?.weight) {
                    updates.weight = last.weight;
                    shouldUpdate = true;
                  }

                  if (!set.reps && last?.reps) {
                    updates.reps = last.reps;
                    shouldUpdate = true;
                  }

                  if (shouldUpdate) {
                    onSetChange(set.id, updates);
                  }

                  onToggleSet(set.id);
                }}
                className={`h-10 w-14 rounded-3xl flex items-center justify-center shrink-0 flex-none transition-all border-2 ${set.completed
                  ? (prSets?.has(set.id) ? "bg-[#FFD700] border-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.5)]" : "bg-[#007AFF] border-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.4)]")
                  : "border-transparent hover:border-[#007AFF]"
                  }`}
                style={{ backgroundColor: !set.completed ? theme.colors.inputBackground : undefined }}
              >
                {set.completed ? (
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-[var(--border-color)]" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* --- DROPS UI --- */}
        {isDropset && (
          <div className="flex flex-col gap-2 pb-3 px-3 border-t border-[var(--border-color)] bg-[var(--bg-color)]/10 pt-2">
            {/* Header for Drops */}
            <div className="flex justify-between items-center pl-8 text-xs text-purple-400 font-semibold uppercase tracking-wide">
              <span>Dropsets</span>
              <button onClick={addDrop} className="flex items-center gap-1 hover:text-purple-300">
                <span className="text-lg leading-none">+</span> Drop
              </button>
            </div>

            {/* Drop Rows */}
            {(set.drops || []).map((drop: any, i: number) => (
              <div key={drop.id} className="grid grid-cols-[40px_1fr_1fr_50px] gap-3 items-center">
                {/* 1. Spacer/Icon */}
                <div className="flex justify-center">
                  <div className="w-1 h-full bg-purple-500/20 rounded-full"></div>
                </div>



                {/* 3. Weight Input */}
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  value={typeof drop.weight === "number" ? drop.weight : ""}
                  placeholder="kg"
                  onChange={(e) => updateDrop(drop.id, { weight: e.target.value })}
        
                  className="h-8 w-full rounded-2xl bg-[var(--button-bg)] text-[var(--text-color)] text-center text-sm font-medium outline-none border border-[var(--border-color)] focus:border-purple-500/50 transition-all placeholder-[var(--text-secondary)]/30"
                />

                {/* 4. Reps Input */}
                <input
                  type="number"
                  inputMode="numeric"
                  value={typeof drop.reps === "number" ? drop.reps : ""}
                  placeholder="Wdh"
                  onChange={(e) => updateDrop(drop.id, { reps: e.target.value })}
        
                  className="h-8 w-full rounded-2xl bg-[var(--button-bg)] text-[var(--text-color)] text-center text-sm font-medium outline-none border border-[var(--border-color)] focus:border-purple-500/50 transition-all placeholder-[var(--text-secondary)]/30"
                />

                {/* 5. Remove Button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => removeDrop(drop.id)}
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-[var(--button-bg)] transition-colors"
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
      </div>
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
  weightSuggestion,      // Weight suggestion from history
  onAddWarmupSets,       // Warmup sets callback
  prSets,                // Set<string> of set IDs that are PRs
}: any) {
  const { theme } = useTheme();

  if (!theme) return null;

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
    <div className="space-y-4 rounded-3xl p-5 border-[1.5px] shadow-2xl" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
      {/* Exercise Header */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenExerciseDetails) onOpenExerciseDetails(exercise.id);
          }}
          className="flex-1 min-w-0 flex items-start gap-2 cursor-pointer hover:opacity-75 transition-opacity"
        >
          <h3
            className="text-xl font-bold w-full pr-2 leading-tight"
            style={{
              color: theme.colors.text,
              flexWrap: 'wrap',
              wordBreak: 'break-word',
              whiteSpace: 'normal',
              overflow: 'visible',
              flex: 1
            }}
          >
            {exercise.name || "Neue Übung"}
          </h3>
          <Info size={20} className="text-[#007AFF] shrink-0 self-start mt-1" />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Timer Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleTimerClick(); }}
            className="h-9 px-3 flex items-center justify-center rounded-2xl transition-colors text-sm font-medium gap-1.5"
            style={{ backgroundColor: "var(--input-bg)", color: "var(--text-secondary)" }}
          >
            <span>⏱️</span>
            <span>
              {typeof exercise.restSeconds === 'number' && exercise.restSeconds > 0
                ? exercise.restSeconds < 60
                  ? `${exercise.restSeconds}s`
                  : `${Math.floor(exercise.restSeconds / 60)}:${(exercise.restSeconds % 60).toString().padStart(2, '0')}`
                : "-"}
            </span>
          </button>

          {/* Remove Button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="h-9 w-9 flex items-center justify-center rounded-2xl hover:bg-red-500/20 hover:text-red-400 transition-colors"
            style={{ backgroundColor: "var(--input-bg)", color: "var(--text-secondary)" }}
            title="Übung entfernen"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weight Suggestion Banner */}
      {weightSuggestion && (
        <div className="flex flex-col gap-0.5 px-1 -mt-1 mb-1">
          <span className="text-xs font-medium" style={{ color: theme.colors.textSecondary }}>
            Letztes Mal: {weightSuggestion.lastWeight}kg &times; {weightSuggestion.lastReps}
          </span>
          {weightSuggestion.allSetsCompleted && (
            <span className="text-xs font-semibold text-[#007AFF]">
              Vorschlag: {weightSuggestion.suggestedWeight}kg (+{weightSuggestion.increment}kg)
            </span>
          )}
        </div>
      )}

      {/* Warmup Button */}
      {onAddWarmupSets && !isCardio && (() => {
        const hasWarmupSets = sets.some((s: LiveSet) => s.setType === "warmup" || (s as any).type === "w");
        const firstWorkingSet = sets.find((s: LiveSet) => s.setType !== "warmup" && (s as any).type !== "w");
        const firstWeight = firstWorkingSet?.weight;
        const canAdd = !hasWarmupSets && typeof firstWeight === "number" && firstWeight > 0;
        return canAdd ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddWarmupSets(); }}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-2xl text-xs font-semibold transition-all active:scale-95 border border-yellow-500/20"
            style={{ backgroundColor: "rgba(234,179,8,0.08)", color: "#EAB308" }}
          >
            <span>🔥</span> Aufwärmsätze hinzufügen
          </button>
        ) : null;
      })()}

      {/* Grid Header */}
      <div className="grid grid-cols-[40px_1fr_1fr_50px] gap-3 items-center px-0 mb-1">
        <div className="flex justify-center"><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.colors.textSecondary }}>#</span></div>
        <div className="flex justify-center"><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.colors.textSecondary }}>{weightUnit}</span></div>
        <div className="flex justify-center"><span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: theme.colors.textSecondary }}>{repsUnit}</span></div>
        <div className="flex justify-center items-center w-full">
          <svg viewBox="0 0 24 24" className="h-4 w-4" style={{ color: theme.colors.textSecondary }} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                prSets={prSets}
              />
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onAddSet}
          className="w-full h-10 flex items-center justify-center rounded-3xl transition-all active:scale-95"
          style={{ backgroundColor: "var(--input-bg)", color: "var(--text-secondary)" }}
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
