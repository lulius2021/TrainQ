import { useMemo } from "react";
import type { CalendarEvent, TrainingType } from "../types/training";

export type TodaySessionSource = "calendar" | "quickstart";

export type TodaySession = {
  id: string;
  title: string;
  dateISO: string;
  startAt?: string;
  sportType: TrainingType;
  source: TodaySessionSource;
  event?: CalendarEvent;
};

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeTrainingType(input: unknown): TrainingType | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  if (lower === "gym") return "gym";
  if (lower === "laufen") return "laufen";
  if (lower === "radfahren") return "radfahren";
  if (lower === "custom") return "custom";

  if (lower === "run" || lower === "running") return "laufen";
  if (lower === "bike" || lower === "cycling") return "radfahren";

  return null;
}

function parseTimeToMinutes(hhmm?: string): number {
  if (!hhmm) return Number.POSITIVE_INFINITY;
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
}

export function useTodaysSessions(events: CalendarEvent[]) {
  const todayISO = useMemo(() => toLocalISODate(new Date()), []);

  const sessions = useMemo<TodaySession[]>(() => {
    return events
      .filter((event) => {
        if (event.date !== todayISO) return false;
        const type = event.type ?? "training";
        if (type === "training") return true;
        return !!normalizeTrainingType((event as any).trainingType);
      })
      .map((event) => {
        const type = normalizeTrainingType((event as any).trainingType) ?? "gym";
        const title = String(event.title ?? "").trim();
        return {
          id: event.id,
          title,
          dateISO: event.date,
          startAt: event.startTime || undefined,
          sportType: type,
          source: "calendar",
          event,
        } as TodaySession;
      })
      .sort((a, b) => parseTimeToMinutes(a.startAt) - parseTimeToMinutes(b.startAt));
  }, [events, todayISO]);

  const status = sessions.length === 0 ? "none" : sessions.length === 1 ? "single" : "multiple";
  const primarySession = sessions.length ? sessions[0] : undefined;

  return { sessions, status, primarySession, todayISO } as const;
}
