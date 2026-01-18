import React from "react";
import type { WorkoutShareModel } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

export default function StickerExerciseStory({ model, locale }: Props) {
  const spotlight = model.spotlight;
  const bestSet = spotlight?.bestSet;
  const name = spotlight?.name ?? (locale === "de" ? "Übung" : "Exercise");

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#f8fafc" }}>
        <BrandMark size="xl" variant="light" showWordmark />
        <div style={{ marginTop: 10, fontSize: 36, fontWeight: 800 }}>{name}</div>
        {bestSet && (
          <div style={{ marginTop: 10, fontSize: 28, fontVariantNumeric: "tabular-nums" }}>
            {bestSet.weight ?? "—"} × {bestSet.reps ?? "—"}
          </div>
        )}
        {spotlight?.tags?.length ? (
          <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {spotlight.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(248,250,252,0.7)",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 12, fontSize: 14, color: "rgba(226,232,240,0.75)" }}>
            {locale === "de" ? "Keine Tags" : "No tags"}
          </div>
        )}
      </div>
    </div>
  );
}
