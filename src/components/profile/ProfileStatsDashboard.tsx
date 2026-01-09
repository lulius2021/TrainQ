// src/components/profile/ProfileStatsDashboard.tsx
import React, { useMemo, useState, useEffect } from "react";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import {
  computeAllTimeE1RMPR,
  computeBestE1RMByDay,
  computeBestE1RMInRange,
  computeLoadByWeek,
  computeStreaks,
  computeTrainingDays,
  computeVolumeByDay,
  computeVolumeByWeek,
  computeWeeklyTrainingDays,
  getWorkoutsForRange,
  listExercises,
  sumVolume,
  type DailyValue,
  type WeeklyValue,
} from "../../utils/stats";

type RangePreset = "7d" | "4w" | "12w" | "custom";
type StatsTab = "overview" | "strength" | "volume" | "load";

type Props = {
  workouts: WorkoutHistoryEntry[];
  weeklyGoalMinutes?: number;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(dateStr: string): Date {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return new Date();
  return d;
}

function clampRange(from: Date, to: Date): { from: Date; to: Date } {
  const f = new Date(from);
  const t = new Date(to);
  if (f.getTime() > t.getTime()) return { from: t, to: f };
  return { from: f, to: t };
}

function formatShortDate(iso: string): string {
  const d = parseISO(`${iso}T00:00:00`);
  return `${d.getDate()}.${d.getMonth() + 1}.`;
}

function formatWeekLabel(weekStartISO: string): string {
  const d = parseISO(`${weekStartISO}T00:00:00`);
  return `W${Math.ceil(d.getDate() / 7)}`;
}

function useRangeState() {
  const today = new Date();
  const [preset, setPreset] = useState<RangePreset>("4w");
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const from = new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000);
    return toISODate(from);
  });
  const [customTo, setCustomTo] = useState<string>(() => toISODate(today));

  const range = useMemo(() => {
    const end = new Date();
    let start: Date;
    if (preset === "7d") {
      start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { from: start, to: end };
    }
    if (preset === "12w") {
      start = new Date(end.getTime() - 83 * 24 * 60 * 60 * 1000);
      return { from: start, to: end };
    }
    if (preset === "custom") {
      const f = parseISO(`${customFrom}T00:00:00`);
      const t = parseISO(`${customTo}T23:59:59`);
      return clampRange(f, t);
    }
    start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);
    return { from: start, to: end };
  }, [preset, customFrom, customTo]);

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range };
}

