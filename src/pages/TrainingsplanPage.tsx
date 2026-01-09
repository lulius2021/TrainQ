// src/pages/TrainingsplanPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
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

// ✅ Seeds stabil per date|title (Dashboard-kompatibel) + Legacy-Migration
import {
  writeLiveSeedForEventOrKey,
  writeGlobalLiveSeed,
  navigateToLiveTraining,
} from "../utils/liveTrainingSeed";

// ✅ Free-Limit: 7 Tage im Voraus (Date helper)
import { isWithinDaysAhead } from "../utils/dateLimits";

// ✅ Entitlements (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";
import { useProGuard } from "../hooks/useProGuard";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { FREE_LIMITS } from "../utils/entitlements";

// -------------------- Typen --------------------

type WeeklySportType = "Gym" | "Laufen" | "Radfahren" | "Custom" | "Ruhetag";
type TrainingSportType = Exclude<WeeklySportType, "Ruhetag">;

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
  sport: WeeklySportType;
  focus: string;
  // ✅ Startzeit optional (nur wenn User sie aktiv hinzufügt)
  startTime?: string;
};

type RoutineBlockType = "Custom" | "Rest";

type RoutineBlock = TrainingTemplate & {
  type: RoutineBlockType;
  sport: WeeklySportType;
  // ✅ Startzeit optional
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
}

// Vorlagen (Trainingspläne)
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

// ✅ Vorlagen (reine Trainings)
type WorkoutTemplate = {
  id: string;
  name: string;
  sport: TrainingSportType;
  isCardio: boolean;
  exercises: BlockExercise[];
  createdAtISO: string;
};

// -------------------- Konfiguration --------------------

const DEFAULT_WEEKLY_DAYS: WeeklyDayConfig[] = [
  { id: 1, label: "Tag 1", sport: "Gym", focus: "Push (Brust/Schulter/Trizeps)", exercises: [], startTime: "" },
  { id: 2, label: "Tag 2", sport: "Gym", focus: "Pull (Rücken/Bizeps)", exercises: [], startTime: "" },
  { id: 3, label: "Tag 3", sport: "Gym", focus: "Beine", exercises: [], startTime: "" },
  { id: 4, label: "Tag 4", sport: "Ruhetag", focus: "Ruhetag", exercises: [], startTime: "" },
  { id: 5, label: "Tag 5", sport: "Gym", focus: "Push", exercises: [], startTime: "" },
  { id: 6, label: "Tag 6", sport: "Gym", focus: "Pull", exercises: [], startTime: "" },
  { id: 7, label: "Tag 7", sport: "Ruhetag", focus: "Ruhetag", exercises: [], startTime: "" },
];

