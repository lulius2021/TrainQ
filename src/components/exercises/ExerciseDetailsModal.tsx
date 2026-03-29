import React, { useEffect, useMemo } from "react";
import type { Exercise, Muscle, Difficulty, Equipment } from "../../data/exerciseLibrary";
import { BottomSheet } from "../common/BottomSheet";
import { useExerciseImage } from "../../hooks/useExerciseImage";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  open: boolean;
  exercise: Exercise | null;
  isAdded?: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
};

type ContentProps = {
  exercise: Exercise;
  isAdded: boolean;
  readOnly?: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
};

function ExerciseDetailsContent({ exercise, isAdded, readOnly, onClose, onAdd }: ContentProps) {
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
        <div className="text-lg font-bold leading-tight" style={{ color: "var(--text-color)" }}>
          {exercise.name}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {t("training.exerciseLibrary.detailsSubtitle")}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs"
        style={{ background: "var(--button-bg)", color: "var(--text-secondary)" }}
        aria-label={t("common.close")}
      >
        ✕
      </button>
    </div>
  );

  const footer = readOnly ? undefined : (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={() => { onAdd(exercise); onClose(); }}
        disabled={isAdded}
        className="w-full rounded-2xl py-4 text-base font-bold disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        style={
          isAdded
            ? { background: "rgba(16,185,129,0.15)", color: "rgba(16,185,129,0.95)", border: "1px solid rgba(16,185,129,0.3)" }
            : { background: "var(--accent-color)", color: "#FFFFFF" }
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
      height="auto"
      maxHeight="85dvh"
      zIndex={10020}
      sheetStyle={{ background: "var(--modal-bg)", borderTop: "1px solid var(--border-color)" }}
      backdropClassName="bg-black/80"
      variant="docked"
    >
      <div className="space-y-5 px-4 pb-4" style={{ color: "var(--text-color)" }}>
        {/* Image - only show if available, compact */}
        {src && (
          <div
            className="w-full overflow-hidden rounded-2xl"
            style={{ background: "var(--button-bg)" }}
          >
            <img src={src} alt={exercise.name} className="h-48 w-full object-contain" />
          </div>
        )}

        {/* Tags: Equipment, Type, Difficulty */}
        {(equipment.length > 0 || difficulty || exercise.type) && (
          <div className="flex flex-wrap gap-2">
            {equipment.map((eq: Equipment) => (
              <span
                key={eq}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--button-bg)", color: "var(--text-color)" }}
              >
                {equipmentLabels[eq] ?? eq}
              </span>
            ))}
            {exercise.type && (
              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "rgba(0,122,255,0.12)", color: "var(--accent-color)" }}
              >
                {typeLabels[exercise.type as keyof typeof typeLabels] ?? exercise.type}
              </span>
            )}
            {difficulty && (
              <span
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ background: "var(--button-bg)", color: "var(--text-secondary)" }}
              >
                {difficultyLabels[difficulty] ?? difficulty}
              </span>
            )}
          </div>
        )}

        {/* Muscle groups */}
        {(muscles.primary.length > 0 || muscles.secondary.length > 0) && (
          <section>
            <div
              className="text-[11px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: "var(--accent-color)" }}
            >
              {t("training.exerciseLibrary.musclesTitle")}
            </div>
            <div className="space-y-2">
              {muscles.primary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {muscles.primary.map((m) => (
                    <span
                      key={`primary-${m}`}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "rgba(0,122,255,0.12)", color: "var(--accent-color)" }}
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
                      className="rounded-full px-3 py-1.5 text-xs font-medium"
                      style={{ background: "var(--button-bg)", color: "var(--text-secondary)" }}
                    >
                      {muscleLabels[m] ?? m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Cues / Tips */}
        {cues.length > 0 && (
          <section>
            <div
              className="text-[11px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: "var(--accent-color)" }}
            >
              {t("training.exerciseLibrary.cuesTitle")}
            </div>
            <div className="space-y-2">
              {cues.map((cue, idx) => (
                <div
                  key={`${cue}-${idx}`}
                  className="flex items-start gap-2.5 text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent-color)" }} />
                  {cue}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state when no muscles and no cues */}
        {muscles.primary.length === 0 && muscles.secondary.length === 0 && cues.length === 0 && (
          <div className="py-6 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            {t("training.exerciseLibrary.musclesEmpty")}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

export default function ExerciseDetailsModal({ open, exercise, isAdded = false, readOnly = false, onClose, onAdd }: Props) {
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

  return <ExerciseDetailsContent exercise={exercise} isAdded={isAdded} readOnly={readOnly} onClose={onClose} onAdd={onAdd} />;
}
