// src/components/share/WorkoutShareStoryCard.tsx
import React from "react";
import type { WorkoutShareStats } from "../../utils/workoutShare";
import { useI18n } from "../../i18n/useI18n";

type Props = {
  stats: WorkoutShareStats;
};

const WIDTH = 1080;
const HEIGHT = 1920;

export default function WorkoutShareStoryCard({ stats }: Props) {
  const { t } = useI18n();
  const volumeLabel = stats.totalVolumeKg > 0 ? `${stats.totalVolumeKg}` : t("share.workout.volumeEmpty");
  const showKg = stats.totalVolumeKg > 0;
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
      className="relative overflow-hidden text-white"
      style={{
        width: WIDTH,
        height: HEIGHT,
        padding: 80,
        borderRadius: 48,
        background:
          "radial-gradient(circle at 20% 15%, rgba(46,125,255,0.35) 0%, transparent 45%)," +
          "radial-gradient(circle at 80% 85%, rgba(0,190,170,0.25) 0%, transparent 50%)," +
          "linear-gradient(135deg, #05060a 0%, #061a3a 40%, #0a3d8f 75%, #12b5a6 115%)",
        fontFamily: "system-ui, -apple-system, 'SF Pro Text', 'SF Pro Display', sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.75 }}>{t("share.workout.title")}</div>
          <div style={{ marginTop: 12, fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>{stats.title}</div>
          <div style={{ marginTop: 12, fontSize: 28, opacity: 0.75 }}>
            {stats.dateLabel} • {stats.sport}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 40,
          }}
        >
          {[
            {
              label: t("share.workout.time"),
              value: String(stats.durationMin),
              unit: t("common.min"),
            },
            {
              label: t("share.workout.volume"),
              value: volumeLabel,
              unit: t("common.kg"),
              unitDim: !showKg,
            },
            {
              label: t("share.workout.exercises"),
              value: String(stats.totalExercises),
              unit: t("share.workout.top"),
            },
            {
              label: t("share.workout.sets"),
              value: String(stats.totalSets),
              unit: t("share.workout.total"),
            },
          ].map((card, idx) => (
            <div
              key={card.label}
              style={{
                height: 300,
                borderRadius: 32,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "28px 28px 26px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 18px 30px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ fontSize: 28, opacity: 0.75 }}>{card.label}</div>
              <div>
                <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 0.95 }}>{card.value}</div>
                {idx === 2 ? (
                  <div style={{ marginTop: 8 }}>
                    {stats.topExercises.slice(0, 3).map((name) => (
                      <div key={name} style={{ fontSize: 26, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 26, opacity: card.unitDim ? 0.45 : 0.75 }}>{card.unit}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 12 }}>
          {stats.muscleGroups.slice(0, 5).map((group) => (
            <span
              key={group}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.1)",
                fontSize: 24,
                fontWeight: 600,
                opacity: 0.85,
              }}
            >
              {formatMuscle(group)}
            </span>
          ))}
        </div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, opacity: 0.75 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(255,255,255,0.18)" }} />
            <div style={{ fontSize: 26, fontWeight: 700 }}>{t("share.workout.brand")}</div>
          </div>
          <div>{t("share.workout.handle")}</div>
        </div>
      </div>
    </div>
  );
}
