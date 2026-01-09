// src/components/training/ExerciseLibraryModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  existingExerciseIds?: string[];

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
  existingExerciseIds,
  onPick,
  onPickCustom,
}: Props) {
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const existingKey = useMemo(() => (existingExerciseIds ?? []).join("|"), [existingExerciseIds]);
  const existingSet = useMemo(() => new Set(existingExerciseIds ?? []), [existingKey]);
  const [localAddedIds, setLocalAddedIds] = useState<Set<string>>(() => new Set(existingExerciseIds ?? []));

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
    setLocalAddedIds(new Set(existingExerciseIds ?? []));
  }, [open, isCardioLibrary, existingKey, existingExerciseIds]);

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

  const headerTitle = "Übungsbibliothek";
  const headerSub = "Übung auswählen";

  const surfaceBox: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" };
  const surfaceSoft: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 px-4"
      data-overlay-open="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
    >
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl text-xs shadow-xl" style={surfaceBox}>
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>{headerTitle}</div>
            <div className="truncate text-[11px]" style={muted}>{headerSub}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-3 py-1.5 text-[11px] hover:opacity-95"
              style={{ ...surfaceSoft, color: "var(--text)" }}
            >
              Schließen
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-3" style={{ background: "var(--surface)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px]" style={muted}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder={isCardioLibrary ? "Suche (z.B. Lauf, Rad...)" : "Suche (z.B. Bankdrücken)"}
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="w-full rounded-xl border px-10 py-3 text-sm outline-none focus:ring-1 focus:ring-sky-500/60 placeholder:text-[color:var(--muted)]"
                    style={{ ...surfaceSoft, color: "var(--text)" }}
                  />
                </div>
              </div>

              {!isCardioLibrary && (
                <button
                  type="button"
                  onClick={() => {
                    onPickCustom?.();
                  }}
                  className="shrink-0 rounded-xl border px-3 py-2 text-[11px] hover:opacity-95"
                  style={{ ...surfaceSoft, color: "var(--text)" }}
                >
                  + Eigene Übung
                </button>
              )}
            </div>

            {!isCardioLibrary && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filters.muscle}
                    onChange={(e) => setFilters((prev) => ({ ...prev, muscle: e.target.value as any }))}
                    className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                    style={{ ...surfaceSoft, color: "var(--text)" }}
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
                    className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                    style={{ ...surfaceSoft, color: "var(--text)" }}
                  >
                    <option value="alle">Equipment: alle</option>
                    {EQUIPMENTS.map((eq) => (
                      <option key={eq} value={eq}>
                        {eq}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMoreFilters((v) => !v)}
                  className="inline-flex items-center gap-2 text-[11px] font-medium hover:opacity-95"
                  style={{ color: "var(--text)" }}
                >
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                  >
                    {showMoreFilters ? "–" : "+"}
                  </span>
                  Weitere Filter
                </button>

                {showMoreFilters && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filters.difficulty}
                      onChange={(e) => setFilters((prev) => ({ ...prev, difficulty: e.target.value as any }))}
                      className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                      style={{ ...surfaceSoft, color: "var(--text)" }}
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
                      className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                      style={{ ...surfaceSoft, color: "var(--text)" }}
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
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredExercises.length === 0 ? (
              <div className="rounded-xl border p-4 text-[12px]" style={{ ...surfaceSoft, color: "var(--muted)" }}>
                Keine Einträge gefunden.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredExercises.map((ex) => {
                  const isAdded = existingSet.has(ex.id) || localAddedIds.has(ex.id);
                  return (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between gap-3 rounded-xl border px-4 py-4"
                      style={{
                        background: isAdded ? "rgba(16,185,129,0.08)" : "var(--surface2)",
                        borderColor: isAdded ? "rgba(16,185,129,0.35)" : "var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-semibold" style={{ color: "var(--text)" }}>
                          {ex.name}
                        </div>
                        <div className="truncate text-[11px]" style={muted}>
                          {(ex.equipment || []).join(", ")}
                          {ex.type ? ` · ${ex.type}` : ""}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => {
                          if (isAdded) return;
                          onPick(ex);
                          setLocalAddedIds((prev) => new Set([...prev, ex.id]));
                        }}
                        className="shrink-0 rounded-full px-3 py-2 text-[11px] font-semibold hover:opacity-95 disabled:cursor-not-allowed"
                        style={
                          isAdded
                            ? {
                                background: "rgba(16,185,129,0.18)",
                                color: "rgba(16,185,129,0.95)",
                                border: "1px solid rgba(16,185,129,0.35)",
                              }
                            : { background: "var(--primary)", color: "#061226" }
                        }
                      >
                        {isAdded ? (
                          <span className="inline-flex items-center gap-1.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Hinzugefügt
                          </span>
                        ) : (
                          "Hinzufügen"
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 text-[10px]" style={muted}>
            Tipp: Du kannst direkt mehrere Übungen hinzufügen – Modal bleibt offen, bis du „Schließen“ drückst.
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
