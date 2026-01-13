// src/components/training/TrainingSummary.tsx
import React from "react";
import type { TrainingMode, TrainingStats } from "../../lib/trainingLogic";
import { useI18n } from "../../i18n/useI18n";

interface TrainingSummaryProps {
  stats: TrainingStats;
  compact?: boolean;
}

export const TrainingSummary: React.FC<TrainingSummaryProps> = ({
  stats,
  compact = false,
}) => {
  const { t } = useI18n();
  const hours = Math.floor(stats.totalMinutes / 60);
  const minutes = stats.totalMinutes % 60;
  const modeLabel = t(`training.mode.${stats.mode}`);

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-100">
          {modeLabel}
        </span>
        <span className="text-[10px] text-white/60">
          {t(stats.totalSessions === 1 ? "training.summary.sessionsOne" : "training.summary.sessionsOther", {
            count: stats.totalSessions,
          })}
        </span>
      </div>

      <div
        className={
          "grid gap-2 " + (compact ? "grid-cols-2" : "grid-cols-3 md:grid-cols-3")
        }
      >
        <div className="flex flex-col">
          <span className="text-[10px] text-white/50">{t("training.summary.time")}</span>
          <span className="text-sm font-semibold text-slate-100">
            {t("training.summary.timeValue", { hours, minutes })}
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] text-white/50">{t("training.summary.sessionsLabel")}</span>
          <span className="text-sm font-semibold text-slate-100">
            {stats.totalSessions}
          </span>
        </div>

        {(stats.mode === "running" || stats.mode === "cycling") && (
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50">{t("training.summary.distance")}</span>
            <span className="text-sm font-semibold text-slate-100">
              {t("training.summary.distanceValue", { value: stats.totalDistanceKm.toFixed(1) })}
            </span>
          </div>
        )}

        {stats.mode === "gym" && !compact && (
          <div className="flex flex-col">
            <span className="text-[10px] text-white/50">{t("training.summary.focus")}</span>
            <span className="text-[11px] text-slate-200">{t("training.summary.focusValue")}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingSummary;
