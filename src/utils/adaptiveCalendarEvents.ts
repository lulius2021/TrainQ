// src/utils/adaptiveCalendarEvents.ts

import type { CalendarEvent } from "../types/training";

type ApplyAdaptiveInput = {
  adaptiveProfile: "A" | "B" | "C";
  adaptiveReasons?: string[];
  estimatedMinutes?: number;
  note?: string;
  endTime?: string;
};

export function applyAdaptiveToCalendarEvent(event: CalendarEvent, input: ApplyAdaptiveInput): CalendarEvent {
  const reasons = (input.adaptiveReasons ?? []).slice(0, 5).map((r) => String(r));
  const estimated = typeof input.estimatedMinutes === "number" ? input.estimatedMinutes : undefined;

  const nextNotes = [event.notes, input.note].filter(Boolean).join(" • ");

  return {
    ...event,

    adaptiveProfile: input.adaptiveProfile,
    adaptiveReasons: reasons.length ? reasons : (event as any).adaptiveReasons,
    adaptiveEstimatedMinutes: estimated ?? (event as any).adaptiveEstimatedMinutes,
    adaptiveAppliedAt: new Date().toISOString(),

    endTime: input.endTime ?? event.endTime,
    notes: nextNotes || event.notes,
  } as any;
}