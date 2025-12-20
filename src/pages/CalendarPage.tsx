// src/pages/CalendarPage.tsx

import React, { useMemo, useState } from "react";
import type { CalendarEvent, NewCalendarEvent, TrainingType } from "../types/training";
import { FeedbackBar } from "../components/feedback/FeedbackBar";

// ✅ Plan-Seed -> LiveTraining (Preview + Start)
import {
  readLiveSeedForEvent,
  readLiveSeedForKey,
  makeSeedKey,
  writeGlobalLiveSeed,
  navigateToLiveTraining,
  type LiveTrainingSeed,
} from "../utils/liveTrainingSeed";

interface CalendarPageProps {
  events: CalendarEvent[];
  onAddEvent: (input: NewCalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}

type ViewMode = "month" | "week" | "day";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Lokales Datum (YYYY-MM-DD)
function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 So – 6 Sa
  const diff = (day + 6) % 7; // 0 = Mo
  d.setDate(d.getDate() - diff);
  return d;
}

const weekdayShort = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const STORAGE_KEY_VIEW = "trainq_calendar_view";

// Kategorien für Termine
const CATEGORY_LABELS = {
  alltag: "Alltag",
  arbeit: "Arbeit",
  gesundheit: "Gesundheit",
  freizeit: "Freizeit",
  sonstiges: "Sonstiges",
} as const;

type AppointmentCategory = keyof typeof CATEGORY_LABELS;

// Trainings-Typen (UI/Storage-normalisiert: lowercase)
// ✅ Keys entsprechen src/types/training.ts -> TrainingType
const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  laufen: "Laufen",
  radfahren: "Radfahren",
  gym: "Gym",
  custom: "Custom",
};

// Dezente Background-Farben (Monats-Streifen)
const CATEGORY_BG_CLASSES: Record<AppointmentCategory, string> = {
  alltag: "bg-yellow-300/70",
  arbeit: "bg-purple-300/70",
  gesundheit: "bg-emerald-200/70",
  freizeit: "bg-orange-300/70",
  sonstiges: "bg-zinc-300/70",
};

const TRAINING_BG_CLASSES: Record<TrainingType, string> = {
  laufen: "bg-green-300/70",
  radfahren: "bg-sky-300/70",
  gym: "bg-red-300/70",
  custom: "bg-indigo-300/70",
};

// Dezente Border-Farben (Woche & Tag)
const CATEGORY_BORDER_CLASSES: Record<AppointmentCategory, string> = {
  alltag: "border-yellow-300/70",
  arbeit: "border-purple-300/70",
  gesundheit: "border-emerald-200/70",
  freizeit: "border-orange-300/70",
  sonstiges: "border-zinc-300/70",
};

const TRAINING_BORDER_CLASSES: Record<TrainingType, string> = {
  laufen: "border-green-300/70",
  radfahren: "border-sky-300/70",
  gym: "border-red-300/70",
  custom: "border-indigo-300/70",
};

// -------------------- Normalisierung / Guards --------------------

function normalizeTitle(t: unknown): string {
  return String(t ?? "").trim();
}

/**
 * ✅ TrainingType normalisieren
 * Akzeptiert sowohl:
 * - "gym" | "laufen" | "radfahren" | "custom" (Kalender)
 * - "Gym" | "Laufen" | "Radfahren" | "Custom" (Plan/UI)
 */
function normalizeTrainingType(input: unknown): TrainingType | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();

  if (lower === "gym") return "gym";
  if (lower === "laufen") return "laufen";
  if (lower === "radfahren") return "radfahren";
  if (lower === "custom") return "custom";

  // defensiv: manche alten Daten könnten "run/bike" etc. haben
  if (lower === "run" || lower === "running") return "laufen";
  if (lower === "bike" || lower === "cycling") return "radfahren";

  return null;
}

/**
 * ✅ Training-Event robust erkennen:
 * - ev.type === "training"
 * - oder trainingType gesetzt
 * - oder type fehlt (legacy) aber trainingType vorhanden
 *
 * Wichtig: Termine (other) dürfen NICHT als Training erkannt werden.
 */
function isTrainingEvent(ev: CalendarEvent): boolean {
  const type = (ev.type ?? "training") as any;
  if (type === "training") return true;
  const tt = normalizeTrainingType((ev as any).trainingType);
  return !!tt;
}

