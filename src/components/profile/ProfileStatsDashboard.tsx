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
import { GarminService } from "../../services/garmin/api";
import type { GarminDailyMetrics, GarminSleepSummary } from "../../services/garmin/types";
import { useGarminConnection } from "../../hooks/useGarminConnection";
import { motion } from "framer-motion";

type RangePreset = "7d" | "4w" | "12w" | "custom";
type StatsTab = "overview" | "strength" | "volume" | "load" | "recovery";

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
  return !Number.isFinite(d.getTime()) ? new Date() : d;
}

function clampRange(from: Date, to: Date): { from: Date; to: Date } {
  return from.getTime() > to.getTime() ? { from: to, to: from } : { from, to };
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
  const [customFrom, setCustomFrom] = useState(() => toISODate(new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000)));
  const [customTo, setCustomTo] = useState(() => toISODate(today));

  const range = useMemo(() => {
    const end = new Date();
    let start: Date;
    if (preset === "7d") start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    else if (preset === "12w") start = new Date(end.getTime() - 83 * 24 * 60 * 60 * 1000);
    else if (preset === "custom") return clampRange(parseISO(`${customFrom}T00:00:00`), parseISO(`${customTo}T23:59:59`));
    else start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);
    return { from: start, to: end };
  }, [preset, customFrom, customTo]);

  return { preset, setPreset, customFrom, setCustomFrom, customTo, setCustomTo, range };
}

