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
import ExerciseDetailsModal from "../exercises/ExerciseDetailsModal";
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

function ExerciseThumbnail({ exercise }: { exercise: Exercise }) {
  const src = useExerciseImage(exercise);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
        loading="eager"
        decoding="async"
      />
    );
  }

  return (
    <div
      style={{
        width: 52,
        height: 52,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--button-bg)',
        border: '1px solid var(--border-color)',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" color="var(--text-secondary)">
        <path d="M5 8h3v8H5M16 8h3v8h-3M8 10h8M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const ExerciseSkeleton = () => (
  <div className="space-y-2 p-4">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--button-bg)] px-3 py-2.5">
        <div className="h-[52px] w-[52px] shrink-0 animate-pulse rounded-[10px] bg-[var(--input-bg)]" />
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
  const [showMoreFilters, setShowMoreFilters] = useState(false);
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
              <p className="text-base text-[var(--text-secondary)] mt-1">{t(`training.difficulty.${ex.difficulty || "Mittel"}` as any)}</p>
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

  const renderGymView = () => (
    <>
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-3 bg-gradient-to-b from-[var(--card-bg)] to-transparent">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
            <input ref={searchRef} type="text" placeholder={t("training.exerciseLibrary.searchGym")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-10 py-3 text-sm text-[var(--text-color)] outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-[var(--text-secondary)]" />
          </div>
          <button type="button" onClick={openCreate} className="shrink-0 rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-4 py-3 text-sm font-semibold text-[var(--text-color)] hover:bg-[var(--button-bg)]">{t("training.exerciseLibrary.addCustom")}</button>
        </div>
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={filters.muscle} onChange={(e) => setFilters((prev) => ({ ...prev, muscle: e.target.value as Muscle }))} className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.muscleAll")}</option>{MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabels[m]}</option>)}</select>
            <select value={filters.equipment} onChange={(e) => setFilters((prev) => ({ ...prev, equipment: e.target.value as Equipment }))} className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.equipmentAll")}</option>{EQUIPMENTS.map((eq) => <option key={eq} value={eq}>{equipmentLabels[eq]}</option>)}</select>
          </div>
          <button type="button" onClick={() => setShowMoreFilters((v) => !v)} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-color)]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--button-bg)] border border-[var(--border-color)]">{showMoreFilters ? "–" : "+"}</span>
            {t("training.exerciseLibrary.moreFilters")}
          </button>
          {showMoreFilters && (
            <div className="grid grid-cols-2 gap-2">
              <select value={filters.difficulty} onChange={(e) => setFilters((prev) => ({ ...prev, difficulty: e.target.value as any }))} className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.levelAll")}</option>{DIFFICULTIES.map((d) => <option key={d} value={d}>{t(`training.difficulty.${d}` as any)}</option>)}</select>
              <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as ExerciseType }))} className="w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.typeAll")}</option>{EXERCISE_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select>
            </div>
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
                Empfehlungen
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "rgba(0,122,255,0.12)", color: "#007AFF" }}>
                {suggestedExercises.length}
              </span>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Ähnliche Muskeln · Bewegung · Dein Verlauf
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
                Alle Übungen
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
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[var(--text-color)]">
                {title || (category === 'running' ? "Lauf auswählen" : category === 'cycling' ? "Radfahrt auswählen" : "Übungsbibliothek")}
              </div>
              <div className="truncate text-sm text-[var(--text-secondary)]">
                {category === 'running' ? "Distanz oder Intervalle" : category === 'cycling' ? "Distanz oder Intervalle" : "Übung auswählen"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-3xl border border-[var(--border-color)] bg-[var(--button-bg)] px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--button-bg)]/80"
            >
              {t("common.close")}
            </button>
          </div>
        }
      >
        <div className="flex flex-col flex-1 overflow-hidden px-4 pb-4">
          {category === 'running' || category === 'cycling' ? renderCardioView() : renderGymView()}
          <div className="mt-3 text-xs text-center text-gray-500">{t("training.exerciseLibrary.tip")}</div>
        </div>
      </BottomSheet>

      {showCreate && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeCreate(); }}
        >
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border-color)] bg-[var(--modal-bg)] backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3"><h3 className="text-lg font-semibold text-[var(--text-color)]">{t("training.exerciseLibrary.createTitle")}</h3><button type="button" className="text-[var(--text-secondary)] hover:text-[var(--text-color)]" onClick={closeCreate}>✕</button></div>
            <div className="mt-3 space-y-4">
              <div><label className="text-sm text-[var(--text-secondary)]">{t("training.exerciseLibrary.createNameLabel")}</label><input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t("training.exerciseLibrary.createNamePlaceholder")} className="mt-1 w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary" /></div>
              <div><label className="text-sm text-[var(--text-secondary)]">{t("training.exerciseLibrary.imageTitle")}</label><div className="mt-2 flex items-center gap-4"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)]">{createImagePreview ? <img src={createImagePreview} alt="" className="h-full w-full object-cover" /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-[var(--text-secondary)]"><path d="M5 8h3v8H5M16 8h3v8h-3M8 10h8M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div><div className="flex flex-col gap-2"><input ref={createImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCreateImageSelect(e.currentTarget.files?.[0] ?? null)} /><button type="button" className="rounded-3xl border border-[var(--border-color)] bg-[var(--button-bg)] px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--input-bg)]" onClick={() => createImageInputRef.current?.click()}>{t("training.exerciseLibrary.imageSelect")}</button><button type="button" className="rounded-3xl border border-[var(--border-color)] bg-[var(--button-bg)] px-4 py-2 text-sm disabled:opacity-50 text-[var(--text-color)] hover:bg-[var(--input-bg)]" onClick={clearCreateImage} disabled={!createImagePreview}>{t("training.exerciseLibrary.imageRemove")}</button></div></div></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm text-[var(--text-secondary)]">{t("training.exerciseLibrary.createMuscleLabel")}</label><select value={createMuscle} onChange={(e) => setCreateMuscle(e.target.value as Muscle)} className="mt-1 w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary">{MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabels[m]}</option>)}</select></div>
                <div><label className="text-sm text-[var(--text-secondary)]">{t("training.exerciseLibrary.createEquipmentLabel")}</label><select value={createEquipment} onChange={(e) => setCreateEquipment(e.target.value as Equipment)} className="mt-1 w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary">{EQUIPMENTS.map((eq) => <option key={eq} value={eq}>{equipmentLabels[eq]}</option>)}</select></div>
              </div>
              <div><label className="text-sm text-[var(--text-secondary)]">{t("training.exerciseLibrary.createTypeLabel")}</label><select value={createType} onChange={(e) => setCreateType(e.target.value as ExerciseType)} className="mt-1 w-full rounded-3xl border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-color)] outline-none focus:ring-1 focus:ring-brand-primary">{EXERCISE_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div>
              <div><div className="text-sm text-[var(--text-secondary)]">{t("training.exerciseLibrary.createMetricsLabel")}</div><div className="mt-2 flex flex-wrap gap-2">{METRICS.map((metric) => <button key={metric} type="button" onClick={() => toggleMetric(metric)} className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${createMetrics.includes(metric) ? 'bg-brand-primary text-white border-brand-primary' : 'border-[var(--border-color)] bg-[var(--input-bg)] text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'}`}>{metricLabels[metric]}</button>)}</div></div>
              {createError && <div className="rounded-3xl border border-red-500/30 bg-red-500/20 px-3 py-2 text-sm text-red-300">{createError}</div>}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" className="rounded-3xl border border-[var(--border-color)] bg-[var(--button-bg)] px-4 py-2 text-sm font-semibold text-[var(--text-color)] hover:bg-[var(--input-bg)]" onClick={closeCreate}>{t("training.exerciseLibrary.createCancel")}</button>
                <button type="button" className="rounded-3xl px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90" onClick={handleCreate}>{t("training.exerciseLibrary.createSave")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ExerciseDetailsModal
        open={detailsOpen && !!selectedExercise}
        exercise={selectedExercise}
        isAdded={!!selectedExercise && (existingSet.has(selectedExercise.id) || localAddedIds.has(selectedExercise.id))}
        onClose={closeDetails}
        onAdd={handleAddExercise}
      />
    </>
  );
});

export default ExerciseLibraryModal;
