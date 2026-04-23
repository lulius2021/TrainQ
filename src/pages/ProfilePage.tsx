// src/pages/ProfilePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadWorkoutHistory,
  onWorkoutHistoryUpdated,
  clearWorkoutHistory,
  type WorkoutHistoryEntry,
} from "../utils/workoutHistory";
import { WorkoutHistoryOverlay } from "../components/profile/WorkoutHistoryOverlay";
import { History, Settings, BarChart3, Medal, Dumbbell, CalendarDays, Clock, TrendingUp } from "lucide-react";

import {
  readOnboardingDataFromStorage,
  writeOnboardingDataToStorage,
  resetOnboardingInStorage,
} from "../context/OnboardingContext";
import NutritionStatsBlock from "../components/nutrition/NutritionStatsBlock";
import { loadDiaryEntries } from "../utils/nutritionStore";
import { Apple } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { track } from "../analytics/track";
import ProfileStatsDashboard from "../components/profile/ProfileStatsDashboard";
import { buildProfileLinks, copyText, shareProfile, shortenId } from "../utils/shareProfile";


// WICHTIG: Datei heißt bei dir "SettingPage.tsx" (ohne s)
import SettingPage from "./SettingPage";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { useStatistics, type TimeRange } from "../hooks/useStatistics";
import { StatsChart } from "../components/stats/StatsChart";
import { ConsistencyHeatmap } from "../components/stats/ConsistencyHeatmap";
import { GarminService } from "../services/garmin/api";
import { useGarminConnection } from "../hooks/useGarminConnection";
import type { GarminActivity } from "../services/garmin/types";
import { FEATURE_FLAGS } from "../config/featureFlags";
import { ShareableStatCard } from "../components/stats/ShareableStatCard";
import { BottomSpacer } from "../components/layout/BottomSpacer";
import { BottomSheet } from "../components/common/BottomSheet";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useI18n } from "../i18n/useI18n";
import { useChallengeRewards } from "../hooks/useChallengeRewards";
import { Gift, Trophy, Flame } from "lucide-react";
import { computeStreaks } from "../utils/stats";
import { hapticButton, hapticSelect } from "../native/haptics";

interface ProfilePageProps {
  onClearCalendar?: () => void;
  onOpenWorkoutShare?: (workoutId: string, returnTo?: "dashboard" | "profile") => void;
}

// -------------------- Helpers --------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 So – 6 Sa
  const diff = (day + 6) % 7; // 0 = Mo
  d.setDate(d.getDate() - diff);
  return d;
}

