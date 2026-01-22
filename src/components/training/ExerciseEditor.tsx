// src/components/training/ExerciseEditor.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DropEntry, ExerciseHistoryEntry, LiveExercise, LiveSet, SetTag, SetType } from "../../types/training";
import { useI18n } from "../../i18n/useI18n";

// ... (helpers can be kept as they are, they are not UI-related)
function parseOptionalNumber(v: string): number | undefined {
  const t = String(v ?? "").trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
function fmtPlaceholderNumber(v: unknown, fallback = ""): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : fallback;
}
function buildId(prefix = "drop"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
// ...

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
  onMoveUp,
  onMoveDown,
}: any) {
  const { t } = useI18n();
  const nameRef = useRef<HTMLInputElement | null>(null);

  const lastSets = useMemo(() => history?.sets ?? [], [history?.sets]);
  const repsUnit = isCardio ? t("training.units.min") : t("training.units.repsShort");
  const weightUnit = isCardio ? t("training.units.km") : t("training.units.kg");
  const addSetLabel = isCardio ? t("training.exercise.addInterval") : t("training.exercise.addSet");
  const sets = Array.isArray(exercise.sets) ? exercise.sets : [];

  return (
    <div className="space-y-4 rounded-2xl p-5 bg-white/10 border-[1.5px] border-white/10 backdrop-blur-xl shadow-lg">
      <div className="flex items-center gap-3">
        <input
          ref={nameRef}
          value={String(exercise.name ?? "")}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 min-w-0 bg-transparent text-3xl font-black text-[var(--text)] outline-none text-left truncate"
          placeholder={t("training.exercise.placeholder")}
        />
        <button
          type="button"
          onClick={onRemove}
          className="h-12 w-12 flex items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
          title={t("training.exercise.delete")}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>

      <div className="space-y-3">
        {sets.map((set: LiveSet, idx: number) => {
          const last = lastSets[idx] as any;
          return (
            <div key={set.id} className="flex flex-col gap-2">
              <div className="grid grid-cols-[auto,1fr,1fr] gap-3 items-center">
                <button
                  type="button"
                  onClick={() => onToggleSet(set.id)}
                  className={`h-14 w-14 rounded-2xl border-2 transition-colors flex items-center justify-center ${set.completed ? 'bg-[var(--primary)] border-transparent' : 'border-[var(--border)] hover:opacity-80'}`}
                  aria-label={set.completed ? t("training.exercise.setMarkOpen") : t("training.exercise.setMarkDone")}
                >
                  {set.completed ? (
                    <svg viewBox="0 0 24 24" className="h-8 w-8 text-white"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <span className="text-xl font-bold text-[var(--muted)]">{idx + 1}</span>
                  )}
                </button>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-[var(--muted)]">{repsUnit}</label>
                  <input
                    type="number"
                    value={typeof set.reps === "number" ? set.reps : ""}
                    placeholder={fmtPlaceholderNumber(last?.reps)}
                    onChange={(e) => onSetChange(set.id, { reps: parseOptionalNumber(e.target.value) })}
                    className="h-14 w-full rounded-2xl px-4 bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] text-center text-xl font-bold tabular-nums"
                    inputMode="numeric"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-[var(--muted)]">{weightUnit}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={isCardio ? 0.1 : 0.5}
                    value={typeof set.weight === "number" ? set.weight : ""}
                    placeholder={fmtPlaceholderNumber(last?.weight)}
                    onChange={(e) => onSetChange(set.id, { weight: parseOptionalNumber(e.target.value) })}
                    onFocus={() => onWeightFocus?.(set.id, set.weight)}
                    onBlur={() => onWeightBlur?.()}
                    className="h-14 w-full rounded-2xl px-4 bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] text-center text-xl font-bold tabular-nums"
                  />
                </div>
              </div>
              {/* ✅ Why-Label / Note */}
              {set.notes && (
                <div className="ml-[68px] flex items-center gap-2">
                  <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                    {set.notes}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={onAddSet} className="w-full h-14 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] font-bold hover:opacity-80 transition-colors text-base">
        {addSetLabel}
      </button>
    </div>
  );
}
