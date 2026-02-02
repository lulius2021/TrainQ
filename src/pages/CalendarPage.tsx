// src/pages/CalendarPage.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useI18n } from "../i18n/useI18n"; // Kept for formatDate if needed, otherwise remove if only t() was used
import type { CalendarEvent, NewCalendarEvent, TrainingType } from "../types/training";
import type { TrainingPlanTemplate, TrainingTemplate } from "../types/trainingTemplates";

// ✅ Entitlements (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";
import { useProGuard } from "../hooks/useProGuard";
import { useAuth } from "../hooks/useAuth";
import { loadTrainingPlanTemplates } from "../services/trainingPlanTemplatesService";
import { getTrainingTemplateById, loadTrainingTemplates } from "../services/trainingTemplatesService";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import TrainingPreviewSheet from "../components/calendar/TrainingPreviewSheet";
import { AddEventModal } from "../components/calendar/AddEventModal";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { EVENT_CATEGORIES } from "../constants/events";

// ✅ Plan-Seed -> LiveTraining (Preview + Start)
import {
  writeGlobalLiveSeed,
  navigateToLiveTraining,
  type LiveTrainingSeed,
  deleteLiveSeedForEvent,
  resolveLiveSeed,
  writeLiveSeedForEventOrKey,
  makeSeedKey,
  deleteLiveSeedForKey,
} from "../utils/liveTrainingSeed";
import { shiftPlanEvents } from "../utils/planShift";

interface CalendarPageProps {
  events: CalendarEvent[];
  onAddEvent: (input: NewCalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onUpdateEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;

  /** optional (für Free-Limit 7 Tage) */
  isPro?: boolean;
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

function isWithinDaysAhead(dateISO: string, daysAhead: number): boolean {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(dateISO + "T00:00:00"));
  if (!Number.isFinite(target.getTime())) return true;
  const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= daysAhead;
}

const weekdayShort = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const STORAGE_KEY_VIEW = "trainq_calendar_view";

// -------------------- Kategorien (Termine) --------------------

const STORAGE_KEY_CATEGORIES = "trainq_calendar_categories_v1";

type CategoryDef = { key: string; label: string };

const BASE_CATEGORIES: CategoryDef[] = [
  { key: "alltag", label: "Alltag" },
  { key: "arbeit", label: "Arbeit" },
  { key: "gesundheit", label: "Gesundheit" },
  { key: "freizeit", label: "Freizeit" },
  { key: "sonstiges", label: "Sonstiges" },
];

type AppointmentCategory = string;

// -------------------- Trainings-Typen --------------------

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  laufen: "Laufen",
  radfahren: "Radfahren",
  gym: "Gym",
  custom: "Custom",
};

// -------------------- Normalisierung / Guards --------------------

function normalizeTitle(t: unknown): string {
  return String(t ?? "").trim();
}

