import React from "react";
import type { WorkoutShareModel } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

function formatDateLabel(dateISO: string, locale: "de" | "en"): string {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PrPosterStory({ model, locale }: Props) {
  const dateLabel = model.dateLabel || formatDateLabel(model.dateISO, locale);
  const prCount = model.highlights?.prsCount ?? 0;
  const prItem = model.highlights?.prItems?.[0];
  const bestSet = model.spotlight?.bestSet;
  const highlight = prItem?.value ?? (bestSet ? `${bestSet.weight ?? "—"} × ${bestSet.reps ?? "—"}` : "—");

  return (
    <div style={{ position: "relative", zIndex: 1, height: "100%", padding: "180px 96px 160px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.9 }}>
        <BrandMark size="lg" variant="light" />
        <div style={{ fontSize: 13, color: "rgba(248,250,252,0.7)", letterSpacing: 1 }}>{dateLabel}</div>
      </div>

      <div style={{ marginTop: 120 }}>
        <div style={{ fontSize: 18, color: "rgba(148,163,184,0.95)", textTransform: "uppercase", letterSpacing: 3 }}>
          {model.sportLabel}
        </div>
        <div style={{ marginTop: 14, fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
          {prCount > 0 ? (locale === "de" ? "Neue PRs." : "New PRs.") : locale === "de" ? "Highlight." : "Highlight."}
        </div>
        <div style={{ marginTop: 12, fontSize: 18, color: "rgba(226,232,240,0.75)" }}>
          {model.title} · {dateLabel}
        </div>
      </div>

      <div style={{ marginTop: 70, display: "flex", alignItems: "center", gap: 28 }}>
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 36,
            background: "rgba(15,23,42,0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 72,
            fontWeight: 900,
            border: "1px solid rgba(148,163,184,0.2)",
          }}
        >
          {prCount > 0 ? prCount : "★"}
        </div>
        <div>
          <div style={{ fontSize: 18, letterSpacing: 2, textTransform: "uppercase", color: "rgba(148,163,184,0.9)" }}>
            {prCount > 0 ? (locale === "de" ? "Persönliche Rekorde" : "Personal records") : locale === "de" ? "Highlight" : "Highlight"}
          </div>
          <div style={{ marginTop: 10, fontSize: 46, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{highlight}</div>
          <div style={{ marginTop: 8, fontSize: 18, color: "rgba(226,232,240,0.7)" }}>
            {prItem?.label ?? model.spotlight?.name ?? model.title}
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 92, left: 96, right: 96, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)" }}>trainq.app</div>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)" }}>{model.title}</div>
      </div>
    </div>
  );
}
