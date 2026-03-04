// src/pages/TrainingsplanPage.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import type { CalendarEvent, NewCalendarEvent } from "../types/training";
import type { SportType } from "../types/training";
import type { TrainingPlanTemplate, TrainingTemplate as StoredTrainingTemplate, TrainingTemplateExercise } from "../types/trainingTemplates";
import { type Exercise } from "../data/exerciseLibrary";
import ExerciseLibraryModal from "../components/training/ExerciseLibraryModal";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import PlanView from "../components/training/PlanView";
import { PageHeader } from "../components/ui/PageHeader";
import { Eye, X } from "lucide-react";

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

// ✅ Lokale ISO-Date Konvertierung (kein UTC-Shift)
import { toISODateLocal } from "../utils/calendarGeneration";

// ✅ Entitlements (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";
import { useProGuard } from "../hooks/useProGuard";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../theme/ThemeContext";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { FREE_LIMITS } from "../utils/entitlements";
import { track } from "../analytics/track";

import type { TranslationKey } from "../i18n/index";
import { useI18n } from "../i18n/useI18n";
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

const SPORT_LABEL_DISPLAY: Record<WeeklySportType, string> = {
  Gym: "Gym",
  Laufen: "Laufen",
  Radfahren: "Radfahren",
  Custom: "Custom",
  Ruhetag: "Ruhetag",
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

const WEEKDAY_NAMES = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function weekdayName(index: number): string {
  return WEEKDAY_NAMES[((index - 1) % 7 + 7) % 7] || `Tag ${index}`;
}

function getDefaultWeeklyDays(): WeeklyDayConfig[] {
  return [
    { id: 1, label: "Montag", sport: "Gym", focus: "Push", exercises: [], startTime: "" },
    { id: 2, label: "Dienstag", sport: "Gym", focus: "Pull", exercises: [], startTime: "" },
    { id: 3, label: "Mittwoch", sport: "Gym", focus: "Beine", exercises: [], startTime: "" },
    { id: 4, label: "Donnerstag", sport: "Ruhetag", focus: "Ruhetag", exercises: [], startTime: "" },
    { id: 5, label: "Freitag", sport: "Gym", focus: "Push (Kurz)", exercises: [], startTime: "" },
    { id: 6, label: "Samstag", sport: "Gym", focus: "Pull (Kurz)", exercises: [], startTime: "" },
    { id: 7, label: "Sonntag", sport: "Ruhetag", focus: "Ruhetag", exercises: [], startTime: "" },
  ];
}

function getDefaultRoutineBlocks(): RoutineBlock[] {
  return [
    { id: 1, type: "Custom", sport: "Gym", label: "Push", exercises: [], startTime: "" },
    { id: 2, type: "Custom", sport: "Gym", label: "Pull", exercises: [], startTime: "" },
    { id: 3, type: "Custom", sport: "Gym", label: "Beine", exercises: [], startTime: "" },
    { id: 4, type: "Rest", sport: "Ruhetag", label: "Ruhetag", exercises: [], startTime: "" },
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
  return toISODateLocal(d);
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
    for (const ex of exercises) {
      if (!ex.sets || !ex.sets.length) {
        total += 10;
        continue;
      }
      for (const s of ex.sets) {
        // Cardio: reps = Minuten, weight = Distanz (km)
        if (typeof s.reps === "number" && s.reps > 0) {
          total += s.reps;
        } else if (typeof s.weight === "number" && s.weight > 0) {
          // Fallback: 6 min / km (konservative Pace)
          total += s.weight * 6;
        } else {
          // Fallback ohne Werte
          total += 10;
        }
      }
    }
    return Math.max(5, Math.round(total));
  }

  // Gym: 2.5 min pro Satz (Ausführung + Pause + Wechsel) + 5 min Warmup/Setup pauschal
  const sets = exercises.reduce((acc, ex) => acc + (ex.sets?.length || 0), 0);
  return Math.max(10, Math.round(sets * 2.5 + 5));
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

  const label = typeof input?.label === "string" && input.label.trim() ? input.label : weekdayName(id);

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

  // Initialize with existing label or empty to encourage naming
  const [templateName, setTemplateName] = useState<string>(() => (template.label?.trim() ? template.label : ""));
  const [selectedWorkoutTemplateId, setSelectedWorkoutTemplateId] = useState<string>("");

  const compatibleWorkoutTemplates = useMemo(() => {
    return (workoutTemplates || [])
      .filter((t) => t.isCardio === isCardioLibrary)
      .sort((a, b) => (b.createdAtISO || "").localeCompare(a.createdAtISO || ""));
  }, [workoutTemplates, isCardioLibrary]);

  // Sync draft label with local state
  useEffect(() => {
    setDraft(prev => ({ ...prev, label: templateName }));
  }, [templateName]);

  // Scroll Lock: Freeze Background when modal is active
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    // Optional: prevent touch move on overlay if needed, often overflow:hidden is enough.
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const handleAddExerciseFromLibrary = (exercise: Exercise) => {
    if (!exercise) return;
    const cardioMin = isCardioLibrary ? parseMinutesFromTitle(exercise.name) : undefined;
    const newBlockExercise: BlockExercise = {
      id: nextBlockExerciseId(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [
        {
          id: nextExerciseSetId(),
          reps: isCardioLibrary ? (cardioMin ?? 30) : 8,
          weight: isCardioLibrary ? undefined : 0,
          notes: "",
        },
      ],
    };
    setDraft((prev) => ({ ...prev, exercises: [...prev.exercises, newBlockExercise] }));
  };

  const handleAddCustomExercise = () => {
    const newBlockExercise: BlockExercise = {
      id: nextBlockExerciseId(),
      name: isCardioLibrary ? t("trainingPlan.newCardioUnit" as TranslationKey) : t("trainingPlan.newExercise" as TranslationKey),
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
    // Determine final label
    const finalLabel = templateName.trim() || t("trainingPlan.trainingDay" as TranslationKey);
    onSave({ ...draft, label: finalLabel });
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

    const freshExercises: BlockExercise[] = (tpl.exercises || []).map((ex) => ({
      id: nextBlockExerciseId(),
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: (ex.sets || []).map((s) => ({
        id: nextExerciseSetId(),
        reps: s.reps,
        weight: s.weight,
        notes: s.notes,
      })),
    }));

    setDraft((prev) => ({
      ...prev,
      exercises: freshExercises,
    }));

    if (!templateName || templateName === "Training") {
      setTemplateName(tpl.name || "");
    }
  };

  const repsPlaceholder = isCardioLibrary ? t("trainingPlan.durationMin" as TranslationKey) : t("trainingPlan.reps" as TranslationKey);
  const weightPlaceholder = isCardioLibrary ? t("trainingPlan.distanceKm" as TranslationKey) : t("trainingPlan.kg" as TranslationKey);
  const notesPlaceholder = isCardioLibrary ? t("trainingPlan.paceInterval" as TranslationKey) : t("trainingPlan.notes" as TranslationKey);

  const existingExerciseIds = draft.exercises.map((ex) => ex.exerciseId).filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" data-overlay-open="true">
      <AppCard variant="glass" className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden !rounded-[24px] !p-0 shadow-2xl ring-1" style={{ backgroundColor: "var(--modal-bg)", borderColor: "var(--border-color)", boxShadow: "0 0 0 1px var(--border-color)" }}>

        {/* Sticky Header */}
        <div className="flex items-center justify-between px-4 py-4 backdrop-blur-xl sticky top-0 z-10 border-b" style={{ backgroundColor: "var(--modal-bg)", borderColor: "var(--border-color)" }}>
          <button
            onClick={onClose}
            className="text-[17px] text-red-500 hover:text-red-400 transition-colors font-medium"
          >
            {t("common.cancel" as TranslationKey)}
          </button>
          <div className="text-[17px] font-bold text-center truncate px-2" style={{ color: "var(--text-color)" }}>
            {isCardioLibrary ? t("trainingPlan.editUnit" as TranslationKey) : t("trainingPlan.editTraining" as TranslationKey)}
          </div>
          <button
            onClick={handleSaveClick}
            className="text-[17px] font-bold text-[#007AFF] hover:text-[#007AFF]/80 transition-colors"
          >
            {t("common.save" as TranslationKey)}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 pb-[160px] scrollbar-hide">
          {/* Top Section: Meta Data */}
          <div className="space-y-4 mb-6">
            <div>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("trainingPlan.templateNamePlaceholder" as TranslationKey)}
                className="w-full border p-4 rounded-3xl placeholder-opacity-40 focus:outline-none focus:ring-1 focus:ring-[#007AFF] transition-all font-medium text-base"
                style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
              />
              {/* Save as Template Quick Action */}
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleSaveWorkoutTemplate}
                  className="text-xs text-[#007AFF] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                  {t("trainingPlan.saveAsTemplate" as TranslationKey)}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border p-4 rounded-3xl" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
              <span className="font-medium text-sm" style={{ color: "var(--text-muted)" }}>{t("trainingPlan.loadTemplate" as TranslationKey)}</span>
              <div className="relative">
                <select
                  value={selectedWorkoutTemplateId}
                  onChange={(e) => handleLoadWorkoutTemplate(e.target.value)}
                  className="bg-transparent text-[#007AFF] font-medium outline-none text-right pr-6 cursor-pointer text-sm appearance-none"
                  style={{ minWidth: '100px' }}
                >
                  <option value="">{t("trainingPlan.select" as TranslationKey)}</option>
                  {compatibleWorkoutTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#007AFF]">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <button
              onClick={() => setLibraryOpen(true)}
              className="h-20 flex flex-col items-center justify-center bg-[#007AFF]/10 border border-[#007AFF]/30 rounded-3xl hover:bg-[#007AFF]/20 transition-all active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#007AFF] mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-[#007AFF] font-medium text-sm">{t("trainingPlan.openLibrary" as TranslationKey)}</span>
            </button>

            <button
              onClick={handleAddCustomExercise}
              className="h-20 flex flex-col items-center justify-center bg-[#007AFF]/10 border border-[#007AFF]/30 rounded-3xl hover:bg-[#007AFF]/20 transition-all active:scale-[0.98]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#007AFF] mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[#007AFF] font-medium text-sm">{t("trainingPlan.customExercise" as TranslationKey)}</span>
            </button>
          </div>

          {/* Exercise List */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: "var(--text-secondary)" }}>
              {isCardioLibrary ? t("trainingPlan.units" as TranslationKey) : t("trainingPlan.exercises" as TranslationKey)} ({draft.exercises.length})
            </h3>

            {draft.exercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-3xl border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                <span className="opacity-20 mb-3 text-3xl">🏋️</span>
                <p className="font-medium text-sm" style={{ color: "var(--text-muted)" }}>{t("trainingPlan.noExercisesAddSome" as TranslationKey)}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {draft.exercises.map((ex) => (
                  <div key={ex.id} className="rounded-3xl border p-4 shadow-sm" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <input
                        type="text"
                        value={ex.name}
                        onChange={(e) => handleUpdateExerciseName(ex.id, e.target.value)}
                        className="w-full bg-transparent font-semibold outline-none border-b border-transparent focus:border-[#007AFF]/50 transition-colors py-1"
                        placeholder={t("trainingPlan.exerciseName" as TranslationKey)}
                        style={{ color: "var(--text-color)" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockExercise(ex.id)}
                        className="p-2 -mr-2 hover:text-red-400 transition-colors"
                        title={t("common.remove" as TranslationKey)}
                        style={{ color: "var(--text-muted)" }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {/* Sets Header */}
                      <div className="flex items-center justify-between text-[11px] px-1" style={{ color: "var(--text-muted)" }}>
                        <div className="grid grid-cols-[auto,1fr,1fr,2fr] gap-3 w-full pr-8">
                          <span>#</span>
                          <span>{repsPlaceholder}</span>
                          <span>{weightPlaceholder}</span>
                          <span>{notesPlaceholder}</span>
                        </div>
                      </div>

                      {ex.sets.map((set, index) => (
                        <div key={set.id} className="relative flex items-center group">
                          <div className="grid grid-cols-[auto,1fr,1fr,2fr] gap-3 w-full items-center">
                            <span className="text-xs w-4" style={{ color: "var(--text-muted)" }}>{index + 1}</span>

                            <input
                              type="number"
                              min={1}
                              value={set.reps ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "reps", e.target.value)}
                              className="w-full rounded-2xl border px-2 py-2 text-sm outline-none focus:border-[#007AFF]/50 transition-colors text-center" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                              placeholder="0"
                            />

                            <input
                              type="number"
                              min={0}
                              value={set.weight ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "weight", e.target.value)}
                              className="w-full rounded-2xl border px-2 py-2 text-sm outline-none focus:border-[#007AFF]/50 transition-colors text-center" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                              placeholder="0"
                            />

                            <input
                              type="text"
                              value={set.notes ?? ""}
                              onChange={(e) => handleUpdateSetField(ex.id, set.id, "notes", e.target.value)}
                              className="w-full rounded-2xl border px-2 py-2 text-sm outline-none focus:border-[#007AFF]/50 transition-colors" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                              placeholder="-"
                            />
                          </div>

                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveSet(ex.id, set.id)}
                              className="p-1.5 text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-full"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddSet(ex.id)}
                      className="mt-3 w-full py-2 rounded-2xl bg-white/5 border border-white/5 text-xs font-medium text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors flex items-center justify-center gap-1"
                    >
                      + {isCardioLibrary ? t("trainingPlan.addInterval" as TranslationKey) : t("trainingPlan.addSet" as TranslationKey)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </AppCard>

      <ExerciseLibraryModal
        open={libraryOpen}
        category={defaultSport === "Laufen" ? "running" : defaultSport === "Radfahren" ? "cycling" : "gym"}
        title={isCardioLibrary ? t("trainingPlan.cardioLibrary" as TranslationKey) : t("trainingPlan.exerciseLibrary" as TranslationKey)}
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
      <AppCard variant="glass" className="w-full max-w-2xl overflow-hidden !rounded-2xl !p-0 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{state.title}</div>
            <div className="mt-0.5 text-[11px] text-zinc-400">
              {state.subtitle} · {t("trainingPlan.approxMinutes" as TranslationKey, { count: estMin })}
            </div>
          </div>
          <AppButton onClick={onClose} variant="secondary" size="sm" className="py-1 px-2 text-xs">
            ✕
          </AppButton>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 pb-[160px]">
          {state.exercises.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl p-4 text-sm text-zinc-400">
              {t("trainingPlan.noExercises" as TranslationKey)}
            </div>
          ) : (
            <div className="space-y-3">
              {state.exercises.map((ex) => {
                const key = ex.exerciseId || ex.name;
                const lastRaw = key ? (getLastSetsForExercise({ id: key, name: ex.name, sets: [] } as any) as any) : null;
                const last = normalizeLastSummary(lastRaw);

                return (
                  <div key={ex.id} className="rounded-3xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">{ex.name}</div>

                        {last && (last.weight !== undefined || last.reps !== undefined) && (
                          <div className="mt-0.5 text-[11px] text-zinc-400">
                            {state.isCardio ? (
                              <>
                                {t("trainingPlan.lastTime" as TranslationKey)}:
                                {last.weight !== undefined ? ` ${last.weight} km` : ""}
                                {last.weight !== undefined && last.reps !== undefined ? " ·" : ""}
                                {last.reps !== undefined ? ` ${last.reps} min` : ""}
                              </>
                            ) : (
                              <>
                                {t("trainingPlan.lastTime" as TranslationKey)}:
                                {last.weight !== undefined ? ` ${last.weight} kg` : ""}
                                {last.weight !== undefined && last.reps !== undefined ? " ×" : ""}
                                {last.reps !== undefined ? ` ${last.reps} ${t("trainingPlan.repsShort" as TranslationKey)}` : ""}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 rounded-full border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl px-2 py-0.5 text-[11px] text-zinc-400">
                        {ex.sets.length} {state.isCardio ? t("trainingPlan.sections" as TranslationKey) : t("trainingPlan.sets" as TranslationKey)}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      {ex.sets.map((s, idx) => (
                        <div key={s.id} className="grid grid-cols-[auto,1fr,1fr,2fr] gap-2 rounded-2xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-zinc-900 shadow-sm border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl px-2 py-1 text-[11px]">
                          <div className="text-zinc-400">{idx + 1}</div>
                          <div className="text-white">
                            {state.isCardio ? t("trainingPlan.duration" as TranslationKey) : t("trainingPlan.reps" as TranslationKey)}: <span className="text-white">{s.reps ?? "—"}</span>
                          </div>
                          <div className="text-white">
                            {state.isCardio ? t("trainingPlan.dist" as TranslationKey) : t("trainingPlan.kg" as TranslationKey)}: <span className="text-white">{s.weight ?? "—"}</span>
                          </div>
                          <div className="truncate text-zinc-400">{s.notes || ""}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3">
          <AppButton onClick={onClose} variant="secondary" className="text-sm">
            {t("common.close" as TranslationKey)}
          </AppButton>

          <AppButton
            onClick={() =>
              startLiveTrainingWithSeed({
                title: state.title,
                sport: state.sport,
                isCardio: state.isCardio,
                exercises: state.exercises,
              })
            }
            variant="primary"
            className="text-sm font-semibold"
          >
            {t("trainingPlan.start" as TranslationKey)}
          </AppButton>
        </div>
      </AppCard>
    </div>
  );
};

// -------------------- Haupt-Komponente --------------------

const TrainingsplanPage: React.FC<TrainingsplanPageProps> = ({ onAddEvent, isPro: isProProp = false }) => {
  // Fallback Theme Guard
  const { theme } = useTheme() || { theme: { colors: { text: '#fff', background: '#000', card: '#1c1c1e', border: '#27272a' } } };
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<ActiveTab>("weekly");
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [previewTemplate, setPreviewTemplate] = useState<WeeklyPlanTemplate | RoutinePlanTemplate | null>(null);

  // ✅ Entitlements
  const { isPro: isProEnt, canUseCalendar7, consumeCalendar7, calendar7DaysRemaining, canCreatePlan } = useEntitlements();
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
    getDefaultWeeklyDays().map((d, i) => normalizeWeeklyDay(d as any, i + 1))
  );
  const [weeklyDurationWeeks, setWeeklyDurationWeeks] = useState<number>(6);
  const [weeklySaved, setWeeklySaved] = useState<boolean>(false);

  // Routine
  const [routineBlocks, setRoutineBlocks] = useState<RoutineBlock[]>(() =>
    getDefaultRoutineBlocks().map((b, i) => normalizeRoutineBlock(b as any, i + 1))
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

  const [weeklyTemplateName, setWeeklyTemplateName] = useState(() => t("trainingPlan.weeklyPlan" as TranslationKey));
  const [routineTemplateName, setRoutineTemplateName] = useState(() => t("trainingPlan.splitRoutine" as TranslationKey));

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

      const title = (block.label || `Training ${weekdayName(i + 1)}`).trim();
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
              label: d.label?.trim() ? d.label : weekdayName(d.id),
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
      const planName = weeklyTemplateName.trim() || t("trainingPlan.weeklyPlan" as TranslationKey);
      const normalizedDays = weeklyDays.map((d, i) => normalizeWeeklyDay(d as any, i + 1));

      const existingPlans = loadTrainingPlanTemplates(userId ?? "");
      const existingPlan = existingPlans.find((p) => p.kind === "weekly" && p.name === planName);

      // Gate: max saved plans for free users (only when creating new, not updating existing)
      if (!existingPlan && !canCreatePlan(existingPlans.length)) {
        window.dispatchEvent(new CustomEvent("trainq:open_paywall", { detail: { reason: "active_plan_limit" } }));
        track("feature_blocked", { featureKey: "CREATE_ACTIVE_PLAN", contextScreen: "plan" });
        return;
      }
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
          label: t("trainingPlan.newTraining" as TranslationKey),
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
      subtitle: `${weekdayName(index + 1)} · ${b.sport}`,
      isCardio: isCardioSport(b.sport),
      sport: b.sport as TrainingSportType,
      exercises: b.exercises,
    });
  };

  const saveRoutineTemplateAndCalendar = (withTemplate: boolean) => {
    if (withTemplate) {
      const planName = routineTemplateName.trim() || t("trainingPlan.splitRoutine" as TranslationKey);
      const normalizedBlocks = routineBlocks.map((b, i) => normalizeRoutineBlock(b as any, i + 1));

      const existingPlans = loadTrainingPlanTemplates(userId ?? "");
      const existingPlan = existingPlans.find((p) => p.kind === "routine" && p.name === planName);

      // Gate: max saved plans for free users (only when creating new, not updating existing)
      if (!existingPlan && !canCreatePlan(existingPlans.length)) {
        window.dispatchEvent(new CustomEvent("trainq:open_paywall", { detail: { reason: "active_plan_limit" } }));
        track("feature_blocked", { featureKey: "CREATE_ACTIVE_PLAN", contextScreen: "plan" });
        return;
      }
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
      return { dayIndex: i, label: weekdayName(i + 1), block };
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
    <div className="w-full text-white pb-40" style={{ paddingTop: "env(safe-area-inset-top)" }}>

      <div className="mx-auto max-w-5xl space-y-4 px-4">
        <PlanView
          activeTab={activeTab}
          onTabChange={setActiveTab}
          startDateISO={planStartISO}
          onStartDateChange={(date) => {
            setWeeklySaved(false);
            setRoutineSaved(false);
            setPlanStartISO(date);
          }}
          durationWeeks={activeTab === "weekly" ? weeklyDurationWeeks : routineDurationWeeks}
          onDurationChange={(weeks) => {
            if (activeTab === "weekly") {
              setWeeklySaved(false);
              setWeeklyDurationWeeks(weeks);
            } else {
              setRoutineSaved(false);
              setRoutineDurationWeeks(weeks);
            }
          }}
          onOpenWorkoutTemplates={() => setWorkoutTemplatesOpen(true)}
          onOpenPlanTemplates={() => {
            if (activeTab === "weekly") setWeeklyTemplatesOpen(true);
            else setRoutineTemplatesOpen(true);
          }}
          onShowPreview={() => { }}
          isPro={effectiveIsPro}
          freeLimitRemaining={
            Number.isFinite(calendar7DaysRemaining as number)
              ? (calendar7DaysRemaining as number)
              : FREE_LIMITS.calendar7DaysPerMonth
          }
        />

        {/* Weekly */}
        {activeTab === "weekly" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>{t("trainingPlan.weeklyPlan" as TranslationKey)}</h2>
                <div className="mt-1 text-sm" style={{ color: theme.colors.textSecondary }}>
                  {t("trainingPlan.startsOn" as TranslationKey)} <span style={{ color: theme.colors.text }}>{planStartISO}</span>
                </div>
              </div>
              {weeklySaved && <span className="text-sm text-emerald-400">{t("trainingPlan.savedToCalendar" as TranslationKey)}</span>}
            </div>

            <div className="space-y-4">
              {weeklyDays.map((rawDay, idx) => {
                const day = normalizeWeeklyDay(rawDay as any, idx + 1);
                const isRest = isRestSport(day.sport);
                const hasWorkout = day.exercises.length > 0;
                const hasTime = !!day.startTime?.trim();

                return (
                  <AppCard key={day.id} variant="glass" className="p-4 space-y-4" style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                        {weekdayName(day.id)}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasTime && (
                          <span className="rounded-full bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl px-3 py-1 text-sm text-white">
                            {day.startTime}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium" style={{ color: theme.colors.textSecondary }}>{t("trainingPlan.label" as TranslationKey)}</label>
                      <input
                        type="text"
                        value={isRest ? t("trainingPlan.restDay" as TranslationKey) : day.focus}
                        disabled={isRest}
                        onChange={(e) => handleWeeklyDayChange(day.id, "focus", e.target.value)}
                        className={`mt-1 w-full rounded-3xl px-3 py-2.5 text-base outline-none focus:ring-1 focus:ring-blue-500 shadow-sm border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20`}
                        style={{
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          color: isRest ? theme.colors.textSecondary : theme.colors.text
                        }}
                      />
                      {!isRest && (
                        <div className="mt-2 text-sm" style={{ color: theme.colors.textSecondary }}>{t("trainingPlan.addExercisesToPlan" as TranslationKey)}</div>
                      )}
                    </div>

                    {isRest ? (
                      <AppButton
                        onClick={() => handleWeeklyDayChange(day.id, "sport", "Gym")}
                        variant="secondary"
                        fullWidth
                        className="py-2.5"
                      >
                        {t("trainingPlan.removeRestDay" as TranslationKey)}
                      </AppButton>
                    ) : (
                      <>
                        <div className="w-full flex justify-between items-center bg-zinc-900 shadow-sm border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl p-3"
                          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}>
                          <span className="text-base font-medium" style={{ color: theme.colors.text }}>{t("trainingPlan.sportType" as TranslationKey)}</span>
                          <select
                            value={day.sport}
                            onChange={(e) => handleWeeklyDayChange(day.id, "sport", e.target.value)}

                            className="bg-transparent text-right outline-none font-medium"
                            style={{ color: theme.colors.text }}
                          >
                            <option value="Gym">{t("trainingPlan.sport.gym" as TranslationKey)}</option>
                            <option value="Laufen">{t("trainingPlan.sport.running" as TranslationKey)}</option>
                            <option value="Radfahren">{t("trainingPlan.sport.cycling" as TranslationKey)}</option>
                            <option value="Custom">{t("trainingPlan.sport.custom" as TranslationKey)}</option>
                            <option value="Ruhetag">{t("trainingPlan.restDay" as TranslationKey)}</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => openWeeklyTraining(day)}
                          className="w-full py-3 border font-semibold rounded-3xl shadow-[0_0_20px_rgba(0,122,255,0.3)] hover:shadow-[0_0_25px_rgba(0,122,255,0.5)] transition-all active:scale-[0.98] flex justify-center items-center gap-2 backdrop-blur-md"
                          style={{
                            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: theme.colors.text
                          }}
                        >
                          {hasWorkout ? t("trainingPlan.editWorkout" as TranslationKey) : t("trainingPlan.createWorkout" as TranslationKey)}
                        </button>

                        <details className="rounded-3xl shadow-sm border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 p-3"
                          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}>
                          <summary className="cursor-pointer text-base font-medium" style={{ color: theme.colors.text }}>
                            {t("trainingPlan.details" as TranslationKey)}
                          </summary>
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm" style={{ color: theme.colors.textSecondary }}>{t("trainingPlan.startTime" as TranslationKey)}</div>
                              {hasTime ? (
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3 py-1 text-sm"
                                    style={{ backgroundColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', borderColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', color: theme.colors.text }}>
                                    {day.startTime}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleWeeklyDayChange(day.id, "startTime", "")}
                                    className="rounded-full shadow-sm border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-2 py-1 text-sm hover:opacity-80"
                                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textSecondary }}
                                    title={t("trainingPlan.removeStartTime" as TranslationKey)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleWeeklyDayChange(day.id, "startTime", defaultStartTimeNowRounded())}
                                  className="rounded-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3 py-1 text-sm hover:opacity-80"
                                  style={{ backgroundColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', borderColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', color: theme.colors.text }}
                                >
                                  {t("trainingPlan.addStartTime" as TranslationKey)}
                                </button>
                              )}
                            </div>

                            {hasWorkout && (
                              <AppButton
                                onClick={() => openWeeklyPreviewAndStart(day)}
                                variant="secondary"
                                fullWidth
                                className="py-2 font-medium"
                              >
                                {t("trainingPlan.previewAndStart" as TranslationKey)}
                              </AppButton>
                            )}
                          </div>
                        </details>
                      </>
                    )}
                  </AppCard>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setWeeklyPreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-3xl bg-zinc-900 shadow-sm border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-2 text-base font-medium text-white hover:bg-zinc-800"
              >
                {t("trainingPlan.preview" as TranslationKey)}
              </button>

              <button
                onClick={() => {
                  setWeeklyTemplateName(`${t("trainingPlan.weeklyPlan" as TranslationKey)} (${new Date().toLocaleDateString("de-DE")})`);
                  setWeeklySaveDialogOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-3xl bg-blue-600 px-4 py-2 text-base font-medium text-white shadow hover:opacity-90 active:opacity-80"
              >
                {t("trainingPlan.saveWeeklyPlan" as TranslationKey)}
              </button>
            </div>
          </section>
        )}

        {/* Routine */}
        {activeTab === "routine" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>{t("trainingPlan.routineCycle" as TranslationKey)}</h2>
                <div className="mt-1 text-sm" style={{ color: theme.colors.textSecondary }}>
                  {t("trainingPlan.startsOn" as TranslationKey)} <span style={{ color: theme.colors.text }}>{planStartISO}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {routineSaved && <span className="text-sm text-emerald-400">{t("trainingPlan.savedToCalendar" as TranslationKey)}</span>}
              </div>
            </div>

            <div className="space-y-4">
              {routineBlocks.map((rawBlock, index) => {
                const block = normalizeRoutineBlock(rawBlock as any, index + 1);
                const isRest = block.type === "Rest" || isRestSport(block.sport);
                const hasWorkout = block.exercises.length > 0;
                const hasTime = !!block.startTime?.trim();

                return (
                  <div key={block.id} className="rounded-[24px] border-[1.5px] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm p-4 space-y-4 backdrop-blur-xl"
                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-semibold" style={{ color: theme.colors.text }}>
                          {t("trainingPlan.routineNumber" as TranslationKey, { number: index + 1 })}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRoutineBlock(block.id)}
                          className="text-red-500 hover:text-red-400 p-2 hover:bg-white/10 rounded-full transition-all"
                          title={t("trainingPlan.deleteDay" as TranslationKey)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasTime && (
                          <span className="rounded-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3 py-1 text-sm"
                            style={{ backgroundColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', borderColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', color: theme.colors.text }}>
                            {block.startTime}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium" style={{ color: theme.colors.textSecondary }}>{t("trainingPlan.label" as TranslationKey)}</label>
                      <input
                        type="text"
                        value={isRest ? t("trainingPlan.restDay" as TranslationKey) : block.label}
                        disabled={isRest}
                        onChange={(e) => handleRoutineBlockChange(block.id, "label", e.target.value)}
                        className={`mt-1 w-full rounded-3xl px-3 py-2.5 text-base outline-none focus:ring-1 focus:ring-sky-500/60 shadow-sm border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl`}
                        style={{
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                          color: isRest ? theme.colors.textSecondary : theme.colors.text
                        }}
                      />
                      {!isRest && (
                        <div className="mt-2 text-sm text-zinc-400">{t("trainingPlan.addExercisesToPlan" as TranslationKey)}</div>
                      )}
                    </div>

                    {!isRest && (
                      <div className="w-full flex justify-between items-center shadow-sm border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl p-3"
                        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}>
                        <span className="text-base font-medium" style={{ color: theme.colors.text }}>Sportart</span>
                        <select
                          value={block.sport}
                          onChange={(e) => handleRoutineBlockChange(block.id, "sport", e.target.value)}
                          className="bg-transparent text-right outline-none font-medium"
                          style={{ color: theme.colors.text }}
                        >
                          <option value="Gym">{t("trainingPlan.sport.gym" as TranslationKey)}</option>
                          <option value="Laufen">{t("trainingPlan.sport.running" as TranslationKey)}</option>
                          <option value="Radfahren">{t("trainingPlan.sport.cycling" as TranslationKey)}</option>
                          <option value="Custom">{t("trainingPlan.sport.custom" as TranslationKey)}</option>
                          <option value="Ruhetag">{t("trainingPlan.restDay" as TranslationKey)}</option>
                        </select>
                      </div>
                    )}

                    {isRest ? (
                      <button
                        type="button"
                        onClick={() => handleRoutineBlockChange(block.id, "sport", "Gym")}
                        className="w-full rounded-3xl shadow-sm border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3 py-2.5 text-base font-semibold hover:opacity-80"
                        style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border, color: theme.colors.text }}
                      >
                        {t("trainingPlan.removeRestDay" as TranslationKey)}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => openRoutineTraining(block)}
                          className="w-full py-3 border font-semibold rounded-3xl shadow-[0_0_20px_rgba(0,122,255,0.3)] hover:shadow-[0_0_25px_rgba(0,122,255,0.5)] transition-all active:scale-[0.98] flex justify-center items-center gap-2 backdrop-blur-md"
                          style={{
                            backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                            borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            color: theme.colors.text
                          }}
                        >

                          {hasWorkout ? t("trainingPlan.editWorkout" as TranslationKey) : t("trainingPlan.createWorkout" as TranslationKey)}
                        </button>

                        <details className="rounded-3xl bg-zinc-900 shadow-sm border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 p-3">
                          <summary className="cursor-pointer text-base font-medium text-white">{t("trainingPlan.details" as TranslationKey)}</summary>
                          <div className="mt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-zinc-400">{t("trainingPlan.startTime" as TranslationKey)}</div>
                              {hasTime ? (
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3 py-1 text-sm"
                                    style={{ backgroundColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', borderColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', color: theme.colors.text }}>
                                    {block.startTime}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRoutineBlockChange(block.id, "startTime", "")}
                                    className="rounded-full shadow-sm border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-2 py-1 text-sm hover:opacity-80"
                                    style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.textSecondary }}
                                    title={t("trainingPlan.removeStartTime" as TranslationKey)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRoutineBlockChange(block.id, "startTime", defaultStartTimeNowRounded())}
                                  className="rounded-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3 py-1 text-sm hover:opacity-80"
                                  style={{ backgroundColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', borderColor: theme.mode === 'dark' ? '#27272a' : '#e4e4e7', color: theme.colors.text }}
                                >
                                  {t("trainingPlan.addStartTime" as TranslationKey)}
                                </button>
                              )}
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
                className="inline-flex items-center justify-center rounded-3xl border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl px-4 py-2 text-sm font-medium hover:opacity-95"
                style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }}
              >
                + {t("trainingPlan.addDay" as TranslationKey)}
              </button>

              <button
                type="button"
                onClick={() => setRoutinePreviewOpen(true)}
                className="inline-flex items-center justify-center rounded-3xl border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl px-4 py-2 text-sm font-medium hover:opacity-95"
                style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }}
              >
                {t("trainingPlan.preview" as TranslationKey)}
              </button>

              <button
                onClick={() => {
                  setRoutineTemplateName(`${t("trainingPlan.routineCycle" as TranslationKey)} (${new Date().toLocaleDateString("de-DE")})`);
                  setRoutineSaveDialogOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-3xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:opacity-90 active:opacity-80"
              >
                {t("trainingPlan.saveRoutine" as TranslationKey)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" data-overlay-open="true">
          <AppCard variant="glass" className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden !rounded-[24px] !p-0 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">{t("trainingPlan.weeklyPreview" as TranslationKey)}</h3>
              <AppButton
                variant="ghost"
                size="sm"
                onClick={() => setWeeklyPreviewOpen(false)}
                className="h-8 w-8 !p-0 text-white hover:bg-zinc-900"
              >
                ✕
              </AppButton>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              <div className="grid grid-cols-1 gap-2">
                {weeklyDays.map((raw, idx) => {
                  const day = normalizeWeeklyDay(raw as any, idx + 1);
                  const isRest = isRestSport(day.sport);
                  return (
                    <AppCard key={day.id} variant="soft" className="p-3 !bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl !border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">{weekdayName(day.id)}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isRest ? "bg-zinc-900 shadow-sm border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl text-zinc-400" : "bg-green-500/10 text-green-500"
                            }`}
                        >
                          {isRest ? t("trainingPlan.restDay" as TranslationKey) : day.sport}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {isRest ? t("trainingPlan.restDay" as TranslationKey) : day.focus || t("trainingPlan.noLabelDefined" as TranslationKey)}
                      </div>
                      {!isRest && day.startTime && <div className="mt-1 text-[10px] text-zinc-400">{t("trainingPlan.startTime" as TranslationKey)}: {day.startTime}</div>}
                    </AppCard>
                  );
                })}
              </div>
            </div>
          </AppCard>
        </div>
      )}

      {/* Routine Vorschau Modal */}
      {routinePreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" data-overlay-open="true">
          <AppCard variant="glass" className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden !rounded-[24px] !p-0 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">{t("trainingPlan.routinePreview" as TranslationKey)}</h3>
              <AppButton
                variant="ghost"
                size="sm"
                onClick={() => setRoutinePreviewOpen(false)}
                className="h-8 w-8 !p-0 text-white hover:bg-zinc-900"
              >
                ✕
              </AppButton>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              <div className="grid grid-cols-1 gap-2">
                {routinePreview.map((item, index) => {
                  const block = normalizeRoutineBlock(item.block as any, index + 1);
                  const isRest = block.type === "Rest" || isRestSport(block.sport);
                  return (
                    <AppCard key={index} variant="soft" className="p-3 !bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl !border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-white">{item.label}</span>
                        <span className="text-[10px] text-zinc-400">{isRest ? t("trainingPlan.restDay" as TranslationKey) : block.sport}</span>
                      </div>
                      <div className="mt-1 text-sm font-medium text-zinc-400">
                        {isRest ? t("trainingPlan.restDay" as TranslationKey) : block.label}
                      </div>
                      {!isRest && block.startTime && <div className="mt-1 text-[10px] text-zinc-400">{t("trainingPlan.startTime" as TranslationKey)}: {block.startTime}</div>}
                    </AppCard>
                  );
                })}
              </div>
            </div>
          </AppCard>
        </div>
      )}

      {/* Reine Trainings Vorlagen Modal (Management) */}
      {workoutTemplatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" data-overlay-open="true">
          <AppCard variant="glass" className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden !rounded-[24px] !p-0 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">{t("trainingPlan.yourWorkoutTemplates" as TranslationKey)}</h3>
              <AppButton
                variant="ghost"
                size="sm"
                onClick={() => setWorkoutTemplatesOpen(false)}
                className="h-8 w-8 !p-0 text-white hover:bg-zinc-900"
              >
                ✕
              </AppButton>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-[160px] scrollbar-hide">
              {workoutTemplates.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  {t("trainingPlan.noTemplatesSaved" as TranslationKey)}
                </p>
              ) : (
                <div className="space-y-2">
                  {workoutTemplates
                    .slice()
                    .sort((a, b) => (b.createdAtISO || "").localeCompare(a.createdAtISO || ""))
                    .map((tpl) => (
                      <AppCard
                        key={tpl.id}
                        variant="soft"
                        className="flex items-center justify-between gap-2 p-3 !bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl !border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <div className="min-w-0 text-sm text-white">
                          <div className="truncate font-medium">{tpl.name}</div>
                          <div className="truncate text-xs text-zinc-400">
                            {tpl.isCardio ? "Cardio" : "Gym"} · {tpl.sport} · {tpl.exercises?.length ?? 0}{" "}
                            {tpl.isCardio ? t("trainingPlan.unitCount" as TranslationKey) : t("trainingPlan.exerciseCount" as TranslationKey)}
                          </div>
                        </div>
                        <AppButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm(t("trainingPlan.confirmDeleteTemplate" as TranslationKey, { name: tpl.name }))) deleteWorkoutTemplate(tpl.id);
                          }}
                          className="shrink-0 text-xs font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200"
                        >
                          {t("common.delete" as TranslationKey)}
                        </AppButton>
                      </AppCard>
                    ))}
                </div>
              )}
            </div>
          </AppCard>
        </div>
      )}

      {/* Trainingspläne Vorlagen Modal (Weekly) */}
      {weeklyTemplatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" data-overlay-open="true">
          <AppCard variant="glass" className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden !rounded-[24px] !p-0 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">{t("trainingPlan.yourWeeklyPlans" as TranslationKey)}</h3>
              <AppButton
                variant="ghost"
                size="sm"
                onClick={() => setWeeklyTemplatesOpen(false)}
                className="h-8 w-8 !p-0 text-white hover:bg-zinc-900"
              >
                ✕
              </AppButton>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              {weeklyTemplates.length === 0 ? (
                <p className="text-sm text-zinc-400">{t("trainingPlan.noTemplatesFound" as TranslationKey)}</p>
              ) : (
                <div className="space-y-2">
                  {weeklyTemplates.map((tpl) => (
                    <AppCard
                      key={tpl.id}
                      variant="soft"
                      className="flex items-center justify-between gap-2 p-3 !bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl !border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    >
                      <div className="text-sm text-white">
                        <div className="font-medium">{tpl.name}</div>
                        <div className="text-xs text-zinc-400">
                          {t("trainingPlan.weeksDays" as TranslationKey, { weeks: tpl.durationWeeks, days: tpl.days.length })}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <AppButton
                          variant="secondary"
                          size="sm"
                          onClick={() => setPreviewTemplate(tpl)}
                          className="text-xs gap-1"
                        >
                          <Eye size={14} />
                        </AppButton>
                        <AppButton
                          variant="primary"
                          size="sm"
                          onClick={() => applyWeeklyTemplate(tpl)}
                          className="text-xs"
                        >
                          {t("trainingPlan.apply" as TranslationKey)}
                        </AppButton>
                      </div>
                    </AppCard>
                  ))}
                </div>
              )}
            </div>
          </AppCard>
        </div >
      )}

      {/* Trainingspläne Vorlagen Modal (Routine) */}
      {
        routineTemplatesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" data-overlay-open="true">
            <AppCard variant="glass" className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden !rounded-[24px] !p-0 shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 py-3">
                <h3 className="text-sm font-semibold text-white">{t("trainingPlan.yourRoutines" as TranslationKey)}</h3>
                <AppButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setRoutineTemplatesOpen(false)}
                  className="h-8 w-8 !p-0 text-white hover:bg-zinc-900"
                >
                  ✕
                </AppButton>
              </div>
              <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                {routineTemplates.length === 0 ? (
                  <p className="text-sm text-zinc-400">{t("trainingPlan.noTemplatesFound" as TranslationKey)}</p>
                ) : (
                  <div className="space-y-2">
                    {routineTemplates.map((tpl) => (
                      <AppCard
                        key={tpl.id}
                        variant="soft"
                        className="flex items-center justify-between gap-2 p-3 !bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl !border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <div className="text-sm text-white">
                          <div className="font-medium">{tpl.name}</div>
                          <div className="text-xs text-zinc-400">
                            {t("trainingPlan.weeksDaysInCycle" as TranslationKey, { weeks: tpl.durationWeeks, days: tpl.blocks.length })}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <AppButton
                            variant="secondary"
                            size="sm"
                            onClick={() => setPreviewTemplate(tpl)}
                            className="text-xs gap-1"
                          >
                            <Eye size={14} />
                          </AppButton>
                          <AppButton
                            variant="primary"
                            size="sm"
                            onClick={() => applyRoutineTemplate(tpl)}
                            className="text-xs"
                          >
                            {t("trainingPlan.apply" as TranslationKey)}
                          </AppButton>
                        </div>
                      </AppCard>
                    ))}
                  </div>
                )}
              </div>
            </AppCard >
          </div >
        )
      }

      {/* Preview Modal */}
      {
        previewTemplate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <AppCard variant="glass" className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden !rounded-[24px] !p-0 shadow-2xl border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 bg-zinc-900/80 px-4 py-3 sticky top-0 backdrop-blur-md z-10">
                <h3 className="font-bold text-white text-lg truncate pr-4">{previewTemplate.name}</h3>
                <button
                  onClick={() => setPreviewTemplate(null)}
                  className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide bg-zinc-950/50">

                {/* Weekly Review */}
                {/* Weekly Review */}
                {(previewTemplate as any)?.days?.map((day: any, i: number) => {
                  if (!day) return null;
                  const isRest = day.sport === "Ruhetag";
                  return (
                    <div key={i} className={`p-3 rounded-2xl border ${isRest ? 'bg-zinc-900/30 border-dashed border-zinc-800' : 'bg-zinc-900 border-zinc-800'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-medium text-sm ${isRest ? 'text-zinc-500' : 'text-zinc-200'}`}>{day.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-zinc-400 border border-white/5">{day.sport}</span>
                      </div>
                      {!isRest && day.exercises?.length > 0 && (
                        <div className="space-y-1.5 pl-2 border-l-2 border-zinc-800">
                          {(day.exercises || []).map((ex: any, j: number) => {
                            if (!ex) return null;
                            return (
                              <div key={j} className="text-xs text-zinc-400 flex items-start gap-2">
                                <span className="font-mono text-zinc-500 min-w-[20px] text-right">{ex.sets?.length || 0}×</span>
                                <span className="text-zinc-300 line-clamp-1">{ex.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Routine Review */}

                {(previewTemplate as any)?.blocks?.map((block: any, i: number) => {
                  if (!block) return null;
                  const isRest = block.type === "Rest";
                  return (
                    <div key={i} className={`p-3 rounded-2xl border ${isRest ? 'bg-zinc-900/30 border-dashed border-zinc-800' : 'bg-zinc-900 border-zinc-800'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={`font-medium text-sm ${isRest ? 'text-zinc-500' : 'text-zinc-200'}`}>{block.label || t("trainingPlan.blockNumber" as TranslationKey, { number: i + 1 })}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 text-zinc-400 border border-white/5">{block.sport}</span>
                      </div>
                      {!isRest && block.exercises?.length > 0 && (
                        <div className="space-y-1.5 pl-2 border-l-2 border-zinc-800">
                          {(block.exercises || []).map((ex: any, j: number) => {
                            if (!ex) return null;
                            return (
                              <div key={j} className="text-xs text-zinc-400 flex items-start gap-2">
                                <span className="font-mono text-zinc-500 min-w-[20px] text-right">{ex.sets?.length || 0}×</span>
                                <span className="text-zinc-300 line-clamp-1">{ex.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-white/10 bg-zinc-900/80 backdrop-blur-md flex gap-3 sticky bottom-0 z-10">
                <AppButton variant="secondary" onClick={() => setPreviewTemplate(null)} className="flex-1">
                  {t("common.close" as TranslationKey)}
                </AppButton>
                <AppButton
                  variant="primary"
                  onClick={() => {
                    const isWeekly = !!(previewTemplate as any).days;
                    if (isWeekly) applyWeeklyTemplate(previewTemplate as any);
                    else applyRoutineTemplate(previewTemplate as any);
                    setPreviewTemplate(null);
                    if (isWeekly) setWeeklyTemplatesOpen(false);
                    else setRoutineTemplatesOpen(false);
                  }}
                  className="flex-1 font-bold"
                >
                  {t("trainingPlan.apply" as TranslationKey)}
                </AppButton>
              </div>
            </AppCard>
          </div>
        )
      }

      {/* Save Dialogs (Plan) */}
      {
        weeklySaveDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" data-overlay-open="true">
            <AppCard variant="glass" className="w-full max-w-md !rounded-[24px] !p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-white">{t("trainingPlan.applyWeeklyPlan" as TranslationKey)}</h3>
              <p className="mt-1 text-sm text-zinc-400">{t("trainingPlan.saveAsTemplateQuestion" as TranslationKey)}</p>
              <div className="mt-4 space-y-2">
                <label className="block text-sm text-zinc-400">{t("trainingPlan.templateName" as TranslationKey)}</label>
                <input
                  type="text"
                  value={weeklyTemplateName}
                  onChange={(e) => setWeeklyTemplateName(e.target.value)}
                  className="w-full rounded-3xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-zinc-900 shadow-sm border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <AppButton
                  onClick={() => saveWeeklyTemplateAndCalendar(false)}
                  variant="secondary"
                >
                  {t("trainingPlan.calendarOnly" as TranslationKey)}
                </AppButton>
                <AppButton
                  onClick={() => saveWeeklyTemplateAndCalendar(true)}
                  variant="primary"
                >
                  {t("trainingPlan.calendarAndTemplate" as TranslationKey)}
                </AppButton>
              </div>
            </AppCard>
          </div>
        )
      }

      {
        routineSaveDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" data-overlay-open="true">
            <AppCard variant="glass" className="w-full max-w-md !rounded-[24px] !p-6 shadow-2xl">
              <h3 className="text-base font-semibold text-white">{t("trainingPlan.applyRoutine" as TranslationKey)}</h3>
              <p className="mt-1 text-sm text-zinc-400">{t("trainingPlan.saveAsTemplateQuestion" as TranslationKey)}</p>
              <div className="mt-4 space-y-2">
                <label className="block text-sm text-zinc-400">{t("trainingPlan.templateName" as TranslationKey)}</label>
                <input
                  type="text"
                  value={routineTemplateName}
                  onChange={(e) => setRoutineTemplateName(e.target.value)}
                  className="w-full rounded-3xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-zinc-900 shadow-sm border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <AppButton
                  onClick={() => saveRoutineTemplateAndCalendar(false)}
                  variant="secondary"
                >
                  {t("trainingPlan.calendarOnly" as TranslationKey)}
                </AppButton>
                <AppButton
                  onClick={() => saveRoutineTemplateAndCalendar(true)}
                  variant="primary"
                >
                  {t("trainingPlan.calendarAndTemplate" as TranslationKey)}
                </AppButton>
              </div>
            </AppCard>
          </div>
        )
      }
    </div>
  );
};

export default TrainingsplanPage;