function BarChart({
  series,
  labelFormatter,
}: {
  series: DailyValue[] | WeeklyValue[];
  labelFormatter: (label: string) => string;
}) {
  const max = Math.max(1, ...series.map((s) => s.value));

  return (
    <div className="h-32 flex items-end gap-2">
      {series.map((s) => {
        const label = "date" in s ? s.date : s.weekStart;
        const height = Math.max(4, (s.value / max) * 100);
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-full border"
              style={{ background: "rgba(127,127,127,0.12)", borderColor: "var(--border)" }}
            >
              <div
                className="w-full rounded-full"
                style={{
                  height: `${height}%`,
                  background: "var(--primary)",
                }}
              />
            </div>
            <span className="text-[9px]" style={{ color: "var(--muted)" }}>
              {labelFormatter(label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ series }: { series: DailyValue[] }) {
  if (series.length === 0) {
    return (
      <div className="h-28 flex items-center justify-center text-[11px]" style={{ color: "var(--muted)" }}>
        Keine Daten im Zeitraum.
      </div>
    );
  }

  const values = series.map((s) => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = series.map((s, idx) => {
    const x = series.length === 1 ? 50 : (idx / (series.length - 1)) * 100;
    const y = 100 - ((s.value - min) / range) * 100;
    return `${x},${y}`;
  });

  const last = series[series.length - 1];
  const lastX = series.length === 1 ? 50 : 100;
  const lastY = 100 - ((last.value - min) / range) * 100;

  return (
    <div className="h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <polyline fill="none" stroke="var(--primary)" strokeWidth="2" points={points.join(" ")} />
        <circle cx={lastX} cy={lastY} r="2.5" fill="var(--primary)" />
      </svg>
    </div>
  );
}

export default function ProfileStatsDashboard(props: Props) {
  const { workouts, weeklyGoalMinutes = 0 } = props;
  const { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range } = useRangeState();
  const [tab, setTab] = useState<StatsTab>("overview");

  const workoutsInRange = useMemo(
    () => getWorkoutsForRange(undefined, range.from, range.to, workouts),
    [range.from, range.to, workouts]
  );

  const allExercises = useMemo(() => listExercises(workoutsInRange), [workoutsInRange]);
  const [selectedExercise, setSelectedExercise] = useState<string>("");

  useEffect(() => {
    if (selectedExercise && allExercises.includes(selectedExercise)) return;
    setSelectedExercise(allExercises[0] || "");
  }, [allExercises, selectedExercise]);

  const volumeByDay = useMemo(() => computeVolumeByDay(workoutsInRange), [workoutsInRange]);
  const volumeByWeek = useMemo(() => computeVolumeByWeek(workoutsInRange), [workoutsInRange]);
  const totalVolume = useMemo(() => sumVolume(workoutsInRange), [workoutsInRange]);

  const bestE1RMSeries = useMemo(
    () => (selectedExercise ? computeBestE1RMByDay(workoutsInRange, selectedExercise) : []),
    [workoutsInRange, selectedExercise]
  );
  const allTimePR = useMemo(() => computeAllTimeE1RMPR(workouts), [workouts]);

  const progressionDelta = useMemo(() => {
    if (!selectedExercise) return 0;
    const end = range.to;
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    const prevStart = new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const currentBest = computeBestE1RMInRange(workoutsInRange, selectedExercise, start, end);
    const prevBest = computeBestE1RMInRange(workoutsInRange, selectedExercise, prevStart, prevEnd);
    if (prevBest <= 0) return 0;
    return ((currentBest - prevBest) / prevBest) * 100;
  }, [workoutsInRange, selectedExercise, range.to]);

  const trainingDays = useMemo(() => computeTrainingDays(workoutsInRange), [workoutsInRange]);
  const streaks = useMemo(() => computeStreaks(workouts), [workouts]);
  const weeklyTrainingDays = useMemo(() => computeWeeklyTrainingDays(workoutsInRange), [workoutsInRange]);

  const loadByWeek = useMemo(() => computeLoadByWeek(workoutsInRange), [workoutsInRange]);
  const lastWeekLoad = loadByWeek.length >= 2 ? loadByWeek[loadByWeek.length - 2].value : 0;
  const thisWeekLoad = loadByWeek.length ? loadByWeek[loadByWeek.length - 1].value : 0;
  const loadDeltaPct = lastWeekLoad > 0 ? ((thisWeekLoad - lastWeekLoad) / lastWeekLoad) * 100 : 0;

  const loadStatus =
    lastWeekLoad === 0
      ? "neutral"
      : Math.abs(loadDeltaPct) <= 20
      ? "green"
      : Math.abs(loadDeltaPct) <= 40
      ? "yellow"
      : "red";

  const loadBadgeStyle =
    loadStatus === "green"
      ? { background: "rgba(34,197,94,0.15)", color: "rgba(34,197,94,0.9)" }
      : loadStatus === "yellow"
      ? { background: "rgba(234,179,8,0.18)", color: "rgba(234,179,8,0.95)" }
      : loadStatus === "red"
      ? { background: "rgba(239,68,68,0.15)", color: "rgba(239,68,68,0.95)" }
      : { background: "rgba(127,127,127,0.12)", color: "var(--muted)" };

  const hasSrpeData = loadByWeek.some((w) => w.value > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["7d", "4w", "12w", "custom"] as RangePreset[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setPreset(k)}
            className="rounded-full px-3 py-1.5 text-[11px] font-medium"
            style={
              preset === k
                ? { background: "var(--primary)", color: "#061226" }
                : { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }
            }
          >
            {k === "7d" ? "7 Tage" : k === "4w" ? "4 Wochen" : k === "12w" ? "12 Wochen" : "Custom"}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text)" }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg px-2 py-1"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <span style={{ color: "var(--muted)" }}>bis</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg px-2 py-1"
              style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {(["overview", "strength", "volume", "load"] as StatsTab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className="rounded-full px-3 py-1.5"
            style={
              tab === k
                ? { background: "var(--primary)", color: "#061226" }
                : { background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }
            }
          >
            {k === "overview"
              ? "Übersicht"
              : k === "strength"
              ? "Kraft"
              : k === "volume"
              ? "Volumen"
              : "Belastung"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Volumen (Zeitraum)
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text)" }}>
              {Math.round(totalVolume).toLocaleString("de-DE")} kg
            </div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>
              Summe aus reps × weight (Working Sets)
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Trainingstage
            </div>
            <div className="text-xl font-semibold" style={{ color: "var(--text)" }}>
              {trainingDays.length}
            </div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>
              Streak: {streaks.current} (aktuell) · {streaks.longest} (best)
            </div>
          </div>

          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Trainingstage / Woche
            </div>
            <BarChart
              series={weeklyTrainingDays}
              labelFormatter={(label) => formatWeekLabel(label)}
            />
          </div>

          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Weekly Load (sRPE × Dauer)
            </div>
            {hasSrpeData ? (
              <>
                <div className="text-xl font-semibold" style={{ color: "var(--text)" }}>
                  {Math.round(thisWeekLoad)} AU
                </div>
                <div className="text-[10px]" style={loadBadgeStyle}>
                  Δ {Math.round(loadDeltaPct)}%
                </div>
              </>
            ) : (
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                Kein sRPE erfasst.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "strength" && (
        <div className="space-y-3">
          <div className="rounded-xl p-3 flex items-center justify-between gap-2 text-[11px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <span style={{ color: "var(--muted)" }}>Übung</span>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="rounded-lg px-2 py-1 text-[11px]"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" }}
            >
              {allExercises.length === 0 && <option value="">Keine Übungen</option>}
              {allExercises.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--muted)" }}>e1RM Verlauf</span>
              {selectedExercise && (
                <span style={{ color: "var(--text)" }}>
                  PR: {Math.round(allTimePR.get(selectedExercise) ?? 0)} kg
                </span>
              )}
            </div>
            <LineChart series={bestE1RMSeries} />
            {selectedExercise && bestE1RMSeries.length > 0 && (
              <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                Letzter Wert: {Math.round(bestE1RMSeries[bestE1RMSeries.length - 1].value)} kg
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Progression (letzte 7 Tage vs. davor)
            </div>
            <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              {Math.round(progressionDelta)}%
            </div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>
              Basierend auf best e1RM pro Tag.
            </div>
          </div>
        </div>
      )}

      {tab === "volume" && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Volumen pro Tag
            </div>
            <BarChart series={volumeByDay} labelFormatter={formatShortDate} />
          </div>
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Volumen pro Woche
            </div>
            <BarChart series={volumeByWeek} labelFormatter={formatWeekLabel} />
          </div>
        </div>
      )}

      {tab === "load" && (
        <div className="space-y-3">
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: "var(--muted)" }}>Belastung (sRPE × Dauer)</span>
              {hasSrpeData && (
                <span className="rounded-full px-2 py-0.5" style={loadBadgeStyle}>
                  Δ {Math.round(loadDeltaPct)}%
                </span>
              )}
            </div>
            {hasSrpeData ? (
              <BarChart series={loadByWeek} labelFormatter={formatWeekLabel} />
            ) : (
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                sRPE fehlt in den Trainingsdaten. Du kannst später eine Session‑RPE erfassen.
              </div>
            )}
          </div>

          {weeklyGoalMinutes > 0 && (
            <div className="rounded-xl p-3 text-[11px]" style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
              Ziel: {Math.round(weeklyGoalMinutes / 60)}h Training pro Woche (aus Profil).
            </div>
          )}
        </div>
      )}
    </div>
  );
}