function formatDateRangeWeek(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const from = start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const to = end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${from} – ${to}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function toLocalDateLabel(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function durationMinutes(w: WorkoutHistoryEntry): number {
  return Math.max(0, Math.round((w.durationSec ?? 0) / 60));
}

function safeInitials(name: string): string {
  const parts = (name || "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map((p) => p[0]).join("");
  return (initials || "TQ").slice(0, 2).toUpperCase();
}

function normalizeSport(s?: string): "Gym" | "Laufen" | "Radfahren" | "Custom" | "Unknown" {
  const t = (s || "").trim().toLowerCase();
  if (t === "gym") return "Gym";
  if (t === "laufen") return "Laufen";
  if (t === "radfahren") return "Radfahren";
  if (t === "custom") return "Custom";
  return "Unknown";
}

function isInWeek(entry: WorkoutHistoryEntry, weekStart: Date): boolean {
  const t = new Date(entry.endedAt || entry.startedAt).getTime();
  const start = weekStart.getTime();
  const end = new Date(weekStart).setDate(weekStart.getDate() + 7);
  return t >= start && t < end;
}

function isInMonth(entry: WorkoutHistoryEntry, ref: Date): boolean {
  const d = new Date(entry.endedAt || entry.startedAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function weekIndexInMonth(d: Date): number {
  const dayOfMonth = d.getDate();
  return Math.min(Math.floor((dayOfMonth - 1) / 7), 4);
}

function parseCsvList(s: string): string[] {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function toNumberOrNull(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// -------------------- Page --------------------

import MonthlyRecapModal from "../components/profile/MonthlyRecapModal";

// ... existing imports ...

// -------------------- Deferred Section (prevents WebKit rendering crash) --------------------
// -------------------- Section Error Boundary --------------------
class SectionErrorBoundary extends React.Component<{ name: string; children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { name: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error: String((error as any)?.message || error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 12, backgroundColor: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 12, marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: "#FF3B30", margin: 0 }}>[{this.props.name}] {this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// -------------------- Page --------------------

// Error Boundary specifically for Profile — uses hardcoded colors to avoid CSS var issues
class ProfileErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string; stack: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "", stack: "" };
  }
  static getDerivedStateFromError(error: unknown) {
    const msg = String((error as any)?.message || error);
    const stack = String((error as any)?.stack || "").slice(0, 500);
    return { hasError: true, error: msg, stack };
  }
  componentDidCatch(error: unknown, info: unknown) {
    if (import.meta.env.DEV) console.error("ProfilePage Error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, backgroundColor: "var(--bg-color)", color: "var(--text-color)", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 12, color: "var(--text-color)" }}>Profil-Fehler</h2>
          <div style={{ padding: 16, backgroundColor: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", borderRadius: 12, marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: "#FF3B30", wordBreak: "break-all", margin: 0 }}>{this.state.error}</p>
            {this.state.stack && (
              <pre style={{ fontSize: 10, color: "#FF3B30", opacity: 0.7, marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{this.state.stack}</pre>
            )}
          </div>
          <button onClick={() => this.setState({ hasError: false, error: "", stack: "" })} style={{ padding: "12px 24px", background: "#007AFF", color: "white", border: "none", borderRadius: 12, fontWeight: "bold", fontSize: 16 }}>
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── All Stats BottomSheet ─── */

function computeAllStats(workouts: WorkoutHistoryEntry[]) {
  // Personal Records (best weight per exercise)
  const prMap = new Map<string, { weight: number; reps: number; date: string }>();
  workouts.forEach((w) => {
    (w.exercises ?? []).forEach((ex) => {
      (ex.sets ?? []).forEach((s) => {
        if (s.weight > 0 && s.reps > 0) {
          const key = ex.name;
          const current = prMap.get(key);
          if (!current || s.weight > current.weight) {
            prMap.set(key, { weight: s.weight, reps: s.reps, date: w.endedAt || w.startedAt });
          }
        }
      });
    });
  });
  const prs = Array.from(prMap.entries())
    .map(([name, pr]) => ({ name, ...pr }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  // Top Exercises (most frequent)
  const exCountMap = new Map<string, number>();
  workouts.forEach((w) => {
    (w.exercises ?? []).forEach((ex) => {
      exCountMap.set(ex.name, (exCountMap.get(ex.name) || 0) + 1);
    });
  });
  const topExercises = Array.from(exCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Training frequency (sessions per week, last 8 weeks)
  const now = Date.now();
  const weekBuckets: number[] = Array(8).fill(0);
  workouts.forEach((w) => {
    const t = new Date(w.startedAt).getTime();
    const weeksAgo = Math.floor((now - t) / (7 * 86400000));
    if (weeksAgo >= 0 && weeksAgo < 8) weekBuckets[7 - weeksAgo]++;
  });
  const avgFrequency = weekBuckets.reduce((s, v) => s + v, 0) / 8;

  // Average session duration
  const durations = workouts.map((w) => (w.durationSec ?? 0) / 60).filter((m) => m > 0);
  const avgDuration = durations.length > 0 ? durations.reduce((s, v) => s + v, 0) / durations.length : 0;

  // Favorite training days
  const dayCount = Array(7).fill(0);
  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  workouts.forEach((w) => {
    const day = new Date(w.startedAt).getDay();
    const idx = (day + 6) % 7; // Monday = 0
    dayCount[idx]++;
  });
  const maxDay = Math.max(...dayCount, 1);
  const trainingDays = dayLabels.map((label, i) => ({ label, count: dayCount[i], pct: (dayCount[i] / maxDay) * 100 }));

  // Best cardio
  const runs = workouts.filter((w) => (w.sport || "").toLowerCase() === "laufen" && w.paceSecPerKm && w.paceSecPerKm > 0);
  const bestPace = runs.length > 0 ? Math.min(...runs.map((r) => r.paceSecPerKm!)) : null;
  const longestRun = runs.length > 0 ? Math.max(...runs.map((r) => r.distanceKm ?? 0)) : null;

  const rides = workouts.filter((w) => (w.sport || "").toLowerCase() === "radfahren");
  const longestRide = rides.length > 0 ? Math.max(...rides.map((r) => r.distanceKm ?? 0)) : null;

  return { prs, topExercises, weekBuckets, avgFrequency, avgDuration, trainingDays, bestPace, longestRun, longestRide };
}

function formatPaceMinSec(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const AllStatsSheet: React.FC<{ open: boolean; onClose: () => void; workouts: WorkoutHistoryEntry[] }> = ({ open, onClose, workouts }) => {
  const { t } = useI18n();
  const allStats = useMemo(() => computeAllStats(workouts), [workouts]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      height="92dvh"
      showHandle
      header={
        <div className="px-5 pb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>{t("profile.allStats")}</h2>
        </div>
      }
      contentClassName="flex-1 min-h-0 overflow-y-auto px-5 pb-10"
    >
      <div className="space-y-8">
        {/* Overview */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.overview")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays size={14} style={{ color: "var(--accent-color)" }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.avgFrequency")}</span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-color)" }}>
                {allStats.avgFrequency.toFixed(1)}<span className="text-sm font-normal ml-1" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.perWeek")}</span>
              </span>
            </div>
            <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Clock size={14} style={{ color: "#F59E0B" }} />
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.avgDuration")}</span>
              </div>
              <span className="text-2xl font-black" style={{ color: "var(--text-color)" }}>
                {Math.round(allStats.avgDuration)}<span className="text-sm font-normal ml-1" style={{ color: "var(--text-secondary)" }}>min</span>
              </span>
            </div>
          </div>
        </div>

        {/* Training Days */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.popularDays")}</h3>
          <div className="flex items-end gap-2 h-24">
            {allStats.trainingDays.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-lg flex flex-col justify-end" style={{ height: 64, backgroundColor: "var(--card-bg)" }}>
                  <div className="w-full rounded-t-lg" style={{ height: `${Math.max(d.pct, 4)}%`, backgroundColor: d.count > 0 ? "#007AFF" : "transparent" }} />
                </div>
                <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{d.label}</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--text-color)" }}>{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Frequency Chart (last 8 weeks) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.weeklySessionsChart")}</h3>
          <div className="flex items-end gap-2 h-20">
            {allStats.weekBuckets.map((count, i) => {
              const max = Math.max(...allStats.weekBuckets, 1);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg flex flex-col justify-end" style={{ height: 52, backgroundColor: "var(--card-bg)" }}>
                    <div className="w-full rounded-t-lg" style={{ height: `${Math.max((count / max) * 100, 4)}%`, backgroundColor: count > 0 ? "#10B981" : "transparent" }} />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--text-color)" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Personal Records */}
        {allStats.prs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Medal size={14} style={{ color: "#F59E0B" }} />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.personalRecords")}</h3>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
              {allStats.prs.map((pr, i) => (
                <div
                  key={pr.name}
                  className="flex items-center justify-between px-4 py-3"
                  style={i < allStats.prs.length - 1 ? { borderBottom: "1px solid var(--border-color)" } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-bold tabular-nums w-5 text-center" style={{ color: i < 3 ? "#F59E0B" : "var(--text-secondary)" }}>{i + 1}</span>
                    <span className="text-sm font-medium truncate" style={{ color: "var(--text-color)" }}>{pr.name}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: "var(--text-color)" }}>
                    {pr.weight} kg <span className="font-normal" style={{ color: "var(--text-secondary)" }}>× {pr.reps}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Exercises */}
        {allStats.topExercises.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Dumbbell size={14} style={{ color: "#007AFF" }} />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("profile.stats.topExercises")}</h3>
            </div>
            <div className="space-y-2.5">
              {allStats.topExercises.map((ex) => {
                const maxCount = allStats.topExercises[0]?.count ?? 1;
                const pct = (ex.count / maxCount) * 100;
                return (
                  <div key={ex.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium truncate" style={{ color: "var(--text-color)" }}>{ex.name}</span>
                      <span className="text-[13px] font-bold tabular-nums shrink-0 ml-3" style={{ color: "var(--text-secondary)" }}>{ex.count}×</span>
                    </div>
                    <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: "#007AFF" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cardio Records */}
        {(allStats.bestPace || allStats.longestRun || allStats.longestRide) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: "#10B981" }} />
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Cardio Bestleistungen</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {allStats.bestPace && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-secondary)" }}>Beste Pace</span>
                  <span className="text-2xl font-black" style={{ color: "#34C759" }}>
                    {formatPaceMinSec(allStats.bestPace)}<span className="text-xs font-normal ml-1">/km</span>
                  </span>
                </div>
              )}
              {allStats.longestRun != null && allStats.longestRun > 0 && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-secondary)" }}>Längster Lauf</span>
                  <span className="text-2xl font-black" style={{ color: "#34C759" }}>
                    {allStats.longestRun.toFixed(1)}<span className="text-xs font-normal ml-1">km</span>
                  </span>
                </div>
              )}
              {allStats.longestRide != null && allStats.longestRide > 0 && (
                <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--card-bg)" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--text-secondary)" }}>Längste Fahrt</span>
                  <span className="text-2xl font-black" style={{ color: "#FF9500" }}>
                    {allStats.longestRide.toFixed(1)}<span className="text-xs font-normal ml-1">km</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

/* ─── Nutrition Stats BottomSheet ─── */

const NutritionStatsSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const hasData = useMemo(() => open ? loadDiaryEntries().length > 0 : false, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      height={hasData ? "88dvh" : "auto"}
      showHandle
      header={
        <div className="px-5 pb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Ernährung</h2>
        </div>
      }
      contentClassName="flex-1 min-h-0 overflow-y-auto px-5 pb-10"
    >
      {hasData ? (
        <NutritionStatsBlock />
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
          <Apple size={32} style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Noch keine Ernährungsdaten erfasst.</p>
        </div>
      )}
    </BottomSheet>
  );
};

/* ─── Stat Detail Sheet with own TimeRange ─── */
const TimeRangePicker: React.FC<{ value: TimeRange; onChange: (v: TimeRange) => void }> = ({ value, onChange }) => (
  <div className="flex items-center p-1 rounded-lg border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}>
    {(["1W", "1M", "6M", "1Y"] as TimeRange[]).map((tr) => (
      <button
        key={tr}
        onClick={() => { hapticSelect(); onChange(tr); }}
        className="px-3 py-1 text-xs font-medium rounded-md transition-all"
        style={{
          backgroundColor: value === tr ? "var(--card-bg)" : "transparent",
          color: value === tr ? "var(--text-color)" : "var(--text-muted)",
          boxShadow: value === tr ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
        }}
      >
        {tr}
      </button>
    ))}
  </div>
);

type StatType = "volume" | "duration" | "distance" | "sports";

const StatDetailSheet: React.FC<{
  type: StatType | null;
  onClose: () => void;
  workouts: WorkoutHistoryEntry[];
}> = ({ type, onClose, workouts }) => {
  const { t } = useI18n();
  const [sheetTimeRange, setSheetTimeRange] = useState<TimeRange>("1W");
  const sheetStats = useStatistics(workouts, sheetTimeRange);

  if (!type) return null;

  const configs: Record<Exclude<StatType, "sports">, { title: string; valueDisplay: string; unit: string; data: any[]; chartType: "area" | "bar"; color: string }> = {
    volume: {
      title: t("profile.stats.trainingLoad"),
      valueDisplay: (sheetStats.totals.volume / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " t",
      unit: "kg",
      data: sheetStats.volumeData,
      chartType: "area",
      color: "#007AFF",
    },
    duration: {
      title: t("profile.stats.trainingTime"),
      valueDisplay: Math.round(sheetStats.totals.duration / 60) + " h",
      unit: "min",
      data: sheetStats.durationData,
      chartType: "bar",
      color: "#F59E0B",
    },
    distance: {
      title: t("profile.stats.distance"),
      valueDisplay: sheetStats.totals.distance.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km",
      unit: "km",
      data: sheetStats.distanceData,
      chartType: "area",
      color: "#10B981",
    },
  };

  if (type === "sports") {
    return (
      <BottomSheet
        open
        onClose={onClose}
        height="auto"
        showHandle
        header={
          <div className="flex items-center justify-between px-5 pb-1">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>{t("profile.stats.sportsFocus")}</h2>
            <TimeRangePicker value={sheetTimeRange} onChange={setSheetTimeRange} />
          </div>
        }
      >
        <div className="px-4 pb-8">
          <StatsChart
            title={t("profile.stats.sportsFocus")}
            type="pie"
            data={sheetStats.sportSplitData}
            unit="x"
            height={300}
          />
        </div>
      </BottomSheet>
    );
  }

  const cfg = configs[type];

  return (
    <BottomSheet
      open
      onClose={onClose}
      height="auto"
      showHandle
      header={
        <div className="flex items-center justify-between px-5 pb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>{cfg.title}</h2>
          <TimeRangePicker value={sheetTimeRange} onChange={setSheetTimeRange} />
        </div>
      }
    >
      <div className="px-4 pb-8">
        <StatsChart
          title={cfg.title}
          valueDisplay={cfg.valueDisplay}
          unit={cfg.unit}
          data={cfg.data}
          type={cfg.chartType}
          color={cfg.color}
          height={300}
        />
      </div>
    </BottomSheet>
  );
};

const ProfilePageInner: React.FC<ProfilePageProps> = ({ onClearCalendar, onOpenWorkoutShare }) => {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const canViewStatsRange = (_range: string) => true;
  const { unclaimedRewards, unclaimedCount, activeGrants, hasActiveGrant, claimReward: claimChallengeReward, isLoading: rewardsLoading } = useChallengeRewards();

  const [onboarding, setOnboarding] = useState(() => readOnboardingDataFromStorage());
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>(() => loadWorkoutHistory());

  const [timeRange, setTimeRange] = useState<TimeRange>("1W");
  const stats = useStatistics(workouts, timeRange);
  const { connected: garminConnected } = useGarminConnection();
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);

  useEffect(() => {
    if (!FEATURE_FLAGS.garmin || !garminConnected) return;
    const now = new Date();
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const from = yearAgo.toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    GarminService.getActivities(from, to).then(setGarminActivities);
  }, [garminConnected]);

  const refreshOnboarding = useCallback(() => setOnboarding(readOnboardingDataFromStorage()), []);
  const refreshWorkouts = useCallback(() => {
    const fresh = loadWorkoutHistory();
    setWorkouts(prev => prev.length === fresh.length ? prev : fresh);
  }, []);

  useEffect(() => {
    refreshOnboarding();
    refreshWorkouts();
  }, [user?.id, refreshOnboarding, refreshWorkouts]);

  useEffect(() => {
    const off = onWorkoutHistoryUpdated(refreshWorkouts);

    if (typeof window !== "undefined") {
      window.addEventListener("focus", refreshWorkouts);
      window.addEventListener("storage", refreshWorkouts);

      window.addEventListener("focus", refreshOnboarding);
      window.addEventListener("storage", refreshOnboarding);
    }

    return () => {
      off();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refreshWorkouts);
        window.removeEventListener("storage", refreshWorkouts);

        window.removeEventListener("focus", refreshOnboarding);
        window.removeEventListener("storage", refreshOnboarding);
      }
    };
  }, [refreshOnboarding, refreshWorkouts]);

  // -------- Profile basics from storage --------
  const initialName = useMemo(
    () => (onboarding.profile?.username || "").trim() || t("profile.defaultName"),
    [onboarding.profile?.username]
  );

  const derivedBioFallback = useMemo(() => {
    const goals = onboarding.goals?.selectedGoals ?? [];
    const sports = onboarding.goals?.sports ?? [];
    const g = goals.length ? `${t("profile.goals")}: ${goals.join(", ")}` : "";
    const s = sports.length ? `${t("profile.sports")}: ${sports.join(", ")}` : "";
    const combined = [g, s].filter(Boolean).join(" • ");
    return combined || t("profile.defaultBio");
  }, [onboarding.goals?.selectedGoals, onboarding.goals?.sports]);

  const initialBio = useMemo(() => {
    const stored = (onboarding.profile?.bio || "").trim();
    return stored || derivedBioFallback;
  }, [onboarding.profile?.bio, derivedBioFallback]);

  const initialAvatar = useMemo(() => {
    const raw = (onboarding.profile as any)?.avatarDataUrl;
    return typeof raw === "string" && raw.trim() ? raw.trim() : "";
  }, [onboarding.profile]);

  const [profileName, setProfileName] = useState<string>(initialName);
  const [profileBio, setProfileBio] = useState<string>(initialBio);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>(initialAvatar);

  // Keep UI in sync if onboarding changes and user hasn't customized locally
  useEffect(() => {
    const obName = (onboarding.profile?.username || "").trim();
    if (!obName) return;

    const isDefaultOrAuto = profileName.trim() === "" || profileName === t("profile.defaultName") || profileName === initialName;
    if (isDefaultOrAuto) setProfileName(obName);
  }, [onboarding.profile?.username, initialName, profileName]);

  useEffect(() => {
    const storedBio = (onboarding.profile?.bio || "").trim();

    const isDefaultOrAuto =
      profileBio.trim() === "" ||
      profileBio === t("profile.defaultBio")
      || profileBio === initialBio ||
      profileBio === derivedBioFallback;

    if (isDefaultOrAuto) setProfileBio(storedBio || derivedBioFallback);
  }, [onboarding.profile?.bio, derivedBioFallback, initialBio, profileBio]);

  useEffect(() => {
    const raw = (onboarding.profile as any)?.avatarDataUrl;
    const next = typeof raw === "string" ? raw : "";
    if (next !== avatarDataUrl) setAvatarDataUrl(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding.profile]);

  // -------- Edit modal state --------
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Editable onboarding fields (moved into profile edit)
  const [age, setAge] = useState<string>(() =>
    typeof onboarding.personal?.age === "number" ? String(onboarding.personal?.age) : ""
  );
  const [height, setHeight] = useState<string>(() =>
    typeof onboarding.personal?.height === "number" ? String(onboarding.personal?.height) : ""
  );
  const [weight, setWeight] = useState<string>(() =>
    typeof onboarding.personal?.weight === "number" ? String(onboarding.personal?.weight) : ""
  );
  const [hoursPerWeek, setHoursPerWeek] = useState<string>(() =>
    typeof onboarding.training?.hoursPerWeek === "number" ? String(onboarding.training?.hoursPerWeek) : ""
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState<string>(() =>
    typeof onboarding.training?.sessionsPerWeek === "number" ? String(onboarding.training?.sessionsPerWeek) : ""
  );
  const [sportsCsv, setSportsCsv] = useState<string>(() =>
    Array.isArray(onboarding.goals?.sports) ? onboarding.goals!.sports.join(", ") : ""
  );
  const [goalsCsv, setGoalsCsv] = useState<string>(() =>
    Array.isArray(onboarding.goals?.selectedGoals) ? onboarding.goals!.selectedGoals.join(", ") : ""
  );

  const openEdit = useCallback(() => {
    const current = readOnboardingDataFromStorage();

    setProfileName(((current.profile?.username || "") as string).trim() || profileName);
    setProfileBio(((current.profile?.bio || "") as string).trim() || profileBio);

    const av = (current.profile as any)?.avatarDataUrl;
    setAvatarDataUrl(typeof av === "string" ? av : "");

    setAge(typeof current.personal?.age === "number" ? String(current.personal?.age) : "");
    setHeight(typeof current.personal?.height === "number" ? String(current.personal?.height) : "");
    setWeight(typeof current.personal?.weight === "number" ? String(current.personal?.weight) : "");

    setHoursPerWeek(typeof current.training?.hoursPerWeek === "number" ? String(current.training?.hoursPerWeek) : "");
    setSessionsPerWeek(
      typeof current.training?.sessionsPerWeek === "number" ? String(current.training?.sessionsPerWeek) : ""
    );

    setSportsCsv(Array.isArray(current.goals?.sports) ? (current.goals!.sports as any[]).join(", ") : "");
    setGoalsCsv(Array.isArray(current.goals?.selectedGoals) ? (current.goals!.selectedGoals as any[]).join(", ") : "");

    setIsEditProfileOpen(true);
  }, [profileBio, profileName]);

  const onPickAvatar = useCallback(() => fileRef.current?.click(), []);
  const onAvatarSelected = useCallback(async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader error"));
      r.readAsDataURL(file);
    });

    setAvatarDataUrl(dataUrl);
  }, []);

  const saveProfileEdits = useCallback(() => {
    const current = readOnboardingDataFromStorage();

    const next = {
      ...current,
      profile: {
        ...(current.profile ?? { username: "", bio: "", isPublic: true }),
        username: profileName.trim(),
        bio: profileBio.trim(),
        avatarDataUrl: avatarDataUrl || "",
      },
      personal: {
        ...(current.personal ?? {}),
        age: toNumberOrNull(age),
        height: toNumberOrNull(height),
        weight: toNumberOrNull(weight),
      },
      training: {
        ...(current.training ?? {}),
        hoursPerWeek: toNumberOrNull(hoursPerWeek),
        sessionsPerWeek: toNumberOrNull(sessionsPerWeek),
      },
      goals: {
        ...(current.goals ?? {}),
        sports: parseCsvList(sportsCsv) as unknown as any,
        selectedGoals: parseCsvList(goalsCsv) as unknown as any,
      },
    };

    writeOnboardingDataToStorage(next);
    setOnboarding(next);
    setIsEditProfileOpen(false);
  }, [age, avatarDataUrl, goalsCsv, height, hoursPerWeek, profileBio, profileName, sessionsPerWeek, sportsCsv, weight]);

  // -------- Settings drawer state --------
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [statsOpen, setStatsOpen] = useState(false);
  const [statSheetOpen, setStatSheetOpen] = useState<string | null>(null);
  const [allStatsOpen, setAllStatsOpen] = useState(false);
  const [nutritionStatsOpen, setNutritionStatsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Lock background scroll whenever any overlay is open
  useBodyScrollLock(statsOpen);

  // Close modals with ESC
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsEditProfileOpen(false);
      setSettingsOpen(false);
      setStatsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const WEEKLY_GOAL_MINUTES = useMemo(() => {
    const h = onboarding.training?.hoursPerWeek;
    const hours = typeof h === "number" && Number.isFinite(h) && h > 0 ? h : 5;
    return Math.round(hours * 60);
  }, [onboarding.training?.hoursPerWeek]);

  const weekStart = useMemo(() => startOfWeekMonday(new Date()), []);

  const weekTotalMinutes = useMemo(() => {
    let total = 0;
    for (const w of workouts ?? []) if (isInWeek(w, weekStart)) total += durationMinutes(w);
    return total;
  }, [workouts, weekStart]);

  const weekTotalSessions = useMemo(() => {
    let total = 0;
    for (const w of workouts ?? []) if (isInWeek(w, weekStart)) total += 1;
    return total;
  }, [workouts, weekStart]);

  const streaks = useMemo(() => computeStreaks(workouts ?? []), [workouts]);

  // -------- Actions --------
  const handleLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("Willst du dich wirklich abmelden?");
    if (!ok) return;

    setSettingsOpen(false);
    setIsEditProfileOpen(false);
    setStatsOpen(false);

    logout();
  }, [logout]);

  const handleShareImage = useCallback(
    (w: WorkoutHistoryEntry) => {
      if (!w?.id) return;
      if (typeof onOpenWorkoutShare === "function") {
        onOpenWorkoutShare(w.id, "profile");
        return;
      }
      window.dispatchEvent(
        new CustomEvent("trainq:navigate", {
          detail: { path: "/workout-share", workoutId: w.id, returnTo: "profile" },
        })
      );
    },
    [onOpenWorkoutShare]
  );

  const handleCopyUserId = useCallback(async () => {
    const id = user?.id ?? "";
    if (!id) return;
    const ok = await copyText(id);
    setCopyFeedback(ok ? t("profile.copied") : t("profile.copyFailed"));
    window.setTimeout(() => setCopyFeedback(null), 2500);
  }, [user?.id]);

  const handleShareProfile = useCallback(async () => {
    const id = user?.id ?? "";
    if (!id) return;
    try {
      const result = await shareProfile({ userId: id, displayName: profileName });
      if (result === "copied") setShareFeedback(t("profile.linkCopied"));
      else if (result === "shared") setShareFeedback(t("profile.shared"));
      else setShareFeedback(t("profile.shareFailed"));
    } catch {
      setShareFeedback(t("profile.shareFailed"));
    } finally {
      window.setTimeout(() => setShareFeedback(null), 1800);
    }
  }, [user?.id, profileName]);

  const handleRestartOnboarding = useCallback(() => {
    if (typeof window === "undefined") return;

    const ok = window.confirm(
      t("profile.confirmRestartOnboarding")
    );
    if (!ok) return;

    resetOnboardingInStorage();
    setSettingsOpen(false);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      t("profile.confirmClearHistory")
    );
    if (!ok) return;
    clearWorkoutHistory();
    setWorkouts([]);
    alert(t("profile.historyCleared"));
  }, []);

  // -------------------- Theme-safe style helpers --------------------
  // (unused legacy helpers removed — all styling uses CSS variables inline)

  // -------- Monthly Recap Logic --------
  const [recapOpen, setRecapOpen] = useState(false);

  const { lastMonthYear, lastMonthIndex, lastMonthName, hasLastMonthWorkouts } = useMemo(() => {
    // Show recap only in the first 10 days after a month ends
    const now = new Date();
    const dayOfMonth = now.getDate();

    // Only show if we're in the first 10 days of the current month
    if (dayOfMonth > 10) {
      return { lastMonthYear: now.getFullYear(), lastMonthIndex: now.getMonth() - 1, lastMonthName: "", hasLastMonthWorkouts: false };
    }

    // Check the previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    const y = prevMonth.getFullYear();
    const m = prevMonth.getMonth();
    const has = workouts.some(w => {
      const wd = new Date(w.startedAt);
      return wd.getFullYear() === y && wd.getMonth() === m;
    });

    if (has) {
      const name = prevMonth.toLocaleString("de-DE", { month: "long" });
      return { lastMonthYear: y, lastMonthIndex: m, lastMonthName: name, hasLastMonthWorkouts: true };
    }

    return { lastMonthYear: y, lastMonthIndex: m, lastMonthName: "", hasLastMonthWorkouts: false };
  }, [workouts]);

  return (
    <>
      <div className="w-full min-h-full" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
        <div className="mx-auto w-full max-w-5xl px-4 pb-40 space-y-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <section className="mt-2 space-y-4">
            {/* ✅ Monthly Recap Trigger */}
            {hasLastMonthWorkouts && (
              <div
                onClick={() => setRecapOpen(true)}
                className="w-full rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-transform active:scale-[0.98]"
                style={{
                  background: "linear-gradient(90deg, rgba(0,122,255,0.15) 0%, rgba(0,0,0,0) 100%)",
                  border: "1px solid rgba(0,122,255,0.3)"
                }}
              >
                <div className="flex flex-col">
                  <span className="text-[#007AFF] text-xs font-bold uppercase tracking-wider mb-0.5">{t("profile.highlights")}</span>
                  <span className="font-semibold text-lg" style={{ color: "var(--text-color)" }}>{t("profile.monthReady", { month: lastMonthName, year: lastMonthYear })}</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#007AFF]/20 flex items-center justify-center text-[#007AFF]">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </div>
              </div>
            )}

            {/* Profile card */}
            <AppCard variant="glass" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1 min-w-0">
                  <h2 className="text-xl font-semibold truncate text-[var(--text-color)]">{profileName}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-main)" }}>
                    <span>{t("profile.workouts")}: <span className="font-medium">{weekTotalSessions}</span></span>
                    <span>{t("profile.time")}: <span className="font-medium">{Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m</span></span>
                    {streaks.current > 0 && (
                      <span className="flex items-center gap-1">
                        <Flame size={13} className="text-orange-400" fill="currentColor" />
                        <span className="font-medium text-orange-400">{streaks.current}d Streak</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <AppButton
                    onClick={handleShareProfile}
                    variant="ghost"
                    className="rounded-full !p-0 w-10 h-10"
                    title={t("profile.shareProfile")}
                    aria-label={t("profile.shareProfile")}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" style={{ color: "var(--text-main)" }}>
                      <path d="M12 3v12m0-12-4 4m4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </AppButton>
                  <AppButton
                    onClick={() => setSettingsOpen(true)}
                    variant="ghost"
                    className="rounded-full !p-0 w-10 h-10 flex items-center justify-center"
                    title={t("profile.settings")}
                    aria-label={t("profile.settings")}
                  >
                    <Settings className="w-5 h-5" style={{ color: "var(--text-main)" }} />
                  </AppButton>
                </div>
              </div>
            </AppCard>


            {(copyFeedback || shareFeedback) && (
              <AppCard variant="soft" className="px-4 py-2 text-sm text-center">
                <span className="text-[var(--text-secondary)]">{copyFeedback || shareFeedback}</span>
              </AppCard>
            )}


            {/* Rewards Section */}
            {(unclaimedCount > 0 || hasActiveGrant) && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-[var(--text-color)] px-1">{t("profile.rewards.title")}</h3>

                {/* Unclaimed Rewards */}
                {unclaimedRewards.map((ur) => (
                  <AppCard key={ur.id} variant="glass">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center text-yellow-500 shrink-0">
                        <Gift size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-color)]">{t("profile.rewards.unclaimed")}</p>
                        {ur.rewardExpiresAt && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            {t("profile.rewards.expiresAt").replace("{{date}}", new Date(ur.rewardExpiresAt).toLocaleDateString("de-DE"))}
                          </p>
                        )}
                      </div>
                      <AppButton
                        variant="primary"
                        size="sm"
                        onClick={() => claimChallengeReward(ur.id)}
                        disabled={rewardsLoading}
                      >
                        {t("profile.rewards.claim")}
                      </AppButton>
                    </div>
                  </AppCard>
                ))}

                {/* Active Pro Grants */}
                {activeGrants.map((grant) => (
                  <AppCard key={grant.id} variant="glass">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-500 shrink-0">
                        <Trophy size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-color)]">{t("profile.rewards.activePro")}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {t("profile.rewards.expiresAt").replace("{{date}}", new Date(grant.expiresAt).toLocaleDateString("de-DE"))}
                        </p>
                      </div>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}

            {/* Statistics */}
              <div className="space-y-4">

                {/* Streak Card */}
                {streaks.current > 0 && (
                  <div className="bg-[var(--card-bg)] rounded-[20px] p-4 border border-[var(--border-color)] flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,149,0,0.15)" }}>
                      <Flame size={24} className="text-orange-400" fill="currentColor" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Streak</div>
                      <div className="text-[22px] font-black text-[var(--text-color)] leading-tight">
                        {streaks.current} {streaks.current === 1 ? "Tag" : "Tage"}
                      </div>
                    </div>
                    {streaks.longest > streaks.current && (
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-[var(--text-secondary)]">Rekord</div>
                        <div className="text-[16px] font-bold text-[var(--text-secondary)]">{streaks.longest}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Heatmap Top */}
                <SectionErrorBoundary name="Heatmap">
                <ShareableStatCard titleForFile={`trainq-heatmap-${new Date().toISOString().split('T')[0]}`}>
                  <ConsistencyHeatmap workouts={workouts} garminActivities={garminActivities} />
                </ShareableStatCard>
                </SectionErrorBoundary>

                <div className="flex items-center justify-between px-1 mt-6">
                  <h3 className="text-lg font-semibold text-[var(--text-color)]">{t("profile.progress")}</h3>
                  <div className="flex items-center p-1 rounded-lg border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}>
                    {(["1W", "1M", "6M", "1Y"] as TimeRange[]).map((tr) => {
                      const locked = !canViewStatsRange(tr);
                      return (
                        <button
                          key={tr}
                          onClick={() => {
                            if (locked) {
                              window.dispatchEvent(new CustomEvent("trainq:open_paywall", { detail: { reason: "stats_history_limit" } }));
                              track("feature_blocked", { featureKey: "HISTORY_BEYOND_30_DAYS", contextScreen: "profile" });
                              return;
                            }
                            setTimeRange(tr);
                          }}
                          className="px-3 py-1 text-xs font-medium rounded-md transition-all relative"
                          style={{
                            backgroundColor: timeRange === tr ? "var(--card-bg)" : "transparent",
                            color: locked ? "var(--text-muted)" : timeRange === tr ? "var(--text-color)" : "var(--text-muted)",
                            boxShadow: timeRange === tr ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                            opacity: locked ? 0.6 : 1,
                          }}
                        >
                          {tr}
                          {locked && <span className="ml-0.5 text-[9px] align-super">Pro</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SectionErrorBoundary name="AreaChart-Volume">
                    <div className="cursor-pointer active:scale-[0.98] transition-transform" style={{ outline: "none", border: "none", WebkitTapHighlightColor: "transparent" }} onClick={() => setStatSheetOpen("volume")}>
                      <StatsChart
                        title={t("profile.stats.trainingLoad")}
                        valueDisplay={(stats.totals.volume / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " t"}
                        unit="kg"
                        data={stats.volumeData}
                        type="area"
                        color="#007AFF"
                        height={140}
                        compact
                      />
                    </div>
                  </SectionErrorBoundary>

                  <SectionErrorBoundary name="BarChart-Duration">
                    <div className="cursor-pointer active:scale-[0.98] transition-transform" style={{ outline: "none", border: "none", WebkitTapHighlightColor: "transparent" }} onClick={() => setStatSheetOpen("duration")}>
                      <StatsChart
                        title={t("profile.stats.trainingTime")}
                        valueDisplay={Math.round(stats.totals.duration / 60) + " h"}
                        unit="min"
                        data={stats.durationData}
                        type="bar"
                        color="#F59E0B"
                        height={140}
                        compact
                      />
                    </div>
                  </SectionErrorBoundary>

                  {stats.totals.distance > 0 && (
                    <SectionErrorBoundary name="AreaChart-Distance">
                      <div className="cursor-pointer active:scale-[0.98] transition-transform" style={{ outline: "none", border: "none", WebkitTapHighlightColor: "transparent" }} onClick={() => setStatSheetOpen("distance")}>
                        <StatsChart
                          title={t("profile.stats.distance")}
                          valueDisplay={stats.totals.distance.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km"}
                          unit="km"
                          data={stats.distanceData}
                          type="area"
                          color="#10B981"
                          height={140}
                          compact
                        />
                      </div>
                    </SectionErrorBoundary>
                  )}

                  <SectionErrorBoundary name="PieChart-Sports">
                    <div className="cursor-pointer active:scale-[0.98] transition-transform" style={{ outline: "none", border: "none", WebkitTapHighlightColor: "transparent" }} onClick={() => setStatSheetOpen("sports")}>
                      <StatsChart
                        title={t("profile.stats.sportsFocus")}
                        type="pie"
                        data={stats.sportSplitData}
                        unit="x"
                        height={140}
                        compact
                      />
                    </div>
                  </SectionErrorBoundary>

                </div>
              </div>


            {/* All Stats TRIGGER */}
            <button
              onClick={() => setAllStatsOpen(true)}
              className="w-full rounded-3xl p-4 flex items-center justify-between transition-all active:scale-[0.98]"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)", outline: "none", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-2xl" style={{ backgroundColor: "var(--input-bg)", color: "#007AFF" }}>
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: "var(--text-color)" }}>{t("profile.allStats")}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>PRs, Top-Übungen, Frequenz & mehr</div>
                </div>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            </button>

            {/* Nutrition Stats TRIGGER */}
            <button
              onClick={() => setNutritionStatsOpen(true)}
              className="w-full rounded-3xl p-4 flex items-center justify-between transition-all active:scale-[0.98]"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)", outline: "none", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-2xl" style={{ backgroundColor: "rgba(52,199,89,0.1)", color: "#34C759" }}>
                  <Apple className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: "var(--text-color)" }}>Ernährungsstatistiken</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>Kalorien, Makros, Ziel-Treue</div>
                </div>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            </button>

            {/* Workout history list TRIGGER */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl p-4 flex items-center justify-between transition-all group hover:opacity-90"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-2xl transition-colors" style={{ backgroundColor: "var(--input-bg)", color: "var(--text-muted)" }}>
                  <History className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: "var(--text-color)" }}>{t("profile.showAllWorkouts")}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{workouts.length} {t("profile.total")}</div>
                </div>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </div>
            </button>
          </section>
          <BottomSpacer />
        </div>
      </div>

      <SectionErrorBoundary name="MonthlyRecap">
      <MonthlyRecapModal
        isOpen={recapOpen}
        onClose={() => setRecapOpen(false)}
        year={lastMonthYear}
        month={lastMonthIndex}
        workouts={workouts}
      />
      </SectionErrorBoundary>

      {isHistoryOpen && (
        <WorkoutHistoryOverlay
          open={isHistoryOpen}
          workouts={workouts}
          onClose={() => setIsHistoryOpen(false)}
          onShare={handleShareImage}
        />
      )}


      {/* MODAL: Statistiken */}
      {statsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setStatsOpen(false); }}>
          <AppCard variant="glass" className="w-full max-w-5xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-color)]">{t("profile.statistics")}</h2>
              <AppButton onClick={() => setStatsOpen(false)} variant="ghost" size="sm" className="!p-1 rounded-full text-[var(--text-secondary)]">✕</AppButton>
            </div>
            <ProfileStatsDashboard workouts={workouts} weeklyGoalMinutes={WEEKLY_GOAL_MINUTES} />
          </AppCard>
        </div>
      )}

      {/* ALL STATS BOTTOM SHEET */}
      <AllStatsSheet open={allStatsOpen} onClose={() => setAllStatsOpen(false)} workouts={workouts} />

      {/* NUTRITION STATS BOTTOM SHEET */}
      <NutritionStatsSheet open={nutritionStatsOpen} onClose={() => setNutritionStatsOpen(false)} />

      {/* STAT DETAIL BOTTOM SHEET */}
      <StatDetailSheet
        type={statSheetOpen as StatType | null}
        onClose={() => setStatSheetOpen(null)}
        workouts={workouts}
      />

      {/* SETTINGS BOTTOM SHEET */}
      <BottomSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        height="92dvh"
        zIndex={100}
      >
        <SettingPage
          onBack={() => setSettingsOpen(false)}
          onClearCalendar={onClearCalendar || (() => { })}
          onOpenGoals={() => { }}
          isSheet
        />
      </BottomSheet>
    </>
  );
};

const ProfilePage: React.FC<ProfilePageProps> = (props) => (
  <ProfileErrorBoundary>
    <ProfilePageInner {...props} />
  </ProfileErrorBoundary>
);

export default ProfilePage;
