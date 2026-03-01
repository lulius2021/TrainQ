import React from "react";
import type { WorkoutShareModel } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

function pickSpotlight(model: WorkoutShareModel) {
  if (model.spotlight) return model.spotlight;
  if (!model.exercises || !model.exercises.length) return undefined;
  let best = model.exercises[0];
  let bestVolume = best.volume ?? 0;
  for (const ex of model.exercises) {
    const volume = ex.volume ?? 0;
    if (volume > bestVolume) {
      best = ex;
      bestVolume = volume;
    }
  }
  return {
    name: best.name,
    imageSrc: best.imageSrc,
    bestSet: best.bestSet,
    tags: best.tags ?? [],
    muscles: best.muscles ?? [],
  };
}

export default function ExerciseSpotlightStory({ model, locale }: Props) {
  const spotlight = pickSpotlight(model);
  if (!spotlight) {
    return (
      <div style={{ position: "relative", zIndex: 1, height: "100%", padding: "160px 96px 160px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.85 }}>
          <BrandMark size="md" variant="light" />
          <div style={{ fontSize: 18, color: "rgba(248,250,252,0.75)" }}>{model.dateLabel}</div>
        </div>
        <div style={{ marginTop: 80, textAlign: "center", fontSize: 24, color: "rgba(226,232,240,0.8)" }}>
          {locale === "de" ? "Keine Übung verfügbar" : "No exercise available"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", zIndex: 1, height: "100%", padding: "160px 96px 160px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.9 }}>
        <BrandMark size="lg" variant="light" />
        <div style={{ fontSize: 13, color: "rgba(248,250,252,0.7)", letterSpacing: 1 }}>{model.dateLabel}</div>
      </div>

      <div style={{ marginTop: 70, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            width: 600,
            height: 600,
            borderRadius: 32,
            background: "rgba(15,23,42,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: "1px solid rgba(148,163,184,0.2)",
          }}
        >
          {spotlight.imageSrc ? (
            <img
              src={spotlight.imageSrc}
              alt={spotlight.name}
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ color: "rgba(148,163,184,0.8)", fontSize: 18 }}>
              {locale === "de" ? "Kein Bild verfügbar" : "No image available"}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 48, textAlign: "center" }}>
        <div style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.05 }}>{spotlight.name}</div>
        {spotlight.bestSet && (
          <div style={{ marginTop: 14, fontSize: 32, color: "rgba(226,232,240,0.85)", fontVariantNumeric: "tabular-nums" }}>
            {spotlight.bestSet.weight ?? "—"} × {spotlight.bestSet.reps ?? "—"}
          </div>
        )}
        <div style={{ marginTop: 10, fontSize: 16, color: "rgba(226,232,240,0.7)" }}>
          {model.title} · {model.sportLabel}
        </div>
      </div>

      {spotlight.tags.length > 0 && (
        <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 10 }}>
          {spotlight.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                background: "rgba(37,99,235,0.2)",
                border: "1px solid rgba(37,99,235,0.5)",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {spotlight.muscles.length > 0 && (
        <div style={{ marginTop: 30, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
          {spotlight.muscles.slice(0, 6).map((m) => (
            <span
              key={m}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.65)",
                border: "1px solid rgba(148,163,184,0.4)",
                fontSize: 15,
                color: "rgba(226,232,240,0.8)",
              }}
            >
              {m}
            </span>
          ))}
        </div>
      )}

      <div style={{ position: "absolute", bottom: 92, left: 96, right: 96, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)" }}>trainq.app</div>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)" }}>{model.title}</div>
      </div>
    </div>
  );
}
