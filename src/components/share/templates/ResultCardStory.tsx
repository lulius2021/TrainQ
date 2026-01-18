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

export default function ResultCardStory({ model, locale }: Props) {
  const dateLabel = model.dateLabel;
  const durationLabel = typeof model.durationSec === "number" ? formatDuration(model.durationSec) : "—";
  const isGym = model.sportType.toLowerCase() === "gym";
  const volumeLabel = Number.isFinite(model.totalVolumeKg ?? NaN)
    ? `${Math.round(model.totalVolumeKg ?? 0)} kg`
    : "—";
  const distanceLabel = Number.isFinite(model.distanceKm ?? NaN)
    ? `${Math.round((model.distanceKm ?? 0) * 10) / 10} km`
    : "—";
  const topExercises = model.topExercises.slice(0, 3);
  const prsCount = model.highlights?.prsCount;
  const prItem = model.highlights?.prItems?.[0];
  const bestSet = model.spotlight?.bestSet;
  const highlightLabel =
    prsCount && prsCount > 0
      ? locale === "de"
        ? "🔥 NEUER PR"
        : "🔥 NEW PR"
      : locale === "de"
        ? "Best set"
        : "Best set";
  const highlightValue = prItem?.value ?? (bestSet ? `${bestSet.weight ?? "—"} × ${bestSet.reps ?? "—"}` : "—");
  const highlightSub = prItem?.label ?? model.spotlight?.name ?? model.title;

  return (
    <div style={{ position: "relative", zIndex: 1, height: "100%", padding: "150px 96px 140px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.9 }}>
        <BrandMark size="xl" variant="light" />
        <div style={{ fontSize: 13, color: "rgba(248,250,252,0.7)", letterSpacing: 1 }}>{dateLabel}</div>
      </div>

      <div style={{ marginTop: 90 }}>
        <div style={{ fontSize: 18, color: "rgba(148,163,184,0.95)", textTransform: "uppercase", letterSpacing: 3 }}>
          {model.sportLabel}
        </div>
        <div style={{ marginTop: 14, fontSize: 70, fontWeight: 900, lineHeight: 1.02 }}>
          {locale === "de" ? "Training erledigt." : "Workout complete."}
        </div>
        <div style={{ marginTop: 10, fontSize: 20, color: "rgba(226,232,240,0.78)" }}>
          {model.title} · {model.sportLabel} · {durationLabel}
        </div>
        <div style={{ marginTop: 10, fontSize: 20, color: "rgba(226,232,240,0.8)" }}>
          {prsCount && prsCount > 0 ? `${highlightLabel} · ${highlightSub} · ${highlightValue}` : isGym ? `${locale === "de" ? "Volumen" : "Volume"} · ${volumeLabel}` : `${locale === "de" ? "Distanz" : "Distance"} · ${distanceLabel}`}
        </div>
      </div>

      <div
        style={{
          marginTop: 70,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 20,
        }}
      >
        <div
          style={{
            padding: "24px 22px",
            borderRadius: 30,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 0 18px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>{locale === "de" ? "Dauer" : "Time"}</div>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {durationLabel}
          </div>
        </div>
        <div
          style={{
            padding: "24px 22px",
            borderRadius: 30,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 0 18px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>
            {isGym ? (locale === "de" ? "Volumen" : "Volume") : locale === "de" ? "Distanz" : "Distance"}
          </div>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {isGym ? volumeLabel : distanceLabel}
          </div>
        </div>
        <div
          style={{
            padding: "24px 22px",
            borderRadius: 30,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 0 18px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>{locale === "de" ? "Sätze" : "Sets"}</div>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {model.setsCount}
          </div>
        </div>
        <div
          style={{
            padding: "24px 22px",
            borderRadius: 30,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "inset 0 0 18px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>{locale === "de" ? "Übungen" : "Exercises"}</div>
          <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {model.exercisesCount}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          padding: "22px 26px",
          borderRadius: 30,
          background: prsCount && prsCount > 0 ? "linear-gradient(135deg, rgba(234,179,8,0.24), rgba(37,99,235,0.2))" : "rgba(255,255,255,0.06)",
          border: prsCount && prsCount > 0 ? "1px solid rgba(234,179,8,0.75)" : "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div style={{ fontSize: 14, letterSpacing: 2, textTransform: "uppercase", color: "rgba(226,232,240,0.9)" }}>
          {highlightLabel}
        </div>
        <div style={{ marginTop: 10, fontSize: 52, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{highlightValue}</div>
        <div style={{ marginTop: 6, fontSize: 18, color: "rgba(226,232,240,0.75)" }}>{highlightSub}</div>
      </div>

      {topExercises.length > 0 && (
        <div style={{ marginTop: 38 }}>
          <div style={{ fontSize: 16, letterSpacing: 2, textTransform: "uppercase", color: "rgba(148,163,184,0.9)" }}>
            {locale === "de" ? "Top Übungen" : "Top exercises"}
          </div>
          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {topExercises.map((ex, idx) => (
              <div
                key={`${ex}-${idx}`}
                style={{
                  padding: "16px 20px",
                  borderRadius: 18,
                  background: "rgba(15,23,42,0.65)",
                  fontSize: 20,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {ex}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 92, left: 96, right: 96, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "rgba(226,232,240,0.65)" }} />
          TrainQ
        </div>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)" }}>trainq.app</div>
      </div>
    </div>
  );
}
