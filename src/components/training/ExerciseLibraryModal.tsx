// src/components/training/ExerciseLibraryModal.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  type Muscle,
  type Equipment,
  type ExerciseType,
  type Metric,
  type Movement,
} from "../../data/exerciseLibrary";
import { addCustomExercise } from "../../utils/customExercisesStore";
import { addAliasOverride } from "../../utils/exerciseAliasesStore";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";

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

export default function ExerciseLibraryModal({
  open,
  title,
  isCardioLibrary = false,
  onClose,
  existingExerciseIds,
  onPick,
}: Props) {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState<ExerciseFilters>(defaultExerciseFilters);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const existingKey = useMemo(() => (existingExerciseIds ?? []).join("|"), [existingExerciseIds]);
  const existingSet = useMemo(() => new Set(existingExerciseIds ?? []), [existingKey]);
  const [localAddedIds, setLocalAddedIds] = useState<Set<string>>(() => new Set(existingExerciseIds ?? []));

  const [showCreate, setShowCreate] = useState(false);
  const { keyboardHeight, isOpen: keyboardOpen } = useKeyboardHeight();
  const [createName, setCreateName] = useState("");
  const [createMuscle, setCreateMuscle] = useState<Muscle>("chest");
  const [createEquipment, setCreateEquipment] = useState<Equipment>("barbell");
  const [createType, setCreateType] = useState<ExerciseType>("strength");
  const [createMetrics, setCreateMetrics] = useState<Metric[]>(DEFAULT_METRICS_BY_TYPE.strength);
  const [createError, setCreateError] = useState<string | null>(null);

  // ✅ Track last mode to reset irrelevant filter fields when switching library mode
  const lastModeRef = useRef<boolean>(isCardioLibrary);

  const muscleLabels = useMemo(
    () => ({
      chest: t("training.muscle.chest"),
      back: t("training.muscle.back"),
      lats: t("training.muscle.lats"),
      traps: t("training.muscle.traps"),
      rear_delts: t("training.muscle.rear_delts"),
      front_delts: t("training.muscle.front_delts"),
      side_delts: t("training.muscle.side_delts"),
      biceps: t("training.muscle.biceps"),
      triceps: t("training.muscle.triceps"),
      forearms: t("training.muscle.forearms"),
      quads: t("training.muscle.quads"),
      hamstrings: t("training.muscle.hamstrings"),
      glutes: t("training.muscle.glutes"),
      calves: t("training.muscle.calves"),
      core: t("training.muscle.core"),
      obliques: t("training.muscle.obliques"),
      lower_back: t("training.muscle.lower_back"),
      hip_flexors: t("training.muscle.hip_flexors"),
    }),
    [t]
  );

  const equipmentLabels = useMemo(
    () => ({
      barbell: t("training.equipment.barbell"),
      dumbbell: t("training.equipment.dumbbell"),
      kettlebell: t("training.equipment.kettlebell"),
      machine: t("training.equipment.machine"),
      cable: t("training.equipment.cable"),
      band: t("training.equipment.band"),
      bodyweight: t("training.equipment.bodyweight"),
      bench: t("training.equipment.bench"),
      rack: t("training.equipment.rack"),
      pullup_bar: t("training.equipment.pullup_bar"),
      dip_bar: t("training.equipment.dip_bar"),
      smith_machine: t("training.equipment.smith_machine"),
      trap_bar: t("training.equipment.trap_bar"),
      medicine_ball: t("training.equipment.medicine_ball"),
      cardio_machine: t("training.equipment.cardio_machine"),
    }),
    [t]
  );

  const typeLabels = useMemo(
    () => ({
      strength: t("training.exerciseType.strength"),
      hypertrophy: t("training.exerciseType.hypertrophy"),
      calisthenics: t("training.exerciseType.calisthenics"),
      conditioning: t("training.exerciseType.conditioning"),
      mobility: t("training.exerciseType.mobility"),
    }),
    [t]
  );

  const metricLabels = useMemo(
    () => ({
      weight: t("training.metric.weight"),
      reps: t("training.metric.reps"),
      time: t("training.metric.time"),
      distance: t("training.metric.distance"),
      pace: t("training.metric.pace"),
      rpe: t("training.metric.rpe"),
    }),
    [t]
  );

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

  useEffect(() => {
    if (!open) return;
    setLocalAddedIds(new Set(existingExerciseIds ?? []));
  }, [open, existingExerciseIds]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const scrollY = window.scrollY || window.pageYOffset;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    setCreateMetrics(DEFAULT_METRICS_BY_TYPE[createType]);
  }, [createType]);

  const filteredExercises = useMemo(() => {
    if (isCardioLibrary) {
      return cardioFilter(CARDIO_EXERCISES, filters.search, lang);
    }
    return filterExercises(EXERCISES, filters);
  }, [filters, isCardioLibrary, lang]);

  if (!open) return null;

  const headerTitle = "Übungsbibliothek";
  const headerSub = "Übung auswählen";

  const surfaceBox: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" };
  const surfaceSoft: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  const openCreate = () => {
    setCreateName("");
    setCreateMuscle("chest");
    setCreateEquipment("barbell");
    setCreateType("strength");
    setCreateMetrics(DEFAULT_METRICS_BY_TYPE.strength);
    setCreateError(null);
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    setCreateError(null);
  };

  const toggleMetric = (metric: Metric) => {
    setCreateMetrics((prev) => {
      if (prev.includes(metric)) return prev.filter((m) => m !== metric);
      return [...prev, metric];
    });
  };

  const handleCreate = () => {
    const name = createName.trim();
    if (!name) {
      setCreateError(t("training.exerciseLibrary.createEmptyName"));
      return;
    }

    const matched = findExerciseByToken(name);
    if (matched) {
      addAliasOverride(matched.id, lang, name);
      refreshExerciseLibrary();
      onPick({ ...matched, name: getExerciseDisplayName(matched, lang) });
      closeCreate();
      return;
    }

    const movement = inferMovement(createMuscle);
    const metrics = createMetrics.length ? createMetrics : DEFAULT_METRICS_BY_TYPE[createType];

    const created = addCustomExercise({
      name,
      lang,
      primaryMuscles: [createMuscle],
      equipment: [createEquipment],
      movement,
      type: createType,
      metrics,
    });

    refreshExerciseLibrary();
    onPick({ ...created, name: getExerciseDisplayName(created, lang) });
    closeCreate();
  };

  const modal = (
    <div
      className={`fixed inset-0 z-[10000] flex ${keyboardOpen ? "items-start" : "items-center"} justify-center bg-black/80 backdrop-blur-sm px-4`}
      style={
        keyboardOpen
          ? {
              paddingTop: "max(env(safe-area-inset-top), 12px)",
              paddingBottom: `calc(${Math.max(0, keyboardHeight)}px + env(safe-area-inset-bottom))`,
            }
          : undefined
      }
      data-overlay-open="true"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={headerTitle}
    >
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl text-xs shadow-xl" style={{ ...surfaceBox, maxHeight: keyboardOpen ? `calc(100dvh - ${Math.max(120, keyboardHeight + 120)}px)` : "85vh" }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>
              {headerTitle}
            </div>
            <div className="truncate text-[11px]" style={muted}>
              {headerSub}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border px-3 py-1.5 text-[11px] hover:opacity-95"
              style={{ ...surfaceSoft, color: "var(--text)" }}
            >
              {t("common.close")}
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
                    placeholder={
                      isCardioLibrary ? t("training.exerciseLibrary.searchCardio") : t("training.exerciseLibrary.searchGym")
                    }
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
                  onClick={openCreate}
                  className="shrink-0 rounded-xl border px-3 py-2 text-[11px] hover:opacity-95"
                  style={{ ...surfaceSoft, color: "var(--text)" }}
                >
                  {t("training.exerciseLibrary.addCustom")}
                </button>
              )}
            </div>

            {!isCardioLibrary && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filters.muscle}
                    onChange={(e) => setFilters((prev) => ({ ...prev, muscle: e.target.value as Muscle }))}
                    className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                    style={{ ...surfaceSoft, color: "var(--text)" }}
                  >
                    <option value="alle">{t("training.exerciseLibrary.muscleAll")}</option>
                    {MUSCLE_GROUPS.map((m) => (
                      <option key={m} value={m}>
                        {muscleLabels[m]}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filters.equipment}
                    onChange={(e) => setFilters((prev) => ({ ...prev, equipment: e.target.value as Equipment }))}
                    className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                    style={{ ...surfaceSoft, color: "var(--text)" }}
                  >
                    <option value="alle">{t("training.exerciseLibrary.equipmentAll")}</option>
                    {EQUIPMENTS.map((eq) => (
                      <option key={eq} value={eq}>
                        {equipmentLabels[eq]}
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
                  {t("training.exerciseLibrary.moreFilters")}
                </button>

                {showMoreFilters && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filters.difficulty}
                      onChange={(e) => setFilters((prev) => ({ ...prev, difficulty: e.target.value as any }))}
                      className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                      style={{ ...surfaceSoft, color: "var(--text)" }}
                    >
                      <option value="alle">{t("training.exerciseLibrary.levelAll")}</option>
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {t(`training.difficulty.${d}` as any)}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filters.type}
                      onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value as ExerciseType }))}
                      className="w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                      style={{ ...surfaceSoft, color: "var(--text)" }}
                    >
                      <option value="alle">{t("training.exerciseLibrary.typeAll")}</option>
                      {EXERCISE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {typeLabels[type]}
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
                {t("training.exerciseLibrary.empty")}
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
                          {getExerciseDisplayName(ex, lang)}
                        </div>
                        <div className="truncate text-[11px]" style={muted}>
                          {(ex.equipment || []).map((eq) => equipmentLabels[eq] ?? eq).join(", ")}
                          {ex.type ? ` · ${typeLabels[ex.type] ?? ex.type}` : ""}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => {
                          if (isAdded) return;
                          onPick({ ...ex, name: getExerciseDisplayName(ex, lang) });
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
                              <path
                                d="m6 12 4 4 8-8"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {t("training.exerciseLibrary.added")}
                          </span>
                        ) : (
                          t("training.exerciseLibrary.add")
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 text-[10px]" style={muted}>
            {t("training.exerciseLibrary.tip")}
          </div>
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeCreate();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border p-4 shadow-xl" style={surfaceBox}>
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {t("training.exerciseLibrary.createTitle")}
              </div>
              <button
                type="button"
                className="rounded-xl border px-3 py-1 text-[11px]"
                style={{ ...surfaceSoft, color: "var(--text)" }}
                onClick={closeCreate}
              >
                {t("training.exerciseLibrary.createCancel")}
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label className="text-[11px]" style={muted}>
                  {t("training.exerciseLibrary.createNameLabel")}
                </label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t("training.exerciseLibrary.createNamePlaceholder")}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-[12px] outline-none"
                  style={{ ...surfaceSoft, color: "var(--text)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px]" style={muted}>
                    {t("training.exerciseLibrary.createMuscleLabel")}
                  </label>
                  <select
                    value={createMuscle}
                    onChange={(e) => setCreateMuscle(e.target.value as Muscle)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                    style={{ ...surfaceSoft, color: "var(--text)" }}
                  >
                    {MUSCLE_GROUPS.map((m) => (
                      <option key={m} value={m}>
                        {muscleLabels[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px]" style={muted}>
                    {t("training.exerciseLibrary.createEquipmentLabel")}
                  </label>
                  <select
                    value={createEquipment}
                    onChange={(e) => setCreateEquipment(e.target.value as Equipment)}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                    style={{ ...surfaceSoft, color: "var(--text)" }}
                  >
                    {EQUIPMENTS.map((eq) => (
                      <option key={eq} value={eq}>
                        {equipmentLabels[eq]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px]" style={muted}>
                  {t("training.exerciseLibrary.createTypeLabel")}
                </label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value as ExerciseType)}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-[11px] outline-none"
                  style={{ ...surfaceSoft, color: "var(--text)" }}
                >
                  {EXERCISE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[11px]" style={muted}>
                  {t("training.exerciseLibrary.createMetricsLabel")}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {METRICS.map((metric) => {
                    const active = createMetrics.includes(metric);
                    return (
                      <button
                        key={metric}
                        type="button"
                        onClick={() => toggleMetric(metric)}
                        className="rounded-full border px-3 py-1 text-[11px]"
                        style={
                          active
                            ? { background: "var(--primary)", color: "#061226", borderColor: "var(--primary)" }
                            : { ...surfaceSoft, color: "var(--text)" }
                        }
                      >
                        {metricLabels[metric]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {createError && (
                <div className="rounded-xl border px-3 py-2 text-[11px]" style={{ ...surfaceSoft, color: "#ef4444" }}>
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-[11px]"
                  style={{ ...surfaceSoft, color: "var(--text)" }}
                  onClick={closeCreate}
                >
                  {t("training.exerciseLibrary.createCancel")}
                </button>
                <button
                  type="button"
                  className="rounded-xl px-3 py-2 text-[11px] font-semibold"
                  style={{ background: "var(--primary)", color: "#061226" }}
                  onClick={handleCreate}
                >
                  {t("training.exerciseLibrary.createSave")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
