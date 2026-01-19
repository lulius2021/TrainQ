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
import ExerciseDetailsModal from "../exercises/ExerciseDetailsModal";

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

const DEFAULT_METRICS_BY_TYPE: Record<ExerciseType, Metric[]> = {
  strength: ["weight", "reps"],
  hypertrophy: ["weight", "reps"],
  calisthenics: ["reps"],
  conditioning: ["time", "distance", "pace"],
  mobility: ["time"],
};

const CARDIO_EXERCISES: Exercise[] = [
  {
    id: "cardio_easy_run_30",
    name: "Lockerer Lauf – 30 Min",
    nameEn: "Easy Run – 30 min",
    nameDe: "Lockerer Lauf – 30 Min",
    aliases: { en: ["Easy Run 30", "Easy Run 30 min"], de: ["Lockerer Lauf 30", "Lauf locker 30 Min"] },
    primaryMuscles: ["quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: ["bodyweight"],
    movement: "locomotion",
    type: "conditioning",
    metrics: ["time", "distance", "pace"],
    difficulty: "Leicht",
  },
  {
    id: "cardio_tempo_run_20",
    name: "Tempo-Lauf – 20 Min",
    nameEn: "Tempo Run – 20 min",
    nameDe: "Tempo-Lauf – 20 Min",
    aliases: { en: ["Tempo Run 20", "Tempo Run 20 min"], de: ["Tempo Lauf 20", "Lauf Tempo 20 Min"] },
    primaryMuscles: ["quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: ["bodyweight"],
    movement: "locomotion",
    type: "conditioning",
    metrics: ["time", "distance", "pace"],
    difficulty: "Mittel",
  },
  {
    id: "cardio_interval_run_10x400",
    name: "Intervalle – 10×400 m",
    nameEn: "Intervals – 10×400 m",
    nameDe: "Intervalle – 10×400 m",
    aliases: { en: ["Intervals 10x400", "Run Intervals"], de: ["Laufintervalle", "Intervalle 10x400"] },
    primaryMuscles: ["quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: ["bodyweight"],
    movement: "locomotion",
    type: "conditioning",
    metrics: ["time", "distance", "pace"],
    difficulty: "Schwer",
  },
  {
    id: "cardio_easy_ride_45",
    name: "Lockere Radausfahrt – 45 Min",
    nameEn: "Easy Ride – 45 min",
    nameDe: "Lockere Radausfahrt – 45 Min",
    aliases: { en: ["Easy Ride 45", "Bike Easy 45"], de: ["Rad locker 45", "Radausfahrt 45"] },
    primaryMuscles: ["quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: ["cardio_machine"],
    movement: "locomotion",
    type: "conditioning",
    metrics: ["time", "distance", "pace"],
    difficulty: "Leicht",
  },
  {
    id: "cardio_interval_bike_8x2",
    name: "Bike-Intervalle – 8×2 Min hart",
    nameEn: "Bike Intervals – 8×2 min hard",
    nameDe: "Bike-Intervalle – 8×2 Min hart",
    aliases: { en: ["Bike Intervals 8x2", "Hard Bike Intervals"], de: ["Bike Intervalle", "Rad Intervalle"] },
    primaryMuscles: ["quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: ["cardio_machine"],
    movement: "locomotion",
    type: "conditioning",
    metrics: ["time", "distance", "pace"],
    difficulty: "Mittel",
  },
  {
    id: "cardio_long_run_60",
    name: "Langer Lauf – 60 Min",
    nameEn: "Long Run – 60 min",
    nameDe: "Langer Lauf – 60 Min",
    aliases: { en: ["Long Run 60", "Endurance Run"], de: ["Langer Lauf", "Lauf 60 Min"] },
    primaryMuscles: ["quads"],
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: ["bodyweight"],
    movement: "locomotion",
    type: "conditioning",
    metrics: ["time", "distance", "pace"],
    difficulty: "Schwer",
  },
];

function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cardioFilter(list: Exercise[], term: string, lang: "de" | "en"): Exercise[] {
  const t = normalize(term);
  if (!t) return list;
  return list.filter((ex) => normalize(getExerciseDisplayName(ex, lang)).includes(t));
}

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
    return <img src={src} alt="" className="h-12 w-12 rounded-xl object-cover" loading="lazy" decoding="async" />;
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-500"><path d="M5 8h3v8H5M16 8h3v8h-3M8 10h8M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

export default function ExerciseLibraryModal({ open, title, isCardioLibrary = false, onClose, existingExerciseIds, onPick, }: Props) {
  const { t, lang } = useI18n();
  const { keyboardHeight, isOpen: keyboardOpen } = useKeyboardHeight();
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const existingSet = useMemo(() => new Set(existingExerciseIds ?? []), [existingExerciseIds]);
  const [localAddedIds, setLocalAddedIds] = useState<Set<string>>(() => new Set(existingExerciseIds ?? []));

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
  const lastModeRef = useRef<boolean>(isCardioLibrary);

  const muscleLabels = useMemo(() => ({ chest: t("training.muscle.chest"), back: t("training.muscle.back"), lats: t("training.muscle.lats"), traps: t("training.muscle.traps"), rear_delts: t("training.muscle.rear_delts"), front_delts: t("training.muscle.front_delts"), side_delts: t("training.muscle.side_delts"), biceps: t("training.muscle.biceps"), triceps: t("training.muscle.triceps"), forearms: t("training.muscle.forearms"), quads: t("training.muscle.quads"), hamstrings: t("training.muscle.hamstrings"), glutes: t("training.muscle.glutes"), calves: t("training.muscle.calves"), core: t("training.muscle.core"), obliques: t("training.muscle.obliques"), lower_back: t("training.muscle.lower_back"), hip_flexors: t("training.muscle.hip_flexors"), }), [t]);
  const equipmentLabels = useMemo(() => ({ barbell: t("training.equipment.barbell"), dumbbell: t("training.equipment.dumbbell"), kettlebell: t("training.equipment.kettlebell"), machine: t("training.equipment.machine"), cable: t("training.equipment.cable"), band: t("training.equipment.band"), bodyweight: t("training.equipment.bodyweight"), bench: t("training.equipment.bench"), rack: t("training.equipment.rack"), pullup_bar: t("training.equipment.pullup_bar"), dip_bar: t("training.equipment.dip_bar"), smith_machine: t("training.equipment.smith_machine"), trap_bar: t("training.equipment.trap_bar"), medicine_ball: t("training.equipment.medicine_ball"), cardio_machine: t("training.equipment.cardio_machine"), }), [t]);
  const typeLabels = useMemo(() => ({ strength: t("training.exerciseType.strength"), hypertrophy: t("training.exerciseType.hypertrophy"), calisthenics: t("training.exerciseType.calisthenics"), conditioning: t("training.exerciseType.conditioning"), mobility: t("training.exerciseType.mobility"), }), [t]);
  const metricLabels = useMemo(() => ({ weight: t("training.metric.weight"), reps: t("training.metric.reps"), time: t("training.metric.time"), distance: t("training.metric.distance"), pace: t("training.metric.pace"), rpe: t("training.metric.rpe"), }), [t]);

  useEffect(() => {
    if (!open) return;
    const modeChanged = lastModeRef.current !== isCardioLibrary;
    lastModeRef.current = isCardioLibrary;
    setFilters((prev) => {
      if (modeChanged) return { ...defaultExerciseFilters, search: "" };
      return { ...prev, search: "" };
    });
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, isCardioLibrary]);

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

  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevBodyOverflow; };
  }, [open]);

  useEffect(() => { setCreateMetrics(DEFAULT_METRICS_BY_TYPE[createType]); }, [createType]);
  useEffect(() => { return () => { if (createImagePreview) URL.revokeObjectURL(createImagePreview); }; }, [createImagePreview]);

  const filteredExercises = useMemo(() => isCardioLibrary ? cardioFilter(CARDIO_EXERCISES, filters.search, lang) : filterExercises(EXERCISES, filters), [filters, isCardioLibrary, lang]);

  // Early return removed

  const clearCreateImage = () => { if (createImagePreview) URL.revokeObjectURL(createImagePreview); setCreateImageFile(null); setCreateImagePreview(null); if (createImageInputRef.current) createImageInputRef.current.value = ""; };
  const openCreate = () => { setCreateName(""); setCreateMuscle("chest"); setCreateEquipment("barbell"); setCreateType("strength"); setCreateMetrics(DEFAULT_METRICS_BY_TYPE.strength); setCreateError(null); clearCreateImage(); setShowCreate(true); };
  const closeCreate = () => { setShowCreate(false); setCreateError(null); clearCreateImage(); };
  const toggleMetric = (metric: Metric) => setCreateMetrics((prev) => prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric]);
  const handleCreateImageSelect = (file: File | null) => { if (!file) return; if (createImagePreview) URL.revokeObjectURL(createImagePreview); setCreateImageFile(file); setCreateImagePreview(URL.createObjectURL(file)); };
  const handleCreate = async () => { const name = createName.trim(); if (!name) { setCreateError(t("training.exerciseLibrary.createEmptyName")); return; } const matched = findExerciseByToken(name); if (matched) { addAliasOverride(matched.id, lang, name); refreshExerciseLibrary(); onPick({ ...matched, name: getExerciseDisplayName(matched, lang) }); closeCreate(); return; } const movement = inferMovement(createMuscle); const metrics = createMetrics.length ? createMetrics : DEFAULT_METRICS_BY_TYPE[createType]; let image: ExerciseImage | undefined; if (createImageFile) { try { image = { kind: "user", ...(await saveExerciseImage(createImageFile)) }; } catch { setCreateError(t("training.exerciseLibrary.imageSaveError")); return; } } const created = addCustomExercise({ name, lang, primaryMuscles: [createMuscle], equipment: [createEquipment], movement, type: createType, metrics, image, }); refreshExerciseLibrary(); onPick({ ...created, name: getExerciseDisplayName(created, lang) }); closeCreate(); };
  const openDetails = (exercise: Exercise) => { setSelectedExercise(exercise); setDetailsOpen(true); };
  const closeDetails = () => { setDetailsOpen(false); setSelectedExercise(null); };
  const handleAddExercise = (exercise: Exercise) => { const isAdded = existingSet.has(exercise.id) || localAddedIds.has(exercise.id); if (isAdded) return; onPick({ ...exercise, name: getExerciseDisplayName(exercise, lang) }); setLocalAddedIds((prev) => new Set([...prev, exercise.id])); };

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
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
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div
            className="flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl"
            style={{ maxHeight: keyboardOpen ? `calc(100dvh - ${Math.max(120, keyboardHeight + 120)}px)` : "85vh" }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0"><div className="truncate text-base font-semibold text-white">{title || "Übungsbibliothek"}</div><div className="truncate text-sm text-gray-400">Übung auswählen</div></div>
              <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">{t("common.close")}</button>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
              <div className="sticky top-0 z-10 -mx-4 px-4 pb-3 pt-3 bg-gradient-to-b from-[#061226]/80 to-transparent">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>
                    <input ref={searchRef} type="text" placeholder={isCardioLibrary ? t("training.exerciseLibrary.searchCardio") : t("training.exerciseLibrary.searchGym")} value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-10 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-gray-500" />
                  </div>
                  {!isCardioLibrary && <button type="button" onClick={openCreate} className="shrink-0 rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20">{t("training.exerciseLibrary.addCustom")}</button>}
                </div>
                {!isCardioLibrary && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <select value={filters.muscle} onChange={(e) => setFilters((prev) => ({ ...prev, muscle: e.target.value as Muscle }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.muscleAll")}</option>{MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabels[m]}</option>)}</select>
                      <select value={filters.equipment} onChange={(e) => setFilters((prev) => ({ ...prev, equipment: e.target.value as Equipment }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.equipmentAll")}</option>{EQUIPMENTS.map((eq) => <option key={eq} value={eq}>{equipmentLabels[eq]}</option>)}</select>
                    </div>
                    <button type="button" onClick={() => setShowMoreFilters((v) => !v)} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/5 border border-white/10">{showMoreFilters ? "–" : "+"}</span>
                      {t("training.exerciseLibrary.moreFilters")}
                    </button>
                    {showMoreFilters && (
                      <div className="grid grid-cols-2 gap-2">
                        <select value={filters.difficulty} onChange={(e) => setFilters((prev) => ({ ...prev, difficulty: e.target.value as any }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.levelAll")}</option>{DIFFICULTIES.map((d) => <option key={d} value={d}>{t(`training.difficulty.${d}` as any)}</option>)}</select>
                        <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as ExerciseType }))} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary"><option value="alle">{t("training.exerciseLibrary.typeAll")}</option>{EXERCISE_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto pt-2">
                {filteredExercises.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-gray-400">
                    {t("training.exerciseLibrary.empty")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredExercises.map((ex) => {
                      const isAdded = existingSet.has(ex.id) || localAddedIds.has(ex.id);
                      return (
                        <div key={ex.id} className={`flex items-center justify-between gap-3 rounded-2xl p-3 transition-colors ${isAdded ? "bg-green-500/10 border-green-500/30" : "bg-white/5 border-white/10 hover:bg-white/10"}`} role="button" tabIndex={0} onClick={() => openDetails(ex)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openDetails(ex); }}>
                          <div className="flex min-w-0 items-center gap-4"><ExerciseThumbnail exercise={ex} /><div className="min-w-0"><div className="truncate text-base font-semibold text-white">{getExerciseDisplayName(ex, lang)}</div><div className="truncate text-sm text-gray-400">{(ex.equipment || []).map((eq) => equipmentLabels[eq] ?? eq).join(", ")}{ex.type ? ` · ${typeLabels[ex.type] ?? ex.type}` : ""}</div></div></div>
                          <button type="button" disabled={isAdded} onClickCapture={(e) => { e.stopPropagation(); if (isAdded) return; handleAddExercise(ex); }} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed ${isAdded ? "bg-green-500/20 text-green-300" : "bg-brand-primary text-white hover:opacity-90"}`}>
                            {isAdded ? (<span className="inline-flex items-center gap-1.5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>{t("training.exerciseLibrary.added")}</span>) : (t("training.exerciseLibrary.add"))}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs text-center text-gray-500">{t("training.exerciseLibrary.tip")}</div>
            </div>
          </div>
          {showCreate && <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeCreate(); }}>
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3"><h3 className="text-lg font-semibold text-white">{t("training.exerciseLibrary.createTitle")}</h3><button type="button" className="text-gray-400 hover:text-white" onClick={closeCreate}>✕</button></div>
              <div className="mt-3 space-y-4">
                <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createNameLabel")}</label><input type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t("training.exerciseLibrary.createNamePlaceholder")} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary" /></div>
                <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.imageTitle")}</label><div className="mt-2 flex items-center gap-4"><div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">{createImagePreview ? <img src={createImagePreview} alt="" className="h-full w-full object-cover" /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-gray-500"><path d="M5 8h3v8H5M16 8h3v8h-3M8 10h8M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div><div className="flex flex-col gap-2"><input ref={createImageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCreateImageSelect(e.currentTarget.files?.[0] ?? null)} /><button type="button" className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20" onClick={() => createImageInputRef.current?.click()}>{t("training.exerciseLibrary.imageSelect")}</button><button type="button" className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm disabled:opacity-50 text-white hover:bg-white/20" onClick={clearCreateImage} disabled={!createImagePreview}>{t("training.exerciseLibrary.imageRemove")}</button></div></div></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createMuscleLabel")}</label><select value={createMuscle} onChange={(e) => setCreateMuscle(e.target.value as Muscle)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary">{MUSCLE_GROUPS.map((m) => <option key={m} value={m}>{muscleLabels[m]}</option>)}</select></div>
                  <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createEquipmentLabel")}</label><select value={createEquipment} onChange={(e) => setCreateEquipment(e.target.value as Equipment)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary">{EQUIPMENTS.map((eq) => <option key={eq} value={eq}>{equipmentLabels[eq]}</option>)}</select></div>
                </div>
                <div><label className="text-sm text-gray-400">{t("training.exerciseLibrary.createTypeLabel")}</label><select value={createType} onChange={(e) => setCreateType(e.target.value as ExerciseType)} className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-primary">{EXERCISE_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type]}</option>)}</select></div>
                <div><div className="text-sm text-gray-400">{t("training.exerciseLibrary.createMetricsLabel")}</div><div className="mt-2 flex flex-wrap gap-2">{METRICS.map((metric) => <button key={metric} type="button" onClick={() => toggleMetric(metric)} className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${createMetrics.includes(metric) ? 'bg-brand-primary text-white border-brand-primary' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}>{metricLabels[metric]}</button>)}</div></div>
                {createError && <div className="rounded-xl border border-red-500/30 bg-red-500/20 px-3 py-2 text-sm text-red-300">{createError}</div>}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20" onClick={closeCreate}>{t("training.exerciseLibrary.createCancel")}</button>
                  <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90" onClick={handleCreate}>{t("training.exerciseLibrary.createSave")}</button>
                </div>
              </div>
            </div>
          </div>}
          <ExerciseDetailsModal open={detailsOpen && !!selectedExercise} exercise={selectedExercise} isAdded={!!selectedExercise && (existingSet.has(selectedExercise.id) || localAddedIds.has(selectedExercise.id))} onClose={closeDetails} onAdd={handleAddExercise} />
        </motion.div>
      )
      }
    </AnimatePresence >
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
