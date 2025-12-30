// src/components/training/ExerciseLibraryModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  EXERCISES,
  MUSCLE_GROUPS,
  EQUIPMENTS,
  DIFFICULTIES,
  EXERCISE_TYPES,
  filterExercises,
  type Exercise,
  type ExerciseFilters,
} from "../../data/exerciseLibrary";

type Props = {
  open: boolean;
  title?: string;
  isCardioLibrary?: boolean;
  onClose: () => void;

  // Wenn User auf "Hinzufügen" klickt
  onPick: (exercise: Exercise) => void;

  // Optional: Eigene Übung
  onPickCustom?: () => void;
};

const defaultExerciseFilters: ExerciseFilters = {
  search: "",
  muscle: "alle",
  equipment: "alle",
  difficulty: "alle",
  type: "alle",
};

// Cardio-Library wie in TrainingsplanPage.tsx
const CARDIO_EXERCISES: Exercise[] = [
  {
    id: "cardio_easy_run_30",
    name: "Lockerer Lauf – 30 Min",
    primaryMuscles: ["Beine"],
    equipment: ["Sonstiges"],
    difficulty: "Leicht",
    type: "Ausdauer",
  },
  {
    id: "cardio_tempo_run_20",
    name: "Tempo-Lauf – 20 Min",
    primaryMuscles: ["Beine"],
    equipment: ["Sonstiges"],
    difficulty: "Mittel",
    type: "Ausdauer",
  },
  {
    id: "cardio_interval_run_10x400",
    name: "Intervalle – 10×400 m",
    primaryMuscles: ["Beine"],
    equipment: ["Sonstiges"],
    difficulty: "Schwer",
    type: "Ausdauer",
  },
  {
    id: "cardio_easy_ride_45",
    name: "Lockere Radausfahrt – 45 Min",
    primaryMuscles: ["Beine"],
    equipment: ["Sonstiges"],
    difficulty: "Leicht",
    type: "Ausdauer",
  },
  {
    id: "cardio_interval_bike_8x2",
    name: "Bike-Intervalle – 8×2 Min hart",
    primaryMuscles: ["Beine"],
    equipment: ["Sonstiges"],
    difficulty: "Mittel",
    type: "Ausdauer",
  },
  {
    id: "cardio_long_run_60",
    name: "Langer Lauf – 60 Min",
    primaryMuscles: ["Beine"],
    equipment: ["Sonstiges"],
    difficulty: "Schwer",
    type: "Ausdauer",
  },
];

/**
 * Robust normalizer (ohne \p{Diacritic} RegEx -> kann in manchen Bundlern/Engines stressen)
 */
function normalize(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .trim();
}

function cardioFilter(list: Exercise[], term: string): Exercise[] {
  const t = normalize(term);
  if (!t) return list;
  return list.filter((ex) => normalize(ex.name).includes(t));
}

export default function ExerciseLibraryModal({
  open,
  title,
  isCardioLibrary = false,
  onClose,
  onPick,
  onPickCustom,
}: Props) {
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // ✅ Track last mode to reset irrelevant filter fields when switching library mode
  const lastModeRef = useRef<boolean>(isCardioLibrary);

  useEffect(() => {
    if (!open) return;

    const modeChanged = lastModeRef.current !== isCardioLibrary;
    lastModeRef.current = isCardioLibrary;

    setFilters((prev) => {
      // immer: Suche resetten beim Öffnen (und bei Mode-Wechsel)
      const next: ExerciseFilters = { ...prev, search: "" };

      // wenn auf Cardio gewechselt: Gym-Filter egal, aber wir lassen sie intern sauber auf default,
      // damit der User später beim Zurückwechseln keine "komischen" Reste hat.
      if (modeChanged && isCardioLibrary) {
        return { ...defaultExerciseFilters, search: "" };
      }

      // wenn zurück auf Gym gewechselt: ebenfalls default, damit die Filter UI erwartbar startet
      if (modeChanged && !isCardioLibrary) {
        return { ...defaultExerciseFilters, search: "" };
      }

      return next;
    });

    // Fokus auf Suche
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, isCardioLibrary]);

  // ESC schließt Modal
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filteredExercises = useMemo(() => {
    if (isCardioLibrary) {
      return cardioFilter(CARDIO_EXERCISES, filters.search);
    }
    // Gym: nutzt eure bestehende Filterlogik
    return filterExercises(EXERCISES, filters);
  }, [filters, isCardioLibrary]);

  if (!open) return null;

  const headerTitle = title ?? (isCardioLibrary ? "Cardio-Bibliothek" : "Übungsbibliothek");
  const headerSub = isCardioLibrary ? "Wähle eine Cardio-Einheit aus." : "Wähle eine Übung aus der Bibliothek.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
    >
      <div className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 text-xs shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{headerTitle}</div>
            <div className="truncate text-[11px] text-slate-400">{headerSub}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Schließen
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-100">{headerTitle}</span>

            {!isCardioLibrary && (
              <button
                type="button"
                onClick={() => {
                  onPickCustom?.();
                  // ✅ Modal bleibt offen (gewollt)
                }}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-800"
              >
                + Eigene Übung
              </button>
            )}
          </div>

          <input
            ref={searchRef}
            type="text"
            placeholder={isCardioLibrary ? "Suche (z.B. Lauf, Rad...)" : "Suche (z.B. Bankdrücken)"}
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-sky-500/60"
          />

          {!isCardioLibrary && (
            <div className="grid grid-cols-2 gap-2">
              <select
                value={filters.muscle}
                onChange={(e) => setFilters((prev) => ({ ...prev, muscle: e.target.value as any }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
              >
                <option value="alle">Muskelgruppe: alle</option>
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={filters.equipment}
                onChange={(e) => setFilters((prev) => ({ ...prev, equipment: e.target.value as any }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
              >
                <option value="alle">Equipment: alle</option>
                {EQUIPMENTS.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>

              <select
                value={filters.difficulty}
                onChange={(e) => setFilters((prev) => ({ ...prev, difficulty: e.target.value as any }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
              >
                <option value="alle">Level: alle</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as any }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-100 outline-none"
              >
                <option value="alle">Typ: alle</option>
                {EXERCISE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80">
            {filteredExercises.length === 0 ? (
              <div className="p-3 text-[11px] text-slate-500">Keine Einträge gefunden.</div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {filteredExercises.map((ex) => (
                  <li
                    key={ex.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-900/80"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-slate-100">{ex.name}</div>
                      <div className="truncate text-[10px] text-slate-500">
                        {(ex.equipment || []).join(", ")}
                        {ex.type ? ` · ${ex.type}` : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onPick(ex);
                        // ✅ Modal bleibt offen (wie im Trainingsplan-Flow)
                      }}
                      className="shrink-0 rounded-full bg-sky-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-sky-600"
                    >
                      Hinzufügen
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="text-[10px] text-slate-500">
            Tipp: Du kannst direkt mehrere Übungen hinzufügen – Modal bleibt offen, bis du „Schließen“ drückst.
          </div>
        </div>
      </div>
    </div>
  );
}