const DEFAULT_ROUTINE_BLOCKS: RoutineBlock[] = [
  { id: 1, type: "Custom", sport: "Gym", label: "Push (Brust/Schulter/Trizeps)", exercises: [], startTime: "" },
  { id: 2, type: "Custom", sport: "Gym", label: "Pull (Rücken/Bizeps)", exercises: [], startTime: "" },
  { id: 3, type: "Custom", sport: "Gym", label: "Beine", exercises: [], startTime: "" },
  { id: 4, type: "Rest", sport: "Ruhetag", label: "Ruhetag", exercises: [], startTime: "" },
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

// ✅ Vorlagen: reine Trainings
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

function isRestSport(sport: WeeklySportType): boolean {
  return sport === "Ruhetag";
}

function isCardioSport(sport: WeeklySportType): boolean {
  return sport === "Laufen" || sport === "Radfahren";
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

function startLiveTrainingWithSeed(seed: { title: string; sport: TrainingSportType; isCardio: boolean; exercises: BlockExercise[] }) {
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

// ✅ Migration/Guard für alte WeeklyDays
function normalizeWeeklyDay(input: any, fallbackId: number): WeeklyDayConfig {
  const id = typeof input?.id === "number" ? input.id : fallbackId;

  const rawSport = String(input?.sport ?? "").trim() as WeeklySportType;
  const hasOldRest = String(input?.type ?? "").trim() === "rest";
  const sport: WeeklySportType =
    hasOldRest || rawSport === "Ruhetag"
      ? "Ruhetag"
      : rawSport === "Gym" || rawSport === "Laufen" || rawSport === "Radfahren" || rawSport === "Custom"
      ? rawSport
      : "Gym";

  const label = typeof input?.label === "string" && input.label.trim() ? input.label : `Tag ${id}`;

  const focus =
    typeof input?.focus === "string" && input.focus.trim()
      ? input.focus
      : isRestSport(sport)
      ? "Ruhetag"
      : sport === "Gym"
      ? "Push"
      : sport === "Laufen"
      ? "Laufen – locker"
      : sport === "Radfahren"
      ? "Radfahren – GA1"
      : "Training";

  const exercises = Array.isArray(input?.exercises) ? input.exercises : [];
  const startTime = typeof input?.startTime === "string" ? input.startTime : "";

  return { id, label, sport, focus, exercises, startTime };
}

// ✅ Migration/Guard für alte Routine-Blocks
function normalizeRoutineBlock(input: any, fallbackId: number): RoutineBlock {
  const id = typeof input?.id === "number" ? input.id : fallbackId;

  const rawSport = String(input?.sport ?? "").trim() as WeeklySportType;
  const rawType = String(input?.type ?? "").trim() as RoutineBlockType;

  const sport: WeeklySportType =
    rawSport === "Ruhetag" || rawType === "Rest"
      ? "Ruhetag"
      : rawSport === "Gym" || rawSport === "Laufen" || rawSport === "Radfahren" || rawSport === "Custom"
      ? rawSport
      : "Gym";

  const type: RoutineBlockType = isRestSport(sport) ? "Rest" : "Custom";

  const label =
    typeof input?.label === "string" && input.label.trim()
      ? input.label
      : type === "Rest"
      ? "Ruhetag"
      : "Neues Training";

  return {
    id,
    type,
    sport,
    label: type === "Rest" ? "Ruhetag" : label,
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
  if (sport === "Ruhetag") return "Ruhetag";
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

// ✅ Default Startzeit: auf nächste 15 Minuten runden (damit Uhr(+) sofort sichtbar wird)
function defaultStartTimeNowRounded(): string {
  const d = new Date();
  const total = d.getHours() * 60 + d.getMinutes();
  const rounded = Math.min(24 * 60 - 1, Math.ceil(total / 15) * 15);
  const hh = String(Math.floor(rounded / 60)).padStart(2, "0");
  const mm = String(rounded % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// -------------------- Mini UI: Uhr (+) --------------------

const ClockPlusButton: React.FC<{ onClick: () => void; title?: string }> = ({ onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    title={title ?? "Startzeit hinzufügen"}
    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1 text-[11px] text-[var(--text)] hover:opacity-95"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" strokeWidth="2" />
    </svg>
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[12px] font-bold text-white">+</span>
  </button>
);

// -------------------- Modal für Trainings-Content --------------------

interface TrainingExercisesModalProps {
  template: TrainingTemplate;
  kind: TrainingContainerKind;
  isCardioLibrary?: boolean;
  // ✅ reine Trainings Vorlagen
  workoutTemplates: WorkoutTemplate[];
  defaultSport: TrainingSportType;
  onSaveWorkoutTemplate: (tpl: WorkoutTemplate) => void;

  onClose: () => void;
  onSave: (updatedTemplate: TrainingTemplate) => void;
}

const TrainingExercisesModal: React.FC<TrainingExercisesModalProps> = ({
  template,
  kind,
  isCardioLibrary = false,
  workoutTemplates,
  defaultSport,
  onSaveWorkoutTemplate,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<TrainingTemplate>(template);
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);

  const [templateName, setTemplateName] = useState<string>(() => (template.label?.trim() ? template.label : "Training"));
  const [selectedWorkoutTemplateId, setSelectedWorkoutTemplateId] = useState<string>("");

  const filteredExercises = useMemo(() => {
    if (isCardioLibrary) {
      const term = filters.search.trim().toLowerCase();
      if (!term) return CARDIO_EXERCISES;
      return CARDIO_EXERCISES.filter((ex) => ex.name.toLowerCase().includes(term));
    }
    return filterExercises(EXERCISES, filters);
  }, [filters, isCardioLibrary]);

  const compatibleWorkoutTemplates = useMemo(() => {
    return (workoutTemplates || [])
      .filter((t) => t.isCardio === isCardioLibrary)
      .sort((a, b) => (b.createdAtISO || "").localeCompare(a.createdAtISO || ""));
  }, [workoutTemplates, isCardioLibrary]);

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
      exercises: prev.exercises.map((ex) => (ex.id === exerciseId ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) } : ex)),
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

  const handleSaveWorkoutTemplate = () => {
    const name = (templateName || "").trim();
    if (!name) return;

    const tpl: WorkoutTemplate = {
      id: makeTemplateId(),
      name,
      sport: defaultSport,
      isCardio: isCardioLibrary,
      exercises: Array.isArray(draft.exercises) ? draft.exercises : [],
      createdAtISO: new Date().toISOString(),
    };

    onSaveWorkoutTemplate(tpl);
  };

  const handleLoadWorkoutTemplate = (id: string) => {
    setSelectedWorkoutTemplateId(id);
    const tpl = compatibleWorkoutTemplates.find((t) => t.id === id);
    if (!tpl) return;

    // ✅ Laden ersetzt den Draft-Content (bewusst)
    setDraft((prev) => ({
      ...prev,
      exercises: Array.isArray(tpl.exercises) ? tpl.exercises : [],
    }));

    // optional: Name übernehmen
    setTemplateName(tpl.name || templateName);
  };

  const repsPlaceholder = isCardioLibrary ? "Dauer (min)" : "Wdh";
  const weightPlaceholder = isCardioLibrary ? "Distanz (km)" : "kg";
  const notesPlaceholder = isCardioLibrary ? "Pace / Intervall-Details" : "Notizen / RPE / Tempo";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
      <div className="flex max-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-xs shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text)]">
              {headingPrefix}: {draft.label}
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              {isCardioLibrary ? "Lege Cardio-Einheiten und Intervalle an." : "Lege Kraftübungen und Sätze an."}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ✅ Trainingsvorlage speichern */}
            <div className="hidden items-center gap-2 md:flex">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Vorlagenname"
                className="w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text)] outline-none focus:ring-1 focus:ring-sky-500/60"
              />
              <button
                type="button"
                onClick={handleSaveWorkoutTemplate}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-[11px] text-[var(--text)] hover:opacity-95"
                title="Speichert dieses Training als Vorlage (reines Training)."
              >
                Vorlage speichern
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-[11px] text-[var(--text)] hover:opacity-95"
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
          <div className="flex w-full flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 md:w-[40%]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[var(--text)]">{isCardioLibrary ? "Cardio-Bibliothek" : "Übungsbibliothek"}</span>

              <button
                type="button"
                onClick={handleAddCustomExercise}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-[11px] text-[var(--text)] hover:opacity-95"
              >
                + {isCardioLibrary ? "Eigene Einheit" : "Eigene Übung"}
              </button>
            </div>

            <input
              type="text"
              placeholder={isCardioLibrary ? "Suche (z.B. Lauf, Rad...)" : "Suche (z.B. Bankdrücken)"}
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] outline-none focus:ring-1 focus:ring-sky-500/60"
            />

            {!isCardioLibrary && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={filters.muscle}
                  onChange={(e) => setFilters((prev) => ({ ...prev, muscle: e.target.value as any }))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] text-[var(--text)] outline-none"
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
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] text-[var(--text)] outline-none"
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
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] text-[var(--text)] outline-none"
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
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] text-[var(--text)] outline-none"
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

            <div className="mt-1 flex-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {filteredExercises.length === 0 ? (
                <div className="p-3 text-[11px] text-[var(--muted)]">Keine Einträge gefunden.</div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {filteredExercises.map((ex) => (
                    <li key={ex.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[var(--surface2)]">
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-medium text-[var(--text)]">{ex.name}</div>
                        <div className="truncate text-[10px] text-[var(--muted)]">
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

          <div className="flex w-full flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 md:w-[60%]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[var(--text)]">{isCardioLibrary ? "Einheiten im Block" : "Übungen im Block"}</span>

              {/* ✅ Vorlagen (reine Trainings) laden */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedWorkoutTemplateId}
                  onChange={(e) => handleLoadWorkoutTemplate(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] text-[var(--text)] outline-none"
                  title="Reines Training als Vorlage laden"
                >
                  <option value="">{compatibleWorkoutTemplates.length ? "Vorlage laden…" : "Keine Trainingsvorlagen"}</option>
                  {compatibleWorkoutTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <span className="text-[10px] text-[var(--muted)]">
                  {draft.exercises.length} {isCardioLibrary ? "Einheit" : "Übung"}
                  {draft.exercises.length === 1 ? "" : "en"}
                </span>
              </div>
            </div>

            {draft.exercises.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 text-[11px] text-[var(--muted)]">
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
                        className="w-full rounded-lg border border-sky-900/70 bg-sky-900/25 px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:ring-1 focus:ring-sky-500/70"
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
                      <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--text)]">
                        <span>{isCardioLibrary ? "Intervalle / Abschnitte" : "Sätze"}</span>
                        <button
                          type="button"
                          onClick={() => handleAddSet(ex.id)}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[10px] text-[var(--text)] hover:opacity-95"
                        >
                          + {isCardioLibrary ? "Intervall" : "Satz"}
                        </button>
                      </div>

                      <div className="space-y-1">
                        {ex.sets.map((set, index) => (
                          <div key={set.id} className="grid grid-cols-[auto,1fr,1fr,1.5fr,auto] items-center gap-2 text-[10px]">
                            <span className="text-[var(--text)]">
                              {isCardioLibrary ? "Abschnitt" : "Satz"} {index + 1}
                            </span>

                            <input
                              type="number"
                              min={1}
                              placeholder={repsPlaceholder}
                              value={set.reps ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "reps", e.target.value)}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[10px] text-[var(--text)] outline-none"
                            />

                            <input
                              type="number"
                              min={0}
                              placeholder={weightPlaceholder}
                              value={set.weight ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "weight", e.target.value)}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[10px] text-[var(--text)] outline-none"
                            />

                            <input
                              type="text"
                              placeholder={notesPlaceholder}
                              value={set.notes ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "notes", e.target.value)}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[10px] text-[var(--text)] outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => handleRemoveSet(ex.id, set.id)}
                              className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:opacity-95"
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

            {/* Mobile: Vorlagen speichern */}
            <div className="mt-1 flex items-center gap-2 md:hidden">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Vorlagenname"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--text)] outline-none"
              />
              <button
                type="button"
                onClick={handleSaveWorkoutTemplate}
                className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-[11px] text-[var(--text)] hover:opacity-95"
              >
                Speichern
              </button>
            </div>
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
      sport: TrainingSportType;
      exercises: BlockExercise[];
    };

const TrainingPreviewModal: React.FC<{ state: PreviewModalState; onClose: () => void }> = ({ state, onClose }) => {
  const isOpen = !!state;

  if (!state) return null;

  const estMin = estimateDurationMinutes(state.exercises, state.isCardio);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text)]">{state.title}</div>
            <div className="mt-0.5 text-[11px] text-[var(--muted)]">
              {state.subtitle} · ca. {estMin} min
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-xs text-[var(--text)] hover:opacity-95">
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          {state.exercises.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4 text-sm text-[var(--muted)]">Keine Übungen/Einheiten hinterlegt.</div>
          ) : (
            <div className="space-y-3">
              {state.exercises.map((ex) => {
                const key = ex.exerciseId || ex.name;
                const lastRaw = key ? (getLastSetsForExercise({ id: key, name: ex.name, sets: [] } as any) as any) : null;
                const last = normalizeLastSummary(lastRaw);

                return (
                  <div key={ex.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[var(--text)]">{ex.name}</div>

                        {last && (last.weight !== undefined || last.reps !== undefined) && (
                          <div className="mt-0.5 text-[11px] text-[var(--muted)]">
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

                      <div className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                        {ex.sets.length} {state.isCardio ? "Abschn." : "Sätze"}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {ex.sets.map((s, idx) => (
                        <div key={s.id} className="grid grid-cols-[auto,1fr,1fr,2fr] gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px]">
                          <div className="text-[var(--muted)]">{idx + 1}</div>
                          <div className="text-[var(--text)]">
                            {state.isCardio ? "Dauer" : "Wdh"}: <span className="text-[var(--text)]">{s.reps ?? "—"}</span>
                          </div>
                          <div className="text-[var(--text)]">
                            {state.isCardio ? "Dist." : "kg"}: <span className="text-[var(--text)]">{s.weight ?? "—"}</span>
                          </div>
                          <div className="truncate text-[var(--muted)]">{s.notes || ""}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-3">
          <button onClick={onClose} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)] hover:opacity-95">
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

const TrainingsplanPage: React.FC<TrainingsplanPageProps> = ({ onAddEvent, isPro: isProProp = false }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("weekly");

  // ✅ Entitlements
  const { isPro: isProEnt, canUseCalendar7, consumeCalendar7, calendar7DaysRemaining } = useEntitlements();
  const effectiveIsPro = isProEnt || isProProp;
  const requirePro = useProGuard();

  // ✅ Startdatum
  const [planStartISO, setPlanStartISO] = useState<string>(() => {
    const today = dateToISO(new Date());
    if (typeof window === "undefined") return today;
    try {
      return getScopedItem(STORAGE_KEY_PLAN_START_ISO) || today;
    } catch {
      return today;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_PLAN_START_ISO, planStartISO);
    } catch {}
  }, [planStartISO]);

  // Weekly
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDayConfig[]>(DEFAULT_WEEKLY_DAYS.map((d, i) => normalizeWeeklyDay(d as any, i + 1)));
  const [weeklyDurationWeeks, setWeeklyDurationWeeks] = useState<number>(6);
  const [weeklySaved, setWeeklySaved] = useState<boolean>(false);

  // Routine
  const [routineBlocks, setRoutineBlocks] = useState<RoutineBlock[]>(DEFAULT_ROUTINE_BLOCKS.map((b, i) => normalizeRoutineBlock(b as any, i + 1)));
  const [routineDurationWeeks, setRoutineDurationWeeks] = useState<number>(6);
  const [routineSaved, setRoutineSaved] = useState<boolean>(false);

  // Trainingspläne Vorlagen
  const [weeklyTemplates, setWeeklyTemplates] = useState<WeeklyPlanTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = getScopedItem(STORAGE_KEY_WEEKLY_TEMPLATES);
      return raw ? (JSON.parse(raw) as WeeklyPlanTemplate[]) : [];
    } catch {
      return [];
    }
  });

  const [routineTemplates, setRoutineTemplates] = useState<RoutinePlanTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = getScopedItem(STORAGE_KEY_ROUTINE_TEMPLATES);
      return raw ? (JSON.parse(raw) as RoutinePlanTemplate[]) : [];
    } catch {
      return [];
    }
  });

  // ✅ Reine Trainings Vorlagen
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = getScopedItem(STORAGE_KEY_WORKOUT_TEMPLATES);
      return raw ? (JSON.parse(raw) as WorkoutTemplate[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_WEEKLY_TEMPLATES, JSON.stringify(weeklyTemplates));
    } catch {}
  }, [weeklyTemplates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_ROUTINE_TEMPLATES, JSON.stringify(routineTemplates));
    } catch {}
  }, [routineTemplates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_WORKOUT_TEMPLATES, JSON.stringify(workoutTemplates));
    } catch {}
  }, [workoutTemplates]);

  // Modals
  const [weeklyPreviewOpen, setWeeklyPreviewOpen] = useState(false);
  const [routinePreviewOpen, setRoutinePreviewOpen] = useState(false);

  // Trainingspläne Vorlagen-Modal
  const [weeklyTemplatesOpen, setWeeklyTemplatesOpen] = useState(false);
  const [routineTemplatesOpen, setRoutineTemplatesOpen] = useState(false);

  // ✅ Reine Trainings Vorlagen-Modal (Management)
  const [workoutTemplatesOpen, setWorkoutTemplatesOpen] = useState(false);

  // Save Dialogs (Plan)
  const [weeklySaveDialogOpen, setWeeklySaveDialogOpen] = useState(false);
  const [routineSaveDialogOpen, setRoutineSaveDialogOpen] = useState(false);

  const [weeklyTemplateName, setWeeklyTemplateName] = useState("Wochenplan");
  const [routineTemplateName, setRoutineTemplateName] = useState("Split/Routine");

  const [activeTrainingTemplate, setActiveTrainingTemplate] = useState<{
    kind: TrainingContainerKind;
    template: TrainingTemplate;
    isCardioLibrary: boolean;
    sport: TrainingSportType;
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
      requirePro("calendar_7days");
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
      setScopedItem(STORAGE_KEY_LAST_IMPORTED_TEMPLATE_ID, templateId);
    } catch {}

    const startDate = isoToDate(planStartISO);
    const totalDays = weeklyDurationWeeks * 7;

    for (let i = 0; i < totalDays; i++) {
      const raw = weeklyDays[i % weeklyDays.length];
      const dayConfig = normalizeWeeklyDay(raw as any, (i % weeklyDays.length) + 1);

      // ✅ Ruhetag wird nicht importiert
      if (isRestSport(dayConfig.sport)) continue;

      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateISO = dateToISO(date);

      if (!handleCalendar7DaysGate(dateISO)) break;

      const title = (dayConfig.focus || `${dayConfig.sport} – ${dayConfig.label}`).trim();
      const isCardio = isCardioSport(dayConfig.sport);

      // ✅ Startzeit nur wenn gesetzt
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

      // ✅ Seeds unter stable key + legacy key speichern
      writeLiveSeedForEventOrKey({
        dateISO,
        title,
        seed: {
          title,
          sport: dayConfig.sport as TrainingSportType,
          isCardio,
          exercises: normalizeExercisesForSeed(dayConfig.exercises),
        },
      });

      onAddEvent(newEvent);
    }
  };

  const pushRoutineToCalendar = () => {
    if (!onAddEvent || routineBlocks.length === 0) return;

    const templateId = makeTemplateId();
    try {
      setScopedItem(STORAGE_KEY_LAST_IMPORTED_TEMPLATE_ID, templateId);
    } catch {}

    const startDate = isoToDate(planStartISO);
    const totalDays = routineDurationWeeks * 7;

    for (let i = 0; i < totalDays; i++) {
      const raw = routineBlocks[i % routineBlocks.length];
      const block = normalizeRoutineBlock(raw as any, (i % routineBlocks.length) + 1);

      // ✅ Ruhetag wird nicht importiert
      if (block.type === "Rest" || isRestSport(block.sport)) continue;

      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateISO = dateToISO(date);

      if (!handleCalendar7DaysGate(dateISO)) break;

      const title = (block.label || `Training Tag ${i + 1}`).trim();
      const isCardio = isCardioSport(block.sport);

      // ✅ Startzeit nur wenn gesetzt
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

      // ✅ Seeds unter stable key + legacy key speichern
      writeLiveSeedForEventOrKey({
        dateISO,
        title,
        seed: {
          title,
          sport: block.sport as TrainingSportType,
          isCardio,
          exercises: normalizeExercisesForSeed(block.exercises),
        },
      });

      onAddEvent(newEvent);
    }
  };

  // -------------------- Weekly --------------------

  const handleWeeklyDayChange = (id: number, field: "sport" | "focus" | "startTime", value: string) => {
    setWeeklySaved(false);

    setWeeklyDays((prev) =>
      prev.map((day) => {
        const d = normalizeWeeklyDay(day as any, day.id);
        if (d.id !== id) return d;

        if (field === "sport") {
          const nextSport = value as WeeklySportType;

          // ✅ wenn Ruhetag -> reset
          if (isRestSport(nextSport)) {
            return {
              ...d,
              sport: "Ruhetag",
              focus: "Ruhetag",
              exercises: [],
              startTime: "",
              label: d.label?.trim() ? d.label : `Tag ${d.id}`,
            };
          }

          const shouldAutoRename = !d.focus?.trim() || isLikelyGymDefaultLabel(d.focus) || d.focus.trim() === "Ruhetag";
          return {
            ...d,
            sport: nextSport,
            focus: shouldAutoRename ? defaultLabelForSport(nextSport) : d.focus,
          };
        }

        if (field === "focus") return { ...d, focus: value };
        if (field === "startTime") return { ...d, startTime: value };

        return d;
      })
    );
  };

  const openWeeklyTraining = (day: WeeklyDayConfig) => {
    const d = normalizeWeeklyDay(day as any, day.id);
    if (isRestSport(d.sport)) return;

    setActiveTrainingTemplate({
      kind: "weekly",
      template: { id: d.id, label: d.label, exercises: d.exercises },
      isCardioLibrary: isCardioSport(d.sport),
      sport: d.sport as TrainingSportType,
    });
  };

  const openWeeklyPreviewAndStart = (day: WeeklyDayConfig) => {
    const d = normalizeWeeklyDay(day as any, day.id);
    if (isRestSport(d.sport)) return;

    setPreviewState({
      title: d.focus || `Training · ${d.label}`,
      subtitle: `${d.label} · ${d.sport}`,
      isCardio: isCardioSport(d.sport),
      sport: d.sport as TrainingSportType,
      exercises: d.exercises,
    });
  };

  const saveWeeklyTemplateAndCalendar = (withTemplate: boolean) => {
    if (withTemplate) {
      const tpl: WeeklyPlanTemplate = {
        id: makeTemplateId(),
        name: weeklyTemplateName.trim() || "Wochenplan",
        days: weeklyDays.map((d, i) => normalizeWeeklyDay(d as any, i + 1)),
        durationWeeks: weeklyDurationWeeks,
      };
      setWeeklyTemplates((prev) => [...prev, tpl]);
    }

    pushWeeklyToCalendar();
    setWeeklySaved(true);
    setWeeklySaveDialogOpen(false);
  };

  const applyWeeklyTemplate = (tpl: WeeklyPlanTemplate) => {
    const nextDays = (tpl.days || []).map((d, i) => normalizeWeeklyDay(d as any, i + 1));
    setWeeklyDays(nextDays);
    setWeeklyDurationWeeks(tpl.durationWeeks);
    setWeeklySaved(false);
    setWeeklyTemplatesOpen(false);
  };

  // -------------------- Routine --------------------

  const handleRoutineBlockChange = (id: number, field: "sport" | "label" | "startTime", value: string) => {
    setRoutineSaved(false);

    setRoutineBlocks((prev) =>
      prev.map((block) => {
        const b = normalizeRoutineBlock(block as any, block.id);
        if (b.id !== id) return b;

        if (field === "sport") {
          const nextSport = value as WeeklySportType;

          if (isRestSport(nextSport)) {
            return { ...b, type: "Rest", sport: "Ruhetag", label: "Ruhetag", exercises: [], startTime: "" };
          }

          const shouldAutoRename = !b.label?.trim() || isLikelyGymDefaultLabel(b.label) || b.label.trim() === "Ruhetag";
          return {
            ...b,
            type: "Custom",
            sport: nextSport,
            label: shouldAutoRename ? defaultLabelForSport(nextSport) : b.label,
          };
        }

        if (field === "startTime") return { ...b, startTime: value };

        // label
        if (b.type === "Rest" || isRestSport(b.sport)) return { ...b, label: "Ruhetag" };
        return { ...b, label: value };
      })
    );
  };

  const handleAddRoutineBlock = () => {
    setRoutineSaved(false);
    setRoutineBlocks((prev) => [
      ...prev,
      normalizeRoutineBlock(
        {
          id: prev.length ? (prev[prev.length - 1].id ?? 0) + 1 : 1,
          type: "Custom",
          sport: "Gym",
          label: "Neues Training",
          exercises: [],
          startTime: "",
        },
        prev.length ? (prev[prev.length - 1].id ?? 0) + 1 : 1
      ),
    ]);
  };

  const handleRemoveRoutineBlock = (id: number) => {
    setRoutineSaved(false);
    setRoutineBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  const openRoutineTraining = (block: RoutineBlock) => {
    const b = normalizeRoutineBlock(block as any, block.id);
    if (b.type === "Rest" || isRestSport(b.sport)) return;

    setActiveTrainingTemplate({
      kind: "routine",
      template: { id: b.id, label: b.label, exercises: b.exercises },
      isCardioLibrary: isCardioSport(b.sport),
      sport: b.sport as TrainingSportType,
    });
  };

  const openRoutinePreviewAndStart = (block: RoutineBlock, index: number) => {
    const b = normalizeRoutineBlock(block as any, block.id);
    if (b.type === "Rest" || isRestSport(b.sport)) return;

    setPreviewState({
      title: b.label,
      subtitle: `Tag ${index + 1} · ${b.sport}`,
      isCardio: isCardioSport(b.sport),
      sport: b.sport as TrainingSportType,
      exercises: b.exercises,
    });
  };

  const saveRoutineTemplateAndCalendar = (withTemplate: boolean) => {
    if (withTemplate) {
      const tpl: RoutinePlanTemplate = {
        id: makeTemplateId(),
        name: routineTemplateName.trim() || "Split/Routine",
        blocks: routineBlocks.map((b, i) => normalizeRoutineBlock(b as any, i + 1)),
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
    return Array.from({ length: 7 }).map((_, i) => {
      const block = normalizeRoutineBlock(routineBlocks[i % routineBlocks.length] as any, (i % routineBlocks.length) + 1);
      return { dayIndex: i, label: `Tag ${i + 1}`, block };
    });
  }, [routineBlocks]);

  // ✅ Reine Trainings Vorlagen: Add / Delete
  const addWorkoutTemplate = (tpl: WorkoutTemplate) => {
    if (!tpl?.name?.trim()) return;

    // ✅ Name-Duplikate erlauben, aber neueste oben
    setWorkoutTemplates((prev) => [tpl, ...(prev || [])].slice(0, 200));
  };

  const deleteWorkoutTemplate = (id: string) => {
    setWorkoutTemplates((prev) => (prev || []).filter((t) => t.id !== id));
  };

  // -------------------- Render --------------------

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 rounded-xl bg-[var(--surface2)] p-1 text-sm">
          <button
            onClick={() => setActiveTab("weekly")}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${activeTab === "weekly" ? "bg-sky-500 text-white shadow" : "text-[var(--muted)] hover:opacity-95"}`}
          >
            Wochenplan
          </button>
          <button
            onClick={() => setActiveTab("routine")}
            className={`flex-1 rounded-lg px-3 py-2 font-medium transition ${activeTab === "routine" ? "bg-sky-500 text-white shadow" : "text-[var(--muted)] hover:opacity-95"}`}
          >
            Split/Routine
          </button>
        </div>

        {/* ✅ Startdatum + Dauer kompakt, Hinweis klein, Vorlagen als Row */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-[11px] text-[var(--muted)]">Startdatum</div>
              <input
                type="date"
                value={planStartISO}
                onChange={(e) => {
                  setWeeklySaved(false);
                  setRoutineSaved(false);
                  setPlanStartISO(e.target.value);
                }}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] outline-none"
              />
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="text-[11px] text-[var(--muted)]">Dauer</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, (activeTab === "weekly" ? weeklyDurationWeeks : routineDurationWeeks) - 1);
                      if (activeTab === "weekly") {
                        setWeeklySaved(false);
                        setWeeklyDurationWeeks(next);
                      } else {
                        setRoutineSaved(false);
                        setRoutineDurationWeeks(next);
                      }
                    }}
                    className="h-11 w-11 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-base font-semibold text-[var(--text)]"
                    aria-label="Weniger Wochen"
                  >
                    –
                  </button>
                  <div className="min-w-[44px] text-center text-[16px] font-semibold text-[var(--text)]">
                    {activeTab === "weekly" ? weeklyDurationWeeks : routineDurationWeeks}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(52, (activeTab === "weekly" ? weeklyDurationWeeks : routineDurationWeeks) + 1);
                      if (activeTab === "weekly") {
                        setWeeklySaved(false);
                        setWeeklyDurationWeeks(next);
                      } else {
                        setRoutineSaved(false);
                        setRoutineDurationWeeks(next);
                      }
                    }}
                    className="h-11 w-11 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-base font-semibold text-[var(--text)]"
                    aria-label="Mehr Wochen"
                  >
                    +
                  </button>
                </div>
                <span className="text-[11px] text-[var(--muted)]">Wochen</span>
              </div>
            </div>
          </div>

          {!effectiveIsPro && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]"
                style={{ background: "var(--surface2)", color: "var(--text)" }}
              >
                i
              </span>
              <div className="flex-1 text-[11px] text-[var(--muted)]">
                Free: Kalender &gt; 7 Tage voraus.
              </div>
              <span
                className="rounded-full px-2 py-1 text-[11px] font-semibold"
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                {Number.isFinite(calendar7DaysRemaining as number) ? (calendar7DaysRemaining as number) : FREE_LIMITS.calendar7DaysPerMonth} übrig
              </span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWorkoutTemplatesOpen(true)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-3 text-[12px] font-semibold text-[var(--text)] hover:opacity-95"
            >
              Trainings
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === "weekly") setWeeklyTemplatesOpen(true);
                else setRoutineTemplatesOpen(true);
              }}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-3 text-[12px] font-semibold text-[var(--text)] hover:opacity-95"
            >
              Trainingspläne
            </button>
          </div>
        </section>

        {/* Weekly */}
        {activeTab === "weekly" && (
          <section className="space-y-4 rounded-2xl bg-[var(--surface2)] p-4 shadow sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Wochenplan</h2>
                <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                  Start: <span className="text-[var(--text)]">{planStartISO}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">{weeklySaved && <span className="text-xs text-emerald-400">In Kalender übernommen</span>}</div>
            </div>

            <div className="space-y-3">
              {weeklyDays.map((rawDay, idx) => {
                const day = normalizeWeeklyDay(rawDay as any, idx + 1);
                const isRest = isRestSport(day.sport);

                return (
                  <div key={day.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    {/* Kopfzeile */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-[var(--text)]">Tag {day.id}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={day.sport}
                          onChange={(e) => handleWeeklyDayChange(day.id, "sport", e.target.value)}
                          className={`rounded-full border px-2.5 py-1 text-xs outline-none ${isRest ? "border-[var(--border)] bg-[var(--surface2)] text-[var(--text)]" : "border-sky-700 bg-sky-950/60 text-sky-100"}`}
                        >
                          <option value="Gym">Gym</option>
                          <option value="Laufen">Laufen</option>
                          <option value="Radfahren">Radfahren</option>
                          <option value="Custom">Custom</option>
                          <option value="Ruhetag">Ruhetag</option>
                        </select>

                        {/* ✅ Startzeit optional */}
                        {!isRest && (
                          <>
                            {day.startTime?.trim() ? (
                              <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1">
                                <input
                                  type="time"
                                  value={day.startTime ?? ""}
                                  onChange={(e) => handleWeeklyDayChange(day.id, "startTime", e.target.value)}
                                  className="w-[92px] bg-transparent text-[11px] text-[var(--text)] outline-none"
                                  title="Optional"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleWeeklyDayChange(day.id, "startTime", "")}
                                  className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:opacity-95"
                                  title="Startzeit entfernen"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <ClockPlusButton onClick={() => handleWeeklyDayChange(day.id, "startTime", defaultStartTimeNowRounded())} />
                            )}
                          </>
                        )}

                        {!isRest && (
                          <button
                            type="button"
                            onClick={() => openWeeklyTraining(day)}
                            className="rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/20"
                          >
                            Training erstellen{day.exercises.length > 0 ? ` (${day.exercises.length})` : ""}
                          </button>
                        )}

                        {!isRest && day.exercises.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openWeeklyPreviewAndStart(day)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-[11px] font-medium text-[var(--text)] hover:opacity-95"
                          >
                            Vorschau / Start
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Trainingsbezeichnung */}
                    <div className="mt-2">
                      <label className="block text-[11px] font-medium text-[var(--muted)]">Trainingsbezeichnung</label>
                      <input
                        type="text"
                        value={isRest ? "Ruhetag" : day.focus}
                        disabled={isRest}
                        onChange={(e) => handleWeeklyDayChange(day.id, "focus", e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-500/60 ${isRest ? "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setWeeklyPreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:opacity-95"
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
          <section className="space-y-4 rounded-2xl bg-[var(--surface2)] p-4 shadow sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">Split/Routine</h2>
                <div className="mt-0.5 text-[11px] text-[var(--muted)]">
                  Start: <span className="text-[var(--text)]">{planStartISO}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">{routineSaved && <span className="text-xs text-emerald-400">In Kalender übernommen</span>}</div>
            </div>

            <div className="space-y-3">
              {routineBlocks.map((rawBlock, index) => {
                const block = normalizeRoutineBlock(rawBlock as any, index + 1);
                const isRest = block.type === "Rest" || isRestSport(block.sport);

                return (
                  <div key={block.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-[var(--text)]">Tag {index + 1}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={block.sport}
                          onChange={(e) => handleRoutineBlockChange(block.id, "sport", e.target.value)}
                          className={`rounded-full border px-2.5 py-1 text-xs outline-none ${isRest ? "border-[var(--border)] bg-[var(--surface2)] text-[var(--text)]" : "border-sky-700 bg-sky-950/60 text-sky-100"}`}
                        >
                          <option value="Gym">Gym</option>
                          <option value="Laufen">Laufen</option>
                          <option value="Radfahren">Radfahren</option>
                          <option value="Custom">Custom</option>
                          <option value="Ruhetag">Ruhetag</option>
                        </select>

                        {/* ✅ Startzeit optional */}
                        {!isRest && (
                          <>
                            {block.startTime?.trim() ? (
                              <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1">
                                <input
                                  type="time"
                                  value={block.startTime ?? ""}
                                  onChange={(e) => handleRoutineBlockChange(block.id, "startTime", e.target.value)}
                                  className="w-[92px] bg-transparent text-[11px] text-[var(--text)] outline-none"
                                  title="Optional"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRoutineBlockChange(block.id, "startTime", "")}
                                  className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:opacity-95"
                                  title="Startzeit entfernen"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <ClockPlusButton onClick={() => handleRoutineBlockChange(block.id, "startTime", defaultStartTimeNowRounded())} />
                            )}
                          </>
                        )}

                        {!isRest && (
                          <button
                            type="button"
                            onClick={() => openRoutineTraining(block)}
                            className="rounded-lg border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-[11px] font-medium text-sky-100 hover:bg-sky-500/20"
                          >
                            Training erstellen{block.exercises.length > 0 ? ` (${block.exercises.length})` : ""}
                          </button>
                        )}

                        {!isRest && block.exercises.length > 0 && (
                          <button
                            type="button"
                            onClick={() => openRoutinePreviewAndStart(block, index)}
                            className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-[11px] font-medium text-[var(--text)] hover:opacity-95"
                          >
                            Vorschau / Start
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="block text-[11px] font-medium text-[var(--muted)]">Trainingsbezeichnung</label>
                      <input
                        type="text"
                        value={isRest ? "Ruhetag" : block.label}
                        disabled={isRest}
                        onChange={(e) => handleRoutineBlockChange(block.id, "label", e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-sky-500/60 ${isRest ? "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]" : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
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
              className="mt-1 inline-flex w-full items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface2)]"
            >
              + Tag hinzufügen (Routine-Zyklus erweitern)
            </button>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setRoutinePreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:opacity-95"
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
          workoutTemplates={workoutTemplates}
          defaultSport={activeTrainingTemplate.sport}
          onSaveWorkoutTemplate={addWorkoutTemplate}
          onClose={() => setActiveTrainingTemplate(null)}
          onSave={(updated) => {
            if (activeTrainingTemplate.kind === "weekly") {
              setWeeklySaved(false);
              setWeeklyDays((prev) =>
                prev.map((d) =>
                  d.id === updated.id
                    ? { ...normalizeWeeklyDay(d as any, d.id), exercises: updated.exercises }
                    : normalizeWeeklyDay(d as any, d.id)
                )
              );
            } else {
              setRoutineSaved(false);
              setRoutineBlocks((prev) =>
                prev.map((b) =>
                  b.id === updated.id
                    ? { ...normalizeRoutineBlock(b as any, b.id), exercises: updated.exercises }
                    : normalizeRoutineBlock(b as any, b.id)
                )
              );
            }
          }}
        />
      )}

      {/* Vorschau/Start Modal */}
      <TrainingPreviewModal state={previewState} onClose={() => setPreviewState(null)} />

      {/* Weekly Vorschau Modal */}
      {weeklyPreviewOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Vorschau – Woche</h3>
              <button type="button" onClick={() => setWeeklyPreviewOpen(false)} className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1">
              {weeklyDays.map((raw, idx) => {
                const day = normalizeWeeklyDay(raw as any, idx + 1);
                const isRest = isRestSport(day.sport);

                return (
                  <div key={day.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[var(--text)]">Tag {day.id}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={
                          isRest
                            ? { background: "var(--surface2)", color: "var(--text)", boxShadow: "0 0 0 1px var(--border)" }
                            : {
                                background: "rgba(16,185,129,0.12)",
                                color: "rgba(16,185,129,0.85)",
                                boxShadow: "0 0 0 1px rgba(16,185,129,0.4)",
                              }
                        }
                      >
                        {isRest ? "Ruhetag" : day.sport}
                      </span>
                    </div>

                    <div className="mt-0.5 text-[11px] text-[var(--text)]">{isRest ? "Ruhetag" : day.focus || "Keine Bezeichnung definiert"}</div>

                    {!isRest && day.startTime && <div className="mt-0.5 text-[10px] text-[var(--muted)]">Startzeit: {day.startTime}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Routine Vorschau Modal */}
      {routinePreviewOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Vorschau – Routine (1 Woche)</h3>
              <button type="button" onClick={() => setRoutinePreviewOpen(false)} className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1">
              {routinePreview.map((item, index) => {
                const block = normalizeRoutineBlock(item.block as any, index + 1);
                const isRest = block.type === "Rest" || isRestSport(block.sport);

                return (
                  <div key={index} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[var(--text)]">{item.label}</span>
                      <span className="text-[10px] text-[var(--muted)]">{isRest ? "Ruhetag" : block.sport}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium text-[var(--text)]">{isRest ? "Ruhetag" : block.label}</div>

                    {!isRest && block.startTime && <div className="mt-0.5 text-[10px] text-[var(--muted)]">Startzeit: {block.startTime}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Reine Trainings Vorlagen Modal (Management) */}
      {workoutTemplatesOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Vorlagen – Trainings</h3>
              <button type="button" onClick={() => setWorkoutTemplatesOpen(false)} className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
                ✕
              </button>
            </div>

            {workoutTemplates.length === 0 ? (
              <p className="text-[11px] text-[var(--muted)]">
                Noch keine Trainingsvorlagen gespeichert. Öffne „Training erstellen“ und klicke oben im Editor auf „Vorlage speichern“.
              </p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {workoutTemplates
                  .slice()
                  .sort((a, b) => (b.createdAtISO || "").localeCompare(a.createdAtISO || ""))
                  .map((tpl) => (
                    <div key={tpl.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <div className="min-w-0 text-[11px] text-[var(--text)]">
                        <div className="truncate font-medium">{tpl.name}</div>
                        <div className="truncate text-[10px] text-[var(--muted)]">
                          {tpl.isCardio ? "Cardio" : "Gym"} · {tpl.sport} · {tpl.exercises?.length ?? 0} {tpl.isCardio ? "Einheit(en)" : "Übung(en)"}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            const ok = window.confirm(`Vorlage "${tpl.name}" löschen?`);
                            if (!ok) return;
                          }
                          deleteWorkoutTemplate(tpl.id);
                        }}
                        className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 hover:bg-red-500/20"
                      >
                        Löschen
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trainingspläne Vorlagen Modal (Weekly) */}
      {weeklyTemplatesOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Vorlagen – Wochenpläne</h3>
              <button type="button" onClick={() => setWeeklyTemplatesOpen(false)} className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
                ✕
              </button>
            </div>

            {weeklyTemplates.length === 0 ? (
              <p className="text-[11px] text-[var(--muted)]">Noch keine Vorlagen gespeichert.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {weeklyTemplates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <div className="text-[11px] text-[var(--text)]">
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {tpl.durationWeeks} Woche{tpl.durationWeeks !== 1 ? "n" : ""}, {tpl.days.length} Tage
                      </div>
                    </div>

                    <button type="button" onClick={() => applyWeeklyTemplate(tpl)} className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-sky-600">
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Vorlagen – Split/Routine</h3>
              <button type="button" onClick={() => setRoutineTemplatesOpen(false)} className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
                ✕
              </button>
            </div>

            {routineTemplates.length === 0 ? (
              <p className="text-[11px] text-[var(--muted)]">Noch keine Vorlagen gespeichert.</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {routineTemplates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    <div className="text-[11px] text-[var(--text)]">
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {tpl.durationWeeks} Woche{tpl.durationWeeks !== 1 ? "n" : ""}, {tpl.blocks.length} Tage im Zyklus
                      </div>
                    </div>

                    <button type="button" onClick={() => applyRoutineTemplate(tpl)} className="rounded-lg bg-sky-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-sky-600">
                      Übernehmen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Dialogs (Plan) */}
      {weeklySaveDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <h3 className="text-sm font-semibold text-[var(--text)]">Plan in Kalender übernehmen</h3>
            <p className="mt-1 text-[11px] text-[var(--muted)]">Als Vorlage speichern (optional)?</p>

            <div className="mt-3 space-y-2">
              <label className="block text-[11px] text-[var(--muted)]">Name der Vorlage (optional)</label>
              <input
                type="text"
                value={weeklyTemplateName}
                onChange={(e) => setWeeklyTemplateName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveWeeklyTemplateAndCalendar(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-[11px] text-[var(--text)] hover:opacity-95"
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <h3 className="text-sm font-semibold text-[var(--text)]">Routine in Kalender übernehmen</h3>
            <p className="mt-1 text-[11px] text-[var(--muted)]">Als Vorlage speichern (optional)?</p>

            <div className="mt-3 space-y-2">
              <label className="block text-[11px] text-[var(--muted)]">Name der Vorlage (optional)</label>
              <input
                type="text"
                value={routineTemplateName}
                onChange={(e) => setRoutineTemplateName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] outline-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveRoutineTemplateAndCalendar(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-[11px] text-[var(--text)] hover:opacity-95"
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
    </div>
  );
};

export default TrainingsplanPage;
