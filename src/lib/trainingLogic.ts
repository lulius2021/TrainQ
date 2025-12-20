// src/lib/trainingLogic.ts
import type { CalendarEvent } from "../types/training";

export type TrainingMode = "gym" | "running" | "cycling";

export interface TrainingStats {
  mode: TrainingMode;
  totalSessions: number;
  totalMinutes: number;
  totalDistanceKm: number;
}

/**
 * Versucht, aus einem CalendarEvent den "Trainingsmodus" abzuleiten.
 *
 * - Wenn ev.trainingType === "laufen"  -> "running"
 * - Wenn ev.trainingType === "radfahren" -> "cycling"
 * - Sonst -> "gym"
 */
export function getTrainingModeFromEvent(ev: CalendarEvent): TrainingMode {
  const anyEv = ev as any;
  const trainingType = anyEv.trainingType as
    | "laufen"
    | "radfahren"
    | "gym"
    | undefined;

  if (trainingType === "laufen") return "running";
  if (trainingType === "radfahren") return "cycling";

  // Fallback: alles andere als Gym
  return "gym";
}

function timeStringToMinutes(time: string | undefined): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map((p) => parseInt(p, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Berechnet Stats für eine bestimmte Trainingsart.
 *
 * - zählt nur Events mit type === "training"
 * - Running/Cycling werden nur gezählt, wenn getTrainingModeFromEvent(ev) passt
 * - Gym = alle Trainings ohne spezifischen Running/Cycling-Tag
 * - Distanz: optional aus ev.distanceKm (number) ausgelesen
 */
export function computeTrainingStats(
  events: CalendarEvent[],
  mode: TrainingMode
): TrainingStats {
  let totalSessions = 0;
  let totalMinutes = 0;
  let totalDistanceKm = 0;

  for (const ev of events) {
    if (ev.type !== "training") continue;

    const evMode = getTrainingModeFromEvent(ev);
    if (evMode !== mode) continue;

    totalSessions += 1;

    const start = timeStringToMinutes(ev.startTime);
    const end = timeStringToMinutes(ev.endTime);
    if (end > start) {
      totalMinutes += end - start;
    }

    const anyEv = ev as any;
    if (typeof anyEv.distanceKm === "number") {
      totalDistanceKm += anyEv.distanceKm;
    }
  }

  return {
    mode,
    totalSessions,
    totalMinutes,
    totalDistanceKm,
  };
}

/**
 * Komfortfunktion: liefert Stats für alle drei Modi in einem Rutsch.
 */
export function computeAllTrainingStats(
  events: CalendarEvent[]
): Record<TrainingMode, TrainingStats> {
  return {
    gym: computeTrainingStats(events, "gym"),
    running: computeTrainingStats(events, "running"),
    cycling: computeTrainingStats(events, "cycling"),
  };
}
