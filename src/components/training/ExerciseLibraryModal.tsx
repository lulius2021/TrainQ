// src/components/training/ExerciseLibraryModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
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
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
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
    return <img src={src} alt="" className="h-20 w-20 rounded-2xl object-cover shrink-0 bg-zinc-800" loading="lazy" decoding="async" />;
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-white/5" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-zinc-600"><path d="M5 8h3v8H5M16 8h3v8h-3M8 10h8M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

const ExerciseSkeleton = () => (
  <div className="space-y-3 p-4">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="flex items-center gap-4 rounded-3xl border border-white/5 bg-white/5 p-4">
        <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/10" />
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
    className={`flex items-start justify-between gap-4 rounded-3xl p-4 transition-all border group relative overflow-hidden ${isAdded
      ? "bg-emerald-500/10 border-emerald-500/20"
      : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-[0.98]"
      }`}
    role="button"
    tabIndex={0}
    onClick={() => onOpenDetails(ex)}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpenDetails(ex); }}
  >
    <div className="flex flex-1 items-start gap-[15px]">
      <ExerciseThumbnail exercise={ex} />
      <div className="flex-1 min-w-0 py-1">
        <div className="text-[17px] font-bold text-white leading-tight break-words pr-2">
          {getExerciseDisplayName(ex, lang)}
        </div>
        <div className="mt-1.5 text-sm font-medium text-zinc-400 break-words leading-snug">
          {(ex.equipment || []).map((eq) => equipmentLabels[eq] ?? eq).join(", ")}
          {ex.type ? ` · ${typeLabels[ex.type] ?? ex.type}` : ""}
        </div>
      </div>
    </div>
    <button
      type="button"
      disabled={isAdded}
      onClickCapture={(e) => { e.stopPropagation(); if (isAdded) return; onAdd(ex); }}
      className={`shrink-0 self-center rounded-2xl w-12 h-12 flex items-center justify-center transition-all ${isAdded
        ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        : "bg-white/10 text-white hover:bg-[#007AFF] hover:text-white"
        }`}
    >
      {isAdded ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="m5 12 5 5 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
      )}
    </button>
  </div>
), (prev, next) => prev.ex.id === next.ex.id && prev.isAdded === next.isAdded && prev.lang === next.lang);

