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
      <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center", color: "#f8fafc", textShadow: "0 0 20px rgba(255,255,255,0.4)" }}>
        <BrandMark size="xl" variant="light" showWordmark />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{model.title}</div>
          <div style={{ marginTop: 6, fontSize: 16, color: "rgba(248,250,252,0.9)" }}>
            {model.dateLabel}
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 42, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{durationLabel}</div>
            <div style={{ fontSize: 13, color: "rgba(248,250,252,0.8)" }}>{locale === "de" ? "Dauer" : "Time"}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 42, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{model.exercisesCount}</div>
            <div style={{ fontSize: 13, color: "rgba(248,250,252,0.8)" }}>{locale === "de" ? "Übungen" : "Exercises"}</div>
          </div>
          {typeof model.adaptiveScore === "number" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 42, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{model.adaptiveScore}</div>
              <div style={{ fontSize: 13, color: "rgba(248,250,252,0.8)" }}>{locale === "de" ? "Score" : "Score"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
