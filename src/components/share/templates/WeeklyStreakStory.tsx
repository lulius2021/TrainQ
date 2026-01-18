import React from "react";
import type { WorkoutShareModel } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

function formatDay(date: Date, locale: "de" | "en"): string {
  return date.toLocaleDateString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "short",
  });
}

function getWeekRange(dateISO: string): { start: Date; end: Date } {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    return { start: now, end: now };
  }
  const day = (d.getDay() + 6) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function formatDuration(totalSec?: number): string {
  const sec = Math.max(0, Math.round(totalSec ?? 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h <= 0) return `${m} min`;
  return `${h}:${String(m).padStart(2, "0")} h`;
}

export default function WeeklyStreakStory({ model, locale }: Props) {
  const { start, end } = getWeekRange(model.dateISO);
  const rangeLabel = `${formatDay(start, locale)} – ${formatDay(end, locale)}`;
  const durationLabel = typeof model.durationSec === "number" ? formatDuration(model.durationSec) : "—";

  return (
    <div style={{ position: "relative", zIndex: 1, height: "100%", padding: "180px 96px 160px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: 0.9 }}>
        <BrandMark size="lg" variant="light" />
        <div style={{ fontSize: 13, color: "rgba(248,250,252,0.7)", letterSpacing: 1 }}>{rangeLabel}</div>
      </div>

      <div style={{ marginTop: 120 }}>
        <div style={{ fontSize: 18, color: "rgba(148,163,184,0.95)", textTransform: "uppercase", letterSpacing: 3 }}>
          {locale === "de" ? "Diese Woche" : "This week"}
        </div>
        <div style={{ marginTop: 14, fontSize: 64, fontWeight: 900, lineHeight: 1.05 }}>
          {locale === "de" ? "Streak gesetzt." : "Streak locked."}
        </div>
        <div style={{ marginTop: 12, fontSize: 18, color: "rgba(226,232,240,0.75)" }}>
          {model.title} · {rangeLabel}
        </div>
      </div>

      <div style={{ marginTop: 70, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18 }}>
        <div style={{ padding: "24px 22px", borderRadius: 26, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.2)" }}>
          <div style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>{locale === "de" ? "Dauer" : "Time"}</div>
          <div style={{ fontSize: 50, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{durationLabel}</div>
        </div>
        <div style={{ padding: "24px 22px", borderRadius: 26, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.2)" }}>
          <div style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>{locale === "de" ? "Übungen" : "Exercises"}</div>
          <div style={{ fontSize: 50, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{model.exercisesCount}</div>
        </div>
        <div style={{ padding: "24px 22px", borderRadius: 26, background: "rgba(15,23,42,0.78)", border: "1px solid rgba(148,163,184,0.2)" }}>
          <div style={{ fontSize: 14, color: "rgba(148,163,184,0.9)" }}>{locale === "de" ? "Sätze" : "Sets"}</div>
          <div style={{ fontSize: 50, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{model.setsCount}</div>
        </div>
      </div>

      <div style={{ marginTop: 70 }}>
        <div style={{ fontSize: 16, letterSpacing: 2, textTransform: "uppercase", color: "rgba(148,163,184,0.9)" }}>
          {locale === "de" ? "Top Übungen" : "Top exercises"}
        </div>
        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {model.topExercises.slice(0, 3).map((ex, idx) => (
            <div
              key={`${ex}-${idx}`}
              style={{
                padding: "16px 20px",
                borderRadius: 18,
                background: "rgba(15,23,42,0.65)",
                fontSize: 22,
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

      <div style={{ position: "absolute", bottom: 92, left: 96, right: 96, display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)" }}>trainq.app</div>
        <div style={{ fontSize: 14, color: "rgba(226,232,240,0.6)" }}>{model.sportLabel}</div>
      </div>
    </div>
  );
}
