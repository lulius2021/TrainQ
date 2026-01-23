import React, { useEffect, useMemo } from "react";
import type { Exercise, Muscle, Difficulty, Equipment } from "../../data/exerciseLibrary";
import { BottomSheet } from "../common/BottomSheet";
import { useExerciseImage } from "../../hooks/useExerciseImage";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  open: boolean;
  exercise: Exercise | null;
  isAdded?: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
};

type ContentProps = {
  exercise: Exercise;
  isAdded: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
};

function ExerciseDetailsContent({ exercise, isAdded, onClose, onAdd }: ContentProps) {
  const { t } = useI18n();
  const src = useExerciseImage(exercise);

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

  const difficultyLabels = useMemo<Record<Difficulty, string>>(
    () => ({
      Leicht: t("training.difficulty.Leicht"),
      Mittel: t("training.difficulty.Mittel"),
      Schwer: t("training.difficulty.Schwer"),
    }),
    [t]
  );

  const muscles = useMemo(() => {
    if (!exercise) return { primary: [] as Muscle[], secondary: [] as Muscle[] };
    if (exercise.muscles?.primary?.length) {
      return { primary: exercise.muscles.primary, secondary: exercise.muscles.secondary ?? [] };
    }
    return {
      primary: exercise.primaryMuscles ?? [],
      secondary: exercise.secondaryMuscles ?? [],
    };
  }, [exercise]);

  const cues = exercise.cues ?? [];
  const equipment = exercise.equipment ?? [];
  const difficulty = exercise.difficulty;

  const header = (
    <div className="flex items-start justify-between gap-3 px-4">
      <div className="min-w-0">
        <div className="truncate text-base font-bold" style={{ color: "var(--text)" }}>
          {exercise.name}
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
          {t("training.exerciseLibrary.detailsSubtitle")}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full border px-3 py-1 text-xs"
        style={{ background: "var(--surface2)", borderColor: "var(--border)", color: "var(--text)" }}
        aria-label={t("common.close")}
      >
        ✕
      </button>
    </div>
  );

  const footer = (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={() => {
          onAdd(exercise);
          onClose();
        }}
        disabled={isAdded}
        className="w-full rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
        style={
          isAdded
            ? { background: "rgba(16,185,129,0.18)", color: "rgba(16,185,129,0.95)", border: "1px solid rgba(16,185,129,0.35)" }
            : { background: "var(--primary)", color: "#061226" }
        }
      >
        {isAdded ? t("training.exerciseLibrary.added") : t("training.exerciseLibrary.add")}
      </button>
    </div>
  );

  return (
    <BottomSheet
      open
      onClose={onClose}
      header={header}
      footer={footer}
      height="80dvh"
      maxHeight="80dvh"
      zIndex={10020}
      sheetStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      backdropClassName="bg-[#1c1c1e]"
      variant="docked"
    >
      <div className="space-y-4 px-4 pb-4" style={{ color: "var(--text)" }}>
        <div
          className="flex h-[260px] w-full items-center justify-center overflow-hidden rounded-2xl border"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "var(--border)" }}
        >
          {src ? (
            <img src={src} alt={exercise.name} className="h-full w-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 8h3v8H5M16 8h3v8h-3M8 10h8M8 14h8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t("training.exerciseLibrary.noImage")}
            </div>
          )}
        </div>

        {(equipment.length > 0 || difficulty) && (
          <div className="flex flex-wrap gap-2">
            {equipment.map((eq: Equipment) => (
              <span
                key={eq}
                className="rounded-full border px-3 py-1 text-[10px]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                {equipmentLabels[eq] ?? eq}
              </span>
            ))}
            {difficulty && (
              <span
                className="rounded-full border px-3 py-1 text-[10px]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                {difficultyLabels[difficulty] ?? difficulty}
              </span>
            )}
          </div>
        )}

        <section>
          <div className="text-xs font-bold uppercase tracking-widest text-blue-400">
            {t("training.exerciseLibrary.cuesTitle")}
          </div>
          {cues.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--muted)" }}>
              {cues.map((cue, idx) => (
                <li key={`${cue}-${idx}`}>{cue}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {t("training.exerciseLibrary.cuesEmpty")}
            </div>
          )}
        </section>

        <section>
          <div className="text-xs font-bold uppercase tracking-widest text-blue-400">
            {t("training.exerciseLibrary.musclesTitle")}
          </div>
          {muscles.primary.length === 0 && muscles.secondary.length === 0 ? (
            <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
              {t("training.exerciseLibrary.musclesEmpty")}
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {muscles.primary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {muscles.primary.map((m) => (
                    <span
                      key={`primary-${m}`}
                      className="rounded-full border px-3 py-1 text-[10px]"
                      style={{ borderColor: "rgba(37,99,235,0.6)", color: "var(--text)" }}
                    >
                      {muscleLabels[m] ?? m}
                    </span>
                  ))}
                </div>
              )}
              {muscles.secondary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {muscles.secondary.map((m) => (
                    <span
                      key={`secondary-${m}`}
                      className="rounded-full border px-3 py-1 text-[10px]"
                      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                    >
                      {muscleLabels[m] ?? m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </BottomSheet>
  );
}

export default function ExerciseDetailsModal({ open, exercise, isAdded = false, onClose, onAdd }: Props) {
  useEffect(() => {
    if (!open || !exercise) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("modal-open");
    };
  }, [open, exercise, onClose]);

  if (!open || !exercise) return null;

  return <ExerciseDetailsContent exercise={exercise} isAdded={isAdded} onClose={onClose} onAdd={onAdd} />;
}
