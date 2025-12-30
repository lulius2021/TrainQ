// src/pages/TrainingsplanPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { CalendarEvent, NewCalendarEvent } from "../types/training";
import {
  EXERCISES,
  MUSCLE_GROUPS,
  EQUIPMENTS,
  DIFFICULTIES,
  EXERCISE_TYPES,
  filterExercises,
  type Exercise,
  type ExerciseFilters,
} from "../data/exerciseLibrary";

// History für graue Werte in der Vorschau
import { getLastSetsForExercise } from "../utils/trainingHistory";

// ✅ Seeds stabil per date|title (Dashboard-kompatibel)
import {
  writeLiveSeedForKey,
  makeSeedKey,
  writeGlobalLiveSeed,
  navigateToLiveTraining,
} from "../utils/liveTrainingSeed";

// ✅ Free-Limit: 7 Tage im Voraus (Date helper)
import { isWithinDaysAhead } from "../utils/dateLimits";

// ✅ Entitlements (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";
import { FREE_LIMITS } from "../utils/entitlements";

// -------------------- Typen --------------------

type WeeklyDayType = "training" | "rest";
type WeeklySportType = "Gym" | "Laufen" | "Radfahren" | "Custom";

type ExerciseSet = {
  id: number;
  reps?: number;
  weight?: number;
  notes?: string;
};

type BlockExercise = {
  id: number;
  exerciseId?: string;
  name: string;
  sets: ExerciseSet[];
};

type TrainingTemplate = {
  id: number;
  label: string;
  exercises: BlockExercise[];
};

type WeeklyDayConfig = TrainingTemplate & {
  type: WeeklyDayType;
  sport: WeeklySportType;
  focus: string;

  // ✅ Nur Startzeit (optional)
  startTime?: string;
};

type RoutineBlockType =
  | "Push"
  | "Pull"
  | "Legs"
  | "Upper"
  | "Lower"
  | "Full Body"
  | "Cardio"
  | "Rest"
  | "Custom";

type RoutineBlock = TrainingTemplate & {
  type: RoutineBlockType;
  sport: WeeklySportType;

  // ✅ Nur Startzeit (optional)
  startTime?: string;
};

type ActiveTab = "weekly" | "routine";
type TrainingContainerKind = "weekly" | "routine";

interface TrainingsplanPageProps {
  onAddEvent?: (input: NewCalendarEvent) => void;

  // optional: falls du Plan-Shift/Update später nutzt
  events?: CalendarEvent[];
  onUpdateEvents?: (next: CalendarEvent[]) => void;

  isPro?: boolean;
  onOpenPaywall?: (reason: "plan_shift" | "calendar_7days" | "adaptive_limit") => void;
}

// Vorlagen
type WeeklyPlanTemplate = {
  id: string;
  name: string;
  days: WeeklyDayConfig[];
  durationWeeks: number;
};

type RoutinePlanTemplate = {
  id: string;
  name: string;
  blocks: RoutineBlock[];
  durationWeeks: number;
};

// ✅ Reine Trainings (Workout-Vorlagen)
type WorkoutTemplate = {
  id: string;
  name: string;
  sport: WeeklySportType;
  isCardio: boolean;
  exercises: BlockExercise[];
  createdAtISO: string;
};

// -------------------- Konfiguration --------------------

const DEFAULT_WEEKLY_DAYS: WeeklyDayConfig[] = [
  { id: 1, label: "Montag", type: "training", sport: "Gym", focus: "Push (Brust/Schulter/Trizeps)", exercises: [], startTime: "" },
  { id: 2, label: "Dienstag", type: "training", sport: "Gym", focus: "Pull (Rücken/Bizeps)", exercises: [], startTime: "" },
  { id: 3, label: "Mittwoch", type: "training", sport: "Gym", focus: "Beine", exercises: [], startTime: "" },
  { id: 4, label: "Donnerstag", type: "rest", sport: "Custom", focus: "Ruhetag", exercises: [], startTime: "" },
  { id: 5, label: "Freitag", type: "training", sport: "Gym", focus: "Push", exercises: [], startTime: "" },
  { id: 6, label: "Samstag", type: "training", sport: "Gym", focus: "Pull", exercises: [], startTime: "" },
  { id: 7, label: "Sonntag", type: "rest", sport: "Custom", focus: "Ruhetag", exercises: [], startTime: "" },
];

const DEFAULT_ROUTINE_BLOCKS: RoutineBlock[] = [
  { id: 1, type: "Custom", sport: "Gym", label: "Push (Brust/Schulter/Trizeps)", exercises: [], startTime: "" },
  { id: 2, type: "Custom", sport: "Gym", label: "Pull (Rücken/Bizeps)", exercises: [], startTime: "" },
  { id: 3, type: "Custom", sport: "Gym", label: "Beine", exercises: [], startTime: "" },
  { id: 4, type: "Rest", sport: "Custom", label: "Ruhetag", exercises: [], startTime: "" },
];

const defaultExerciseFilters: ExerciseFilters = {
  search: "",
  muscle: "alle",
  equipment: "alle",
  difficulty: "alle",
  type: "alle",
};

const CARDIO_EXERCISES: Exercise[] = [
  { id: "cardio_easy_run_30", name: "Lockerer Lauf – 30 Min", primaryMuscles: ["Beine"], equipment: ["Sonstiges"], difficulty: "Leicht", type: "Ausdauer" },
  { id: "cardio_tempo_run_20", name: "Tempo-Lauf – 20 Min", primaryMuscles: ["Beine"], equipment: ["Sonstiges"], difficulty: "Mittel", type: "Ausdauer" },
  { id: "cardio_interval_run_10x400", name: "Intervalle – 10×400 m", primaryMuscles: ["Beine"], equipment: ["Sonstiges"], difficulty: "Schwer", type: "Ausdauer" },
  { id: "cardio_easy_ride_45", name: "Lockere Radausfahrt – 45 Min", primaryMuscles: ["Beine"], equipment: ["Sonstiges"], difficulty: "Leicht", type: "Ausdauer" },
  { id: "cardio_interval_bike_8x2", name: "Bike-Intervalle – 8×2 Min hart", primaryMuscles: ["Beine"], equipment: ["Sonstiges"], difficulty: "Mittel", type: "Ausdauer" },
  { id: "cardio_long_run_60", name: "Langer Lauf – 60 Min", primaryMuscles: ["Beine"], equipment: ["Sonstiges"], difficulty: "Schwer", type: "Ausdauer" },
];

// Storage-Keys
const STORAGE_KEY_WEEKLY_TEMPLATES = "trainq_weekly_plan_templates";
const STORAGE_KEY_ROUTINE_TEMPLATES = "trainq_routine_plan_templates";
const STORAGE_KEY_WORKOUT_TEMPLATES = "trainq_workout_templates_v1";

// ✅ Startplan-Settings (nur Startdatum)
const STORAGE_KEY_PLAN_START_ISO = "trainq_plan_start_date_iso";