function BarChart({ series, labelFormatter }: { series: DailyValue[] | WeeklyValue[]; labelFormatter: (label: string) => string; }) {
  const seriesValues = series.map(s => s.value);
  const max = seriesValues.length > 0 ? Math.max(1, ...seriesValues) : 1;
  return (
    <div className="h-40 flex items-end gap-2">
      {series.map(s => {
        const label = "date" in s ? s.date : s.weekStart;
        const height = Math.max(2, (s.value / max) * 100);
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full rounded-2xl" style={{ height: `${height}%`, minHeight: '4px', backgroundColor: "var(--input-bg)" }}>
              <div className="h-full w-full rounded-2xl" style={{ backgroundColor: "var(--accent-color)", boxShadow: "0 0 12px 0px rgba(0, 122, 255, 0.3)" }} />
            </div>
            <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>{labelFormatter(label)}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ series }: { series: DailyValue[] }) {
  if (series.length < 2) return <div className="h-36 flex items-center justify-center text-sm text-gray-400">Nicht genügend Datenpunkte.</div>;

  const values = series.map(s => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = series.map((s, idx) => `${(idx / (series.length - 1)) * 100},${100 - ((s.value - min) / range) * 90 - 5}`).join(" ");
  const last = series[series.length - 1];
  const lastX = 100;
  const lastY = 100 - ((last.value - min) / range) * 90 - 5;

  return (
    <div className="h-36">
      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.2)" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="url(#line-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} style={{ filter: "url(#glow)" }} />
        <circle cx={lastX} cy={lastY} r="3" fill="#fff" stroke="#2563EB" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

const StatWidget: React.FC<{ title: string; value?: string; hint?: string; children?: React.ReactNode; className?: string; }> = ({ title, value = "—", hint, children, className }) => (
  <div className={`rounded-[32px] p-8 backdrop-blur-xl flex flex-col justify-between border ${className}`} style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
    <div>
      <h3 className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>{title}</h3>
      <p className="text-6xl font-black tabular-nums mt-2" style={{ color: "var(--text-color)" }}>{value}</p>
      {hint && <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{hint}</p>}
    </div>
    {children && <div className="mt-6">{children}</div>}
  </div>
);

function RecoveryChart({ series, color, label, unit }: { series: { date: string; value: number }[]; color: string; label: string; unit?: string }) {
  if (series.length < 2) return <div className="h-24 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>Nicht genügend Daten</div>;
  const values = series.map(s => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const points = series.map((s, idx) => `${(idx / (series.length - 1)) * 100},${100 - ((s.value - min) / range) * 85 - 7}`).join(" ");
  const last = series[series.length - 1];
  const lastY = 100 - ((last.value - min) / range) * 85 - 7;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{label}</span>
        <span className="text-lg font-bold tabular-nums" style={{ color }}>{Math.round(last.value)}{unit}</span>
      </div>
      <div className="h-20">
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
          <circle cx="100" cy={lastY} r="3" fill="#fff" stroke={color} strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

export default function ProfileStatsDashboard(props: Props) {
  const { workouts, weeklyGoalMinutes = 0 } = props;
  const { preset, setPreset, range } = useRangeState();
  const [tab, setTab] = useState<StatsTab>("overview");
  const { connected: garminConnected } = useGarminConnection();
  const [garminMetrics, setGarminMetrics] = useState<GarminDailyMetrics[]>([]);
  const [garminSleep, setGarminSleep] = useState<GarminSleepSummary[]>([]);

  useEffect(() => {
    if (!garminConnected || tab !== "recovery") return;
    const from = toISODate(range.from);
    const to = toISODate(range.to);
    GarminService.getDailyMetrics(from, to).then(setGarminMetrics);
    GarminService.getSleepSummaries(from, to).then(setGarminSleep);
  }, [garminConnected, tab, range.from.getTime(), range.to.getTime()]);

  const workoutsInRange = useMemo(() => getWorkoutsForRange(undefined, range.from, range.to, workouts), [range, workouts]);
  const allExercises = useMemo(() => listExercises(workoutsInRange), [workoutsInRange]);
  const [selectedExercise, setSelectedExercise] = useState<string>("");

  useEffect(() => {
    if (!selectedExercise || !allExercises.includes(selectedExercise)) {
      setSelectedExercise(allExercises[0] || "");
    }
  }, [allExercises, selectedExercise]);

  const volumeByDay = useMemo(() => computeVolumeByDay(workoutsInRange), [workoutsInRange]);
  const volumeByWeek = useMemo(() => computeVolumeByWeek(workoutsInRange), [workoutsInRange]);
  const totalVolume = useMemo(() => sumVolume(workoutsInRange), [workoutsInRange]);
  const bestE1RMSeries = useMemo(() => (selectedExercise ? computeBestE1RMByDay(workoutsInRange, selectedExercise) : []), [workoutsInRange, selectedExercise]);
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
  const loadStatus = Math.abs(loadDeltaPct) <= 20 ? "green" : Math.abs(loadDeltaPct) <= 40 ? "yellow" : "red";
  const loadBadgeClass = loadStatus === "green" ? "bg-green-500/20 text-green-300" : loadStatus === "yellow" ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300";
  const hasSrpeData = loadByWeek.some(w => w.value > 0);

  return (
    <div className="space-y-6 px-2">
      <div className="flex flex-wrap items-center gap-2">
        {(["7d", "4w", "12w"] as RangePreset[]).map(k => (
          <button key={k} type="button" onClick={() => setPreset(k)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${preset === k ? 'text-white shadow-lg' : 'hover:opacity-80'}`}
            style={{
              backgroundColor: preset === k ? "var(--accent-color)" : "var(--card-bg)",
              borderColor: "var(--border-color)",
              color: preset === k ? "#FFFFFF" : "var(--text-muted)"
            }}
          >
            {k === "7d" ? "7 Tage" : k === "4w" ? "4 Wochen" : "12 Wochen"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["overview", "strength", "volume", "load", ...(garminConnected ? ["recovery" as StatsTab] : [])] as StatsTab[]).map(k => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors border ${tab === k ? 'text-white shadow-lg' : 'hover:opacity-80'}`}
            style={{
              backgroundColor: tab === k ? "var(--accent-color)" : "var(--card-bg)",
              borderColor: "var(--border-color)",
              color: tab === k ? "#FFFFFF" : "var(--text-muted)"
            }}
          >
            {k === "overview" ? "Übersicht" : k === "strength" ? "Kraft" : k === "volume" ? "Volumen" : k === "load" ? "Belastung" : "Recovery"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tab === "overview" && (
          <>
            <StatWidget title="Volumen" value={`${Math.round(totalVolume).toLocaleString("de-DE")} kg`} hint="Summe aus reps × weight" />
            <StatWidget title="Trainingstage" value={trainingDays.length.toString()} hint={`Streak: ${streaks.current} (aktuell) · ${streaks.longest} (max)`} />
            <StatWidget title="Trainingstage / Woche" className="md:col-span-2">
              <BarChart series={weeklyTrainingDays} labelFormatter={formatWeekLabel} />
            </StatWidget>
          </>
        )}

        {tab === "strength" && (
          <>
            <div className="rounded-[32px] p-8 backdrop-blur-xl md:col-span-2 flex items-center justify-between border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
              <h3 className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>Übung für e1RM</h3>
              <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}
                className="rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 border"
                style={{ backgroundColor: "var(--input-bg)", color: "var(--text-color)", borderColor: "var(--border-color)" }}
              >
                {allExercises.length === 0 && <option value="">Keine Übungen</option>}
                {allExercises.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <StatWidget title="e1RM Verlauf" hint={selectedExercise ? `All-Time PR: ${Math.round(allTimePR.get(selectedExercise) ?? 0)} kg` : ''}>
              <LineChart series={bestE1RMSeries} />
            </StatWidget>
            <StatWidget title="Progression (7 vs 7 Tage)" value={`${Math.round(progressionDelta)}%`} hint="Basierend auf bestem e1RM" />
          </>
        )}

        {tab === "volume" && (
          <>
            <StatWidget title="Volumen pro Tag" className="md:col-span-2">
              <BarChart series={volumeByDay} labelFormatter={formatShortDate} />
            </StatWidget>
            <StatWidget title="Volumen pro Woche" className="md:col-span-2">
              <BarChart series={volumeByWeek} labelFormatter={formatWeekLabel} />
            </StatWidget>
          </>
        )}

        {tab === "load" && (
          <StatWidget title="Belastung (sRPE × Dauer)" className="md:col-span-2">
            {hasSrpeData ? (
              <>
                <div className="flex items-baseline gap-3">
                  <p className="text-6xl font-black tabular-nums" style={{ color: "var(--text-color)" }}>{Math.round(thisWeekLoad)} <span className="text-4xl">AU</span></p>
                  <div className={`text-lg font-bold px-3 py-1 rounded-full inline-block ${loadBadgeClass}`}>Δ {Math.round(loadDeltaPct)}%</div>
                </div>
                <div className="mt-6">
                  <BarChart series={loadByWeek} labelFormatter={formatWeekLabel} />
                </div>
              </>
            ) : <p className="text-lg" style={{ color: "var(--text-muted)" }}>Keine sRPE Daten in Trainings erfasst.</p>}
          </StatWidget>
        )}

        {tab === "recovery" && garminConnected && (
          <>
            {garminMetrics.length === 0 && garminSleep.length === 0 ? (
              <StatWidget title="Recovery" className="md:col-span-2">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Keine Garmin-Daten im gewählten Zeitraum. Synchronisiere zuerst in den Einstellungen.
                </p>
              </StatWidget>
            ) : (
              <>
                {/* Body Battery */}
                <StatWidget title="Body Battery" className="md:col-span-2">
                  <RecoveryChart
                    series={garminMetrics.filter(m => m.bodyBatteryHigh > 0).map(m => ({ date: m.calendarDate, value: m.bodyBatteryHigh }))}
                    color="#00c853"
                    label="Aktuell"
                    unit="%"
                  />
                </StatWidget>

                {/* Stress */}
                <StatWidget title="Stress-Level">
                  <RecoveryChart
                    series={garminMetrics.filter(m => m.avgStressLevel > 0).map(m => ({ date: m.calendarDate, value: m.avgStressLevel }))}
                    color="#FF6B35"
                    label="Durchschnitt"
                    unit=""
                  />
                </StatWidget>

                {/* Resting HR */}
                <StatWidget title="Ruhepuls">
                  <RecoveryChart
                    series={garminMetrics.filter(m => m.restingHeartRate > 0).map(m => ({ date: m.calendarDate, value: m.restingHeartRate }))}
                    color="#E63946"
                    label="Aktuell"
                    unit=" bpm"
                  />
                </StatWidget>

                {/* Sleep Score */}
                {garminSleep.length > 0 && (
                  <StatWidget title="Schlafqualität" className="md:col-span-2">
                    <RecoveryChart
                      series={garminSleep.filter(s => s.sleepScore > 0).map(s => ({ date: s.calendarDate, value: s.sleepScore }))}
                      color="#7C4DFF"
                      label="Sleep Score"
                      unit=""
                    />
                    {/* Sleep breakdown for latest night */}
                    {(() => {
                      const latest = garminSleep[garminSleep.length - 1];
                      if (!latest || latest.totalSleepSeconds <= 0) return null;
                      const total = latest.totalSleepSeconds;
                      const deep = Math.round((latest.deepSleepSeconds / total) * 100);
                      const light = Math.round((latest.lightSleepSeconds / total) * 100);
                      const rem = Math.round((latest.remSleepSeconds / total) * 100);
                      const awake = Math.round((latest.awakeSeconds / total) * 100);
                      const hours = Math.floor(total / 3600);
                      const mins = Math.round((total % 3600) / 60);
                      return (
                        <div className="mt-4">
                          <div className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
                            Letzte Nacht: {hours}h {mins}m
                          </div>
                          <div className="flex rounded-full overflow-hidden h-3">
                            <div style={{ width: `${deep}%`, backgroundColor: "#1565C0" }} title={`Tief: ${deep}%`} />
                            <div style={{ width: `${light}%`, backgroundColor: "#42A5F5" }} title={`Leicht: ${light}%`} />
                            <div style={{ width: `${rem}%`, backgroundColor: "#7C4DFF" }} title={`REM: ${rem}%`} />
                            <div style={{ width: `${awake}%`, backgroundColor: "#FF6B35" }} title={`Wach: ${awake}%`} />
                          </div>
                          <div className="flex gap-3 mt-2 text-[10px]" style={{ color: "var(--text-secondary)" }}>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#1565C0" }} />Tief {deep}%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#42A5F5" }} />Leicht {light}%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#7C4DFF" }} />REM {rem}%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#FF6B35" }} />Wach {awake}%</span>
                          </div>
                        </div>
                      );
                    })()}
                  </StatWidget>
                )}

                {/* Daily Steps + Intensity */}
                <StatWidget title="Schritte / Tag">
                  <BarChart
                    series={garminMetrics.filter(m => m.steps > 0).map(m => ({ date: m.calendarDate, value: m.steps }))}
                    labelFormatter={formatShortDate}
                  />
                </StatWidget>

                <StatWidget title="Intensitätsminuten">
                  <BarChart
                    series={garminMetrics.filter(m => m.intensityMinutes > 0).map(m => ({ date: m.calendarDate, value: m.intensityMinutes }))}
                    labelFormatter={formatShortDate}
                  />
                </StatWidget>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
