// src/components/share/WorkoutShareSticker.tsx
import React from "react";
import type { WorkoutShareStats } from "../../utils/workoutShare";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  stats: WorkoutShareStats;
};

const SIZE = 1024;

export default function WorkoutShareSticker({ stats }: Props) {
  const { t } = useI18n();
  const volumeLabel = stats.totalVolumeKg > 0 ? `${stats.totalVolumeKg} kg` : t("share.workout.volumeEmpty");
  const muscleLabels: Record<string, string> = {
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
  };
  const formatMuscle = (group: string) => muscleLabels[group] ?? group;

  return (
    <div
      className="relative text-white"
      style={{
        width: SIZE,
        height: SIZE,
        background: "transparent",
        fontFamily: "'SF Pro Display', 'SF Pro Text', system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        className="absolute inset-0 rounded-[80px]"
        style={{
          background: "rgba(12,18,35,0.92)",
          border: "2px solid rgba(255,255,255,0.08)",
        }}
      />

      <div className="relative z-10 flex h-full w-full flex-col px-[64px] py-[72px]">
        <div className="text-[22px] font-semibold text-white/70">{t("share.workout.title")}</div>
        <div className="mt-3 text-[46px] font-bold leading-[1.05]">{stats.title}</div>
        <div className="mt-2 text-[22px] text-white/60">
          {stats.dateLabel} • {stats.sport}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-6 text-[22px]">
          <div className="rounded-3xl bg-white/10 px-5 py-4">
            <div className="text-white/60 text-[18px]">{t("share.workout.time")}</div>
            <div className="mt-2 text-[34px] font-bold">{stats.durationMin} {t("common.min")}</div>
          </div>
          <div className="rounded-3xl bg-white/10 px-5 py-4">
            <div className="text-white/60 text-[18px]">{t("share.workout.volume")}</div>
            <div className="mt-2 text-[34px] font-bold">{volumeLabel}</div>
          </div>
          <div className="rounded-3xl bg-white/10 px-5 py-4">
            <div className="text-white/60 text-[18px]">{t("share.workout.exercises")}</div>
            <div className="mt-2 text-[34px] font-bold">{stats.totalExercises}</div>
          </div>
          <div className="rounded-3xl bg-white/10 px-5 py-4">
            <div className="text-white/60 text-[18px]">{t("share.workout.sets")}</div>
            <div className="mt-2 text-[34px] font-bold">{stats.totalSets}</div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {stats.muscleGroups.map((group) => (
            <span key={group} className="rounded-full bg-white/12 px-4 py-2 text-[18px] text-white/80">
              {formatMuscle(group)}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between text-[20px] text-white/60">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/15" />
            <span className="font-semibold text-white/80">{t("share.workout.brand")}</span>
          </div>
          <span>{t("share.workout.handle")}</span>
        </div>
      </div>
    </div>
  );
}