// ✅ letzte Import-TemplateId
const STORAGE_KEY_LAST_IMPORTED_TEMPLATE_ID = "trainq_last_import_template_id_v1";

// IDs für Übungen/Sätze
let blockExerciseIdCounter = 1;
let exerciseSetIdCounter = 1;
function nextBlockExerciseId() {
  return blockExerciseIdCounter++;
}
function nextExerciseSetId() {
  return exerciseSetIdCounter++;
}

// Helpers
function dateToISO(d: Date): string {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function isoToDate(iso: string): Date {
  const [y, m, dd] = iso.split("-").map((v) => Number(v));
  const dt = new Date();
  dt.setFullYear(y || dt.getFullYear());
  dt.setMonth(m ? m - 1 : dt.getMonth());
  dt.setDate(dd || dt.getDate());
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function estimateDurationMinutes(exercises: BlockExercise[], isCardio: boolean): number {
  if (!exercises.length) return 0;

  if (isCardio) {
    let total = 0;
    for (const ex of exercises) for (const s of ex.sets) total += typeof s.reps === "number" ? s.reps : 10;
    return Math.max(5, Math.round(total));
  }

  const sets = exercises.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0);
  return Math.max(10, Math.round(sets * 2));
}

function startLiveTrainingWithSeed(seed: { title: string; sport: WeeklySportType; isCardio: boolean; exercises: BlockExercise[] }) {
  writeGlobalLiveSeed({
    title: seed.title,
    sport: seed.sport,
    isCardio: seed.isCardio,
    exercises: seed.exercises as any,
  });
  navigateToLiveTraining();
}

function normalizeExercisesForSeed(exercises: BlockExercise[]): any[] {
  if (!Array.isArray(exercises)) return [];
  return exercises.map((ex) => ({
    id: String(ex.id ?? Date.now()),
    exerciseId: ex.exerciseId,
    name: ex.name ?? "Übung",
    sets: Array.isArray(ex.sets)
      ? ex.sets.map((s) => ({
          id: String(s.id ?? Date.now()),
          reps: typeof s.reps === "number" ? s.reps : undefined,
          weight: typeof s.weight === "number" ? s.weight : undefined,
          notes: typeof s.notes === "string" ? s.notes : "",
        }))
      : [],
  }));
}

function normalizeLastSummary(last: unknown): { weight?: number; reps?: number } | null {
  if (!last) return null;
  const anyLast = last as any;

  if (typeof anyLast === "object" && ("lastWeight" in anyLast || "lastReps" in anyLast)) {
    return {
      weight: typeof anyLast.lastWeight === "number" ? anyLast.lastWeight : undefined,
      reps: typeof anyLast.lastReps === "number" ? anyLast.lastReps : undefined,
    };
  }

  if (typeof anyLast === "object" && Array.isArray(anyLast.sets) && anyLast.sets.length > 0) {
    const s0 = anyLast.sets[0] as any;
    return {
      weight: typeof s0?.weight === "number" ? s0.weight : undefined,
      reps: typeof s0?.reps === "number" ? s0.reps : undefined,
    };
  }

  if (Array.isArray(anyLast) && anyLast.length > 0) {
    const s0 = anyLast[0] as any;
    return {
      weight: typeof s0?.weight === "number" ? s0.weight : undefined,
      reps: typeof s0?.reps === "number" ? s0.reps : undefined,
    };
  }

  return null;
}

// ✅ Migration/Guard für alte Routine-Blocks
function normalizeRoutineBlock(input: any, fallbackId: number): RoutineBlock {
  const type: RoutineBlockType = (input?.type as RoutineBlockType) || "Custom";
  const sportFromOldType: WeeklySportType = type === "Cardio" ? "Laufen" : type === "Rest" ? "Custom" : "Gym";
  const sport: WeeklySportType = (input?.sport as WeeklySportType) || sportFromOldType;

  const label =
    typeof input?.label === "string" && input.label.trim()
      ? input.label
      : type === "Rest"
      ? "Ruhetag"
      : "Neuer Block";

  return {
    id: typeof input?.id === "number" ? input.id : fallbackId,
    type,
    sport,
    label,
    exercises: Array.isArray(input?.exercises) ? input.exercises : [],
    startTime: typeof input?.startTime === "string" ? input.startTime : "",
  };
}

function isLikelyGymDefaultLabel(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (!t) return true;

  const defaults = ["push", "pull", "beine", "legs", "upper", "lower", "full body", "ganzkörper", "ganzkoerper"];
  return defaults.some((k) => t.includes(k));
}

function defaultLabelForSport(sport: WeeklySportType): string {
  if (sport === "Laufen") return "Laufen – locker";
  if (sport === "Radfahren") return "Radfahren – GA1";
  if (sport === "Gym") return "Push";
  return "Training";
}

function makeTemplateId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tpl_${Date.now()}`;
}

// ✅ FIX: TrainingType passt jetzt exakt zu src/types/training.ts (lowercase: laufen/radfahren)
function trainingTypeFromSport(sport: WeeklySportType): "gym" | "laufen" | "radfahren" | "custom" {
  if (sport === "Gym") return "gym";
  if (sport === "Laufen") return "laufen";
  if (sport === "Radfahren") return "radfahren";
  return "custom";
}

// ✅ Cardio Default: Minuten aus Titel ziehen (z.B. "30 Min")
function parseMinutesFromTitle(title: string): number | undefined {
  const t = (title || "").toLowerCase();
  const m = t.match(/(\d+)\s*(min|minute|minuten)\b/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

// -------------------- Modal für Trainings-Content --------------------

interface TrainingExercisesModalProps {
  template: TrainingTemplate;
  kind: TrainingContainerKind;
  isCardioLibrary?: boolean;
  onClose: () => void;
  onSave: (updatedTemplate: TrainingTemplate) => void;
}

const TrainingExercisesModal: React.FC<TrainingExercisesModalProps> = ({
  template,
  kind,
  isCardioLibrary = false,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<TrainingTemplate>(template);
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);

  const filteredExercises = useMemo(() => {
    if (isCardioLibrary) {
      const term = filters.search.trim().toLowerCase();
      if (!term) return CARDIO_EXERCISES;
      return CARDIO_EXERCISES.filter((ex) => ex.name.toLowerCase().includes(term));
    }
    return filterExercises(EXERCISES, filters);
  }, [filters, isCardioLibrary]);

  const headingPrefix = kind === "routine" ? "Training für Block" : "Training für Tag";

  const handleAddExerciseFromLibrary = (exercise: Exercise) => {
    const cardioMin = isCardioLibrary ? parseMinutesFromTitle(exercise.name) : undefined;

    const newBlockExercise: BlockExercise = {
      id: nextBlockExerciseId(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [
        {
          id: nextExerciseSetId(),
          reps: isCardioLibrary ? (cardioMin ?? 30) : 8, // ✅ Cardio = Minuten
          weight: isCardioLibrary ? undefined : 0, // ✅ Cardio = km optional
          notes: "",
        },
      ],
    };
    setDraft((prev) => ({ ...prev, exercises: [...prev.exercises, newBlockExercise] }));
  };

  const handleAddCustomExercise = () => {
    const newBlockExercise: BlockExercise = {
      id: nextBlockExerciseId(),
      name: isCardioLibrary ? "Neue Einheit" : "Neue Übung",
      sets: [
        {
          id: nextExerciseSetId(),
          reps: isCardioLibrary ? 30 : 8,
          weight: isCardioLibrary ? undefined : 0,
          notes: "",
        },
      ],
    };
    setDraft((prev) => ({ ...prev, exercises: [...prev.exercises, newBlockExercise] }));
  };

  const handleRemoveBlockExercise = (exerciseId: number) => {
    setDraft((prev) => ({ ...prev, exercises: prev.exercises.filter((ex) => ex.id !== exerciseId) }));
  };

  const handleAddSet = (exerciseId: number) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  id: nextExerciseSetId(),
                  reps: isCardioLibrary ? 10 : 8,
                  weight: isCardioLibrary ? undefined : 0,
                  notes: "",
                },
              ],
            }
          : ex
      ),
    }));
  };

  const handleRemoveSet = (exerciseId: number, setId: number) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) } : ex
      ),
    }));
  };

  const handleUpdateSetField = (exerciseId: number, setId: number, field: keyof ExerciseSet, value: string) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map((set) =>
                set.id === setId
                  ? {
                      ...set,
                      [field]:
                        field === "reps" || field === "weight"
                          ? value === ""
                            ? undefined
                            : Number(value)
                          : value,
                    }
                  : set
              ),
            }
          : ex
      ),
    }));
  };

  const handleUpdateExerciseName = (exerciseId: number, name: string) => {
    setDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, name } : ex)),
    }));
  };

  const handleSaveClick = () => {
    onSave(draft);
    onClose();
  };

  const repsPlaceholder = isCardioLibrary ? "Dauer (min)" : "Wdh";
  const weightPlaceholder = isCardioLibrary ? "Distanz (km)" : "kg";
  const notesPlaceholder = isCardioLibrary ? "Pace / Intervall-Details" : "Notizen / RPE / Tempo";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="flex max-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 text-xs shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-100">
              {headingPrefix}: {draft.label}
            </div>
            <div className="text-[11px] text-slate-400">
              {isCardioLibrary ? "Lege Cardio-Einheiten und Intervalle an." : "Lege Kraftübungen und Sätze an."}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              className="rounded-xl bg-sky-500 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-sky-600"
            >
              Speichern
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 md:flex-row">
          <div className="flex w-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 md:w-[40%]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-100">
                {isCardioLibrary ? "Cardio-Bibliothek" : "Übungsbibliothek"}
              </span>

              <button
                type="button"
                onClick={handleAddCustomExercise}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-800"
              >
                + {isCardioLibrary ? "Eigene Einheit" : "Eigene Übung"}
              </button>
            </div>

            <input
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

            <div className="mt-1 flex-1 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/80">
              {filteredExercises.length === 0 ? (
                <div className="p-3 text-[11px] text-slate-500">Keine Einträge gefunden.</div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {filteredExercises.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-900/80">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-slate-100">{ex.name}</div>
                        <div className="truncate text-[10px] text-slate-500">
                          {(ex.equipment || []).join(", ")}
                          {ex.type ? ` · ${ex.type}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddExerciseFromLibrary(ex)}
                        className="shrink-0 rounded-full bg-sky-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-sky-600"
                      >
                        Hinzufügen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 md:w-[60%]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-100">
                {isCardioLibrary ? "Einheiten im Block" : "Übungen im Block"}
              </span>
              <span className="text-[10px] text-slate-400">
                {draft.exercises.length} {isCardioLibrary ? "Einheit" : "Übung"}
                {draft.exercises.length === 1 ? "" : "en"}
              </span>
            </div>

            {draft.exercises.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-4 text-[11px] text-slate-500">
                Noch nichts angelegt.
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {draft.exercises.map((ex) => (
                  <div key={ex.id} className="space-y-2 rounded-xl border border-sky-800/60 bg-sky-950/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={ex.name}
                        onChange={(e) => handleUpdateExerciseName(ex.id, e.target.value)}
                        className="w-full rounded-lg border border-sky-900/70 bg-sky-900/25 px-2 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-sky-500/70"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockExercise(ex.id)}
                        className="shrink-0 rounded-lg border border-red-500/60 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-200 hover:bg-red-500/20"
                      >
                        Entfernen
                      </button>
                    </div>

                    <div className="space-y-1 rounded-lg border border-sky-900/60 bg-sky-900/25 p-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-slate-100/80">
                        <span>{isCardioLibrary ? "Intervalle / Abschnitte" : "Sätze"}</span>
                        <button
                          type="button"
                          onClick={() => handleAddSet(ex.id)}
                          className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-100 hover:bg-slate-800"
                        >
                          + {isCardioLibrary ? "Intervall" : "Satz"}
                        </button>
                      </div>

                      <div className="space-y-1">
                        {ex.sets.map((set, index) => (
                          <div key={set.id} className="grid grid-cols-[auto,1fr,1fr,1.5fr,auto] items-center gap-2 text-[10px]">
                            <span className="text-slate-100/80">
                              {isCardioLibrary ? "Abschnitt" : "Satz"} {index + 1}
                            </span>

                            <input
                              type="number"
                              min={1}
                              placeholder={repsPlaceholder}
                              value={set.reps ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "reps", e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-slate-100 outline-none"
                            />

                            <input
                              type="number"
                              min={0}
                              placeholder={weightPlaceholder}
                              value={set.weight ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "weight", e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-slate-100 outline-none"
                            />

                            <input
                              type="text"
                              placeholder={notesPlaceholder}
                              value={set.notes ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "notes", e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-1.5 py-1 text-[10px] text-slate-100 outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => handleRemoveSet(ex.id, set.id)}
                              className="rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------- Vorschau Modal --------------------

type PreviewModalState =
  | null
  | {
      title: string;
      subtitle: string;
      isCardio: boolean;
      sport: WeeklySportType;
      exercises: BlockExercise[];
    };

const TrainingPreviewModal: React.FC<{ state: PreviewModalState; onClose: () => void }> = ({ state, onClose }) => {
  if (!state) return null;

  const estMin = estimateDurationMinutes(state.exercises, state.isCardio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-100">{state.title}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {state.subtitle} · ca. {estMin} min
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {state.exercises.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
              Keine Übungen/Einheiten hinterlegt.
            </div>
          ) : (
            <div className="space-y-3">
              {state.exercises.map((ex) => {
                const key = ex.exerciseId || ex.name;
                const lastRaw = key ? (getLastSetsForExercise({ id: key, name: ex.name, sets: [] } as any) as any) : null;
                const last = normalizeLastSummary(lastRaw);

                return (
                  <div key={ex.id} className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{ex.name}</div>

                        {last && (last.weight !== undefined || last.reps !== undefined) && (
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {state.isCardio ? (
                              <>
                                Letztes Mal:
                                {last.weight !== undefined ? ` ${last.weight} km` : ""}
                                {last.weight !== undefined && last.reps !== undefined ? " ·" : ""}
                                {last.reps !== undefined ? ` ${last.reps} min` : ""}
                              </>
                            ) : (
                              <>
                                Letztes Mal:
                                {last.weight !== undefined ? ` ${last.weight} kg` : ""}
                                {last.weight !== undefined && last.reps !== undefined ? " ×" : ""}
                                {last.reps !== undefined ? ` ${last.reps} Wdh.` : ""}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300">
                        {ex.sets.length} {state.isCardio ? "Abschn." : "Sätze"}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {ex.sets.map((s, idx) => (
                        <div
                          key={s.id}
                          className="grid grid-cols-[auto,1fr,1fr,2fr] gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px]"
                        >
                          <div className="text-slate-400">{idx + 1}</div>
                          <div className="text-slate-200">
                            {state.isCardio ? "Dauer" : "Wdh"}: <span className="text-slate-100">{s.reps ?? "—"}</span>
                          </div>
                          <div className="text-slate-200">
                            {state.isCardio ? "Dist." : "kg"}: <span className="text-slate-100">{s.weight ?? "—"}</span>
                          </div>
                          <div className="truncate text-slate-400">{s.notes || ""}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-800 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
          >
            Schließen
          </button>

          <button
            onClick={() =>
              startLiveTrainingWithSeed({
                title: state.title,
                sport: state.sport,
                isCardio: state.isCardio,
                exercises: state.exercises,
              })
            }
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------- Haupt-Komponente --------------------

const TrainingsplanPage: React.FC<TrainingsplanPageProps> = ({ onAddEvent, isPro: isProProp = false, onOpenPaywall }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("weekly");

  // ✅ Entitlements
  const {
    isPro: isProEnt,
    canUseCalendar7,
    consumeCalendar7,
    calendar7DaysRemaining,
  } = useEntitlements();

  const effectiveIsPro = isProEnt || isProProp;

  // ✅ Startdatum
  const [planStartISO, setPlanStartISO] = useState<string>(() => {
    const today = dateToISO(new Date());
    if (typeof window === "undefined") return today;
    try {
      return window.localStorage.getItem(STORAGE_KEY_PLAN_START_ISO) || today;
    } catch {
      return today;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_PLAN_START_ISO, planStartISO);
    } catch {}
  }, [planStartISO]);

  // Weekly
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDayConfig[]>(DEFAULT_WEEKLY_DAYS);
  const [weeklyDurationWeeks, setWeeklyDurationWeeks] = useState<number>(6);
  const [weeklySaved, setWeeklySaved] = useState<boolean>(false);

  // Routine
  const [routineBlocks, setRoutineBlocks] = useState<RoutineBlock[]>(
    DEFAULT_ROUTINE_BLOCKS.map((b, i) => normalizeRoutineBlock(b, i + 1))
  );
  const [routineDurationWeeks, setRoutineDurationWeeks] = useState<number>(6);
  const [routineSaved, setRoutineSaved] = useState<boolean>(false);

  // Trainingspläne Vorlagen
  const [weeklyTemplates, setWeeklyTemplates] = useState<WeeklyPlanTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_WEEKLY_TEMPLATES);
      return raw ? (JSON.parse(raw) as WeeklyPlanTemplate[]) : [];
    } catch {
      return [];
    }
  });

  const [routineTemplates, setRoutineTemplates] = useState<RoutinePlanTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_ROUTINE_TEMPLATES);
      return raw ? (JSON.parse(raw) as RoutinePlanTemplate[]) : [];
    } catch {
      return [];
    }
  });

  // ✅ Reine Trainings Vorlagen
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_WORKOUT_TEMPLATES);
      return raw ? (JSON.parse(raw) as WorkoutTemplate[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_WEEKLY_TEMPLATES, JSON.stringify(weeklyTemplates));
    } catch {}
  }, [weeklyTemplates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_ROUTINE_TEMPLATES, JSON.stringify(routineTemplates));
    } catch {}
  }, [routineTemplates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_WORKOUT_TEMPLATES, JSON.stringify(workoutTemplates));
    } catch {}
  }, [workoutTemplates]);

  // Modals
  const [weeklyPreviewOpen, setWeeklyPreviewOpen] = useState(false);
  const [routinePreviewOpen, setRoutinePreviewOpen] = useState(false);

  // Trainingspläne Vorlagen-Modal
  const [weeklyTemplatesOpen, setWeeklyTemplatesOpen] = useState(false);
  const [routineTemplatesOpen, setRoutineTemplatesOpen] = useState(false);

  // Reine Trainings Vorlagen-Modal
  const [workoutTemplatesOpen, setWorkoutTemplatesOpen] = useState(false);

  // Save Dialogs (Plan)
  const [weeklySaveDialogOpen, setWeeklySaveDialogOpen] = useState(false);
  const [routineSaveDialogOpen, setRoutineSaveDialogOpen] = useState(false);

  const [weeklyTemplateName, setWeeklyTemplateName] = useState("Wochenplan");
  const [routineTemplateName, setRoutineTemplateName] = useState("Split/Routine");

  // Save Dialog (Training)
  const [workoutSaveOpen, setWorkoutSaveOpen] = useState(false);
  const [workoutSaveName, setWorkoutSaveName] = useState("Training");
  const [workoutSaveDraft, setWorkoutSaveDraft] = useState<{
    nameFallback: string;
    sport: WeeklySportType;
    isCardio: boolean;
    exercises: BlockExercise[];
  } | null>(null);

  const [activeTrainingTemplate, setActiveTrainingTemplate] = useState<{
    kind: TrainingContainerKind;
    template: TrainingTemplate;
    isCardioLibrary: boolean;
  } | null>(null);

  const [previewState, setPreviewState] = useState<PreviewModalState>(null);

  // -------------------- Kalender-Import --------------------

  const handleCalendar7DaysGate = (dateISO: string): boolean => {
    // innerhalb 7 Tage: immer ok
    if (isWithinDaysAhead(dateISO, 7)) return true;

    // > 7 Tage: Pro immer ok
    if (effectiveIsPro) return true;

    // Free: 3/Monat
    if (!canUseCalendar7()) {
      onOpenPaywall?.("calendar_7days");
      return false;
    }

    // ✅ pro Event, das >7 Tage liegt, wird 1 Credit konsumiert
    consumeCalendar7();
    return true;
  };

  const pushWeeklyToCalendar = () => {
    if (!onAddEvent) return;

    const templateId = makeTemplateId();
    try {
      window.localStorage.setItem(STORAGE_KEY_LAST_IMPORTED_TEMPLATE_ID, templateId);
    } catch {}

    const startDate = isoToDate(planStartISO);
    const totalDays = weeklyDurationWeeks * 7;

    for (let i = 0; i < totalDays; i++) {
      const dayConfig = weeklyDays[i % weeklyDays.length];
      if (!dayConfig || dayConfig.type !== "training") continue;

      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateISO = dateToISO(date);

      if (!handleCalendar7DaysGate(dateISO)) break;

      const title = dayConfig.focus || `${dayConfig.sport} – ${dayConfig.label}`;
      const isCardio = dayConfig.sport === "Laufen" || dayConfig.sport === "Radfahren";

      // ✅ NUR Startzeit optional (kein Endzeit)
      const startTime = (dayConfig.startTime || "").trim();
      const endTime = "";

      const newEvent: NewCalendarEvent = {
        title,
        date: dateISO,
        startTime,
        endTime,
        type: "training",
        templateId,
        trainingType: trainingTypeFromSport(dayConfig.sport),
        trainingStatus: "open",
      } as any;

      writeLiveSeedForKey(makeSeedKey(dateISO, title), {
        title,
        sport: dayConfig.sport,
        isCardio,
        exercises: normalizeExercisesForSeed(dayConfig.exercises),
      });

      onAddEvent(newEvent);
    }
  };

  const pushRoutineToCalendar = () => {
    if (!onAddEvent || routineBlocks.length === 0) return;

    const templateId = makeTemplateId();
    try {
      window.localStorage.setItem(STORAGE_KEY_LAST_IMPORTED_TEMPLATE_ID, templateId);
    } catch {}

    const startDate = isoToDate(planStartISO);
    const totalDays = routineDurationWeeks * 7;

    for (let i = 0; i < totalDays; i++) {
      const raw = routineBlocks[i % routineBlocks.length];
      const block = normalizeRoutineBlock(raw as any, i + 1);
      if (!block || block.type === "Rest") continue;

      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateISO = dateToISO(date);

      if (!handleCalendar7DaysGate(dateISO)) break;

      const title = block.label;
      const isCardio = block.sport === "Laufen" || block.sport === "Radfahren";

      // ✅ NUR Startzeit optional (kein Endzeit)
      const startTime = (block.startTime || "").trim();
      const endTime = "";

      const newEvent: NewCalendarEvent = {
        title,
        date: dateISO,
        startTime,
        endTime,
        type: "training",
        templateId,
        trainingType: trainingTypeFromSport(block.sport),
        trainingStatus: "open",
      } as any;

      writeLiveSeedForKey(makeSeedKey(dateISO, title), {
        title,
        sport: block.sport,
        isCardio,
        exercises: normalizeExercisesForSeed(block.exercises),
      });

      onAddEvent(newEvent);
    }
  };

  // -------------------- Reine Trainings Vorlagen --------------------

  const openSaveWorkoutTemplate = (args: { nameFallback: string; sport: WeeklySportType; exercises: BlockExercise[] }) => {
    const isCardio = args.sport === "Laufen" || args.sport === "Radfahren";
    setWorkoutSaveDraft({ ...args, isCardio });
    setWorkoutSaveName(args.nameFallback || "Training");
    setWorkoutSaveOpen(true);
  };

  const saveWorkoutTemplate = () => {
    if (!workoutSaveDraft) {
      setWorkoutSaveOpen(false);
      return;
    }

    const name = (workoutSaveName || "").trim() || workoutSaveDraft.nameFallback || "Training";
    const tpl: WorkoutTemplate = {
      id: makeTemplateId(),
      name,
      sport: workoutSaveDraft.sport,
      isCardio: workoutSaveDraft.isCardio,
      exercises: workoutSaveDraft.exercises,
      createdAtISO: new Date().toISOString(),
    };

    setWorkoutTemplates((prev) => [tpl, ...prev]);
    setWorkoutSaveDraft(null);
    setWorkoutSaveOpen(false);
  };

  const deleteWorkoutTemplate = (id: string) => {
    if (!window.confirm("Vorlage wirklich löschen?")) return;
    setWorkoutTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // -------------------- Weekly --------------------

  const handleWeeklyDayChange = (
    id: number,
    field: keyof Omit<WeeklyDayConfig, "id" | "label" | "exercises">,
    value: string
  ) => {
    setWeeklySaved(false);

    setWeeklyDays((prev) =>
      prev.map((day) => {
        if (day.id !== id) return day;

        if (field === "type") {
          const nextType = value as WeeklyDayType;
          if (nextType === "rest") return { ...day, type: nextType, startTime: "" };
          return { ...day, type: nextType };
        }

        if (field === "sport") {
          const nextSport = value as WeeklySportType;
          const shouldAutoRename = !day.focus?.trim() || isLikelyGymDefaultLabel(day.focus);
          return { ...day, sport: nextSport, focus: shouldAutoRename ? defaultLabelForSport(nextSport) : day.focus };
        }

        if (field === "focus") return { ...day, focus: value };
        if (field === "startTime") return { ...day, startTime: value };

        return { ...day, [field]: value } as WeeklyDayConfig;
      })
    );
  };

  const openWeeklyTraining = (day: WeeklyDayConfig) => {
    const isCardioDay = day.sport === "Laufen" || day.sport === "Radfahren";

    setActiveTrainingTemplate({
      kind: "weekly",
      template: { id: day.id, label: day.label, exercises: day.exercises },
      isCardioLibrary: isCardioDay,
    });
  };

  const openWeeklyPreviewAndStart = (day: WeeklyDayConfig) => {
    const isCardioDay = day.sport === "Laufen" || day.sport === "Radfahren";

    setPreviewState({
      title: day.focus || `${day.sport} – ${day.label}`,
      subtitle: `${day.label} · ${day.sport}`,
      isCardio: isCardioDay,
      sport: day.sport,
      exercises: day.exercises,
    });
  };

  const handleSaveWeeklyTrainingTemplate = (updated: TrainingTemplate) => {
    setWeeklySaved(false);
    setWeeklyDays((prev) => prev.map((d) => (d.id === updated.id ? { ...d, exercises: updated.exercises } : d)));
  };

  const saveWeeklyTemplateAndCalendar = (withTemplate: boolean) => {
    if (withTemplate) {
      const tpl: WeeklyPlanTemplate = {
        id: String(Date.now()),
        name: weeklyTemplateName.trim() || "Wochenplan",
        days: weeklyDays,
        durationWeeks: weeklyDurationWeeks,
      };
      setWeeklyTemplates((prev) => [...prev, tpl]);
    }

    pushWeeklyToCalendar();
    setWeeklySaved(true);
    setWeeklySaveDialogOpen(false);
  };

  const applyWeeklyTemplate = (tpl: WeeklyPlanTemplate) => {
    setWeeklyDays(tpl.days);
    setWeeklyDurationWeeks(tpl.durationWeeks);
    setWeeklySaved(false);
    setWeeklyTemplatesOpen(false);
  };

  // -------------------- Routine --------------------

  const handleRoutineBlockChange = (id: number, field: "dayType" | "sport" | "label" | "startTime", value: string) => {
    setRoutineSaved(false);

    setRoutineBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;

        if (field === "dayType") {
          if (value === "rest") {
            return { ...block, type: "Rest", sport: "Custom", label: "Ruhetag", exercises: [], startTime: "" };
          }
          return {
            ...block,
            type: "Custom",
            sport: block.sport && block.sport !== "Custom" ? block.sport : "Gym",
            label: block.label && block.label !== "Ruhetag" ? block.label : "Neues Training",
          };
        }

        if (field === "sport") {
          const nextSport = value as WeeklySportType;
          const shouldAutoRename = !block.label?.trim() || isLikelyGymDefaultLabel(block.label);

          return {
            ...block,
            sport: nextSport,
            type: block.type === "Rest" ? "Rest" : "Custom",
            label: shouldAutoRename ? defaultLabelForSport(nextSport) : block.label,
          };
        }

        if (field === "startTime") return { ...block, startTime: value };
        return { ...block, label: value };
      })
    );
  };

  const handleAddRoutineBlock = () => {
    setRoutineSaved(false);
    setRoutineBlocks((prev) => [
      ...prev,
      {
        id: prev.length ? prev[prev.length - 1].id + 1 : 1,
        type: "Custom",
        sport: "Gym",
        label: "Neues Training",
        exercises: [],
        startTime: "",
      },
    ]);
  };

  const handleRemoveRoutineBlock = (id: number) => {
    setRoutineSaved(false);
    setRoutineBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  const openRoutineTraining = (block: RoutineBlock) => {
    const isCardio = block.sport === "Laufen" || block.sport === "Radfahren";
    setActiveTrainingTemplate({
      kind: "routine",
      template: { id: block.id, label: block.label, exercises: block.exercises },
      isCardioLibrary: isCardio,
    });
  };

  const openRoutinePreviewAndStart = (block: RoutineBlock, dayLabel?: string, dayIndex?: number) => {
    const isCardio = block.sport === "Laufen" || block.sport === "Radfahren";

    setPreviewState({
      title: block.label,
      subtitle: `${dayLabel ? dayLabel : "Tag"}${typeof dayIndex === "number" ? ` / Tag ${dayIndex + 1}` : ""} · ${block.sport}`,
      isCardio,
      sport: block.sport,
      exercises: block.exercises,
    });
  };

  const handleSaveRoutineTrainingTemplate = (updated: TrainingTemplate) => {
    setRoutineSaved(false);
    setRoutineBlocks((prev) => prev.map((b) => (b.id === updated.id ? { ...b, exercises: updated.exercises } : b)));
  };

  const saveRoutineTemplateAndCalendar = (withTemplate: boolean) => {
    if (withTemplate) {
      const tpl: RoutinePlanTemplate = {
        id: String(Date.now()),
        name: routineTemplateName.trim() || "Split/Routine",
        blocks: routineBlocks,
        durationWeeks: routineDurationWeeks,
      };
      setRoutineTemplates((prev) => [...prev, tpl]);
    }

    pushRoutineToCalendar();
    setRoutineSaved(true);
    setRoutineSaveDialogOpen(false);
  };

  const applyRoutineTemplate = (tpl: RoutinePlanTemplate) => {
    const blocks = (tpl.blocks || []).map((b, idx) => normalizeRoutineBlock(b as any, idx + 1));
    setRoutineBlocks(blocks);
    setRoutineDurationWeeks(tpl.durationWeeks);
    setRoutineSaved(false);
    setRoutineTemplatesOpen(false);
  };

  const routinePreview = useMemo(() => {
    if (!routineBlocks.length) return [];
    const labels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    return Array.from({ length: 7 }).map((_, i) => {
      const block = normalizeRoutineBlock(routineBlocks[i % routineBlocks.length] as any, i + 1);
      return { dayIndex: i, label: labels[i], block };
    });
  }, [routineBlocks]);

  // -------------------- Render --------------------

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 rounded-xl bg-slate-900/60 p-1 text-sm">
          <button
            onClick={() => setActiveTab("weekly")}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${
              activeTab === "weekly" ? "bg-sky-500 text-white shadow" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Wochenplan
          </button>
          <button
            onClick={() => setActiveTab("routine")}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${
              activeTab === "routine" ? "bg-sky-500 text-white shadow" : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Split/Routine
          </button>
        </div>

        {/* ✅ Startdatum + Dauer + darunter Vorlagen (Trainings + Trainingspläne) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
              <span className="text-[11px] text-slate-400">Startdatum</span>
              <input
                type="date"
                value={planStartISO}
                onChange={(e) => {
                  setWeeklySaved(false);
                  setRoutineSaved(false);
                  setPlanStartISO(e.target.value);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-100 outline-none"
              />
            </div>

            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2">
              <span className="text-[11px] text-slate-400">Dauer</span>
              <input
                type="number"
                min={1}
                max={52}
                value={activeTab === "weekly" ? weeklyDurationWeeks : routineDurationWeeks}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value) || 1);
                  if (activeTab === "weekly") {
                    setWeeklySaved(false);
                    setWeeklyDurationWeeks(v);
                  } else {
                    setRoutineSaved(false);
                    setRoutineDurationWeeks(v);
                  }
                }}
                className="w-14 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none"
              />
              <span className="text-[11px] text-slate-400">Wochen</span>
            </div>
          </div>

          {!effectiveIsPro && (
            <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-slate-400">
              Free: Kalender &gt; 7 Tage voraus:{" "}
              <span className="text-slate-200 font-semibold">
                {Number.isFinite(calendar7DaysRemaining as number) ? (calendar7DaysRemaining as number) : FREE_LIMITS.calendar7DaysPerMonth}
              </span>{" "}
              übrig (Limit {FREE_LIMITS.calendar7DaysPerMonth}/Monat). Pro: unbegrenzt.
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWorkoutTemplatesOpen(true)}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] text-slate-100 hover:bg-slate-800"
            >
              Vorlagen: Trainings
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === "weekly") setWeeklyTemplatesOpen(true);
                else setRoutineTemplatesOpen(true);
              }}
              className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-[11px] text-slate-100 hover:bg-slate-800"
            >
              Vorlagen: Trainingspläne
            </button>
          </div>
        </section>

        {/* Weekly */}
        {activeTab === "weekly" && (
          <section className="space-y-4 rounded-2xl bg-slate-900/60 p-4 shadow sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Wochenplan</h2>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Start: <span className="text-slate-200">{planStartISO}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {weeklySaved && <span className="text-xs text-emerald-400">In Kalender übernommen</span>}
              </div>
            </div>

            <div className="space-y-3">
              {weeklyDays.map((day) => (
                <div key={day.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-100">{day.label}</div>
                      <span className="text-[11px] text-slate-500">/ Tag {day.id}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={day.type}
                        onChange={(e) => handleWeeklyDayChange(day.id, "type", e.target.value)}
                        className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-100 outline-none"
                      >
                        <option value="training">Training</option>
                        <option value="rest">Ruhetag</option>
                      </select>

                      {day.type === "training" && (
                        <>
                          <select
                            value={day.sport}
                            onChange={(e) => handleWeeklyDayChange(day.id, "sport", e.target.value)}
                            className="rounded-full border border-sky-700 bg-sky-950/60 px-2.5 py-1 text-xs text-sky-100 outline-none"
                          >
                            <option value="Gym">Gym</option>
                            <option value="Laufen">Laufen</option>
                            <option value="Radfahren">Radfahren</option>
                            <option value="Custom">Custom</option>
                          </select>

                          {/* ✅ Startzeit OPTIONAL (nur dieses Feld) */}
                          <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                            <span className="text-[11px] text-slate-400">Startzeit</span>
                            <input
                              type="time"
                              value={day.startTime ?? ""}
                              onChange={(e) => handleWeeklyDayChange(day.id, "startTime", e.target.value)}
                              className="w-[92px] bg-transparent text-[11px] text-slate-100 outline-none"
                              title="Optional"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => openWeeklyTraining(day)}
                            className="rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/20"
                          >
                            Training erstellen{day.exercises.length > 0 ? ` (${day.exercises.length})` : ""}
                          </button>

                          {day.exercises.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => openWeeklyPreviewAndStart(day)}
                                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                              >
                                Vorschau / Start
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  openSaveWorkoutTemplate({
                                    nameFallback: day.focus || `${day.sport} – ${day.label}`,
                                    sport: day.sport,
                                    exercises: day.exercises,
                                  })
                                }
                                className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                              >
                                Als Training speichern
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="block text-[11px] font-medium text-slate-400">Trainingsbezeichnung</label>
                    <input
                      type="text"
                      value={day.focus}
                      onChange={(e) => handleWeeklyDayChange(day.id, "focus", e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-sky-500/60"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setWeeklyPreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
              >
                Vorschau
              </button>

              <button
                onClick={() => {
                  setWeeklyTemplateName(`Wochenplan (${new Date().toLocaleDateString("de-DE")})`);
                  setWeeklySaveDialogOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-600 active:bg-sky-700"
              >
                Wochenplan speichern & in Kalender übernehmen
              </button>
            </div>
          </section>
        )}

        {/* Routine */}
        {activeTab === "routine" && (
          <section className="space-y-4 rounded-2xl bg-slate-900/60 p-4 shadow sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Split/Routine</h2>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Start: <span className="text-slate-200">{planStartISO}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {routineSaved && <span className="text-xs text-emerald-400">In Kalender übernommen</span>}
              </div>
            </div>

            <div className="space-y-3">
              {routineBlocks.map((rawBlock, index) => {
                const block = normalizeRoutineBlock(rawBlock as any, index + 1);
                const dayNames = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
                const dayLabel = dayNames[index % 7];
                const dayType: WeeklyDayType = block.type === "Rest" ? "rest" : "training";

                return (
                  <div key={block.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-100">{dayLabel}</div>
                        <span className="text-[11px] text-slate-500">/ Tag {index + 1}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={dayType}
                          onChange={(e) => handleRoutineBlockChange(block.id, "dayType", e.target.value)}
                          className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-100 outline-none"
                        >
                          <option value="training">Training</option>
                          <option value="rest">Ruhetag</option>
                        </select>

                        {dayType === "training" && (
                          <>
                            <select
                              value={block.sport}
                              onChange={(e) => handleRoutineBlockChange(block.id, "sport", e.target.value)}
                              className="rounded-full border border-sky-700 bg-sky-950/60 px-2.5 py-1 text-xs text-sky-100 outline-none"
                            >
                              <option value="Gym">Gym</option>
                              <option value="Laufen">Laufen</option>
                              <option value="Radfahren">Radfahren</option>
                              <option value="Custom">Custom</option>
                            </select>

                            {/* ✅ Startzeit OPTIONAL (nur dieses Feld) */}
                            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1">
                              <span className="text-[11px] text-slate-400">Startzeit</span>
                              <input
                                type="time"
                                value={block.startTime ?? ""}
                                onChange={(e) => handleRoutineBlockChange(block.id, "startTime", e.target.value)}
                                className="w-[92px] bg-transparent text-[11px] text-slate-100 outline-none"
                                title="Optional"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => openRoutineTraining(block)}
                              className="rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/20"
                            >
                              Training erstellen{block.exercises.length > 0 ? ` (${block.exercises.length})` : ""}
                            </button>

                            {block.exercises.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openRoutinePreviewAndStart(block, dayLabel, index)}
                                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                                >
                                  Vorschau / Start
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openSaveWorkoutTemplate({
                                      nameFallback: block.label || `${block.sport} – ${dayLabel}`,
                                      sport: block.sport,
                                      exercises: block.exercises,
                                    })
                                  }
                                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                                >
                                  Als Training speichern
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="block text-[11px] font-medium text-slate-400">Trainingsbezeichnung</label>
                      <input
                        type="text"
                        value={block.label}
                        onChange={(e) => handleRoutineBlockChange(block.id, "label", e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-sky-500/60"
                      />
                    </div>

                    {routineBlocks.length > 1 && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveRoutineBlock(block.id)}
                          className="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                        >
                          Entfernen
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleAddRoutineBlock}
              className="mt-1 inline-flex w-full items-center justify-center rounded-xl border border-dashed border-slate-600 bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900"
            >
              + Tag hinzufügen (Routine-Zyklus erweitern)
            </button>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRoutinePreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
              >
                Vorschau
              </button>

              <button
                onClick={() => {
                  setRoutineTemplateName(`Split/Routine (${new Date().toLocaleDateString("de-DE")})`);
                  setRoutineSaveDialogOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-600 active:bg-sky-700"
              >
                Split/Routine speichern & in Kalender übernehmen
              </button>
            </div>
          </section>
        )}
      </div>

      {/* Training-Modal */}
      {activeTrainingTemplate && (
        <TrainingExercisesModal
          template={activeTrainingTemplate.template}
          kind={activeTrainingTemplate.kind}
          isCardioLibrary={activeTrainingTemplate.isCardioLibrary}
          onClose={() => setActiveTrainingTemplate(null)}
          onSave={(updated) => {
            if (activeTrainingTemplate.kind === "weekly") {
              setWeeklySaved(false);
              setWeeklyDays((prev) => prev.map((d) => (d.id === updated.id ? { ...d, exercises: updated.exercises } : d)));
            } else {
              setRoutineSaved(false);
              setRoutineBlocks((prev) => prev.map((b) => (b.id === updated.id ? { ...b, exercises: updated.exercises } : b)));
            }
          }}
        />
      )}

      {/* Vorschau/Start Modal */}
      <TrainingPreviewModal state={previewState} onClose={() => setPreviewState(null)} />

      {/* Weekly Vorschau Modal */}
      {weeklyPreviewOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Vorschau – Woche</h3>
              <button
                type="button"
                onClick={() => setWeeklyPreviewOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1">
              {weeklyDays.map((day) => (
                <div key={day.id} className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-100">{day.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        day.type === "training"
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40"
                          : "bg-slate-700/40 text-slate-200 ring-1 ring-slate-500/40"
                      }`}
                    >
                      {day.type === "training" ? "Training" : "Ruhetag"}
                    </span>
                  </div>

                  <div className="mt-0.5 text-[10px] text-sky-300">{day.type === "training" ? `Sportart: ${day.sport}` : ""}</div>
                  <div className="mt-0.5 text-[11px] text-slate-200">{day.focus || "Keine Bezeichnung definiert"}</div>

                  {/* ✅ Startzeit nur anzeigen, wenn gesetzt */}
                  {day.type === "training" && day.startTime && (
                    <div className="mt-0.5 text-[10px] text-slate-400">Startzeit: {day.startTime}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Routine Vorschau Modal */}
      {routinePreviewOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Vorschau – Routine (1 Woche)</h3>
              <button
                type="button"
                onClick={() => setRoutinePreviewOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1">
              {routinePreview.map((item, index) => (
                <div key={index} className="rounded-lg border border-slate-800 bg-slate-950/80 p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-100">{item.label}</span>
                    <span className="text-[10px] text-slate-400">Tag {index + 1}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-slate-100">{item.block.label}</div>
                  <div className="mt-0.5 text-[10px] text-slate-400">
                    {item.block.type === "Rest" ? "Ruhetag" : `Sport: ${item.block.sport}`}
                  </div>

                  {/* ✅ Startzeit nur anzeigen, wenn gesetzt */}
                  {item.block.type !== "Rest" && item.block.startTime && (
                    <div className="mt-0.5 text-[10px] text-slate-400">Startzeit: {item.block.startTime}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trainingspläne Vorlagen Modal (Weekly) */}
      {weeklyTemplatesOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Vorlagen – Wochenpläne</h3>
              <button
                type="button"
                onClick={() => setWeeklyTemplatesOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            {weeklyTemplates.length === 0 ? (
              <p className="text-[11px] text-slate-400">Noch keine Vorlagen gespeichert.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {weeklyTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
                  >
                    <div className="text-[11px] text-slate-100">
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {tpl.durationWeeks} Woche{tpl.durationWeeks !== 1 ? "n" : ""}, {tpl.days.length} Tage
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => applyWeeklyTemplate(tpl)}
                      className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-sky-600"
                    >
                      Übernehmen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trainingspläne Vorlagen Modal (Routine) */}
      {routineTemplatesOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Vorlagen – Split/Routine</h3>
              <button
                type="button"
                onClick={() => setRoutineTemplatesOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            {routineTemplates.length === 0 ? (
              <p className="text-[11px] text-slate-400">Noch keine Vorlagen gespeichert.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {routineTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
                  >
                    <div className="text-[11px] text-slate-100">
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {tpl.durationWeeks} Woche{tpl.durationWeeks !== 1 ? "n" : ""}, {tpl.blocks.length} Tage im Zyklus
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => applyRoutineTemplate(tpl)}
                      className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-sky-600"
                    >
                      Übernehmen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reine Trainings Vorlagen Modal */}
      {workoutTemplatesOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Vorlagen – Trainings</h3>
              <button
                type="button"
                onClick={() => setWorkoutTemplatesOpen(false)}
                className="text-[11px] text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            {workoutTemplates.length === 0 ? (
              <p className="text-[11px] text-slate-400">Noch keine Trainings-Vorlagen gespeichert.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {workoutTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-slate-100">{t.name}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {t.sport} · {estimateDurationMinutes(t.exercises, t.isCardio)} min · {t.exercises.length} {t.isCardio ? "Einheiten" : "Üb."}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteWorkoutTemplate(t.id)}
                        className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 hover:bg-red-500/20"
                      >
                        Löschen
                      </button>
                    </div>

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWorkoutTemplatesOpen(false);
                          startLiveTrainingWithSeed({
                            title: t.name,
                            sport: t.sport,
                            isCardio: t.isCardio,
                            exercises: t.exercises,
                          });
                        }}
                        className="flex-1 rounded-lg bg-sky-500 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-600"
                      >
                        Start
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setWorkoutTemplatesOpen(false);
                          setPreviewState({
                            title: t.name,
                            subtitle: `Vorlage · ${t.sport}`,
                            isCardio: t.isCardio,
                            sport: t.sport,
                            exercises: t.exercises,
                          });
                        }}
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800"
                      >
                        Vorschau
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Dialogs (Plan) */}
      {weeklySaveDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-100">Plan in Kalender übernehmen</h3>
            <p className="mt-1 text-[11px] text-slate-400">Als Vorlage speichern (optional)?</p>

            <div className="mt-3 space-y-2">
              <label className="block text-[11px] text-slate-300">Name der Vorlage (optional)</label>
              <input
                type="text"
                value={weeklyTemplateName}
                onChange={(e) => setWeeklyTemplateName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveWeeklyTemplateAndCalendar(false)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800"
              >
                Nur Kalender
              </button>
              <button
                type="button"
                onClick={() => saveWeeklyTemplateAndCalendar(true)}
                className="rounded-xl bg-sky-500 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-sky-600"
              >
                Kalender + Vorlage
              </button>
            </div>
          </div>
        </div>
      )}

      {routineSaveDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-100">Routine in Kalender übernehmen</h3>
            <p className="mt-1 text-[11px] text-slate-400">Als Vorlage speichern (optional)?</p>

            <div className="mt-3 space-y-2">
              <label className="block text-[11px] text-slate-300">Name der Vorlage (optional)</label>
              <input
                type="text"
                value={routineTemplateName}
                onChange={(e) => setRoutineTemplateName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveRoutineTemplateAndCalendar(false)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800"
              >
                Nur Kalender
              </button>
              <button
                type="button"
                onClick={() => saveRoutineTemplateAndCalendar(true)}
                className="rounded-xl bg-sky-500 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-sky-600"
              >
                Kalender + Vorlage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Dialog (Training) */}
      {workoutSaveOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-100">Training als Vorlage speichern</h3>
            <p className="mt-1 text-[11px] text-slate-400">Optional um später schnell zu starten.</p>

            <div className="mt-3 space-y-2">
              <label className="block text-[11px] text-slate-300">Name</label>
              <input
                type="text"
                value={workoutSaveName}
                onChange={(e) => setWorkoutSaveName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setWorkoutSaveDraft(null);
                  setWorkoutSaveOpen(false);
                }}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveWorkoutTemplate}
                className="rounded-xl bg-sky-500 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-sky-600"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingsplanPage;