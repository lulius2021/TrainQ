// src/hooks/useTrainingHistory.ts
import { useMemo } from "react";
import type { CalendarEvent } from "../types/training";
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";

export interface TrainingSession {
  date: string; // YYYY-MM-DD
  minutes: number;
  sourceEventId: string; // eventId oder workoutId
}

export interface TrainingDaySummary {
  date: string; // YYYY-MM-DD
  minutes: number;
  sessions: number;
}

export interface TrainingWeekSummary {
  weekKey: string; // z.B. "2025-03" (Jahr-Woche, monday-based)
  startOfWeek: string; // Montag der Woche (YYYY-MM-DD)
  minutes: number;
  sessions: number;
}

export interface TrainingHistoryResult {
  sessions: TrainingSession[];
  perDay: TrainingDaySummary[];
  perWeek: TrainingWeekSummary[];
  totalMinutes: number;
  totalSessions: number;
}

type Options = {
  /**
   * Calendar-Only:
   * Wenn false: nur completed zählen (wenn trainingStatus gesetzt ist).
   * Wenn true: zählt auch open Trainings als Sessions (MVP Default).
   */
  includePlanned?: boolean;

  /**
   * Calendar-Only:
   * Skipped Trainings ignorieren (Default true).
   */
  ignoreSkipped?: boolean;

  /**
   * Calendar-Only:
   * Wenn true: nur Events zählen, die wirklich Trainings sind
   * (type==="training" ODER trainingType gesetzt).
   * Wenn false: type undefined wird weiterhin als Training gezählt (legacy MVP).
   */
  strictTrainingOnly?: boolean;
};

function parseDateFromIso(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
}

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

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekKeyMonday(date: Date): string {
  // einfache Jahr-Woche Kennung basierend auf dem Montag der Woche
  const monday = startOfWeekMonday(date);
  const oneJan = new Date(monday.getFullYear(), 0, 1);
  const diffDays = (monday.getTime() - oneJan.getTime()) / (1000 * 60 * 60 * 24);
  const week = Math.floor(diffDays / 7) + 1;
  return `${monday.getFullYear()}-${String(week).padStart(2, "0")}`;
}

function parseHHMM(value: string): { h: number; m: number } | null {
  if (!value || typeof value !== "string") return null;
  const [hh, mm] = value.split(":");
  const h = Number(hh);
  const m = Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function minutesBetween(startTime: string, endTime: string): number {
  // robust: unterstützt auch "über Mitternacht"
  const s = parseHHMM(startTime);
  const e = parseHHMM(endTime);
  if (!s || !e) return 0;

  const start = s.h * 60 + s.m;
  const end = e.h * 60 + e.m;

  const raw = end >= start ? end - start : 24 * 60 - start + end;

  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, 24 * 60);
}

function isTrainingEvent(ev: CalendarEvent, strict: boolean): boolean {
  if (ev.type === "training") return true;
  if ((ev as any).trainingType) return true;

  // legacy: wenn type fehlt, früher als Training behandelt
  if (!strict && !ev.type) return true;

  return false;
}

/**
 * useTrainingHistory (Calendar)
 *
 * - Filtert CalendarEvents auf Trainings
 * - Rechnet Dauer (Minuten) aus Start/Ende
 * - Aggregiert nach Tag & Woche (Montag-basiert)
 */
export function useTrainingHistory(
  events: CalendarEvent[],
  options: Options = {}
): TrainingHistoryResult {
  const {
    includePlanned = true,
    ignoreSkipped = true,
    strictTrainingOnly = false,
  } = options;

  return useMemo(() => {
    const sessions: TrainingSession[] = [];

    for (const ev of events ?? []) {
      if (!ev?.date || !ev?.startTime || !ev?.endTime) continue;

      if (!isTrainingEvent(ev, strictTrainingOnly)) continue;

      if (ignoreSkipped && (ev as any).trainingStatus === "skipped") continue;

      if (!includePlanned && (ev as any).trainingStatus && (ev as any).trainingStatus !== "completed") {
        continue;
      }

      const minutes = minutesBetween(ev.startTime, ev.endTime);
      if (minutes <= 0) continue;

      sessions.push({
        date: ev.date,
        minutes,
        sourceEventId: ev.id,
      });
    }

    return aggregateSessions(sessions);
  }, [events, includePlanned, ignoreSkipped, strictTrainingOnly]);
}

/**
 * useWorkoutHistory (Strava-like Beiträge)
 *
 * - 1 WorkoutHistoryEntry == 1 echtes "gemacht" Training
 * - Dauer kommt aus durationSec
 * - Datum kommt aus endedAt/startedAt
 * - Aggregation identisch wie Calendar-Hook (perDay/perWeek)
 */
export function useWorkoutHistory(
  workouts: WorkoutHistoryEntry[]
): TrainingHistoryResult {
  return useMemo(() => {
    const sessions: TrainingSession[] = [];

    for (const w of workouts ?? []) {
      const iso = w.endedAt || w.startedAt;
      if (!iso) continue;

      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;

      const date = formatIsoDate(d);
      const minutes = Math.max(0, Math.round((w.durationSec ?? 0) / 60));

      // Wenn du willst, dass 0-min Workouts NICHT zählen, lass die Zeile so.
      // Wenn du willst, dass jedes beendete Training zählt, selbst 0 min, dann min 1:
      if (minutes <= 0) continue;

      sessions.push({
        date,
        minutes,
        sourceEventId: w.id,
      });
    }

    return aggregateSessions(sessions);
  }, [workouts]);
}

/* ---------------------------- Shared Aggregation --------------------------- */

function aggregateSessions(sessions: TrainingSession[]): TrainingHistoryResult {
  // Tages-Aggregation
  const dayMap = new Map<string, { minutes: number; sessions: number }>();
  for (const s of sessions) {
    const entry = dayMap.get(s.date) ?? { minutes: 0, sessions: 0 };
    entry.minutes += s.minutes;
    entry.sessions += 1;
    dayMap.set(s.date, entry);
  }

  const perDay: TrainingDaySummary[] = Array.from(dayMap.entries())
    .map(([date, value]) => ({
      date,
      minutes: value.minutes,
      sessions: value.sessions,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Wochen-Aggregation
  const weekMap = new Map<string, { minutes: number; sessions: number; startOfWeek: string }>();

  for (const s of sessions) {
    const d = parseDateFromIso(s.date);
    const monday = startOfWeekMonday(d);
    const weekKey = getWeekKeyMonday(d);
    const startOfWeekIso = formatIsoDate(monday);

    const entry = weekMap.get(weekKey) ?? { minutes: 0, sessions: 0, startOfWeek: startOfWeekIso };
    entry.minutes += s.minutes;
    entry.sessions += 1;
    weekMap.set(weekKey, entry);
  }

  const perWeek: TrainingWeekSummary[] = Array.from(weekMap.entries())
    .map(([weekKey, value]) => ({
      weekKey,
      startOfWeek: value.startOfWeek,
      minutes: value.minutes,
      sessions: value.sessions,
    }))
    .sort((a, b) => a.startOfWeek.localeCompare(b.startOfWeek));

  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const totalSessions = sessions.length;

  return { sessions, perDay, perWeek, totalMinutes, totalSessions };
}