const ExerciseLibraryModal = React.memo(function ExerciseLibraryModal({ open, title, category = 'gym', onClose, existingExerciseIds, onPick, }: Props) {
  const { t, lang } = useI18n();
  const { keyboardHeight, isOpen: keyboardOpen } = useKeyboardHeight();
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

  // Body Scroll Lock (iOS safe)
  useBodyScrollLock(open);

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
  const handleAddExercise = (exercise: Exercise) => { const isAdded = existingSet.has(exercise.id) || localAddedIds.has(exercise.id); if (isAdded) return; onPick({ ...exercise, name: getExerciseDisplayName(exercise, lang) }); setLocalAddedIds((prev) => new Set([...prev, exercise.id])); };

  // Helper to get icon for running/cycling cards
  const getCardIcon = (id: string) => {
    if (id.includes("run_1") || id.includes("cycle_1")) return <MapPin className="text-brand-primary" size={32} />; // Normal Run/Bike
    if (id.includes("run_2") || id.includes("cycle_2")) return <Activity className="text-green-400" size={32} />; // Recovery
    if (id.includes("run_3") || id.includes("cycle_3")) return <Repeat className="text-orange-400" size={32} />; // Intervals
    return <Activity className="text-gray-400" size={32} />;
  };

  const getCardBg = (id: string, isAdded: boolean) => {
    if (isAdded) return "bg-green-500/20 border-green-500/50";
    if (id.includes("run_1") || id.includes("cycle_1")) return "bg-brand-primary/10 border-brand-primary/20 hover:bg-brand-primary/20";
    if (id.includes("run_2") || id.includes("cycle_2")) return "bg-green-500/10 border-green-500/20 hover:bg-green-500/20";
    if (id.includes("run_3") || id.includes("cycle_3")) return "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20";
    return "bg-white/5 border-white/10 hover:bg-white/10";
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
              <h3 className="text-xl font-bold text-white">{getExerciseDisplayName(ex, lang)}</h3>
              <p className="text-base text-gray-400 mt-1">{t(`training.difficulty.${ex.difficulty || "Mittel"}` as any)}</p>
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
      <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-3 bg-gradient-to-b from-[#061226]/80 to-transparent">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
            <input ref={searchRef} type="text" placeholder={t("training.exerciseLibrary.searchGym")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-3xl border border-white/10 bg-white/5 px-10 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-gray-500" />
          </div>
          <button type="button" onClick={openCreate} className="shrink-0 rounded-3xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20">{t("training.exerciseLibrary.addCustom")}</button>
        </div>
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={filters.muscle} onChange={(e) => setFilters((prev) => ({ ...prev, muscle: e.target.value as Muscle }))} className="w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.muscleAll")}</option>{MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabels[m]}</option>)}</select>
            <select value={filters.equipment} onChange={(e) => setFilters((prev) => ({ ...prev, equipment: e.target.value as Equipment }))} className="w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.equipmentAll")}</option>{EQUIPMENTS.map((eq) => <option key={eq} value={eq}>{equipmentLabels[eq]}</option>)}</select>
          </div>
          <button type="button" onClick={() => setShowMoreFilters((v) => !v)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 border border-white/10">{showMoreFilters ? "–" : "+"}</span>
            {t("training.exerciseLibrary.moreFilters")}
          </button>
          {showMoreFilters && (
            <div className="grid grid-cols-2 gap-2">
              <select value={filters.difficulty} onChange={(e) => setFilters((prev) => ({ ...prev, difficulty: e.target.value as any }))} className="w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.levelAll")}</option>{DIFFICULTIES.map((d) => <option key={d} value={d}>{t(`training.difficulty.${d}` as any)}</option>)}</select>
              <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as ExerciseType }))} className="w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.typeAll")}</option>{EXERCISE_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 pb-[160px]" onScroll={handleScroll} ref={listContainerRef}>
        {filteredExercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-gray-400">
            {t("training.exerciseLibrary.empty")}
            <div className="mt-4">
              <button
                type="button"
                onClick={openCreate}
                className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
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


  const MotionDiv = motion.div as any;

  const modal = (
    <AnimatePresence>
      {open && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-[99999] flex ${keyboardOpen ? "items-start" : "items-center"} justify-center bg-black/80 backdrop-blur-sm px-4`}
          style={
            keyboardOpen
              ? {
                paddingTop: "max(env(safe-area-inset-top), 12px)",
                paddingBottom: `calc(${Math.max(0, keyboardHeight)}px + env(safe-area-inset-bottom))`,
              }
              : undefined
          }
          role="dialog"
          aria-modal="true"
          onPointerDown={(e: any) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl h-[85lvh] min-h-[80vh] shrink-0"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-white">{title || (category === 'running' ? "Lauf auswählen" : category === 'cycling' ? "Radfahrt auswählen" : "Übungsbibliothek")}</div>
                <div className="truncate text-sm text-gray-400">
                  {category === 'running' ? "Distanz oder Intervalle" : category === 'cycling' ? "Distanz oder Intervalle" : "Übung auswählen"}
                </div>
              </div>
              <button type="button" onClick={onClose} className="rounded-3xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">{t("common.close")}</button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
              {category === 'running' || category === 'cycling' ? renderCardioView() : renderGymView()}
              <div className="mt-3 text-xs text-center text-gray-500">{t("training.exerciseLibrary.tip")}</div>
            </div>

          </div>
          {showCreate && <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCreate(); }}>
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3"><h3 className="text-lg font-semibold text-white">{t("training.exerciseLibrary.createTitle")}</h3><button type="button" className="text-gray-400 hover:text-white" onClick={closeCreate}>✕</button></div>
              <div className="mt-3 space-y-4">
                <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createNameLabel")}</label><input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t("training.exerciseLibrary.createNamePlaceholder")} className="mt-1 w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary" /></div>
                <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.imageTitle")}</label><div className="mt-2 flex items-center gap-4"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/5">{createImagePreview ? <img src={createImagePreview} alt="" className="h-full w-full object-cover" /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-500"><path d="M5 8h3v8H5M16 8h3v8h-3M8 10h8M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div><div className="flex flex-col gap-2"><input ref={createImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCreateImageSelect(e.currentTarget.files?.[0] ?? null)} /><button type="button" className="rounded-3xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20" onClick={() => createImageInputRef.current?.click()}>{t("training.exerciseLibrary.imageSelect")}</button><button type="button" className="rounded-3xl border border-white/10 bg-white/10 px-4 py-2 text-sm disabled:opacity-50 text-white hover:bg-white/20" onClick={clearCreateImage} disabled={!createImagePreview}>{t("training.exerciseLibrary.imageRemove")}</button></div></div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createMuscleLabel")}</label><select value={createMuscle} onChange={(e) => setCreateMuscle(e.target.value as Muscle)} className="mt-1 w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary">{MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabels[m]}</option>)}</select></div>
                  <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createEquipmentLabel")}</label><select value={createEquipment} onChange={(e) => setCreateEquipment(e.target.value as Equipment)} className="mt-1 w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary">{EQUIPMENTS.map((eq) => <option key={eq} value={eq}>{equipmentLabels[eq]}</option>)}</select></div>
                </div>
                <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createTypeLabel")}</label><select value={createType} onChange={(e) => setCreateType(e.target.value as ExerciseType)} className="mt-1 w-full rounded-3xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary">{EXERCISE_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div>
                <div><div className="text-sm text-gray-400">{t("training.exerciseLibrary.createMetricsLabel")}</div><div className="mt-2 flex flex-wrap gap-2">{METRICS.map((metric) => <button key={metric} type="button" onClick={() => toggleMetric(metric)} className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${createMetrics.includes(metric) ? 'bg-brand-primary text-white border-brand-primary' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}>{metricLabels[metric]}</button>)}</div></div>
                {createError && <div className="rounded-3xl border border-red-500/30 bg-red-500/20 px-3 py-2 text-sm text-red-300">{createError}</div>}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" className="rounded-3xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20" onClick={closeCreate}>{t("training.exerciseLibrary.createCancel")}</button>
                  <button type="button" className="rounded-3xl px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90" onClick={handleCreate}>{t("training.exerciseLibrary.createSave")}</button>
                </div>
              </div>
            </div>
          </div>}
          <ExerciseDetailsModal open={detailsOpen && !!selectedExercise} exercise={selectedExercise} isAdded={!!selectedExercise && (existingSet.has(selectedExercise.id) || localAddedIds.has(selectedExercise.id))} onClose={closeDetails} onAdd={handleAddExercise} />
        </MotionDiv>
      )
      }
    </AnimatePresence >
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
});

export default ExerciseLibraryModal;