function slugifyCategoryLabel(label: string): string {
  const s = String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `custom_${s || "kategorie"}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v as T;
  } catch {
    return fallback;
  }
}

function dedupCategories(list: CategoryDef[]): CategoryDef[] {
  const seen = new Set<string>();
  const out: CategoryDef[] = [];
  for (const c of list) {
    const key = String(c?.key ?? "").trim();
    const label = String(c?.label ?? "").trim();
    if (!key || !label) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label });
  }
  return out;
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

function isTrainingEvent(ev: CalendarEvent): boolean {
  const type = String(ev.type ?? "other").trim();
  if (type === "training") return true;
  const tt = normalizeTrainingType((ev as any).trainingType);
  return !!tt;
}

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

function countSeed(seed: LiveTrainingSeed | null): { exercises: number; sets: number } {
  if (!seed || !Array.isArray(seed.exercises)) return { exercises: 0, sets: 0 };
  const exercises = seed.exercises.length;
  const sets = seed.exercises.reduce((acc, ex) => acc + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0);
  return { exercises, sets };
}

function fallbackSeedForNonGymEvent(ev: CalendarEvent): LiveTrainingSeed {
  const tt = getTrainingType(ev);
  const sport: LiveTrainingSeed["sport"] = tt === "laufen" ? "Laufen" : tt === "radfahren" ? "Radfahren" : "Custom";

  return {
    title: normalizeTitle(ev.title) || "Training",
    sport,
    isCardio: tt === "laufen" || tt === "radfahren",
    exercises: [],
  };
}

function seedForCreatedTraining(title: string, tt: TrainingType): LiveTrainingSeed {
  const sport: LiveTrainingSeed["sport"] =
    tt === "laufen" ? "Laufen" : tt === "radfahren" ? "Radfahren" : tt === "custom" ? "Custom" : "Gym";

  const isCardio = tt === "laufen" || tt === "radfahren";

  return {
    title: title || "Training",
    sport,
    isCardio,
    exercises: [],
  };
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  events,
  onAddEvent,
  onDeleteEvent,
  onUpdateEvents,
  isPro = false,
}) => {
  const { isPro: isProEntitlements, canUseCalendar7, consumeCalendar7, calendar7DaysRemaining, canUseShift, consumeShift } = useEntitlements();
  // removed t, kept hook if needed for date formatting, but logic below uses native Date
  const effectiveIsPro = isProEntitlements || isPro;
  const requirePro = useProGuard();

  // ---------- Theme-safe style helpers (wie Dashboard) ----------
  const surfaceBox: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)" };
  const surfaceSoft: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };
  const inputStyle: React.CSSProperties = {
    background: "var(--surface2)",
    borderColor: "var(--border)",
    color: "var(--text)",
  };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  const [viewMode, _setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "day";
    const stored = getScopedItem(STORAGE_KEY_VIEW);
    if (stored === "day" || stored === "week" || stored === "month") return stored;
    return "day";
  });

  const setViewMode = (mode: ViewMode) => {
    _setViewMode(mode);
    if (typeof window !== "undefined") {
      try {
        setScopedItem(STORAGE_KEY_VIEW, mode);
      } catch {
        // ignore
      }
    }
  };

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [previousView, setPreviousView] = useState<ViewMode | null>(null);
  const [createMode, setCreateMode] = useState<"appointment" | "training">("appointment");

  const [customCategories, setCustomCategories] = useState<CategoryDef[]>(() => {
    if (typeof window === "undefined") return [];
    const parsed = safeParse<CategoryDef[]>(getScopedItem(STORAGE_KEY_CATEGORIES), []);
    return dedupCategories(parsed);
  });

  const allCategories: CategoryDef[] = useMemo(
    () => dedupCategories([...BASE_CATEGORIES, ...customCategories]),
    [customCategories]
  );

  const categoryLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCategories) map.set(c.key, c.label);
    return map;
  }, [allCategories]);

  const getCategoryLabel = (key?: unknown): string | null => {
    const k = String(key ?? "").trim();
    if (!k) return null;
    return categoryLabelByKey.get(k) ?? k;
  };

  // ✅ New Modal State (Mode-based)
  const [addEventMode, setAddEventMode] = useState<'appointment' | 'training' | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [infoSheetEvent, setInfoSheetEvent] = useState<CalendarEvent | null>(null);
  const swipeRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTime: number;
    pointerId: number | null;
    handled: boolean;
  }>({ active: false, startX: 0, startY: 0, startTime: 0, pointerId: null, handled: false });

  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories));
    } catch {
      // ignore
    }
  }, [customCategories]);


  // -------------------- Navigation --------------------

  const goToday = () => {
    const today = startOfDay(new Date());
    setSelectedDate(today);
    // ✅ Heute-Button: In Monatsansicht springt auf heutigen Tag und öffnet Tagesansicht
    if (viewMode !== "day") {
      setPreviousView(viewMode);
      setViewMode("day");
    }
  };

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

  // -------------------- Events nach Datum gruppiert & sortiert --------------------

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (String(a.startTime ?? "") + a.title).localeCompare(String(b.startTime ?? "") + b.title));
    }
    return map;
  }, [events]);

  const eventsForSelectedDay = eventsByDate.get(selectedKey) ?? [];

  const monthGrid = useMemo(() => {
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();

    const firstOfMonth = new Date(y, m, 1);
    const lastOfMonth = new Date(y, m + 1, 0);

    const gridStart = startOfWeekMonday(firstOfMonth);

    const lastWeekStart = startOfWeekMonday(lastOfMonth);
    const gridEnd = new Date(lastWeekStart);
    gridEnd.setDate(lastWeekStart.getDate() + 6);

    const days: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [selectedDate]);

  const monthWeeks = useMemo(() => Math.max(1, Math.floor(monthGrid.length / 7)), [monthGrid]);

  const currentWeekDays = useMemo(() => {
    const start = startOfWeekMonday(selectedDate);
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return d;
    });
  }, [selectedDate]);

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

  // ✅ zentrale Seed-Auflösung (EventId -> key-Resolver inkl. Legacy)
  const resolveSeedForEvent = (event: CalendarEvent): LiveTrainingSeed | null => {
    return resolveLiveSeed({ eventId: event.id, dateISO: event.date, title: event.title });
  };

  const openTrainingPreview = (event: CalendarEvent) => {
    if (infoSheetOpen) {
      setInfoSheetOpen(false);
      setInfoSheetEvent(null);
    }
    setPreviewEvent(event);
    setPreviewOpen(true);
  };

  const closeTrainingPreview = () => {
    setPreviewOpen(false);
    setPreviewEvent(null);
  };

  const handleOpenAddEvent = (mode: 'appointment' | 'training') => {
    setAddEventMode(mode);
  };

  const handlePreviewSave = (nextEvent: CalendarEvent, seed: LiveTrainingSeed) => {
    onUpdateEvents?.((prev) => prev.map((ev) => (ev.id === nextEvent.id ? { ...ev, ...nextEvent } : ev)));
    writeLiveSeedForEventOrKey({ eventId: nextEvent.id, dateISO: nextEvent.date, title: nextEvent.title, seed });
    setPreviewEvent(nextEvent);
  };

  const handlePreviewStart = (nextEvent: CalendarEvent, seed: LiveTrainingSeed) => {
    writeGlobalLiveSeed(seed);
    closeTrainingPreview();
    navigateToLiveTraining(nextEvent.id);
  };


  const swipeDisabled = previewOpen || infoSheetOpen || !!addEventMode || isPlusMenuOpen;

  const handleSwipePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeDisabled) return;
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, button, a")) return;
    swipeRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      pointerId: e.pointerId,
      handled: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    if (!addEventMode) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const scrollY = window.scrollY || window.pageYOffset;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [addEventMode]);

  const handleSwipePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (!state.active || state.handled) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) > Math.abs(dy) * 1.3 && Math.abs(dx) > 10) {
      e.preventDefault();
    }
  };

  const handleSwipePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = swipeRef.current;
    if (!state.active || state.handled) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const dt = Date.now() - state.startTime;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 500) {
      state.handled = true;
      if (dx < 0) goNext();
      else goPrev();
    }
    swipeRef.current = { active: false, startX: 0, startY: 0, startTime: 0, pointerId: null, handled: false };
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // -------------------- Event erstellen --------------------

  const handleSaveNewEvent = (payload: NewCalendarEvent) => {
    const isBeyond7Days = !isWithinDaysAhead(payload.date, 7);

    if (!effectiveIsPro && isBeyond7Days) {
      const allowed = canUseCalendar7();
      if (!allowed) {
        requirePro("calendar_7days");
        return;
      }
    }

    onAddEvent(payload);

    if (!effectiveIsPro && isBeyond7Days) consumeCalendar7();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Eintrag wirklich löschen?")) return;

    const ev = events.find((e) => e.id === id);
    if (ev && isTrainingEvent(ev)) {
      // ✅ EventId-Seed entfernen
      deleteLiveSeedForEvent(id);

      // ✅ Key-Seeds entfernen (neu + legacy)
      const t = normalizeTitle(ev.title);
      const key = makeSeedKey(ev.date, t);
      deleteLiveSeedForKey(key);
      deleteLiveSeedForKey(key.replace("|", "")); // legacy (date+title)
    }

    onDeleteEvent(id);
  };

  const openDayViewFromDate = (d: Date, from: ViewMode) => {
    setPreviousView(from);
    setSelectedDate(startOfDay(d));
    setViewMode("day");
  };

  const handleBackFromDay = () => {
    if (previousView) setViewMode(previousView);
    else setViewMode("month");
  };

  const eventLabel = (ev: CalendarEvent): string | null => {
    if (isTrainingEvent(ev)) {
      const trainingType = getTrainingType(ev);
      if (trainingType && TRAINING_TYPE_LABELS[trainingType]) return TRAINING_TYPE_LABELS[trainingType];
      return "Training";
    }
    return getCategoryLabel((ev as any).category);
  };

  // -------------------- Plan Shift --------------------
  const handlePlanShift = () => {
    if (!onUpdateEvents) {
      alert("Plan verschieben: Diese Funktion benötigt Event-Updates. Bitte nutze das Dashboard für Plan-Shift.");
      return;
    }

    if (!effectiveIsPro) {
      const allowed = canUseShift();
      if (!allowed) {
        requirePro("plan_shift");
        return;
      }
    }

    const today = dateKey(new Date());
    const res = shiftPlanEvents({
      events,
      planId: null, // Alle Pläne
      days: 1,
      fromDateISO: today,
    });

    onUpdateEvents(res.nextEvents);
    if (!effectiveIsPro) consumeShift();
    setIsPlusMenuOpen(false);
    alert("Plan erfolgreich um 1 Tag verschoben.");
  };

  // -------------------- Info Sheet --------------------
  const openInfoSheet = (ev: CalendarEvent) => {
    setInfoSheetEvent(ev);
    setInfoSheetOpen(true);
  };

  const closeInfoSheet = () => {
    setInfoSheetOpen(false);
    setInfoSheetEvent(null);
  };

  const updateEventTime = (eventId: string, startTime: string, endTime?: string) => {
    if (!onUpdateEvents) return;
    onUpdateEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== eventId) return ev;
        return { ...ev, startTime, endTime: endTime ?? ev.endTime };
      })
    );
  };

  // -------------------- UI --------------------

  return (
    <>

      <div className="w-full text-[var(--text)]">
        <div className="mx-auto w-full max-w-5xl px-4 pt-0 pb-40 space-y-2">
          {/* Header */}
          <div className="mb-2">
            <h1 className="text-3xl font-bold text-white tracking-tight">Kalender</h1>
          </div>

          {/* Pager */}
          <div className="flex items-center">
            <div className="w-full inline-flex items-center rounded-2xl p-1 bg-[var(--surface)] border border-[var(--border)]">
              <AppButton
                onClick={goPrev}
                variant="ghost"
                className="h-10 w-10 !p-0 rounded-3xl"
              >
                ‹
              </AppButton>
              <span className="flex-1 text-center text-base font-semibold whitespace-nowrap text-[var(--text)]">
                {viewMode === "month" ? monthLabel : viewMode === "week" ? weekLabel : dayLabelFull}
              </span>
              <AppButton
                onClick={goNext}
                variant="ghost"
                className="h-10 w-10 !p-0 rounded-3xl"
              >
                ›
              </AppButton>
            </div>
          </div>

          {/* View switch + Today */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="inline-flex rounded-2xl p-1 text-base bg-[var(--surface)] border border-[var(--border)]">
              <AppButton
                onClick={() => setViewMode("day")}
                variant={viewMode === "day" ? "primary" : "ghost"}
                size="sm"
                className={viewMode === "day" ? "" : "text-[var(--muted)]"}
              >
                Tag
              </AppButton>
              <AppButton
                onClick={() => setViewMode("week")}
                variant={viewMode === "week" ? "primary" : "ghost"}
                size="sm"
                className={viewMode === "week" ? "" : "text-[var(--muted)]"}
              >
                Woche
              </AppButton>
              <AppButton
                onClick={() => setViewMode("month")}
                variant={viewMode === "month" ? "primary" : "ghost"}
                size="sm"
                className={viewMode === "month" ? "" : "text-[var(--muted)]"}
              >
                Monat
              </AppButton>
            </div>
            <AppButton
              onClick={goToday}
              variant="secondary"
              size="sm"
              className="shrink-0"
              title={viewMode === "day" ? "Heute" : "Heute öffnen"}
            >
              Heute
            </AppButton>
          </div>
          <AppCard
            variant="glass"
            className="relative min-h-[460px]"
            style={{ touchAction: "pan-y" }}
            onPointerDown={handleSwipePointerDown}
            onPointerMove={handleSwipePointerMove}
            onPointerUp={handleSwipePointerEnd}
            onPointerCancel={handleSwipePointerEnd}
          >
            {/* Monatsansicht */}
            {viewMode === "month" && (
              <div className="space-y-2">
                <div className="grid grid-cols-7 text-center text-sm text-[var(--muted)]">
                  {weekdayShort.map((wd) => (
                    <div key={wd} className="py-1">{wd}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2 text-sm">
                  {monthGrid.map((day) => {
                    const key = dateKey(day);
                    const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                    const isToday = key === todayKey;
                    const isSelected = key === selectedKey;
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const minH = monthWeeks === 5 ? 120 : 100;

                    // Date comparison for status logic
                    const now = startOfDay(new Date());
                    const checkDate = startOfDay(day);
                    const isPast = checkDate < now;
                    const isFuture = checkDate > now;

                    const cellClasses = [
                      "flex flex-col rounded-2xl px-2 py-2 text-left transition relative overflow-hidden",
                      isSelected
                        ? "bg-[var(--surface2)] ring-1 ring-[#007AFF] shadow-lg shadow-[#007AFF]/10"
                        : "bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/50",
                      !isCurrentMonth ? "opacity-30" : ""
                    ].join(" ");

                    return (
                      <button key={key} type="button" onClick={() => openDayViewFromDate(day, "month")} className={cellClasses} style={{ minHeight: minH }}>
                        {/* Today Highlight */}
                        {isToday && !isSelected && (
                          <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#007AFF]" />
                        )}

                        <div className="flex items-center justify-between w-full">
                          {/* Date Number */}
                          <div className={`text-base font-semibold ${isSelected ? "text-[#007AFF]" : isToday ? "text-white" : "text-[var(--muted)]"}`}>
                            {day.getDate()}
                          </div>
                        </div>

                        <div className="mt-auto space-y-1.5 w-full">
                          {dayEvents.slice(0, 4).map((ev) => {
                            const isDone = isCompletedTraining(ev);
                            const isTraining = isTrainingEvent(ev);
                            const status = (ev as any).trainingStatus;

                            // Visual Logic
                            let dotClass = "bg-[var(--muted)]"; // default other

                            if (!isTraining) {
                              const cat = EVENT_CATEGORIES.find(c => c.id === (ev as any).category);
                              if (cat) dotClass = cat.color;
                            }

                            if (isTraining) {
                              if (isDone) {
                                // Past + Done = Glowing Green
                                dotClass = "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]";
                              } else if (isPast && status !== "completed") {
                                // Past + Missed (not done) = Dimmed Red
                                dotClass = "bg-red-500/40";
                              } else if (isFuture || isToday) {
                                // Future = Hollow Ring (approximated with border)
                                dotClass = "bg-transparent border-[1.5px] border-white/30";
                              } else {
                                // Default fallback
                                dotClass = "bg-[var(--primary)]";
                              }
                            }

                            return (
                              <div key={ev.id} className={`h-2 w-full rounded-full transition-all ${dotClass}`} title={normalizeTitle(ev.title)} />
                            );
                          })}
                          {dayEvents.length > 4 && (
                            <div className="text-[10px] font-medium text-[var(--muted)] text-right">+{dayEvents.length - 4}</div>
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
              <div className="flex flex-col text-sm min-h-[390px] h-full">
                <div className="grid grid-cols-7 gap-x-2 gap-y-2 flex-1" data-no-tab-swipe="true" data-no-back-swipe="true">
                  {currentWeekDays.map((d, idx) => {
                    const key = dateKey(d);
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const isToday = key === todayKey;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openDayViewFromDate(d, "week")}
                        className={`flex flex-col h-full rounded-3xl p-2 text-left transition bg-[var(--surface)] border hover:bg-[var(--surface2)] min-w-0 ${isToday ? "border-[var(--primary)]/50" : "border-[var(--border)]"}`}
                      >
                        <div className="mb-2 flex items-center justify-between min-w-0">
                          <span className="text-sm font-medium leading-tight truncate text-[var(--muted)]">{weekdayShort[idx]}</span>
                          <span className="text-base font-semibold leading-none">{d.getDate()}</span>
                        </div>
                        <div className="mt-0.5 space-y-2 flex-1 min-w-0">
                          {dayEvents.map((ev) => {
                            const done = isCompletedTraining(ev);
                            const training = isTrainingEvent(ev);
                            const leftBorder = done ? "bg-green-500" : training ? "bg-[var(--primary)]" : "bg-[var(--muted)]";
                            return (
                              <div key={ev.id} className={`rounded-md px-2 py-1.5 min-w-0 bg-zinc-900 border border-zinc-800 border-l-[3px] shadow-sm ${leftBorder.replace("bg-", "border-")}`}>
                                <p className="text-xs font-semibold truncate text-[var(--text)]">{normalizeTitle(ev.title)}</p>
                                <p className="text-xs text-[var(--muted)]">{ev.startTime}</p>
                              </div>
                            );
                          })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tagesansicht */}
            {viewMode === "day" && (
              <div className="flex flex-col h-full">
                {(previousView === "month" || previousView === "week") && (
                  <div className="text-right mb-2">
                    <button type="button" onClick={handleBackFromDay} className="text-sm text-[var(--muted)] underline-offset-2 hover:underline">
                      Zurück zur {previousView === "month" ? "Monatsansicht" : "Wochenansicht"}
                    </button>
                  </div>
                )}
                <div className="space-y-4 flex-1">
                  {/* Weekly Summary Header */}
                  {(() => {
                    // Calculate Weekly Stats
                    const start = startOfWeekMonday(selectedDate);
                    const daysInWeek = Array.from({ length: 7 }).map((_, i) => {
                      const d = new Date(start);
                      d.setDate(d.getDate() + i);
                      return dateKey(d);
                    });

                    let scheduled = 0;
                    let completed = 0;

                    daysInWeek.forEach(k => {
                      const evs = eventsByDate.get(k) ?? [];
                      evs.forEach(ev => {
                        if (isTrainingEvent(ev)) {
                          scheduled++;
                          if (isCompletedTraining(ev)) completed++;
                        }
                      });
                    });

                    const percent = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;

                    if (scheduled === 0) return null;

                    return (
                      <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-zinc-800 px-4 py-3 shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Diese Woche</span>
                          <span className="text-sm font-medium text-white">{completed}/{scheduled} Einheiten erledigt</span>
                        </div>
                        <div className="text-xl font-bold text-white">{percent}%</div>
                      </div>
                    );
                  })()}

                  <div className="space-y-3">
                    {eventsForSelectedDay.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-[var(--border)] p-8 text-center bg-[var(--surface)]">
                        <p className="text-base text-[var(--muted)]">Keine Einträge für diesen Tag</p>
                        <button onClick={() => handleOpenAddEvent("training")} className="mt-2 text-sm text-[#007AFF] font-medium hover:underline">Training hinzufügen</button>
                      </div>
                    ) : (
                      eventsForSelectedDay.map((ev) => {
                        const label = eventLabel(ev);
                        const isTraining = isTrainingEvent(ev);
                        const isDone = isCompletedTraining(ev);
                        const trainingType = getTrainingType(ev);

                        // Card Styling Logic
                        // Left bar color
                        let barColor = "bg-[var(--muted)]";
                        if (isTraining) {
                          if (trainingType === "laufen" || trainingType === "radfahren") barColor = "bg-blue-500";
                          else if (trainingType === "gym") barColor = "bg-purple-500";
                          else barColor = "bg-orange-500"; // Custom
                        } else {
                          // Appointments
                          const cat = EVENT_CATEGORIES.find(c => c.id === (ev as any).category);
                          barColor = cat ? cat.color : "bg-emerald-500";
                        }

                        // Badge / Status
                        let statusBadge = null;
                        if (isTraining) {
                          if (isDone) {
                            statusBadge = (
                              <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-500/20 text-green-400">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              </div>
                            );
                          } else {
                            statusBadge = (
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border border-[var(--border)] px-1.5 py-0.5 rounded">
                                Geplant
                              </span>
                            );
                          }
                        }

                        return (
                          <div
                            key={ev.id}
                            className="group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer"
                            onClick={() => (isTraining ? openTrainingPreview(ev) : openInfoSheet(ev))}
                          >
                            {/* Context Indicators */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />

                            <div className="flex items-center p-4 pl-5 gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-bold text-white truncate leading-tight mb-0.5">
                                  {normalizeTitle(ev.title)}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  <span>
                                    {isTraining ? ev.startTime || "Ganztägig" : `${ev.startTime || ""} – ${ev.endTime || ""}`}
                                  </span>
                                  {label && (
                                    <>
                                      <span>•</span>
                                      <span>{label}</span>
                                    </>
                                  )}
                                  {/* Optional: Add Duration or Focus if available in notes or description */}
                                </div>
                              </div>

                              <div className="shrink-0 flex items-center">
                                {statusBadge}
                                {!isTraining && <span className="text-[var(--muted)] text-opacity-50">›</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

          </AppCard>

          {/* FAB mit Plus-Menü - Global Fixed */}
          <div className="fixed bottom-[110px] right-4 z-50 flex flex-col items-end gap-3 pointer-events-none">
            {isPlusMenuOpen && (
              <div className="pointer-events-auto mb-2 min-w-[180px] overflow-hidden rounded-2xl border border-zinc-800 bg-[var(--surface2)] shadow-2xl backdrop-blur-xl">
                <button type="button" onClick={() => { setIsPlusMenuOpen(false); handleOpenAddEvent("appointment"); }} className="w-full px-4 py-3 text-left text-base text-[var(--text)] hover:bg-[var(--surface)] active:bg-[var(--surface)] transition-colors">
                  Termin anlegen
                </button>
                <div className="h-px bg-[var(--border)]" />
                <button type="button" onClick={() => { setIsPlusMenuOpen(false); handleOpenAddEvent("training"); }} className="w-full px-4 py-3 text-left text-base text-[var(--text)] hover:bg-[var(--surface)] active:bg-[var(--surface)] transition-colors">
                  Training anlegen
                </button>
                {onUpdateEvents && (<>
                  <div className="h-px bg-[var(--border)]" />
                  <button type="button" onClick={handlePlanShift} className="w-full px-4 py-3 text-left text-base text-[var(--text)] hover:bg-[var(--surface)] active:bg-[var(--surface)] transition-colors">
                    Plan verschieben
                  </button>
                </>)}
              </div>
            )}
            <AppButton
              onClick={() => setIsPlusMenuOpen((prev) => !prev)}
              variant="primary"
              className={`pointer-events-auto h-14 w-14 rounded-full !p-0 text-3xl shadow-lg transition-transform ${isPlusMenuOpen ? "rotate-45" : ""}`}
              style={{ transform: isPlusMenuOpen ? "rotate(45deg)" : "rotate(0deg)" }}
            >
              +
            </AppButton>
          </div>
        </div>
      </div>

      <TrainingPreviewSheet
        open={previewOpen}
        event={previewEvent}
        onClose={closeTrainingPreview}
        onSave={handlePreviewSave}
        onStart={handlePreviewStart}
      />

      {/* ✅ Training-Info Bottomsheet */}
      {infoSheetOpen && infoSheetEvent && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" data-overlay-open="true" onClick={closeInfoSheet}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <AppCard variant="glass" className="rounded-t-[24px] rounded-b-none p-5 space-y-4 max-h-[85vh] overflow-y-auto border-b-0">
              <div className="flex justify-center mb-2"><div className="w-12 h-1.5 rounded-full bg-white/20" /></div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-[var(--text)]">{normalizeTitle(infoSheetEvent.title)}</h2>
                  <p className="text-base mt-1 text-[var(--muted)]">
                    {infoSheetEvent.date}
                    {infoSheetEvent.startTime ? ` • ${infoSheetEvent.startTime}` : ""}
                    {infoSheetEvent.endTime ? ` – ${infoSheetEvent.endTime}` : ""}
                  </p>
                </div>
                <AppButton onClick={closeInfoSheet} variant="ghost" size="sm" className="!p-2 aspect-square rounded-full">✕</AppButton>
              </div>
            </AppCard>
          </div>
        </div>
      )}

      {/* Unified Add Event Modal */}
      {addEventMode && (
        <AddEventModal
          isOpen={!!addEventMode}
          onClose={() => setAddEventMode(null)}
          initialDate={selectedKey}
          mode={addEventMode}
          onSave={handleSaveNewEvent}
        />
      )}
    </>
  );
};

export default CalendarPage;
