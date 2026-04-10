import React from "react";
import { Clock, Flame, Heart, MapPin } from "lucide-react";
import type { GarminActivityData } from "../../services/community/types";
import { useI18n } from "../../i18n/useI18n";

const ACTIVITY_EMOJIS: Record<string, string> = {
  running: "🏃",
  cycling: "🚴",
  swimming: "🏊",
  hiking: "🥾",
  walking: "🚶",
  strength_training: "🏋️",
  yoga: "🧘",
  elliptical: "🏃",
  indoor_cycling: "🚴",
  treadmill_running: "🏃",
  other: "⚡",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatDistance(meters: number): string {
  if (meters <= 0) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

interface Props {
  data: GarminActivityData;
}

export default function GarminActivityCard({ data }: Props) {
  const { t } = useI18n();
  const activityKey = `community.garmin.activity.${data.activityType}` as const;
  const activityLabel = t(activityKey) !== activityKey ? t(activityKey) : t("community.garmin.activity.other");
  const activityEmoji = ACTIVITY_EMOJIS[data.activityType] ?? ACTIVITY_EMOJIS.other;
  const distance = formatDistance(data.distanceMeters);

  return (
    <div
      className="mt-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{activityEmoji}</span>
        <span className="font-semibold text-sm" style={{ color: "var(--text-color)" }}>
          {activityLabel}
        </span>
        <span
          className="text-[10px] ml-auto px-2 py-0.5 rounded-full font-medium"
          style={{ background: "rgba(0,200,83,0.15)", color: "#00c853" }}
        >
          Garmin
        </span>
      </div>

      {/* Stats grid */}
      <div className={`grid gap-3 mb-1 ${distance ? "grid-cols-4" : "grid-cols-3"}`}>
        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Clock size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {formatDuration(data.durationSeconds)}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{t("community.garmin.duration")}</span>
        </div>

        {distance && (
          <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
            <MapPin size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
              {distance}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{t("community.garmin.distance")}</span>
          </div>
        )}

        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Flame size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {data.calories > 0 ? data.calories : "–"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{t("community.garmin.calories")}</span>
        </div>

        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Heart size={14} className="mb-1" style={{ color: "#E63946" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {data.avgHeartRate > 0 ? data.avgHeartRate : "–"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{t("community.garmin.heartRate")}</span>
        </div>
      </div>
    </div>
  );
}
