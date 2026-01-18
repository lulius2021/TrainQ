import React from "react";
import type { WorkoutShareModel } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

export default function WatermarkOnlyStory({ model, locale }: Props) {
  const claim = locale === "de" ? "Erstellt mit TrainQ" : "Made with TrainQ";

  return (
    <div
      data-story-export-root="true"
      style={{
        width: 1080,
        height: 1920,
        position: "relative",
        background: "transparent",
        color: "#f8fafc",
        fontFamily: '"SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div style={{ position: "absolute", left: 80, bottom: 220, display: "flex", flexDirection: "column", gap: 12 }}>
        <BrandMark size="xl" variant="light" showWordmark />
        <div style={{ fontSize: 16, color: "rgba(226,232,240,0.8)" }}>{claim}</div>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.7)" }}>trainq.app</div>
      </div>
    </div>
  );
}
