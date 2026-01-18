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

export default function CleanReceiptStory({ model, locale }: Props) {
  const durationLabel = typeof model.durationSec === "number" ? formatDuration(model.durationSec) : "—";
  const volumeLabel = Number.isFinite(model.totalVolumeKg ?? NaN)
    ? `${Math.round(model.totalVolumeKg ?? 0)} kg`
    : "—";

  return (
    <div style={{ position: "relative", zIndex: 1, height: "100%", padding: "180px 96px 160px" }}>
      <div
        style={{
          width: "100%",
          borderRadius: 32,
          background: "rgba(248,250,252,0.96)",
          color: "#0f172a",
          padding: "40px 44px",
          boxShadow: "0 24px 80px rgba(15,23,42,0.35)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <BrandMark size="md" variant="dark" />
          <div style={{ fontSize: 12, color: "rgba(15,23,42,0.55)" }}>{model.sportLabel}</div>
        </div>

        <div style={{ marginTop: 24, fontSize: 32, fontWeight: 800 }}>{model.title}</div>
        <div style={{ marginTop: 6, fontSize: 14, color: "rgba(15,23,42,0.55)" }}>
          {locale === "de" ? "Workout Übersicht" : "Workout summary"}
        </div>

        <div style={{ marginTop: 28, display: "grid", gap: 12 }}>
          {model.topExercises.slice(0, 5).map((ex, idx) => (
            <div key={`${ex}-${idx}`} style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
              <span style={{ fontWeight: 600 }}>{ex}</span>
              <span style={{ color: "rgba(15,23,42,0.55)" }}>{idx + 1}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 30, borderTop: "1px dashed rgba(15,23,42,0.2)", paddingTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16 }}>
            <span style={{ color: "rgba(15,23,42,0.55)" }}>{locale === "de" ? "Dauer" : "Time"}</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{durationLabel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, marginTop: 8 }}>
            <span style={{ color: "rgba(15,23,42,0.55)" }}>{locale === "de" ? "Volumen" : "Volume"}</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{volumeLabel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, marginTop: 8 }}>
            <span style={{ color: "rgba(15,23,42,0.55)" }}>{locale === "de" ? "Übungen" : "Exercises"}</span>
            <span style={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{model.exercisesCount}</span>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 110, left: 96, right: 96, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, color: "rgba(226,232,240,0.6)" }}>trainq.app</div>
        <div style={{ fontSize: 16, color: "rgba(226,232,240,0.6)" }}>{locale === "de" ? "Beleg" : "Receipt"}</div>
      </div>
    </div>
  );
}
