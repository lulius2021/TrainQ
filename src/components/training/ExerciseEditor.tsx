// src/components/training/ExerciseEditor.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseHistoryEntry, LiveExercise, LiveSet } from "../../types/training";

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
          <span className="text-sm font-semibold text-white">Löschen</span>
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
      <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-black/50">
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
}: Props) {
  // Autofocus für neue Übung
  const nameRef = useRef<HTMLInputElement | null>(null);
  const didAutoFocusRef = useRef(false);

  useEffect(() => {
    if (didAutoFocusRef.current) return;
    const n = String(exercise.name || "").trim().toLowerCase();
    if (!n || n === "übung" || n === "neue übung") {
      didAutoFocusRef.current = true;
      requestAnimationFrame(() => {
        nameRef.current?.focus();
        nameRef.current?.select?.();
      });
    }
  }, [exercise.id, exercise.name]);

  const lastSets = useMemo(() => history?.sets ?? [], [history?.sets]);

  const repsUnit = isCardio ? "min" : "Wdh";
  const weightUnit = isCardio ? "km" : "kg";
  const restLabel = isCardio ? "Pause (optional)" : "Pause";
  const addSetLabel = isCardio ? "+ Intervall" : "+ Satz";
  const notesPlaceholder = isCardio ? "Pace / Intervall-Details" : "Notizen / RPE / Tempo";

  // ✅ Pause ist optional: Standard = aus, erst via Uhr+ einblendbar
  const hasRest = typeof (exercise as any).restSeconds === "number" && (exercise as any).restSeconds > 0;
  const [showRestPicker, setShowRestPicker] = useState<boolean>(hasRest);

  useEffect(() => {
    if (hasRest) setShowRestPicker(true);
    if (!hasRest) setShowRestPicker(false);
  }, [hasRest]);

  const restOptions = useMemo(() => buildRestOptions(5), []);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <input
          ref={nameRef}
          value={String(exercise.name ?? "")}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full bg-transparent text-sm font-semibold outline-none"
          placeholder="Übung"
        />
        <button type="button" onClick={onRemove} className="text-sm text-white/70 hover:text-white">
          Löschen
        </button>
      </div>

      {/* Pause (Uhr+ -> erst dann Picker sichtbar, iOS: select = Wheel) */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">{restLabel}</span>

        {!showRestPicker ? (
          <button
            type="button"
            onClick={() => setShowRestPicker(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[12px] font-semibold text-white/85 hover:bg-white/5"
            title="Pause hinzufügen (optional)"
          >
            <ClockPlusIcon className="h-4 w-4" />
            Pause
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
              className="rounded bg-black/40 px-2 py-1 text-right"
              aria-label="Pausenzeit in Sekunden"
              title="Sekunden (optional)"
            >
              <option value="">Keine</option>
              {restOptions.map((s) => (
                <option key={s} value={String(s)}>
                  {s} sek
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                onChange({ restSeconds: undefined });
                setShowRestPicker(false);
              }}
              className="rounded bg-black/35 px-2 py-1 text-white/70 hover:text-white"
              aria-label="Pause entfernen"
              title="Pause entfernen"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Sets */}
      <div className="space-y-2">
        {exercise.sets.map((set, idx) => {
          const last = lastSets[idx] as any;

          return (
            <SwipeSetRow key={set.id} onDelete={() => onRemoveSet(set.id)}>
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSet(set.id)}
                    className={`h-5 w-5 rounded border ${
                      set.completed ? "border-emerald-400 bg-emerald-500" : "border-white/30"
                    }`}
                    aria-label={set.completed ? "Satz als offen markieren" : "Satz als erledigt markieren"}
                  />
                  <span className="w-6 text-white/50">{idx + 1}</span>

                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={typeof set.reps === "number" ? set.reps : ""}
                      placeholder={fmtPlaceholderNumber(last?.reps)}
                      onChange={(e) => onSetChange(set.id, { reps: parseOptionalNumber(e.target.value) })}
                      className="w-16 rounded bg-black/50 px-2 py-1"
                      inputMode="numeric"
                      aria-label={isCardio ? "Minuten" : "Wiederholungen"}
                    />
                    <span className="text-white/55">{repsUnit}</span>
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
                      className="w-16 rounded bg-black/50 px-2 py-1"
                      aria-label={isCardio ? "Kilometer" : "Gewicht in kg"}
                    />
                    <span className="text-white/55">{weightUnit}</span>
                  </div>
                </div>

                {/* ✅ Notes */}
                <input
                  type="text"
                  value={typeof (set as any).notes === "string" ? (set as any).notes : ""}
                  onChange={(e) => onSetChange(set.id, { ...(set as any), notes: e.target.value } as any)}
                  placeholder={notesPlaceholder}
                  className="w-full rounded bg-black/50 px-2 py-1 text-[11px] text-white/80 outline-none"
                  aria-label="Notizen"
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