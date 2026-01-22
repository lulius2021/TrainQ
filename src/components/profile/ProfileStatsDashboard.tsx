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
import { motion } from "framer-motion";

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
  const max = Math.max(1, ...series.map(s => s.value));
  return (
    <div className="h-40 flex items-end gap-2">
      {series.map(s => {
        const label = "date" in s ? s.date : s.weekStart;
        const height = Math.max(2, (s.value / max) * 100);
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-2">
            <div className="w-full bg-white/10 rounded-lg" style={{ height: `${height}%`, minHeight: '4px' }}>
              <div className="h-full w-full rounded-lg bg-[var(--primary)]" style={{ boxShadow: "0 0 12px 0px var(--primarySoft)" }} />
            </div>
            <span className="text-xs text-gray-400 tabular-nums">{labelFormatter(label)}</span>
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
  <div className={`rounded-[32px] p-8 bg-white/5 border border-white/10 backdrop-blur-xl flex flex-col justify-between ${className}`}>
    <div>
      <h3 className="text-lg font-bold text-gray-400">{title}</h3>
      <p className="text-6xl font-black text-white tabular-nums mt-2">{value}</p>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
    </div>
    {children && <div className="mt-6">{children}</div>}
  </div>
);

export default function ProfileStatsDashboard(props: Props) {
  const { workouts, weeklyGoalMinutes = 0 } = props;
  const { preset, setPreset, range } = useRangeState();
  const [tab, setTab] = useState<StatsTab>("overview");

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
          <button key={k} type="button" onClick={() => setPreset(k)} className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${preset === k ? 'bg-[var(--primary)] text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] border border-[var(--border)]'}`}>
            {k === "7d" ? "7 Tage" : k === "4w" ? "4 Wochen" : "12 Wochen"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["overview", "strength", "volume", "load"] as StatsTab[]).map(k => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${tab === k ? 'bg-[var(--primary)] text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] border border-[var(--border)]'}`}>
            {k === "overview" ? "Übersicht" : k === "strength" ? "Kraft" : k === "volume" ? "Volumen" : "Belastung"}
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
            <div className="rounded-[32px] p-8 bg-white/5 border border-white/10 backdrop-blur-xl md:col-span-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-400">Übung für e1RM</h3>
              <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)} className="rounded-2xl px-4 py-3 bg-black/20 border border-white/10 text-white outline-none focus:ring-2 focus:ring-blue-500">
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
                  <p className="text-6xl font-black text-white tabular-nums">{Math.round(thisWeekLoad)} <span className="text-4xl">AU</span></p>
                  <div className={`text-lg font-bold px-3 py-1 rounded-full inline-block ${loadBadgeClass}`}>Δ {Math.round(loadDeltaPct)}%</div>
                </div>
                <div className="mt-6">
                  <BarChart series={loadByWeek} labelFormatter={formatWeekLabel} />
                </div>
              </>
            ) : <p className="text-lg text-gray-400">Keine sRPE Daten in Trainings erfasst.</p>}
          </StatWidget>
        )}
      </div>
    </div>
  );
}
