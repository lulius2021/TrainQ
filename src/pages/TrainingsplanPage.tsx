// src/pages/TrainingsplanPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { CalendarEvent, NewCalendarEvent } from "../types/training";
import type { SportType } from "../types/training";
import type { TrainingPlanTemplate, TrainingTemplate as StoredTrainingTemplate, TrainingTemplateExercise } from "../types/trainingTemplates";
import { type Exercise } from "../data/exerciseLibrary";
import ExerciseLibraryModal from "../components/training/ExerciseLibraryModal";

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
import { useAuth } from "../hooks/useAuth";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { FREE_LIMITS } from "../utils/entitlements";
import { useI18n } from "../i18n/useI18n";
import type { TranslationKey } from "../i18n/index";
import {
  buildTrainingTemplateSignature,
  deleteTrainingTemplate,
  loadTrainingTemplates,
  saveTrainingTemplates,
  upsertTrainingTemplate,
} from "../services/trainingTemplatesService";
import { loadTrainingPlanTemplates, upsertTrainingPlanTemplate } from "../services/trainingPlanTemplatesService";

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

const SPORT_LABEL_KEY: Record<WeeklySportType, TranslationKey> = {
  Gym: "plan.sport.gym",
  Laufen: "plan.sport.run",
  Radfahren: "plan.sport.bike",
  Custom: "plan.sport.custom",
  Ruhetag: "plan.sport.rest",
};

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

function getDefaultWeeklyDays(t: (key: any, vars?: any) => string): WeeklyDayConfig[] {
  return [
    { id: 1, label: t("plan.dayLabel", { day: 1 }), sport: "Gym", focus: t("plan.focus.push"), exercises: [], startTime: "" },
    { id: 2, label: t("plan.dayLabel", { day: 2 }), sport: "Gym", focus: t("plan.focus.pull"), exercises: [], startTime: "" },
    { id: 3, label: t("plan.dayLabel", { day: 3 }), sport: "Gym", focus: t("plan.focus.legs"), exercises: [], startTime: "" },
    { id: 4, label: t("plan.dayLabel", { day: 4 }), sport: "Ruhetag", focus: t("plan.restday"), exercises: [], startTime: "" },
    { id: 5, label: t("plan.dayLabel", { day: 5 }), sport: "Gym", focus: t("plan.focus.pushShort"), exercises: [], startTime: "" },
    { id: 6, label: t("plan.dayLabel", { day: 6 }), sport: "Gym", focus: t("plan.focus.pullShort"), exercises: [], startTime: "" },
    { id: 7, label: t("plan.dayLabel", { day: 7 }), sport: "Ruhetag", focus: t("plan.restday"), exercises: [], startTime: "" },
  ];
}

function getDefaultRoutineBlocks(t: (key: any, vars?: any) => string): RoutineBlock[] {
  return [
    { id: 1, type: "Custom", sport: "Gym", label: t("plan.focus.push"), exercises: [], startTime: "" },
    { id: 2, type: "Custom", sport: "Gym", label: t("plan.focus.pull"), exercises: [], startTime: "" },
    { id: 3, type: "Custom", sport: "Gym", label: t("plan.focus.legs"), exercises: [], startTime: "" },
    { id: 4, type: "Rest", sport: "Ruhetag", label: t("plan.restday"), exercises: [], startTime: "" },
  ];
}

// Storage-Keys
const STORAGE_KEY_WEEKLY_TEMPLATES = "trainq_weekly_plan_templates";
const STORAGE_KEY_ROUTINE_TEMPLATES = "trainq_routine_plan_templates";

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

function isCardioSportType(sport: SportType): boolean {
  return sport === "Laufen" || sport === "Radfahren";
}

function blockExercisesToStoredExercises(exercises: BlockExercise[]): TrainingTemplateExercise[] {
  return (exercises || []).map((ex) => ({
    id: String(ex.id ?? nextBlockExerciseId()),
    exerciseId: ex.exerciseId,
    name: ex.name ?? "Übung",
    sets: (ex.sets || []).map((s) => ({
      id: String(s.id ?? nextExerciseSetId()),
      reps: typeof s.reps === "number" ? s.reps : undefined,
      weight: typeof s.weight === "number" ? s.weight : undefined,
      notes: typeof s.notes === "string" ? s.notes : undefined,
    })),
  }));
}

