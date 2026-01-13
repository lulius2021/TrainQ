// src/components/training/ExerciseEditor.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseHistoryEntry, LiveExercise, LiveSet, SetType } from "../../types/training";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  exercise: LiveExercise;
  history?: ExerciseHistoryEntry | null;

  /**
   * OPTIONAL:
   * - false/undefined => Gym UI (Wdh + kg)
   * - true           => Cardio UI (Min + km)
   */
  isCardio?: boolean;

  onChange: (patch: Partial<LiveExercise>) => void;
  onRemove: () => void;

  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onSetChange: (setId: string, patch: Partial<LiveSet>) => void;
  onToggleSet: (setId: string) => void;

  /** ✅ NEW: wird bei Fokus im kg/k m Feld getriggert (für Plattenrechner-Button) */
  onWeightFocus?: (setId: string, currentWeight?: unknown) => void;
  /** ✅ NEW: optionaler Blur-Hook */
  onWeightBlur?: () => void;
  /** ✅ NEW: Workout-Reihenfolge hoch/runter */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

// ---------------- helpers ----------------

// Leere Inputs => undefined (unterstützt auch Komma)
function parseOptionalNumber(v: string): number | undefined {
  const t = String(v ?? "").trim();
  if (!t) return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function fmtPlaceholderNumber(v: unknown, fallback = ""): string {
  return typeof v === "number" && Number.isFinite(v) ? String(v) : fallback;
}

/** Swipe */
const SWIPE_ACTION_W = 110;
const DELETE_THRESHOLD = 0.9;
const REVEAL_MIN_PROGRESS = 0.06;

/* ---------------- Swipe Row ---------------- */

function SwipeSetRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  const clamp = (v: number) => Math.max(-SWIPE_ACTION_W, Math.min(0, v));
  const progress = Math.min(1, Math.abs(offset) / SWIPE_ACTION_W);
  const showDelete = progress >= REVEAL_MIN_PROGRESS;

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const finishDrag = (el: HTMLElement | null) => {
    draggingRef.current = false;
    try {
      if (pointerIdRef.current != null) el?.releasePointerCapture?.(pointerIdRef.current);
    } catch {
      // ignore
    }
    pointerIdRef.current = null;

    const finalOffset = offsetRef.current;
    if (Math.abs(finalOffset) / SWIPE_ACTION_W >= DELETE_THRESHOLD) {
      onDelete();
    }
    setOffset(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete layer */}
      <div className="absolute inset-0 flex items-center justify-end">
        <div
          className="flex h-full items-center justify-center rounded-xl px-6"
          style={{
            opacity: showDelete ? 1 : 0,
            transition: draggingRef.current ? "none" : "opacity 120ms ease",
            background: "linear-gradient(180deg, rgba(248,113,113,.92), rgba(185,28,28,.92))",
          }}
        >
          <span className="text-sm font-semibold text-white">{t("common.delete")}</span>
        </div>
      </div>

      <div
        className="relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: draggingRef.current ? "none" : "transform 160ms ease",
          touchAction: "pan-y",
        }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          pointerIdRef.current = e.pointerId;
          startXRef.current = e.clientX;
          startOffsetRef.current = offsetRef.current;
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          const next = clamp(startOffsetRef.current + (e.clientX - startXRef.current));
          setOffset(next);
        }}
        onPointerUp={(e) => finishDrag(e.currentTarget)}
        onPointerCancel={(e) => finishDrag(e.currentTarget)}
        onPointerLeave={(e) => {
          if (draggingRef.current) finishDrag(e.currentTarget);
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------------- Rest UI helpers ---------------- */

function ClockPlusIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" />
      </svg>

      {/* Plus badge */}
      <span
        className="absolute -right-1.5 -top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border"
        style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
    </span>
  );
}

function buildRestOptions(step = 5): number[] {
  const arr: number[] = [];
  for (let s = 10; s <= 300; s += step) arr.push(s);
  return arr;
}

