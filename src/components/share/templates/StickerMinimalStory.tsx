import React from "react";
import type { WorkoutShareModel } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

function formatDuration(totalSec?: number): string {
  const sec = Math.max(0, Math.round(totalSec ?? 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h}:${String(m).padStart(2, "0")} h`;
}

export default function StickerMinimalStory({ model, locale }: Props) {
  const durationLabel = typeof model.durationSec === "number" ? formatDuration(model.durationSec) : "—";
  const volumeLabel = Number.isFinite(model.totalVolumeKg ?? NaN)
    ? `${Math.round(model.totalVolumeKg ?? 0)} kg`
    : "—";

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", color: "#f8fafc" }}>
        <BrandMark size="xl" variant="light" showWordmark />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{model.title}</div>
          <div style={{ marginTop: 6, fontSize: 16, color: "rgba(248,250,252,0.75)" }}>
            {durationLabel} · {locale === "de" ? "Übungen" : "Exercises"} {model.exercisesCount}
          </div>
        </div>
        <div style={{ display: "flex", gap: 36, alignItems: "baseline" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 54, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{durationLabel}</div>
            <div style={{ fontSize: 14, color: "rgba(248,250,252,0.7)" }}>{locale === "de" ? "Dauer" : "Time"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 54, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{volumeLabel}</div>
            <div style={{ fontSize: 14, color: "rgba(248,250,252,0.7)" }}>{locale === "de" ? "Volumen" : "Volume"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