function storedExercisesToBlockExercises(exercises: TrainingTemplateExercise[]): BlockExercise[] {
  return (exercises || []).map((ex) => ({
    id: nextBlockExerciseId(),
    exerciseId: ex.exerciseId,
    name: ex.name ?? "Übung",
    sets: (ex.sets || []).map((s) => ({
      id: nextExerciseSetId(),
      reps: typeof s.reps === "number" ? s.reps : undefined,
      weight: typeof s.weight === "number" ? s.weight : undefined,
      notes: typeof s.notes === "string" ? s.notes : "",
    })),
  }));
}

function storedTemplateToWorkoutTemplate(tpl: StoredTrainingTemplate): WorkoutTemplate {
  return {
    id: tpl.id,
    name: tpl.name,
    sport: tpl.sportType as TrainingSportType,
    isCardio: isCardioSportType(tpl.sportType),
    exercises: storedExercisesToBlockExercises(tpl.exercises),
    createdAtISO: tpl.createdAt,
  };
}

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
  const { t } = useI18n();
  const [draft, setDraft] = useState<TrainingTemplate>(template);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const [templateName, setTemplateName] = useState<string>(() => (template.label?.trim() ? template.label : "Training"));
  const [selectedWorkoutTemplateId, setSelectedWorkoutTemplateId] = useState<string>("");

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
    if (import.meta.env.DEV) {
      console.log("[Trainingsplan] Added exercise from library", exercise.id, newBlockExercise.name);
    }
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
    if (import.meta.env.DEV) {
      console.log("[Trainingsplan] Added custom exercise", newBlockExercise.name);
    }
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
  const existingExerciseIds = draft.exercises.map((ex) => ex.exerciseId).filter(Boolean) as string[];

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
                placeholder={t("plan.templateNamePlaceholder")}
                className="w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text)] outline-none focus:ring-1 focus:ring-sky-500/60"
              />
              <button
                type="button"
                onClick={handleSaveWorkoutTemplate}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-1.5 text-[11px] text-[var(--text)] hover:opacity-95"
                title={t("plan.templateSaveHint")}
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

        <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4">
          <div className="flex w-full flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[var(--text)]">{isCardioLibrary ? "Einheiten im Block" : "Übungen im Block"}</span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLibraryOpen(true);
                    if (import.meta.env.DEV) console.log("[Trainingsplan] Open exercise library");
                  }}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-[11px] text-[var(--text)] hover:opacity-95"
                >
                  {isCardioLibrary ? "Cardio öffnen" : "Übungsbibliothek"}
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomExercise}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-[11px] text-[var(--text)] hover:opacity-95"
                >
                  + {isCardioLibrary ? "Eigene Einheit" : "Eigene Übung"}
                </button>
              </div>
            </div>

            {/* ✅ Vorlagen (reine Trainings) laden */}
            <div className="flex items-center justify-between gap-2">
              <select
                value={selectedWorkoutTemplateId}
                onChange={(e) => handleLoadWorkoutTemplate(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[11px] text-[var(--text)] outline-none"
                title={t("plan.templateLoadHint")}
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
                placeholder={t("plan.templateNamePlaceholder")}
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

      <ExerciseLibraryModal
        open={libraryOpen}
        isCardioLibrary={isCardioLibrary}
        title={isCardioLibrary ? "Cardio-Bibliothek" : "Übungsbibliothek"}
        onClose={() => setLibraryOpen(false)}
        existingExerciseIds={existingExerciseIds}
        onPick={(exercise: Exercise) => handleAddExerciseFromLibrary(exercise)}
        onPickCustom={handleAddCustomExercise}
      />
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
  const { t } = useI18n();
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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-4 text-sm text-[var(--muted)]">
              {t("plan.emptyExercises")}
            </div>
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
  const { t, formatDate } = useI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>("weekly");
  const { user } = useAuth();
  const userId = user?.id ?? null;

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
    } catch { }
  }, [planStartISO]);

  // Weekly
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDayConfig[]>(() =>
    getDefaultWeeklyDays(t).map((d, i) => normalizeWeeklyDay(d as any, i + 1))
  );
  const [weeklyDurationWeeks, setWeeklyDurationWeeks] = useState<number>(6);
  const [weeklySaved, setWeeklySaved] = useState<boolean>(false);

  // Routine
  const [routineBlocks, setRoutineBlocks] = useState<RoutineBlock[]>(() =>
    getDefaultRoutineBlocks(t).map((b, i) => normalizeRoutineBlock(b as any, i + 1))
  );
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

  // ✅ Reine Trainings Vorlagen (neue zentrale Storage)
  const [workoutTemplates, setWorkoutTemplates] = useState<WorkoutTemplate[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_WEEKLY_TEMPLATES, JSON.stringify(weeklyTemplates));
    } catch { }
  }, [weeklyTemplates]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_ROUTINE_TEMPLATES, JSON.stringify(routineTemplates));
    } catch { }
  }, [routineTemplates]);

  useEffect(() => {
    const stored = loadTrainingTemplates(userId ?? "");
    setWorkoutTemplates(stored.map(storedTemplateToWorkoutTemplate));
  }, [userId]);

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
    } catch { }

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
    } catch { }

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
      const planName = weeklyTemplateName.trim() || "Wochenplan";
      const normalizedDays = weeklyDays.map((d, i) => normalizeWeeklyDay(d as any, i + 1));

      const existingPlans = loadTrainingPlanTemplates(userId ?? "");
      const existingPlan = existingPlans.find((p) => p.kind === "weekly" && p.name === planName);
      const planId = existingPlan?.id ?? makeTemplateId();

      const now = new Date().toISOString();
      const storedTemplates = loadTrainingTemplates(userId ?? "");
      const nextStoredTemplates = [...storedTemplates];

      const planDays = normalizedDays.map((day, idx) => {
        const sportType = (day.sport as SportType) || "Gym";
        const exercises = blockExercisesToStoredExercises(day.exercises || []);

        let trainingTemplateId: string | undefined;
        if (!isRestSport(day.sport) && exercises.length > 0) {
          const signature = buildTrainingTemplateSignature(exercises);
          const existingBySource = nextStoredTemplates.find(
            (t) => t.sourcePlanId === planId && t.sourceDayIndex === idx
          );
          const existingBySignature = nextStoredTemplates.find((t) => t.signature === signature && t.name === day.label);
          const existing = existingBySource ?? existingBySignature;

          const updated: StoredTrainingTemplate = {
            id: existing?.id ?? makeTemplateId(),
            userId: userId ?? "unknown",
            name: day.label,
            sportType,
            exercises,
            sourcePlanId: planId,
            sourceDayIndex: idx,
            signature,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };

          if (existing) {
            const index = nextStoredTemplates.findIndex((t) => t.id === existing.id);
            nextStoredTemplates[index] = updated;
          } else {
            nextStoredTemplates.push(updated);
          }

          trainingTemplateId = updated.id;
        }

        return {
          dayIndex: idx,
          title: day.label,
          trainingTemplateId,
          trainingSnapshot: {
            name: day.label,
            sportType,
            exercises,
          },
        };
      });

      const planTemplate: TrainingPlanTemplate = {
        id: planId,
        userId: userId ?? "unknown",
        name: planName,
        kind: "weekly",
        startDate: planStartISO,
        durationWeeks: weeklyDurationWeeks,
        days: planDays,
        createdAt: existingPlan?.createdAt ?? now,
        updatedAt: now,
      };

      upsertTrainingPlanTemplate(userId ?? "", planTemplate);
      saveTrainingTemplates(userId ?? "", nextStoredTemplates);
      setWorkoutTemplates(nextStoredTemplates.map(storedTemplateToWorkoutTemplate));

      const tpl: WeeklyPlanTemplate = {
        id: planId,
        name: planName,
        days: normalizedDays,
        durationWeeks: weeklyDurationWeeks,
      };
      setWeeklyTemplates((prev) => {
        const idx = prev.findIndex((p) => p.id === planId || p.name === planName);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = tpl;
          return next;
        }
        return [...prev, tpl];
      });
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
      const planName = routineTemplateName.trim() || "Split/Routine";
      const normalizedBlocks = routineBlocks.map((b, i) => normalizeRoutineBlock(b as any, i + 1));

      const existingPlans = loadTrainingPlanTemplates(userId ?? "");
      const existingPlan = existingPlans.find((p) => p.kind === "routine" && p.name === planName);
      const planId = existingPlan?.id ?? makeTemplateId();

      const now = new Date().toISOString();
      const storedTemplates = loadTrainingTemplates(userId ?? "");
      const nextStoredTemplates = [...storedTemplates];

      const planDays = normalizedBlocks.map((block, idx) => {
        const sportType = (block.sport as SportType) || "Gym";
        const exercises = blockExercisesToStoredExercises(block.exercises || []);

        let trainingTemplateId: string | undefined;
        if (!isRestSport(block.sport) && exercises.length > 0) {
          const signature = buildTrainingTemplateSignature(exercises);
          const existingBySource = nextStoredTemplates.find(
            (t) => t.sourcePlanId === planId && t.sourceDayIndex === idx
          );
          const existingBySignature = nextStoredTemplates.find((t) => t.signature === signature && t.name === block.label);
          const existing = existingBySource ?? existingBySignature;

          const updated: StoredTrainingTemplate = {
            id: existing?.id ?? makeTemplateId(),
            userId: userId ?? "unknown",
            name: block.label,
            sportType,
            exercises,
            sourcePlanId: planId,
            sourceDayIndex: idx,
            signature,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };

          if (existing) {
            const index = nextStoredTemplates.findIndex((t) => t.id === existing.id);
            nextStoredTemplates[index] = updated;
          } else {
            nextStoredTemplates.push(updated);
          }

          trainingTemplateId = updated.id;
        }

        return {
          dayIndex: idx,
          title: block.label,
          trainingTemplateId,
          trainingSnapshot: {
            name: block.label,
            sportType,
            exercises,
          },
        };
      });

      const planTemplate: TrainingPlanTemplate = {
        id: planId,
        userId: userId ?? "unknown",
        name: planName,
        kind: "routine",
        startDate: planStartISO,
        durationWeeks: routineDurationWeeks,
        days: planDays,
        createdAt: existingPlan?.createdAt ?? now,
        updatedAt: now,
      };

      upsertTrainingPlanTemplate(userId ?? "", planTemplate);
      saveTrainingTemplates(userId ?? "", nextStoredTemplates);
      setWorkoutTemplates(nextStoredTemplates.map(storedTemplateToWorkoutTemplate));

      const tpl: RoutinePlanTemplate = {
        id: planId,
        name: planName,
        blocks: normalizedBlocks,
        durationWeeks: routineDurationWeeks,
      };
      setRoutineTemplates((prev) => {
        const idx = prev.findIndex((p) => p.id === planId || p.name === planName);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = tpl;
          return next;
        }
        return [...prev, tpl];
      });
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

    const now = new Date().toISOString();
    const storedExercises = blockExercisesToStoredExercises(tpl.exercises || []);
    const stored: StoredTrainingTemplate = {
      id: tpl.id || makeTemplateId(),
      userId: userId ?? "unknown",
      name: tpl.name.trim(),
      sportType: (tpl.sport as SportType) || "Gym",
      exercises: storedExercises,
      signature: buildTrainingTemplateSignature(storedExercises),
      createdAt: tpl.createdAtISO || now,
      updatedAt: now,
    };

    upsertTrainingTemplate(userId ?? "", stored);
    const next = loadTrainingTemplates(userId ?? "");
    setWorkoutTemplates(next.map(storedTemplateToWorkoutTemplate));
  };

  const deleteWorkoutTemplate = (id: string) => {
    deleteTrainingTemplate(userId ?? "", id);
    const next = loadTrainingTemplates(userId ?? "");
    setWorkoutTemplates(next.map(storedTemplateToWorkoutTemplate));
  };

  // -------------------- Render --------------------

  return (
    <div className="h-full w-full overflow-y-auto bg-[#061226] text-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 rounded-full bg-white/5 p-1 text-base">
          <button
            onClick={() => setActiveTab("weekly")}
            className={`flex-1 rounded-full px-3 py-2 font-medium transition ${activeTab === "weekly" ? "bg-[#2563EB] text-white shadow" : "text-gray-300 hover:bg-white/10"}`}
          >
            {t("plan.weeklyTab")}
          </button>
          <button
            onClick={() => setActiveTab("routine")}
            className={`flex-1 rounded-full px-3 py-2 font-medium transition ${activeTab === "routine" ? "bg-[#2563EB] text-white shadow" : "text-gray-300 hover:bg-white/10"}`}
          >
            {t("plan.routineTab")}
          </button>
        </div>

        {/* ✅ Startdatum + Dauer kompakt, Hinweis klein, Vorlagen als Row */}
        <section className="rounded-[24px] bg-white/5 border border-white/10 backdrop-blur-md p-4 text-base">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-gray-300">{t("plan.startDate")}</label>
              <input
                type="date"
                value={planStartISO}
                onChange={(e) => {
                  setWeeklySaved(false);
                  setRoutineSaved(false);
                  setPlanStartISO(e.target.value);
                }}
                className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-base text-white outline-none"
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">{t("plan.duration")}</label>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-3">
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
                    className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 text-xl font-semibold text-white hover:bg-white/10"
                    aria-label={t("plan.weeks.less")}
                  >
                    –
                  </button>
                  <div className="min-w-[44px] text-center text-lg font-semibold text-white">
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
                    className="h-11 w-11 rounded-xl bg-white/5 border border-white/10 text-xl font-semibold text-white hover:bg-white/10"
                    aria-label={t("plan.weeks.more")}
                  >
                    +
                  </button>
                </div>
                <span className="text-sm text-gray-300">{t("plan.weeks.label")}</span>
              </div>
            </div>
          </div>

          {!effectiveIsPro && (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-sm text-white">
                i
              </span>
              <div className="flex-1 text-sm text-gray-300">
                {t("plan.freeLimit.note")}
              </div>
              <span className="rounded-full px-2 py-1 text-sm font-semibold bg-white/10 border border-white/10 text-white">
                {t("plan.freeLimit.remaining", {
                  count: Number.isFinite(calendar7DaysRemaining as number)
                    ? (calendar7DaysRemaining as number)
                    : FREE_LIMITS.calendar7DaysPerMonth,
                })}
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setWorkoutTemplatesOpen(true)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-base font-semibold text-white hover:bg-white/10"
            >
              {t("plan.templates.workouts")}
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeTab === "weekly") setWeeklyTemplatesOpen(true);
                else setRoutineTemplatesOpen(true);
              }}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-base font-semibold text-white hover:bg-white/10"
            >
              {t("plan.templates.plans")}
            </button>
          </div>
        </section>

        {/* Weekly */}
        {activeTab === "weekly" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{t("plan.weeklyTitle")}</h2>
                <div className="mt-1 text-sm text-gray-300">
                  {t("plan.startLabel")} <span className="text-white">{planStartISO}</span>
                </div>
              </div>
              {weeklySaved && <span className="text-sm text-emerald-400">{t("plan.savedToCalendar")}</span>}
            </div>

            <div className="space-y-4">
              {weeklyDays.map((rawDay, idx) => {
                const day = normalizeWeeklyDay(rawDay as any, idx + 1);
                const isRest = isRestSport(day.sport);
                const hasWorkout = day.exercises.length > 0;
                const hasTime = !!day.startTime?.trim();

                return (
                  <div key={day.id} className="rounded-[24px] bg-white/5 border border-white/10 backdrop-blur-md p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-semibold text-white">
                        {t("plan.dayLabel", { day: day.id })}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                          {isRest ? t("plan.restday") : t(SPORT_LABEL_KEY[day.sport])}
                        </span>
                        {hasTime && (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                            {day.startTime}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300">{t("plan.name")}</label>
                      <input
                        type="text"
                        value={isRest ? t("plan.restday") : day.focus}
                        disabled={isRest}
                        onChange={(e) => handleWeeklyDayChange(day.id, "focus", e.target.value)}
                        className={`mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none focus:ring-1 focus:ring-sky-500/60 ${isRest ? "bg-white/5 border-white/10 text-gray-400" : "bg-white/5 border-white/10 text-white"}`}
                      />
                      {!isRest && (
                        <div className="mt-2 text-sm text-gray-400">{t("plan.addExercisesHint")}</div>
                      )}
                    </div>

                    {isRest ? (
                      <button
                        type="button"
                        onClick={() => handleWeeklyDayChange(day.id, "sport", "Gym")}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-base font-semibold text-white hover:bg-white/10"
                      >
                        {t("plan.removeRestday")}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openWeeklyTraining(day)}
                          className="w-full rounded-xl bg-[#2563EB] px-3 py-2.5 text-base font-semibold text-white hover:bg-sky-600"
                        >
                          {hasWorkout ? t("plan.editWorkout") : t("plan.createWorkout")}
                        </button>

                        <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-2">
                          <div className="text-sm text-gray-300">{t("plan.startTime")}</div>
                          {hasTime ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                                {day.startTime}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleWeeklyDayChange(day.id, "startTime", "")}
                                className="rounded-full bg-white/5 px-2 py-1 text-sm text-gray-300 hover:bg-white/10"
                                title={t("plan.timeRemove")}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleWeeklyDayChange(day.id, "startTime", defaultStartTimeNowRounded())}
                              className="rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
                            >
                              {t("plan.timeAdd")}
                            </button>
                          )}
                        </div>

                        <details className="rounded-xl bg-white/5 border border-white/10 p-3">
                          <summary className="cursor-pointer text-base font-medium text-white">
                            {t("plan.details")}
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="text-sm text-gray-300">{t("plan.sport")}</label>
                              <select
                                value={day.sport}
                                onChange={(e) => handleWeeklyDayChange(day.id, "sport", e.target.value)}
                                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-base text-white outline-none"
                              >
                                <option value="Gym">{t("plan.sport.gym")}</option>
                                <option value="Laufen">{t("plan.sport.run")}</option>
                                <option value="Radfahren">{t("plan.sport.bike")}</option>
                                <option value="Custom">{t("plan.sport.custom")}</option>
                                <option value="Ruhetag">{t("plan.sport.rest")}</option>
                              </select>
                            </div>

                            {hasWorkout && (
                              <button
                                type="button"
                                onClick={() => openWeeklyPreviewAndStart(day)}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-base font-medium text-white hover:bg-white/10"
                              >
                                {t("plan.previewStart")}
                              </button>
                            )}
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setWeeklyPreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-base font-medium text-white hover:bg-white/10"
              >
                {t("plan.preview")}
              </button>

              <button
                onClick={() => {
                  setWeeklyTemplateName(`${t("plan.weeklyTitle")} (${formatDate(new Date())})`);
                  setWeeklySaveDialogOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-xl bg-[#2563EB] px-4 py-2 text-base font-medium text-white shadow hover:bg-sky-600 active:bg-sky-700"
              >
                {t("plan.saveWeekly")}
              </button>
            </div>
          </section>
        )}

        {/* Routine */}
        {activeTab === "routine" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">{t("plan.routineTitle")}</h2>
                <div className="mt-1 text-sm text-gray-300">
                  {t("plan.startLabel")} <span className="text-white">{planStartISO}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {routineSaved && <span className="text-sm text-emerald-400">{t("plan.savedToCalendar")}</span>}
              </div>
            </div>

            <div className="space-y-4">
              {routineBlocks.map((rawBlock, index) => {
                const block = normalizeRoutineBlock(rawBlock as any, index + 1);
                const isRest = block.type === "Rest" || isRestSport(block.sport);
                const hasWorkout = block.exercises.length > 0;
                const hasTime = !!block.startTime?.trim();

                return (
                  <div key={block.id} className="rounded-[24px] bg-white/5 border border-white/10 backdrop-blur-md p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-semibold text-white">
                        {t("plan.dayLabel", { day: index + 1 })}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                          {isRest ? t("plan.restday") : t(SPORT_LABEL_KEY[block.sport])}
                        </span>
                        {hasTime && (
                          <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                            {block.startTime}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300">{t("plan.name")}</label>
                      <input
                        type="text"
                        value={isRest ? t("plan.restday") : block.label}
                        disabled={isRest}
                        onChange={(e) => handleRoutineBlockChange(block.id, "label", e.target.value)}
                        className={`mt-1 w-full rounded-xl px-3 py-2.5 text-base outline-none focus:ring-1 focus:ring-sky-500/60 ${isRest ? "bg-white/5 border-white/10 text-gray-400" : "bg-white/5 border-white/10 text-white"}`}
                      />
                      {!isRest && (
                        <div className="mt-2 text-sm text-gray-400">{t("plan.addExercisesHint")}</div>
                      )}
                    </div>

                    {isRest ? (
                      <button
                        type="button"
                        onClick={() => handleRoutineBlockChange(block.id, "sport", "Gym")}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-base font-semibold text-white hover:bg-white/10"
                      >
                        {t("plan.removeRestday")}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openRoutineTraining(block)}
                          className="w-full rounded-xl bg-[#2563EB] px-3 py-2.5 text-base font-semibold text-white hover:bg-sky-600"
                        >
                          {hasWorkout ? t("plan.editWorkout") : t("plan.createWorkout")}
                        </button>

                        <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-2">
                          <div className="text-sm text-gray-300">{t("plan.startTime")}</div>
                          {hasTime ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
                                {block.startTime}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRoutineBlockChange(block.id, "startTime", "")}
                                className="rounded-full bg-white/5 px-2 py-1 text-sm text-gray-300 hover:bg-white/10"
                                title={t("plan.timeRemove")}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRoutineBlockChange(block.id, "startTime", defaultStartTimeNowRounded())}
                              className="rounded-full bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
                            >
                              {t("plan.timeAdd")}
                            </button>
                          )}
                        </div>

                        <details className="rounded-xl bg-white/5 border border-white/10 p-3">
                          <summary className="cursor-pointer text-base font-medium text-white">{t("plan.details")}</summary>
                          <div className="mt-3 space-y-3">
                            <div>
                              <label className="text-sm text-gray-300">{t("plan.sport")}</label>
                              <select
                                value={block.sport}
                                onChange={(e) => handleRoutineBlockChange(block.id, "sport", e.target.value)}
                                className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-2 text-base text-white outline-none"
                              >
                                <option value="Gym">{t("plan.sport.gym")}</option>
                                <option value="Laufen">{t("plan.sport.run")}</option>
                                <option value="Radfahren">{t("plan.sport.bike")}</option>
                                <option value="Custom">{t("plan.sport.custom")}</option>
                                <option value="Ruhetag">{t("plan.sport.rest")}</option>
                              </select>
                            </div>
                          </div>
                        </details>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleAddRoutineBlock}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:opacity-95"
              >
                + {t("plan.addDay")}
              </button>

              <button
                type="button"
                onClick={() => setRoutinePreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:opacity-95"
              >
                {t("plan.preview")}
              </button>

              <button
                onClick={() => {
                  setRoutineTemplateName(`${t("plan.routineTitle")} (${formatDate(new Date())})`);
                  setRoutineSaveDialogOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-600 active:bg-sky-700"
              >
                {t("plan.saveRoutine")}
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
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">{t("plan.previewWeekTitle")}</h3>
              <button
                type="button"
                onClick={() => setWeeklyPreviewOpen(false)}
                className="text-sm text-[var(--text)] hover:opacity-95"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1">
              {weeklyDays.map((raw, idx) => {
                const day = normalizeWeeklyDay(raw as any, idx + 1);
                const isRest = isRestSport(day.sport);
                return (
                  <div key={day.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[var(--text)]">Tag {day.id}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isRest ? "bg-gray-500/20 text-gray-300" : "bg-green-500/20 text-green-300"
                          }`}
                      >
                        {isRest ? "Ruhetag" : day.sport}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--text)]">
                      {isRest ? "Ruhetag" : day.focus || "Keine Bezeichnung definiert"}
                    </div>
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
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-xs shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">{t("plan.previewRoutineTitle")}</h3>
              <button
                type="button"
                onClick={() => setRoutinePreviewOpen(false)}
                className="text-sm text-[var(--text)] hover:opacity-95"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1">
              {routinePreview.map((item, index) => {
                const block = normalizeRoutineBlock(item.block as any, index + 1);
                const isRest = block.type === "Rest" || isRestSport(block.sport);
                return (
                  <div key={index} className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] p-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-[var(--text)]">{item.label}</span>
                      <span className="text-[10px] text-[var(--muted)]">{isRest ? "Ruhetag" : block.sport}</span>
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-[var(--text)]">
                      {isRest ? "Ruhetag" : block.label}
                    </div>
                    {!isRest && block.startTime && <div className="mt-0.5 text-[10px] text-[var(--muted)]">Startzeit: {block.startTime}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reine Trainings Vorlagen Modal (Management) */}
      {workoutTemplatesOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">{t("plan.templates.workoutsTitle")}</h3>
              <button
                type="button"
                onClick={() => setWorkoutTemplatesOpen(false)}
                className="text-sm text-[var(--text)] hover:opacity-95"
              >
                ✕
              </button>
            </div>
            {workoutTemplates.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Noch keine Trainingsvorlagen gespeichert. Öffne „Training erstellen“ und klicke oben im Editor auf „Vorlage speichern“.
              </p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {workoutTemplates
                  .slice()
                  .sort((a, b) => (b.createdAtISO || "").localeCompare(a.createdAtISO || ""))
                  .map((tpl) => (
                    <div
                      key={tpl.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2"
                    >
                      <div className="min-w-0 text-sm text-[var(--text)]">
                        <div className="truncate font-medium">{tpl.name}</div>
                        <div className="truncate text-xs text-[var(--muted)]">
                          {tpl.isCardio ? "Cardio" : "Gym"} · {tpl.sport} · {tpl.exercises?.length ?? 0}{" "}
                          {tpl.isCardio ? "Einheit(en)" : "Übung(en)"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Vorlage "${tpl.name}" löschen?`)) deleteWorkoutTemplate(tpl.id);
                        }}
                        className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/20 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30"
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
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">{t("plan.templates.weeklyTitle")}</h3>
              <button
                type="button"
                onClick={() => setWeeklyTemplatesOpen(false)}
                className="text-sm text-[var(--text)] hover:opacity-95"
              >
                ✕
              </button>
            </div>
            {weeklyTemplates.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("plan.templates.empty")}</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {weeklyTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2"
                  >
                    <div className="text-sm text-[var(--text)]">
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {tpl.durationWeeks} Woche{tpl.durationWeeks !== 1 ? "n" : ""}, {tpl.days.length} Tage
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyWeeklyTemplate(tpl)}
                      className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">{t("plan.templates.routineTitle")}</h3>
              <button
                type="button"
                onClick={() => setRoutineTemplatesOpen(false)}
                className="text-sm text-[var(--text)] hover:opacity-95"
              >
                ✕
              </button>
            </div>
            {routineTemplates.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{t("plan.templates.empty")}</p>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1">
                {routineTemplates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2"
                  >
                    <div className="text-sm text-[var(--text)]">
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {tpl.durationWeeks} Woche{tpl.durationWeeks !== 1 ? "n" : ""}, {tpl.blocks.length} Tage im
                        Zyklus
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyRoutineTemplate(tpl)}
                      className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-600"
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

      {/* Save Dialogs (Plan) */}
      {weeklySaveDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-xl">
            <h3 className="text-sm font-semibold text-[var(--text)]">{t("plan.applyWeeklyTitle")}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("plan.applyTemplateOptional")}</p>
            <div className="mt-3 space-y-2">
              <label className="block text-sm text-[var(--muted)]">{t("plan.templateNameLabel")}</label>
              <input
                type="text"
                value={weeklyTemplateName}
                onChange={(e) => setWeeklyTemplateName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:ring-1 focus:ring-sky-500/60"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveWeeklyTemplateAndCalendar(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:opacity-95"
              >
                Nur Kalender
              </button>
              <button
                type="button"
                onClick={() => saveWeeklyTemplateAndCalendar(true)}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
              >
                Kalender + Vorlage
              </button>
            </div>
          </div>
        </div>
      )}

      {routineSaveDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-xl">
            <h3 className="text-sm font-semibold text-[var(--text)]">{t("plan.applyRoutineTitle")}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t("plan.applyTemplateOptional")}</p>
            <div className="mt-3 space-y-2">
              <label className="block text-sm text-[var(--muted)]">{t("plan.templateNameLabel")}</label>
              <input
                type="text"
                value={routineTemplateName}
                onChange={(e) => setRoutineTemplateName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:ring-1 focus:ring-sky-500/60"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => saveRoutineTemplateAndCalendar(false)}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:opacity-95"
              >
                Nur Kalender
              </button>
              <button
                type="button"
                onClick={() => saveRoutineTemplateAndCalendar(true)}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
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