/* ---------------- Component ---------------- */

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
}: Props) {
  const { t } = useI18n();
  const defaultName = t("training.exercise.defaultName");
  const newName = t("training.exercise.newName");

  // Autofocus für neue Übung
  const nameRef = useRef<HTMLInputElement | null>(null);
  const didAutoFocusRef = useRef(false);

  useEffect(() => {
    if (didAutoFocusRef.current) return;
    const n = String(exercise.name || "").trim().toLowerCase();
    if (!n || n === defaultName.toLowerCase() || n === newName.toLowerCase()) {
      didAutoFocusRef.current = true;
      requestAnimationFrame(() => {
        nameRef.current?.focus();
        nameRef.current?.select?.();
      });
    }
  }, [exercise.id, exercise.name, defaultName, newName]);

  const lastSets = useMemo(() => history?.sets ?? [], [history?.sets]);

  // ✅ Einheiten-Validierung:
  // - Gym/Custom: reps = Wiederholungen, weight = kg
  // - Laufen/Radfahren (Cardio): reps = Minuten, weight = km
  // Diese Logik ist konsistent mit trainingHistory.ts (computeCardioFromSets)
  const repsUnit = isCardio ? t("training.units.min") : t("training.units.repsShort");
  const weightUnit = isCardio ? t("training.units.km") : t("training.units.kg");
  const restLabel = isCardio ? t("training.exercise.restOptional") : t("training.exercise.rest");
  const addSetLabel = isCardio ? t("training.exercise.addInterval") : t("training.exercise.addSet");
  const notesPlaceholder = isCardio ? t("training.exercise.notesPlaceholderCardio") : t("training.exercise.notesPlaceholder");

  // ✅ Pause ist optional: Standard = aus, erst via Uhr+ einblendbar
  const hasRest = typeof (exercise as any).restSeconds === "number" && (exercise as any).restSeconds > 0;
  const [showRestPicker, setShowRestPicker] = useState<boolean>(hasRest);

  useEffect(() => {
    if (hasRest) setShowRestPicker(true);
    if (!hasRest) setShowRestPicker(false);
  }, [hasRest]);

  const restOptions = useMemo(() => buildRestOptions(5), []);
  const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
  const surfaceSoft: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  return (
    <div className="space-y-3 rounded-xl p-3" style={surfaceSoft}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="h-7 w-7 flex items-center justify-center rounded-lg border hover:opacity-95"
              style={{ ...surfaceSoft, color: "var(--text)" }}
              title={t("training.exercise.moveUp")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M12 6l-6 6h4v6h4v-6h4z" fill="currentColor" />
              </svg>
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="h-7 w-7 flex items-center justify-center rounded-lg border hover:opacity-95"
              style={{ ...surfaceSoft, color: "var(--text)" }}
              title={t("training.exercise.moveDown")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M12 18l6-6h-4V6h-4v6H6z" fill="currentColor" />
              </svg>
            </button>
          )}
        </div>
        <input
          ref={nameRef}
          value={String(exercise.name ?? "")}
          onChange={(e) => onChange({ name: e.target.value })}
          className="flex-1 bg-transparent text-sm font-semibold outline-none"
          style={{ color: "var(--text)" }}
          placeholder={t("training.exercise.placeholder")}
        />
        <button
          type="button"
          onClick={onRemove}
          className="h-7 w-7 flex items-center justify-center rounded-lg border hover:bg-red-500/20 hover:text-red-400"
          style={{ ...surfaceSoft, color: "rgba(239,68,68,0.8)" }}
          title={t("training.exercise.delete")}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 7l1 12h8l1-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Pause (Uhr+ -> erst dann Picker sichtbar, iOS: select = Wheel) */}
      <div className="flex items-center justify-between text-xs">
        <span style={muted}>{restLabel}</span>

        {!showRestPicker ? (
          <button
            type="button"
            onClick={() => setShowRestPicker(true)}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold hover:opacity-95"
            style={{ ...surfaceSoft, color: "var(--text)" }}
            title={t("training.exercise.addRest")}
          >
            <ClockPlusIcon className="h-4 w-4" />
            {t("training.exercise.rest")}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={hasRest ? String((exercise as any).restSeconds) : ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw) {
                  onChange({ restSeconds: undefined });
                  return;
                }
                const n = parseOptionalNumber(raw);
                onChange({ restSeconds: n });
              }}
              className="rounded px-2 py-1 text-right"
              style={{ ...surfaceSoft, color: "var(--text)" }}
              aria-label={t("training.exercise.restSecondsAria")}
              title={t("training.exercise.secondsOptional")}
            >
              <option value="">{t("common.none")}</option>
              {restOptions.map((s) => (
                <option key={s} value={String(s)}>
                  {s} {t("training.units.secShort")}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                onChange({ restSeconds: undefined });
                setShowRestPicker(false);
              }}
              className="rounded px-2 py-1 hover:opacity-95"
              style={{ ...surfaceSoft, color: "var(--text)" }}
              aria-label={t("training.exercise.removeRest")}
              title={t("training.exercise.removeRest")}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Sets */}
      <div className="space-y-2">
        {sets.map((set, idx) => {
          const last = lastSets[idx] as any;

          return (
            <SwipeSetRow key={`${set.id}-${idx}`} onDelete={() => onRemoveSet(set.id)}>
              <div className="space-y-2 rounded-xl border px-2 py-2 text-xs" style={surfaceSoft}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSet(set.id)}
                    className={`h-5 w-5 rounded border ${
                      set.completed ? "border-emerald-400 bg-emerald-500" : ""
                    }`}
                    style={!set.completed ? { borderColor: "var(--border)" } : undefined}
                    aria-label={set.completed ? t("training.exercise.setMarkOpen") : t("training.exercise.setMarkDone")}
                  />
                  <span className="w-6" style={muted}>{idx + 1}</span>
                  
                  {/* ✅ Satztyp-Selector */}
                  <select
                    value={set.setType || "normal"}
                    onChange={(e) => onSetChange(set.id, { setType: e.target.value as SetType })}
                    className="h-6 rounded px-1.5 text-[10px] border"
                    style={{ ...surfaceSoft, color: "var(--text)", minWidth: 50 }}
                  >
                    <option value="normal">{t("training.exercise.setType.normal")}</option>
                    <option value="warmup">{t("training.exercise.setType.warmupShort")}</option>
                    <option value="failure">{t("training.exercise.setType.failureShort")}</option>
                    <option value="1D">{t("training.exercise.setType.dropShort")}</option>
                  </select>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={typeof set.reps === "number" ? set.reps : ""}
                      placeholder={fmtPlaceholderNumber(last?.reps)}
                      onChange={(e) => onSetChange(set.id, { reps: parseOptionalNumber(e.target.value) })}
                      className="w-16 rounded px-2 py-1"
                      style={{ ...surfaceSoft, color: "var(--text)" }}
                      inputMode="numeric"
                      aria-label={isCardio ? t("training.units.min") : t("training.units.reps")}
                    />
                    <span style={muted}>{repsUnit}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      step={isCardio ? 0.1 : 0.5}
                      value={typeof set.weight === "number" ? set.weight : ""}
                      placeholder={fmtPlaceholderNumber(last?.weight)}
                      onChange={(e) => onSetChange(set.id, { weight: parseOptionalNumber(e.target.value) })}
                      onFocus={() => onWeightFocus?.(set.id, (set as any).weight)}
                      onBlur={() => onWeightBlur?.()}
                      className="w-16 rounded px-2 py-1"
                      style={{ ...surfaceSoft, color: "var(--text)" }}
                      aria-label={isCardio ? t("training.units.km") : t("training.units.weightKg")}
                    />
                    <span style={muted}>{weightUnit}</span>
                  </div>
                </div>

                {/* ✅ Notes */}
                <input
                  type="text"
                  value={typeof (set as any).notes === "string" ? (set as any).notes : ""}
                  onChange={(e) => onSetChange(set.id, { ...(set as any), notes: e.target.value } as any)}
                  placeholder={notesPlaceholder}
                  className="w-full rounded px-2 py-1 text-[11px] outline-none placeholder:text-[color:var(--muted)]"
                  style={{ ...surfaceSoft, color: "var(--text)" }}
                  aria-label={t("training.exercise.notes")}
                />
              </div>
            </SwipeSetRow>
          );
        })}
      </div>

      <button type="button" onClick={onAddSet} className="text-xs text-brand-primary">
        {addSetLabel}
      </button>
    </div>
  );
}
