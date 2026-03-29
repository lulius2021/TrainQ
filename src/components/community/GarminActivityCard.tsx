import React from "react";
import { Clock, Flame, Heart, MapPin } from "lucide-react";
import type { GarminActivityData } from "../../services/community/types";

const ACTIVITY_LABELS: Record<string, { label: string; emoji: string }> = {
  running: { label: "Laufen", emoji: "🏃" },
  cycling: { label: "Radfahren", emoji: "🚴" },
  swimming: { label: "Schwimmen", emoji: "🏊" },
  hiking: { label: "Wandern", emoji: "🥾" },
  walking: { label: "Gehen", emoji: "🚶" },
  strength_training: { label: "Krafttraining", emoji: "🏋️" },
  yoga: { label: "Yoga", emoji: "🧘" },
  elliptical: { label: "Crosstrainer", emoji: "🏃" },
  indoor_cycling: { label: "Indoor Cycling", emoji: "🚴" },
  treadmill_running: { label: "Laufband", emoji: "🏃" },
  other: { label: "Aktivität", emoji: "⚡" },
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
  const activityInfo = ACTIVITY_LABELS[data.activityType] ?? ACTIVITY_LABELS.other;
  const distance = formatDistance(data.distanceMeters);

  return (
    <div
      className="mt-3 rounded-2xl border p-4"
      style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{activityInfo.emoji}</span>
        <span className="font-semibold text-sm" style={{ color: "var(--text-color)" }}>
          {activityInfo.label}
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
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Dauer</span>
        </div>

        {distance && (
          <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
            <MapPin size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
              {distance}
            </span>
            <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Distanz</span>
          </div>
        )}

        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Flame size={14} className="mb-1" style={{ color: "var(--accent-color)" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {data.calories > 0 ? data.calories : "–"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>kcal</span>
        </div>

        <div className="flex flex-col items-center rounded-xl py-2" style={{ background: "var(--bg-color)" }}>
          <Heart size={14} className="mb-1" style={{ color: "#E63946" }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
            {data.avgHeartRate > 0 ? data.avgHeartRate : "–"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>Puls</span>
        </div>
      </div>
    </div>
  );
}