/** ✅ Completed-Training (trainingStatus === "completed") */
function isCompletedTraining(ev: CalendarEvent): boolean {
  const status = (ev as any).trainingStatus as string | undefined;
  return isTrainingEvent(ev) && status === "completed";
}

function getTrainingType(ev: CalendarEvent): TrainingType | null {
  return normalizeTrainingType((ev as any).trainingType);
}

function isGymTraining(ev: CalendarEvent): boolean {
  return getTrainingType(ev) === "gym";
}

// Helper: Farben & Labels je Event
function getEventBgClass(ev: CalendarEvent): string {
  // ✅ override: completed immer grün (Monats-Dots/Stripes)
  if (isCompletedTraining(ev)) return "bg-emerald-400/80";

  if (isTrainingEvent(ev)) {
    const trainingType = getTrainingType(ev);
    if (trainingType && TRAINING_BG_CLASSES[trainingType]) return TRAINING_BG_CLASSES[trainingType];
    return "bg-red-300/70";
  }

  const cat = (ev as any).category as AppointmentCategory | undefined;
  if (cat && CATEGORY_BG_CLASSES[cat]) return CATEGORY_BG_CLASSES[cat];
  return "bg-zinc-300/70";
}

function getEventBorderClass(ev: CalendarEvent): string {
  // ✅ override: completed immer grün (Woche/Tag Border)
  if (isCompletedTraining(ev)) return "border-emerald-400/80";

  if (isTrainingEvent(ev)) {
    const trainingType = getTrainingType(ev);
    if (trainingType && TRAINING_BORDER_CLASSES[trainingType]) return TRAINING_BORDER_CLASSES[trainingType];
    return "border-red-300/70";
  }

  const cat = (ev as any).category as AppointmentCategory | undefined;
  if (cat && CATEGORY_BORDER_CLASSES[cat]) return CATEGORY_BORDER_CLASSES[cat];
  return "border-zinc-300/70";
}

function getEventLabel(ev: CalendarEvent): string | null {
  if (isTrainingEvent(ev)) {
    const trainingType = getTrainingType(ev);
    if (trainingType && TRAINING_TYPE_LABELS[trainingType]) return TRAINING_TYPE_LABELS[trainingType];
    return "Training";
  }

  const cat = (ev as any).category as AppointmentCategory | undefined;
  if (cat && CATEGORY_LABELS[cat]) return CATEGORY_LABELS[cat];
  return null;
}

