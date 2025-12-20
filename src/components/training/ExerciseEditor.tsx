// src/components/training/ExerciseEditor.tsx

import type { LiveExercise, LiveSet, ExerciseHistoryEntry } from "../../types/training";

type Props = {
  exercise: LiveExercise;
  history?: ExerciseHistoryEntry | null;

  onChange: (patch: Partial<LiveExercise>) => void;
  onRemove: () => void;

  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onSetChange: (setId: string, patch: Partial<LiveSet>) => void;
  onToggleSet: (setId: string) => void;
};

export default function ExerciseEditor({
  exercise,
  history,
  onChange,
  onRemove,
  onAddSet,
  onRemoveSet,
  onSetChange,
  onToggleSet,
}: Props) {
  // Helper: damit wir bei leeren Inputs nicht aus Versehen 0 speichern
  const parseOptionalNumber = (v: string): number | undefined => {
    const trimmed = v.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  };

  const fmtLast = (v: unknown, fallback: string) => {
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return fallback;
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <input
          value={exercise.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full bg-transparent text-sm font-semibold outline-none"
        />

        <button onClick={onRemove} className="shrink-0 text-xs text-red-400 hover:text-red-300">
          Entfernen
        </button>
      </div>

      {/* Optional: Rest */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">Pause</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={30}
            max={300}
            step={5}
            value={exercise.restSeconds ?? 90}
            onChange={(e) => onChange({ restSeconds: parseOptionalNumber(e.target.value) ?? 90 })}
            className="w-20 rounded bg-slate-800 px-2 py-1 text-right"
          />
          <span className="text-slate-400">sek</span>
        </div>
      </div>

      {/* Sets */}
      <div className="space-y-1.5">
        {exercise.sets.map((set, idx) => {
          // graue Werte: falls weniger history-sets existieren als aktuelle sets -> undefined ok
          const last = history?.sets?.[idx];

          return (
            <div key={set.id} className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onToggleSet(set.id)}
                className={`h-5 w-5 rounded border ${
                  set.completed ? "bg-emerald-500 border-emerald-400" : "border-slate-600"
                }`}
                title={set.completed ? "Set erledigt" : "Set offen"}
              />

              <span className="w-6 text-slate-400">{idx + 1}</span>

              <input
                type="number"
                inputMode="numeric"
                placeholder={fmtLast(last?.reps, "Wdh")}
                value={typeof set.reps === "number" ? set.reps : ""}
                onChange={(e) => onSetChange(set.id, { reps: parseOptionalNumber(e.target.value) })}
                className="w-16 rounded bg-slate-800 px-2 py-1"
              />

              <input
                type="number"
                inputMode="decimal"
                placeholder={fmtLast(last?.weight, "kg")}
                value={typeof set.weight === "number" ? set.weight : ""}
                onChange={(e) => onSetChange(set.id, { weight: parseOptionalNumber(e.target.value) })}
                className="w-16 rounded bg-slate-800 px-2 py-1"
              />

              <button
                type="button"
                onClick={() => onRemoveSet(set.id)}
                className="ml-auto text-red-400 text-xs hover:text-red-300"
                title="Set löschen"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onAddSet} className="text-xs text-sky-400 hover:text-sky-300">
        + Satz
      </button>
    </div>
  );
}