// src/components/training/ExerciseLibraryModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "../common/BottomSheet";
import { useI18n } from "../../i18n/useI18n";
import {
  EXERCISES,
  MUSCLE_GROUPS,
  EQUIPMENTS,
  DIFFICULTIES,
  EXERCISE_TYPES,
  METRICS,
  RUNNING_EXERCISES,
  CYCLING_EXERCISES,
  filterExercises,
  refreshExerciseLibrary,
  findExerciseByToken,
  getExerciseDisplayName,
  type Exercise,
  type ExerciseFilters,
  type ExerciseImage,
  type Muscle,
  type Equipment,
  type ExerciseType,
  type Metric,
  type Movement,
} from "../../data/exerciseLibrary";
import { addCustomExercise } from "../../utils/customExercisesStore";
import { addAliasOverride } from "../../utils/exerciseAliasesStore";
import { saveExerciseImage } from "../../utils/exerciseImageStore";
import { useExerciseImage } from "../../hooks/useExerciseImage";
import ExerciseDetailView from "../exercises/ExerciseDetailView";
import { MapPin, Repeat, Activity, Bike } from "lucide-react";

type Category = 'gym' | 'running' | 'cycling' | 'custom';

type Props = {
  open: boolean;
  title?: string;
  category?: Category;
  onClose: () => void;
  existingExerciseIds?: string[];
  onPick: (exercise: Exercise) => void;
  onPickCustom?: () => void;
  suggestedExercises?: Exercise[]; // Same-muscle suggestions shown at top (swap mode)
  swapMode?: boolean;              // Close after single pick + suppress "already added" state
};

const defaultExerciseFilters: ExerciseFilters = {
  search: "",
  muscle: "alle",
  equipment: "alle",
  difficulty: "alle",
  type: "alle",
};

const DEFAULT_METRICS_BY_TYPE: Record<ExerciseType, Metric[]> = {
  strength: ["weight", "reps"],
  hypertrophy: ["weight", "reps"],
  calisthenics: ["reps"],
  conditioning: ["time", "distance", "pace"],
  mobility: ["time"],
};

function inferMovement(primaryMuscle: Muscle): Movement {
  if (["chest", "front_delts", "side_delts", "triceps"].includes(primaryMuscle)) return "push";
  if (["back", "lats", "rear_delts", "biceps", "forearms", "traps"].includes(primaryMuscle)) return "pull";
  if (["quads", "calves"].includes(primaryMuscle)) return "squat";
  if (["hamstrings", "glutes", "lower_back"].includes(primaryMuscle)) return "hinge";
  if (["core", "obliques", "hip_flexors"].includes(primaryMuscle)) return "rotation";
  return "push";
}

import MuscleBodyMap from "../exercises/MuscleBodyMap";

const LOGO_FALLBACK = "/logo-dark.png";

function ExerciseThumbnail({ exercise }: { exercise: Exercise }) {
  const src = useExerciseImage(exercise);

  const isCustom = exercise.source === "custom";

  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: 52, height: 64, borderRadius: 10, objectFit: 'cover', objectPosition: 'center 20%', flexShrink: 0 }}
        loading="eager"
        decoding="async"
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = LOGO_FALLBACK; }}
      />
    );
  }

  // Custom exercises without image → TrainQ logo
  // Core exercises without image → MuscleBodyMap if muscles available
  const hasMuscles = !isCustom && (exercise.primaryMuscles?.length || 0) > 0;
  if (hasMuscles) {
    return (
      <div style={{ width: 52, height: 64, borderRadius: 10, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--button-bg)', border: '1px solid var(--border-color)' }}>
        <MuscleBodyMap primaryMuscles={exercise.primaryMuscles || []} secondaryMuscles={exercise.secondaryMuscles || []} size={26} />
      </div>
    );
  }

  return (
    <img
      src={LOGO_FALLBACK}
      alt="TrainQ"
      style={{ width: 52, height: 64, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
      loading="eager"
      decoding="async"
    />
  );
}

const ExerciseSkeleton = () => (
  <div className="space-y-2 p-4">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--button-bg)] px-3 py-2.5">
        <div className="h-[64px] w-[52px] shrink-0 animate-pulse rounded-[10px] bg-[var(--input-bg)]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--input-bg)]" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--input-bg)]" />
        </div>
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[var(--input-bg)]" />
      </div>
    ))}
  </div>
);

const ExerciseRow = React.memo(({
  ex,
  isAdded,
  lang,
  equipmentLabels,
  typeLabels,
  t,
  onOpenDetails,
  onAdd
}: {
  ex: Exercise;
  isAdded: boolean;
  lang: "de" | "en";
  equipmentLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  t: any;
  onOpenDetails: (ex: Exercise) => void;
  onAdd: (ex: Exercise) => void;
}) => (
  <div
    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all border group relative overflow-hidden ${isAdded
      ? "bg-[var(--success)]/10 border-[var(--success)]/20"
      : "bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--button-bg)] active:scale-[0.98]"
      }`}
    role="button"
    tabIndex={0}
    onClick={() => onOpenDetails(ex)}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenDetails(ex); }}
  >
    <ExerciseThumbnail exercise={ex} />
    <div className="flex-1 min-w-0">
      <div className="text-[15px] font-bold text-[var(--text-color)] leading-tight line-clamp-2">
        {getExerciseDisplayName(ex, lang)}
      </div>
      <div className="mt-0.5 text-xs text-[var(--text-secondary)] truncate">
        {(ex.equipment || []).map((eq) => equipmentLabels[eq] ?? eq).join(", ")}
        {ex.type ? ` · ${typeLabels[ex.type] ?? ex.type}` : ""}
      </div>
    </div>
    <button
      type="button"
      disabled={isAdded}
      onClickCapture={(e) => { e.stopPropagation(); if (isAdded) return; onAdd(ex); }}
      className={`shrink-0 rounded-xl w-10 h-10 flex items-center justify-center transition-all ${isAdded
        ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        : "bg-[var(--button-bg)] text-[var(--text-color)] hover:bg-[#007AFF] hover:text-white"
        }`}
    >
      {isAdded ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m5 12 5 5 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
      )}
    </button>
  </div>
), (prev, next) => prev.ex.id === next.ex.id && prev.isAdded === next.isAdded && prev.lang === next.lang);

const ExerciseLibraryModal = React.memo(function ExerciseLibraryModal({ open, title, category = 'gym', onClose, existingExerciseIds, onPick, suggestedExercises, swapMode, }: Props) {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const existingSet = useMemo(() => new Set(existingExerciseIds ?? []), [existingExerciseIds]);
  const [localAddedIds, setLocalAddedIds] = useState<Set<string>>(() => new Set(existingExerciseIds ?? []));

  // VIRTUALIZATION STATE
  const [visibleCount, setVisibleCount] = useState(20);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchTerm }));
    }, 100); // 100ms debounce
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset virtualization when filters change
  useEffect(() => {
    setVisibleCount(20);
    listContainerRef.current?.scrollTo(0, 0);
  }, [filters, category]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 300) {
      setVisibleCount(prev => Math.min(prev + 20, filteredExercises.length));
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createMuscle, setCreateMuscle] = useState<Muscle>("chest");
  const [createEquipment, setCreateEquipment] = useState<Equipment>("barbell");
  const [createType, setCreateType] = useState<ExerciseType>("strength");
  const [createMetrics, setCreateMetrics] = useState<Metric[]>(DEFAULT_METRICS_BY_TYPE.strength);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createImageFile, setCreateImageFile] = useState<File | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const createImageInputRef = useRef<HTMLInputElement | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const muscleLabels = useMemo(() => ({ chest: t("training.muscle.chest"), back: t("training.muscle.back"), lats: t("training.muscle.lats"), traps: t("training.muscle.traps"), rear_delts: t("training.muscle.rear_delts"), front_delts: t("training.muscle.front_delts"), side_delts: t("training.muscle.side_delts"), biceps: t("training.muscle.biceps"), triceps: t("training.muscle.triceps"), forearms: t("training.muscle.forearms"), quads: t("training.muscle.quads"), hamstrings: t("training.muscle.hamstrings"), glutes: t("training.muscle.glutes"), calves: t("training.muscle.calves"), core: t("training.muscle.core"), obliques: t("training.muscle.obliques"), lower_back: t("training.muscle.lower_back"), hip_flexors: t("training.muscle.hip_flexors"), }), [t]);
  const equipmentLabels = useMemo(() => ({ barbell: t("training.equipment.barbell"), dumbbell: t("training.equipment.dumbbell"), kettlebell: t("training.equipment.kettlebell"), machine: t("training.equipment.machine"), cable: t("training.equipment.cable"), band: t("training.equipment.band"), bodyweight: t("training.equipment.bodyweight"), bench: t("training.equipment.bench"), rack: t("training.equipment.rack"), pullup_bar: t("training.equipment.pullup_bar"), dip_bar: t("training.equipment.dip_bar"), smith_machine: t("training.equipment.smith_machine"), trap_bar: t("training.equipment.trap_bar"), medicine_ball: t("training.equipment.medicine_ball"), cardio_machine: t("training.equipment.cardio_machine"), }), [t]);
  const typeLabels = useMemo(() => ({ strength: t("training.exerciseType.strength"), hypertrophy: t("training.exerciseType.hypertrophy"), calisthenics: t("training.exerciseType.calisthenics"), conditioning: t("training.exerciseType.conditioning"), mobility: t("training.exerciseType.mobility"), }), [t]);
  const metricLabels = useMemo(() => ({ weight: t("training.metric.weight"), reps: t("training.metric.reps"), time: t("training.metric.time"), distance: t("training.metric.distance"), pace: t("training.metric.pace"), rpe: t("training.metric.rpe"), }), [t]);

  useEffect(() => {
    if (!open) return;
    setFilters({ ...defaultExerciseFilters, search: "" });
    setSearchTerm("");
  }, [open, category]);

  useEffect(() => {
    if (!open) return;
    setLocalAddedIds(new Set(existingExerciseIds ?? []));
  }, [open, existingExerciseIds]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => { setCreateMetrics(DEFAULT_METRICS_BY_TYPE[createType]); }, [createType]);
  useEffect(() => { return () => { if (createImagePreview) URL.revokeObjectURL(createImagePreview); }; }, [createImagePreview]);

  const filteredExercises = useMemo(() => {
    if (category === 'running') return RUNNING_EXERCISES;
    if (category === 'cycling') return CYCLING_EXERCISES;
    return filterExercises(EXERCISES, filters);
  }, [filters, category]);

  const clearCreateImage = () => { if (createImagePreview) URL.revokeObjectURL(createImagePreview); setCreateImageFile(null); setCreateImagePreview(null); if (createImageInputRef.current) createImageInputRef.current.value = ""; };
  const openCreate = () => { setCreateName(""); setCreateMuscle("chest"); setCreateEquipment("barbell"); setCreateType("strength"); setCreateMetrics(DEFAULT_METRICS_BY_TYPE.strength); setCreateError(null); clearCreateImage(); setShowCreate(true); };
  const closeCreate = () => { setShowCreate(false); setCreateError(null); clearCreateImage(); };
  const toggleMetric = (metric: Metric) => setCreateMetrics((prev) => prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]);
  const handleCreateImageSelect = (file: File | null) => { if (!file) return; if (createImagePreview) URL.revokeObjectURL(createImagePreview); setCreateImageFile(file); setCreateImagePreview(URL.createObjectURL(file)); };
  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateError(t("training.exerciseLibrary.createEmptyName"));
      return;
    }

    const matched = findExerciseByToken(name);
    if (matched) {
      addAliasOverride(matched.id, lang as "en" | "de", name);
      refreshExerciseLibrary();
      onPick({ ...matched, name: getExerciseDisplayName(matched, lang) });
      closeCreate();
      return;
    }

    const movement = inferMovement(createMuscle);
    const metrics = createMetrics.length ? createMetrics : DEFAULT_METRICS_BY_TYPE[createType];

    let image: ExerciseImage | undefined;
    if (createImageFile) {
      try {
        image = { kind: "user", ...(await saveExerciseImage(createImageFile)) };
      } catch {
        setCreateError(t("training.exerciseLibrary.imageSaveError"));
        return;
      }
    }

    const created = addCustomExercise({
      name,
      lang,
      primaryMuscles: [createMuscle],
      equipment: [createEquipment],
      movement,
      type: createType,
      metrics,
      image,
    });

    refreshExerciseLibrary();
    onPick({ ...created, name: getExerciseDisplayName(created, lang) });
    closeCreate();
  };

  const openDetails = (exercise: Exercise) => { setSelectedExercise(exercise); setDetailsOpen(true); };
  const closeDetails = () => { setDetailsOpen(false); setSelectedExercise(null); };
  const handleAddExercise = (exercise: Exercise) => {
    const isAdded = !swapMode && (existingSet.has(exercise.id) || localAddedIds.has(exercise.id));
    if (isAdded) return;
    onPick({ ...exercise, name: getExerciseDisplayName(exercise, lang) });
    if (swapMode) { onClose(); return; }
    setLocalAddedIds((prev) => new Set([...prev, exercise.id]));
  };

  // Helper to get icon for running/cycling cards
  const getCardIcon = (id: string) => {
    if (id.includes("run_1") || id.includes("cycle_1")) return <MapPin className="text-brand-primary" size={32} />; // Normal Run/Bike
    if (id.includes("run_2") || id.includes("cycle_2")) return <Activity className="text-green-400" size={32} />; // Recovery
    if (id.includes("run_3") || id.includes("cycle_3")) return <Repeat className="text-orange-400" size={32} />; // Intervals
    return <Activity className="text-gray-400" size={32} />;
  };

  const getCardBg = (id: string, isAdded: boolean) => {
    if (isAdded) return "bg-[var(--success)]/20 border-[var(--success)]/50";
    if (id.includes("run_1") || id.includes("cycle_1")) return "bg-[var(--accent-color)]/10 border-[var(--accent-color)]/20 hover:bg-[var(--accent-color)]/20";
    if (id.includes("run_2") || id.includes("cycle_2")) return "bg-[var(--success)]/10 border-[var(--success)]/20 hover:bg-[var(--success)]/20";
    if (id.includes("run_3") || id.includes("cycle_3")) return "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20";
    return "bg-[var(--card-bg)] border-[var(--border-color)] hover:bg-[var(--button-bg)]";
  };

  const renderCardioView = () => (
    <div className="grid grid-cols-1 gap-4 p-4 overflow-y-auto pb-[160px]" onScroll={handleScroll} ref={listContainerRef}>
      {filteredExercises.slice(0, visibleCount).map((ex) => {
        const isAdded = existingSet.has(ex.id) || localAddedIds.has(ex.id);
        return (
          <div
            key={ex.id}
            onClick={() => handleAddExercise(ex)}
            className={`relative flex items-center gap-4 rounded-3xl border p-6 transition-all active:scale-[0.98] ${getCardBg(ex.id, isAdded)} cursor-pointer`}
          >
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-black/20 backdrop-blur-sm`}>
              {getCardIcon(ex.id)}
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-[var(--text-color)]">{getExerciseDisplayName(ex, lang)}</h3>
              <p className="text-base text-[var(--text-secondary)] mt-1">{t(`training.difficulty.${ex.difficulty || "Mittel"}`)}</p>
            </div>
            {isAdded && (
              <div className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-black">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m5 12 5 5 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const activeFilterCount = [filters.muscle, filters.equipment, filters.difficulty, filters.type].filter(f => f !== "alle").length;

  const renderGymView = () => (
    <>
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-2 pt-3" style={{ backgroundColor: "var(--card-bg)" }}>
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={searchRef}
            type="text"
            placeholder={t("training.exerciseLibrary.searchGym")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl bg-[var(--input-bg)] pl-10 pr-4 py-2.5 text-[15px] text-[var(--text-color)] outline-none placeholder:text-[var(--text-secondary)]"
          />
        </div>

        {/* Filter chips row */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Create custom button */}
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 flex items-center gap-1.5 rounded-full bg-brand-primary px-3.5 py-1.5 text-[13px] font-semibold text-white active:scale-[0.96] transition-transform"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            {t("training.exerciseLibrary.addCustom")}
          </button>

          {/* Muscle filter */}
          <button
            type="button"
            onClick={() => {
              const idx = MUSCLE_GROUPS.indexOf(filters.muscle as Muscle);
              const next = idx === -1 ? MUSCLE_GROUPS[0] : (idx + 1 >= MUSCLE_GROUPS.length ? "alle" : MUSCLE_GROUPS[idx + 1]);
              setFilters(prev => ({ ...prev, muscle: next as Muscle }));
            }}
            className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
              filters.muscle !== "alle"
                ? "bg-brand-primary/15 text-brand-primary"
                : "bg-[var(--input-bg)] text-[var(--text-secondary)]"
            }`}
          >
            {filters.muscle !== "alle" ? muscleLabels[filters.muscle as keyof typeof muscleLabels] : t("training.exerciseLibrary.muscleAll")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          {/* Equipment filter */}
          <button
            type="button"
            onClick={() => {
              const idx = EQUIPMENTS.indexOf(filters.equipment as Equipment);
              const next = idx === -1 ? EQUIPMENTS[0] : (idx + 1 >= EQUIPMENTS.length ? "alle" : EQUIPMENTS[idx + 1]);
              setFilters(prev => ({ ...prev, equipment: next as Equipment }));
            }}
            className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
              filters.equipment !== "alle"
                ? "bg-brand-primary/15 text-brand-primary"
                : "bg-[var(--input-bg)] text-[var(--text-secondary)]"
            }`}
          >
            {filters.equipment !== "alle" ? equipmentLabels[filters.equipment as keyof typeof equipmentLabels] : t("training.exerciseLibrary.equipmentAll")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          {/* Type filter */}
          <button
            type="button"
            onClick={() => {
              const idx = EXERCISE_TYPES.indexOf(filters.type as ExerciseType);
              const next = idx === -1 ? EXERCISE_TYPES[0] : (idx + 1 >= EXERCISE_TYPES.length ? "alle" : EXERCISE_TYPES[idx + 1]);
              setFilters(prev => ({ ...prev, type: next as ExerciseType }));
            }}
            className={`shrink-0 flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
              filters.type !== "alle"
                ? "bg-brand-primary/15 text-brand-primary"
                : "bg-[var(--input-bg)] text-[var(--text-secondary)]"
            }`}
          >
            {filters.type !== "alle" ? typeLabels[filters.type as keyof typeof typeLabels] : t("training.exerciseLibrary.typeAll")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>

          {/* Clear filters */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => setFilters({ ...defaultExerciseFilters, search: filters.search })}
              className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-medium text-red-400 active:opacity-70"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 pb-8" onScroll={handleScroll} ref={listContainerRef}>
        {/* Swap mode: same-muscle suggestions at top */}
        {suggestedExercises && suggestedExercises.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 px-1 mb-2">
              <div className="w-1.5 h-5 rounded-full bg-[#007AFF]" />
              <span className="text-sm font-semibold" style={{ color: "var(--text-color)" }}>
                {t("training.exerciseLibrary.suggestions")}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(0,122,255,0.12)", color: "#007AFF" }}>
                {suggestedExercises.length}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("training.exerciseLibrary.suggestionsHint")}
              </span>
            </div>
            <div className="space-y-2">
              {suggestedExercises.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  ex={ex}
                  lang={lang}
                  isAdded={false}
                  onAdd={handleAddExercise}
                  onOpenDetails={openDetails}
                  equipmentLabels={equipmentLabels}
                  typeLabels={typeLabels}
                  t={t}
                />
              ))}
            </div>
            <div className="my-4 h-px" style={{ backgroundColor: "var(--border-color)" }} />
            <div className="px-1 mb-2">
              <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                {t("training.exerciseLibrary.allExercises")}
              </span>
            </div>
          </div>
        )}

        {filteredExercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-color)] p-6 text-center text-[var(--text-secondary)]">
            {t("training.exerciseLibrary.empty")}
            <div className="mt-4">
              <button
                type="button"
                onClick={openCreate}
                className="rounded-full bg-[var(--button-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-color)] transition-colors hover:bg-[var(--input-bg)]"
              >
                {t("training.exerciseLibrary.addCustom")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExercises.slice(0, visibleCount).map((ex) => (
              <ExerciseRow
                key={ex.id}
                ex={ex}
                isAdded={existingSet.has(ex.id) || localAddedIds.has(ex.id)}
                lang={lang}
                equipmentLabels={equipmentLabels}
                typeLabels={typeLabels}
                t={t}
                onOpenDetails={openDetails}
                onAdd={handleAddExercise}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );


  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        height="92dvh"
        zIndex={300}
        contentClassName="flex flex-col flex-1 overflow-hidden"
        header={
          <div className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-lg font-bold text-[var(--text-color)]">
                {title || (category === 'running' ? t("training.exerciseLibrary.runningTitle") : category === 'cycling' ? t("training.exerciseLibrary.cyclingTitle") : t("training.exerciseLibrary.title"))}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--input-bg)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="var(--text-secondary)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        }
      >
        <div className="flex flex-col flex-1 overflow-hidden px-4 pb-4">
          {category === 'running' || category === 'cycling' ? renderCardioView() : renderGymView()}
        </div>
      </BottomSheet>

      <BottomSheet
        open={showCreate}
        onClose={closeCreate}
        height="92dvh"
        zIndex={400}
        contentClassName="flex flex-col flex-1 overflow-hidden"
        header={
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[var(--text-color)]">
                {t("training.exerciseLibrary.createTitle")}
              </div>
            </div>
            <button
              type="button"
              onClick={closeCreate}
              className="rounded-3xl border border-[var(--border-color)] bg-[var(--button-bg)] px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--button-bg)]/80"
            >
              {t("training.exerciseLibrary.createCancel")}
            </button>
          </div>
        }
      >
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t("training.exerciseLibrary.createNameLabel")}
            </label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t("training.exerciseLibrary.createNamePlaceholder")}
              className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--input-bg)] px-4 py-3 text-[15px] text-[var(--text-color)] outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-[var(--text-secondary)]"
              autoFocus
            />
          </div>

          {/* Image */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t("training.exerciseLibrary.imageTitle")}
            </label>
            <div className="mt-2 flex items-center gap-4">
              <button
                type="button"
                onClick={() => createImageInputRef.current?.click()}
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[var(--border-color)] bg-[var(--input-bg)] transition-colors hover:border-brand-primary"
              >
                {createImagePreview ? (
                  <img src={createImagePreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[var(--text-secondary)]">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
              <input
                ref={createImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleCreateImageSelect(e.currentTarget.files?.[0] ?? null)}
              />
              {createImagePreview && (
                <button
                  type="button"
                  onClick={clearCreateImage}
                  className="text-sm text-red-400 hover:text-red-300"
                >
                  {t("training.exerciseLibrary.imageRemove")}
                </button>
              )}
            </div>
          </div>

          {/* Muscle & Equipment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {t("training.exerciseLibrary.createMuscleLabel")}
              </label>
              <select
                value={createMuscle}
                onChange={(e) => setCreateMuscle(e.target.value as Muscle)}
                className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--input-bg)] px-4 py-3 text-[15px] text-[var(--text-color)] outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabels[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)]">
                {t("training.exerciseLibrary.createEquipmentLabel")}
              </label>
              <select
                value={createEquipment}
                onChange={(e) => setCreateEquipment(e.target.value as Equipment)}
                className="mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--input-bg)] px-4 py-3 text-[15px] text-[var(--text-color)] outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {EQUIPMENTS.map((eq) => <option key={eq} value={eq}>{equipmentLabels[eq]}</option>)}
              </select>
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t("training.exerciseLibrary.createTypeLabel")}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXERCISE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCreateType(type)}
                  className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    createType === type
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'
                  }`}
                >
                  {typeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t("training.exerciseLibrary.createMetricsLabel")}
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {METRICS.map((metric) => (
                <button
                  key={metric}
                  type="button"
                  onClick={() => toggleMetric(metric)}
                  className={`rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    createMetrics.includes(metric)
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'
                  }`}
                >
                  {metricLabels[metric]}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {createError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {createError}
            </div>
          )}
        </div>

        {/* Fixed bottom save button */}
        <div className="border-t border-[var(--border-color)] px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <button
            type="button"
            onClick={handleCreate}
            className="w-full rounded-2xl bg-brand-primary py-3.5 text-base font-semibold text-white transition-colors hover:bg-brand-primary/90 active:scale-[0.98]"
          >
            {t("training.exerciseLibrary.createSave")}
          </button>
        </div>
      </BottomSheet>

      <ExerciseDetailView
        isOpen={detailsOpen && !!selectedExercise}
        exercise={selectedExercise}
        onClose={closeDetails}
      />
    </>
  );
});

export default ExerciseLibraryModal;