function countSeed(seed: LiveTrainingSeed | null): { exercises: number; sets: number } {
  if (!seed || !Array.isArray(seed.exercises)) return { exercises: 0, sets: 0 };
  const exercises = seed.exercises.length;
  const sets = seed.exercises.reduce((acc, ex) => acc + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
  return { exercises, sets };
}

function fallbackSeedForNonGymEvent(ev: CalendarEvent): LiveTrainingSeed {
  const tt = getTrainingType(ev);
  const sport: LiveTrainingSeed["sport"] =
    tt === "laufen" ? "Laufen" : tt === "radfahren" ? "Radfahren" : "Custom";

  return {
    title: normalizeTitle(ev.title) || "Training",
    sport,
    isCardio: tt === "laufen" || tt === "radfahren",
    exercises: [],
  };
}

export const CalendarPage: React.FC<CalendarPageProps> = ({ events, onAddEvent, onDeleteEvent }) => {
  // zuletzt genutzte Ansicht merken
  const [viewMode, _setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "day";
    const stored = window.localStorage.getItem(STORAGE_KEY_VIEW);
    if (stored === "day" || stored === "week" || stored === "month") return stored;
    return "day";
  });

  const setViewMode = (mode: ViewMode) => {
    _setViewMode(mode);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY_VIEW, mode);
      } catch {
        // ignore
      }
    }
  };

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // für Zurück-Button von der Tagesansicht
  const [previousView, setPreviousView] = useState<ViewMode | null>(null);

  // Tab im Modal: Termin vs Training
  const [createMode, setCreateMode] = useState<"appointment" | "training">("appointment");

  // Kategorie nur für Termine
  const [appointmentCategory, setAppointmentCategory] = useState<AppointmentCategory>("alltag");

  // Trainingstyp für Trainings (UI: lowercase)
  const [trainingType, setTrainingType] = useState<TrainingType>("gym");

  const [form, setForm] = useState<NewCalendarEvent>({
    title: "",
    description: "",
    date: dateKey(new Date()),
    startTime: "09:00",
    endTime: "10:00",
    type: "other",
    notes: "",
  });

  // ✅ Preview Modal State (für Training starten)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);

  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);

  // Navigation
  const goToday = () => setSelectedDate(startOfDay(new Date()));

  const goPrev = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "day") d.setDate(d.getDate() - 1);
      else if (viewMode === "week") d.setDate(d.getDate() - 7);
      else d.setMonth(d.getMonth() - 1);
      return startOfDay(d);
    });
  };

  const goNext = () => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (viewMode === "day") d.setDate(d.getDate() + 1);
      else if (viewMode === "week") d.setDate(d.getDate() + 7);
      else d.setMonth(d.getMonth() + 1);
      return startOfDay(d);
    });
  };

  // Events nach Datum gruppiert & sortiert
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime + a.title).localeCompare(b.startTime + b.title));
    }
    return map;
  }, [events]);

  const eventsForSelectedDay = eventsByDate.get(selectedKey) ?? [];

  // Monat-Grid (6 Wochen, 42 Tage)
  const monthGrid = useMemo(() => {
    const firstOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const start = startOfWeekMonday(firstOfMonth);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // aktuelle Woche (7 Tage)
  const currentWeekDays = useMemo(() => {
    const start = startOfWeekMonday(selectedDate);
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return d;
    });
  }, [selectedDate]);

  // Labels
  const monthLabel = selectedDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const dayLabelFull = selectedDate.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const weekLabel = useMemo(() => {
    const start = startOfWeekMonday(selectedDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    const endStr = end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    return `${startStr} – ${endStr}`;
  }, [selectedDate]);

  // ✅ zentrale Seed-Auflösung (EventId -> Fallback date|title)
  const resolveSeedForEvent = (event: CalendarEvent): LiveTrainingSeed | null => {
    const byEvent = readLiveSeedForEvent(event.id);
    if (byEvent) return byEvent;

    const title = normalizeTitle(event.title);
    const key = makeSeedKey(event.date, title);
    const byKey = readLiveSeedForKey(key);
    if (byKey) return byKey;

    return null;
  };

  const openTrainingPreview = (event: CalendarEvent) => {
    setPreviewEvent(event);
    setPreviewOpen(true);
  };

  const closeTrainingPreview = () => {
    setPreviewOpen(false);
    setPreviewEvent(null);
  };

  const previewSeed = useMemo(() => (previewEvent ? resolveSeedForEvent(previewEvent) : null), [previewEvent, events]);
  const previewCounts = useMemo(() => countSeed(previewSeed), [previewSeed]);

  const startPreviewedTraining = () => {
    if (!previewEvent) return;

    const seed = resolveSeedForEvent(previewEvent);

    // ✅ Gym: Seed Pflicht
    if (isGymTraining(previewEvent) && !seed) {
      window.alert("Kein Trainings-Seed gefunden. Bitte Plan erneut in den Kalender übernehmen.");
      return;
    }

    // ✅ Non-Gym: Seed optional -> Fallback
    const toWrite = seed ?? fallbackSeedForNonGymEvent(previewEvent);

    writeGlobalLiveSeed(toWrite);
    navigateToLiveTraining(previewEvent.id);
  };

  const startFreeTraining = () => {
    const empty: LiveTrainingSeed = { title: "Freies Training", sport: "Gym", isCardio: false, exercises: [] };
    writeGlobalLiveSeed(empty);
    navigateToLiveTraining(undefined);
  };

  // Event erstellen
  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(form.title)) return;

    // ✅ Appointment immer "other"
    const finalType: NewCalendarEvent["type"] = createMode === "training" ? "training" : "other";

    const extra: any = {};

    if (createMode === "appointment") {
      // ✅ Kategorie speichern
      extra.category = appointmentCategory;
      // Termin soll NICHT als Training erkannt werden:
      // extra.trainingType darf NICHT gesetzt werden
    } else {
      // ✅ TrainingType IMMER normalisiert speichern
      extra.trainingType = trainingType;
    }

    onAddEvent({
      ...form,
      ...extra,
      type: finalType,
      title: normalizeTitle(form.title),
      description: normalizeTitle(form.description),
      notes: normalizeTitle(form.notes),
    });

    setForm((prev) => ({ ...prev, title: "", description: "", notes: "" }));
    setIsCreateOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Termin wirklich löschen?")) return;
    onDeleteEvent(id);
  };

  // Drilldown in Tagesansicht
  const openDayViewFromDate = (d: Date, from: ViewMode) => {
    setPreviousView(from);
    setSelectedDate(startOfDay(d));
    setViewMode("day");
  };

  const handleBackFromDay = () => {
    if (previousView) setViewMode(previousView);
    else setViewMode("month");
  };

  const canStartPreview = useMemo(() => {
    if (!previewEvent) return false;
    if (!isTrainingEvent(previewEvent)) return false;
    // Gym braucht Seed, alle anderen nicht
    return isGymTraining(previewEvent) ? !!previewSeed : true;
  }, [previewEvent, previewSeed]);

  // -------------------- UI --------------------

  return (
    <>
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Kalender</h1>
          </div>

          {/* View-Toggle + Navigation */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Tag / Woche / Monat */}
            <div className="inline-flex rounded-full bg-black/40 border border-white/15 p-1 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={
                  "px-4 py-1.5 rounded-full " +
                  (viewMode === "day" ? "bg-brand-primary text-black shadow-sm" : "text-white/80 hover:bg-white/5")
                }
              >
                Tag
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={
                  "px-4 py-1.5 rounded-full " +
                  (viewMode === "week" ? "bg-brand-primary text-black shadow-sm" : "text-white/80 hover:bg-white/5")
                }
              >
                Woche
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={
                  "px-4 py-1.5 rounded-full " +
                  (viewMode === "month" ? "bg-brand-primary text-black shadow-sm" : "text-white/80 hover:bg-white/5")
                }
              >
                Monat
              </button>
            </div>

            {/* Heute + Pfeile + Label */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={goToday}
                className="rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/5"
              >
                Heute
              </button>
              <div className="inline-flex items-center rounded-full border border-white/15 bg-black/40">
                <button
                  type="button"
                  onClick={goPrev}
                  className="h-8 w-8 text-sm flex items-center justify-center hover:bg-white/5 rounded-l-full"
                >
                  ‹
                </button>
                <span className="px-3 text-[11px] text-white/80 whitespace-nowrap">
                  {viewMode === "month" ? monthLabel : viewMode === "week" ? weekLabel : dayLabelFull}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  className="h-8 w-8 text-sm flex items-center justify-center hover:bg-white/5 rounded-r-full"
                >
                  ›
                </button>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl bg-brand-card border border-white/5 p-5 shadow-lg shadow-black/30 min-h-[430px]">
            {/* Monatsansicht */}
            {viewMode === "month" && (
              <div className="space-y-4">
                <div className="grid grid-cols-7 text-center text-[11px] text-white/50">
                  {weekdayShort.map((wd) => (
                    <div key={wd} className="py-1">
                      {wd}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2 text-xs sm:text-sm">
                  {monthGrid.map((day) => {
                    const key = dateKey(day);
                    const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                    const isToday = key === todayKey;
                    const isSelected = key === selectedKey;
                    const dayEvents = eventsByDate.get(key) ?? [];

                    const cellClasses = ["flex flex-col rounded-2xl px-2.5 py-3 text-left transition min-h-[80px]"];
                    if (isSelected) cellClasses.push("bg-sky-500/20 border border-sky-400/70");
                    else if (isToday) cellClasses.push("bg-black/40 border border-sky-400/70");
                    else cellClasses.push("bg-black/30 border border-white/5 hover:bg-white/5");
                    if (!isCurrentMonth) cellClasses.push("opacity-40");

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openDayViewFromDate(day, "month")}
                        className={cellClasses.join(" ")}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] sm:text-xs">{day.getDate().toString().padStart(2, "0")}</span>
                        </div>

                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((ev) => (
                            <div key={ev.id} className={"h-1.5 w-full rounded-full " + getEventBgClass(ev)} />
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[9px] text-white/50">+{dayEvents.length - 3}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Wochenansicht */}
            {viewMode === "week" && (
              <div className="flex flex-col text-xs min-h-[360px] h-full">
                <p className="text-[11px] text-white/60 mb-1">Woche {weekLabel}</p>

                <div className="grid grid-cols-7 gap-2 flex-1">
                  {currentWeekDays.map((d, idx) => {
                    const key = dateKey(d);
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const isToday = key === todayKey;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openDayViewFromDate(d, "week")}
                        className={[
                          "flex flex-col h-full rounded-2xl bg-black/30 p-2.5 text-left transition",
                          isToday ? "border border-sky-400/70" : "border border-white/5 hover:bg-white/5",
                        ].join(" ")}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px] text-white/70">{weekdayShort[idx]}</span>
                          <span className="text-[11px]">{d.getDate().toString().padStart(2, "0")}</span>
                        </div>

                        <div className="mt-1 space-y-1 flex-1 overflow-y-auto pr-1">
                          {dayEvents.length === 0 && <span className="text-[10px] text-white/35">–</span>}

                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className={[
                                "rounded-md px-1.5 py-0.5 border-l-4",
                                isCompletedTraining(ev) ? "bg-emerald-500/15" : "bg-white/5",
                                getEventBorderClass(ev),
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-medium truncate">{normalizeTitle(ev.title)}</span>
                                <span className="text-[9px] text-white/60">{ev.startTime}</span>
                              </div>

                              {isCompletedTraining(ev) && (
                                <div className="mt-0.5 text-[9px] font-semibold text-emerald-200/90">Gemacht</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tagesansicht */}
            {viewMode === "day" && (
              <div className="flex flex-col text-xs min-h-[360px] h-full">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-white/60">{dayLabelFull}</p>
                  {(previousView === "month" || previousView === "week") && (
                    <button
                      type="button"
                      onClick={handleBackFromDay}
                      className="text-[11px] text-white/70 hover:text-white underline-offset-2 hover:underline"
                    >
                      Zurück zur {previousView === "month" ? "Monatsansicht" : "Wochenansicht"}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl bg-black/30 border border-white/10 p-4 space-y-2 flex-1 overflow-y-auto">
                  {eventsForSelectedDay.length === 0 ? (
                    <span className="text-[11px] text-white/50">Keine Termine an diesem Tag.</span>
                  ) : (
                    eventsForSelectedDay.map((ev) => {
                      const label = getEventLabel(ev);
                      const training = isTrainingEvent(ev);
                      const seed = training ? resolveSeedForEvent(ev) : null;
                      const counts = training ? countSeed(seed) : { exercises: 0, sets: 0 };
                      const showSeedMissingWarning = training && isGymTraining(ev) && !seed;

                      return (
                        <div
                          key={ev.id}
                          className={[
                            "rounded-xl border px-3 py-2 flex flex-col gap-1",
                            isCompletedTraining(ev) ? "bg-emerald-500/12" : "bg-black/40",
                            getEventBorderClass(ev),
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-semibold truncate">{normalizeTitle(ev.title)}</span>

                              {isCompletedTraining(ev) && (
                                <span className="shrink-0 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                                  Gemacht
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-white/60 whitespace-nowrap">
                              {ev.startTime} – {ev.endTime}
                            </span>
                          </div>

                          {label && <div className="text-[10px] text-white/70">{label}</div>}
                          {ev.description && <div className="text-[11px] text-white/70">{ev.description}</div>}

                          {training && (
                            <div className="mt-1 flex items-center justify-between rounded-lg bg-black/30 border border-white/10 px-2.5 py-2">
                              <div className="text-[11px] text-white/70">
                                {counts.exercises} Üb. • {counts.sets} Sätze
                                {showSeedMissingWarning && <span className="ml-2 text-amber-200/90">Seed fehlt</span>}
                              </div>

                              <button
                                type="button"
                                onClick={() => openTrainingPreview(ev)}
                                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-white"
                                title="Vorschau öffnen"
                              >
                                Vorschau
                              </button>
                            </div>
                          )}

                          <div className="mt-1 flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleDelete(ev.id)}
                              className="text-[10px] text-red-400 hover:text-red-300"
                            >
                              Löschen
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* FAB */}
            <button
              type="button"
              onClick={() => {
                setForm((prev) => ({ ...prev, date: selectedKey }));
                setCreateMode("appointment");
                setAppointmentCategory("alltag");
                setTrainingType("gym");
                setIsCreateOpen(true);
              }}
              className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary text-black text-2xl shadow-xl shadow-black/50 hover:bg-brand-primary/90"
            >
              +
            </button>
          </div>

          <FeedbackBar page="Kalender" />
        </div>
      </div>

      {/* ✅ Training Vorschau Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 shadow-lg shadow-black/40 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] text-white/60">Trainings-Vorschau</div>
                <div className="text-base font-semibold text-white">
                  {normalizeTitle(previewEvent?.title) || "Training"}
                </div>
                {previewEvent && (
                  <div className="text-[11px] text-white/60">
                    {previewEvent.date} • {previewEvent.startTime}–{previewEvent.endTime}
                  </div>
                )}
              </div>

              <button type="button" onClick={closeTrainingPreview} className="text-xs text-white/60 hover:text-white">
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-white/60">Umfang</div>
                <div className="text-[11px] text-white/80">
                  {previewCounts.exercises} Üb. • {previewCounts.sets} Sätze
                </div>
              </div>

              {previewEvent && isGymTraining(previewEvent) && !previewSeed && (
                <div className="mt-1 text-[11px] text-amber-200/90">
                  Hinweis: Kein Plan-Seed gefunden. Plan bitte erneut in den Kalender übernehmen.
                </div>
              )}

              {previewEvent && !isGymTraining(previewEvent) && !previewSeed && (
                <div className="mt-1 text-[11px] text-white/55">
                  Kein Plan-Seed nötig (MVP). Du kannst trotzdem starten.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={startPreviewedTraining}
                disabled={!canStartPreview}
                className={`flex-1 px-4 py-2 rounded-2xl text-sm font-semibold shadow ${
                  canStartPreview
                    ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                    : "bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                Training starten
              </button>

              <button
                type="button"
                onClick={() => {
                  closeTrainingPreview();
                  startFreeTraining();
                }}
                className="px-3 py-2 rounded-2xl bg-black/40 border border-white/15 text-[12px] text-white/85 hover:bg-white/5"
                title="Freies Training"
              >
                Frei
              </button>
            </div>

            <div className="text-[10px] text-white/45">
              Tipp: Im Tagesplan kannst du bei Trainings auch direkt auf „Vorschau“ gehen.
            </div>
          </div>
        </div>
      )}

      {/* Modal: Termin / Training erstellen */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="inline-flex rounded-full bg-black/40 border border-white/15 p-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setCreateMode("appointment")}
                  className={
                    "px-3 py-1.5 rounded-full " +
                    (createMode === "appointment"
                      ? "bg-brand-primary text-black shadow-sm"
                      : "text-white/80 hover:bg-white/5")
                  }
                >
                  Termin
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode("training")}
                  className={
                    "px-3 py-1.5 rounded-full " +
                    (createMode === "training"
                      ? "bg-brand-primary text-black shadow-sm"
                      : "text-white/80 hover:bg-white/5")
                  }
                >
                  Training
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3">
              {/* Titel */}
              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Titel</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                  placeholder={createMode === "training" ? "z.B. Push" : "z.B. Meeting"}
                />
              </div>

              {/* Datum + Zeit */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">Datum</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] text-white/60">Start</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                      className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] text-white/60">Ende</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                      className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                    />
                  </div>
                </div>
              </div>

              {/* Kategorie ODER TrainingType */}
              {createMode === "appointment" ? (
                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">Kategorie</label>
                  <select
                    value={appointmentCategory}
                    onChange={(e) => setAppointmentCategory(e.target.value as AppointmentCategory)}
                    className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2 text-[12px]"
                  >
                    {Object.keys(CATEGORY_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORY_LABELS[k as AppointmentCategory]}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">Trainingstyp</label>
                  <select
                    value={trainingType}
                    onChange={(e) => setTrainingType(e.target.value as TrainingType)}
                    className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2 text-[12px]"
                  >
                    {Object.keys(TRAINING_TYPE_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {TRAINING_TYPE_LABELS[k as TrainingType]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Beschreibung */}
              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Beschreibung (optional)</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full min-h-[70px] rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                  placeholder="Notizen / Details"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Notizen (optional)</label>
                <input
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                  placeholder="z.B. Ort / Reminder"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-[11px] text-white/80"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-[11px] font-medium"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarPage;