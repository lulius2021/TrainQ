import React from "react";
import type { WorkoutShareModel } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

export default function StickerPrStory({ model, locale }: Props) {
  const prCount = model.highlights?.prsCount ?? 0;
  const prItem = model.highlights?.prItems?.[0];
  const hasPr = prCount > 0 || !!prItem;
  const label =
    prCount > 0 ? `${prCount} PR${prCount === 1 ? "" : "s"}` : prItem?.value ?? (locale === "de" ? "Highlight" : "Highlight");

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#f8fafc" }}>
        <BrandMark size="xl" variant="light" showWordmark />
        <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, letterSpacing: 4 }}>
          {hasPr ? (locale === "de" ? "NEUER PR" : "NEW PR") : locale === "de" ? "HIGHLIGHT" : "HIGHLIGHT"}
        </div>
        <div style={{ marginTop: 10, fontSize: 52, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{label}</div>
        {prItem?.label && (
          <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, color: "rgba(226,232,240,0.75)" }}>
            {prItem.label}
          </div>
        )}
      </div>
    </div>
  );
}
