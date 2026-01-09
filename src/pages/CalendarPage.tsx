// src/pages/CalendarPage.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import type { CalendarEvent, NewCalendarEvent, TrainingType } from "../types/training";

// ✅ Entitlements (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";
import { useProGuard } from "../hooks/useProGuard";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import TrainingPreviewSheet from "../components/calendar/TrainingPreviewSheet";

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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  const [appointmentCategory, setAppointmentCategory] = useState<AppointmentCategory>("alltag");

  const [categoryCreateMode, setCategoryCreateMode] = useState<"select" | "create">("select");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const [trainingType, setTrainingType] = useState<TrainingType>("gym");

  const [form, setForm] = useState<NewCalendarEvent>({
    title: "",
    description: "",
    date: dateKey(new Date()),
    startTime: "",
    endTime: "",
    type: "other",
    notes: "",
  });

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

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setCreateMode("appointment");
    setAppointmentCategory("alltag");
    setCategoryCreateMode("select");
    setNewCategoryLabel("");
    setTrainingType("gym");
    setForm({
      title: "",
      description: "",
      date: selectedKey,
      startTime: "",
      endTime: "",
      type: "other",
      notes: "",
    });
  };

  const openCreateModal = (mode: "appointment" | "training") => {
    setForm((prev) => ({ ...prev, date: selectedKey, startTime: "", endTime: "" }));
    setCreateMode(mode);
    if (mode === "appointment") {
      setAppointmentCategory("alltag");
      setCategoryCreateMode("select");
      setNewCategoryLabel("");
    } else {
      setTrainingType("gym");
    }
    setIsCreateOpen(true);
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


  const swipeDisabled = previewOpen || infoSheetOpen || isCreateOpen || isPlusMenuOpen;

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
    if (!isCreateOpen) return;
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
  }, [isCreateOpen]);

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

  const maybeCreateCategory = (): { categoryKey?: string } => {
    if (createMode !== "appointment") return {};

    if (categoryCreateMode === "select") {
      return { categoryKey: appointmentCategory };
    }

    const label = normalizeTitle(newCategoryLabel);
    if (!label) return { categoryKey: appointmentCategory };

    const keyBase = slugifyCategoryLabel(label);

    let key = keyBase;
    let n = 2;
    while (categoryLabelByKey.has(key)) {
      key = `${keyBase}-${n}`;
      n++;
    }

    const next = dedupCategories([...customCategories, { key, label }]);
    setCustomCategories(next);

    setAppointmentCategory(key);
    setCategoryCreateMode("select");
    setNewCategoryLabel("");

    return { categoryKey: key };
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(form.title)) return;

    const isBeyond7Days = !isWithinDaysAhead(form.date, 7);

    if (!effectiveIsPro && isBeyond7Days) {
      const allowed = canUseCalendar7();
      if (!allowed) {
        requirePro("calendar_7days");
        return;
      }
    }

    const finalType: NewCalendarEvent["type"] = createMode === "training" ? "training" : "other";

    const extra: any = {};
    if (createMode === "appointment") {
      const created = maybeCreateCategory();
      extra.category = created.categoryKey ?? appointmentCategory;
    } else {
      extra.trainingType = trainingType;
      extra.trainingStatus = "open";

      // ✅ Seed wird NACH Event-Erstellung in App.tsx geschrieben (mit eventId)
      // Hier NICHT schreiben, da eventId noch nicht existiert
    }

    onAddEvent({
      ...form,
      ...extra,
      type: finalType,
      title: normalizeTitle(form.title),
      description: normalizeTitle(form.description),
      notes: normalizeTitle(form.notes),
      endTime: createMode === "training" ? "" : normalizeTitle((form as any).endTime),
      startTime: normalizeTitle((form as any).startTime),
    });

    if (!effectiveIsPro && isBeyond7Days) consumeCalendar7();

    setForm((prev) => ({ ...prev, title: "", description: "", notes: "" }));
    setIsCreateOpen(false);
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
    alert("Plan um +1 Tag verschoben.");
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
      <div className="w-full">
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 pt-4 pb-24 space-y-4">
          {/* Header / Pager */}
          <div className="flex items-center">
            <div className="w-full inline-flex items-center rounded-full px-1" style={surfaceBox}>
              <button
                type="button"
                onClick={goPrev}
                className="h-11 w-11 text-lg flex items-center justify-center rounded-full hover:opacity-95"
                aria-label="Zurück"
                title="Zurück"
                style={{ color: "var(--text)" }}
              >
                ‹
              </button>

              <span className="flex-1 text-center text-sm whitespace-nowrap" style={muted}>
                {viewMode === "month" ? monthLabel : viewMode === "week" ? weekLabel : dayLabelFull}
              </span>

              <button
                type="button"
                onClick={goNext}
                className="h-11 w-11 text-lg flex items-center justify-center rounded-full hover:opacity-95"
                aria-label="Weiter"
                title="Weiter"
                style={{ color: "var(--text)" }}
              >
                ›
              </button>
            </div>
          </div>

          {/* View switch + Today */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-full p-1 text-base" style={surfaceBox}>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className="px-5 py-2.5 rounded-full transition text-sm font-medium"
                style={viewMode === "day" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
              >
                Tag
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className="px-5 py-2.5 rounded-full transition text-sm font-medium"
                style={viewMode === "week" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
              >
                Woche
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className="px-5 py-2.5 rounded-full transition text-sm font-medium"
                style={viewMode === "month" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
              >
                Monat
              </button>
            </div>

            <button
              type="button"
              onClick={goToday}
              className="shrink-0 rounded-full px-4 py-2.5 text-sm font-medium hover:opacity-95"
              style={surfaceBox}
              title={viewMode === "day" ? "Heute" : "Heute (öffnet Tagesansicht)"}
            >
              <span style={muted}>Heute</span>
            </button>
          </div>

          {/* Main */}
          <div
            className="relative rounded-2xl p-4 shadow-lg shadow-black/10 min-h-[460px]"
            style={{ ...surfaceBox, touchAction: "pan-y" }}
            onPointerDown={handleSwipePointerDown}
            onPointerMove={handleSwipePointerMove}
            onPointerUp={handleSwipePointerEnd}
            onPointerCancel={handleSwipePointerEnd}
          >
            {/* Monatsansicht */}
            {viewMode === "month" && (
              <div className="space-y-2">
                <div className="grid grid-cols-7 text-center text-sm" style={muted}>
                  {weekdayShort.map((wd) => (
                    <div key={wd} className="py-1">
                      {wd}
                    </div>
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

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openDayViewFromDate(day, "month")}
                        className="flex flex-col rounded-2xl px-3 py-3 text-left transition hover:opacity-95"
                        style={{
                          minHeight: minH,
                          background: isSelected ? "rgba(37,99,235,0.14)" : "var(--surface2)",
                          border: isSelected
                            ? "1px solid rgba(59,130,246,0.45)"
                            : isToday
                            ? "1px solid rgba(59,130,246,0.45)"
                            : "1px solid var(--border)",
                          opacity: isCurrentMonth ? 1 : 0.45,
                          color: "var(--text)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-semibold">{day.getDate().toString().padStart(2, "0")}</span>
                        </div>

                        <div className="mt-1 space-y-1.5">
                          {dayEvents.slice(0, 3).map((ev) => {
                            const isDone = isCompletedTraining(ev);
                            const isTraining = isTrainingEvent(ev);
                            const dot = isDone
                              ? "rgba(16,185,129,0.85)"
                              : isTraining
                              ? "rgba(37,99,235,0.55)"
                              : "rgba(148,163,184,0.55)";
                            return (
                              <div
                                key={ev.id}
                                className="h-2.5 w-full rounded-full flex items-center gap-1"
                                style={{ background: dot }}
                                title={normalizeTitle(ev.title)}
                              />
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-xs font-medium" style={muted}>
                              +{dayEvents.length - 3}
                            </div>
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
                <p className="text-[13px] mb-2 font-medium" style={{ color: "var(--text)" }}>
                  Woche {weekLabel}
                </p>

                <div className="grid grid-cols-7 gap-x-1 gap-y-2 flex-1" data-no-tab-swipe="true" data-no-back-swipe="true">
                  {currentWeekDays.map((d, idx) => {
                    const key = dateKey(d);
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const isToday = key === todayKey;

                    const maxItems = 4;
                    const visible = dayEvents.slice(0, maxItems);
                    const rest = Math.max(0, dayEvents.length - visible.length);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openDayViewFromDate(d, "week")}
                        className="flex flex-col h-full rounded-xl p-2 text-left transition hover:opacity-95 min-w-0"
                        style={{
                          background: "var(--surface2)",
                          border: isToday ? "1px solid rgba(59,130,246,0.45)" : "1px solid var(--border)",
                          color: "var(--text)",
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between min-w-0">
                          <span className="text-[11px] font-medium leading-tight truncate" style={muted}>
                            {weekdayShort[idx]}
                          </span>
                          <span className="text-[13px] font-semibold leading-none">
                            {d.getDate().toString().padStart(2, "0")}
                          </span>
                        </div>

                        <div className="mt-0.5 space-y-1.5 flex-1 min-w-0">
                          {dayEvents.length === 0 && (
                            <span className="text-[11px]" style={muted}>
                              –
                            </span>
                          )}

                          {visible.map((ev) => {
                            const done = isCompletedTraining(ev);
                            const training = isTrainingEvent(ev);

                            const leftBorder = done
                              ? "rgba(16,185,129,0.75)"
                              : training
                              ? "rgba(37,99,235,0.65)"
                              : "rgba(148,163,184,0.55)";

                            return (
                              <div
                                key={ev.id}
                                className="rounded-lg px-2 py-1.5 min-w-0"
                                style={{
                                  background: done ? "rgba(16,185,129,0.10)" : "rgba(0,0,0,0.06)",
                                  border: "1px solid var(--border)",
                                  borderLeft: `4px solid ${leftBorder}`,
                                }}
                              >
                                <div className="flex items-center justify-between gap-1 min-w-0">
                                  <span className="text-[11px] font-semibold truncate">{normalizeTitle(ev.title)}</span>
                                  <span className="text-[11px] whitespace-nowrap" style={muted}>
                                    {ev.startTime}
                                  </span>
                                </div>

                                {done && (
                                  <div className="mt-0.5 text-[11px] font-semibold" style={{ color: "rgba(16,185,129,0.85)" }}>
                                    Gemacht
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {rest > 0 && (
                            <div className="text-[11px] pt-0.5" style={muted}>
                              +{rest} weitere
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tagesansicht */}
            {viewMode === "day" && (
              <div className="flex flex-col text-sm min-h-[390px] h-full">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium" style={muted}>
                    {dayLabelFull}
                  </p>
                  {(previousView === "month" || previousView === "week") && (
                    <button
                      type="button"
                      onClick={handleBackFromDay}
                      className="text-sm underline-offset-2 hover:underline"
                      style={muted}
                    >
                      Zurück zur {previousView === "month" ? "Monatsansicht" : "Wochenansicht"}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl p-4 space-y-3 flex-1" style={surfaceSoft}>
                  {eventsForSelectedDay.length === 0 ? (
                    <span className="text-sm" style={muted}>
                      Keine Termine an diesem Tag.
                    </span>
                  ) : (
                    eventsForSelectedDay.map((ev) => {
                      const label = eventLabel(ev);
                      const training = isTrainingEvent(ev);
                      const seed = training ? resolveSeedForEvent(ev) : null;
                      const counts = training ? countSeed(seed) : { exercises: 0, sets: 0 };
                      const showSeedMissingWarning = training && isGymTraining(ev) && !seed;

                      const leftBorder = isCompletedTraining(ev)
                        ? "rgba(16,185,129,0.75)"
                        : training
                        ? "rgba(37,99,235,0.65)"
                        : "rgba(148,163,184,0.55)";

                      return (
                        <div
                          key={ev.id}
                          className="rounded-xl px-4 py-4 flex flex-col gap-3 cursor-pointer"
                          onClick={() => (training ? openTrainingPreview(ev) : openInfoSheet(ev))}
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderLeft: `4px solid ${leftBorder}`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="text-base font-semibold truncate">{normalizeTitle(ev.title)}</span>

                              {isCompletedTraining(ev) && (
                                <span
                                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
                                  style={{
                                    background: "rgba(16,185,129,0.14)",
                                    border: "1px solid var(--border)",
                                    color: "rgba(16,185,129,0.85)",
                                  }}
                                >
                                  Gemacht
                                </span>
                              )}
                            </div>

                            <span className="text-sm whitespace-nowrap" style={muted}>
                              {isTrainingEvent(ev)
                                ? ev.startTime
                                  ? ev.startTime
                                  : ""
                                : `${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ""}`}
                            </span>
                          </div>

                          {label && (
                            <div className="text-sm" style={muted}>
                              {label}
                            </div>
                          )}
                          {ev.description && (
                            <div className="text-sm leading-snug" style={muted}>
                              {ev.description}
                            </div>
                          )}

                          {training && (
                            <div className="mt-1 flex items-center justify-between rounded-xl px-3 py-2.5" style={surfaceSoft}>
                              <div className="text-sm" style={muted}>
                                {counts.exercises} Üb. • {counts.sets} Sätze
                                {showSeedMissingWarning && (
                                  <span style={{ marginLeft: 10, color: "rgba(245,158,11,0.95)", fontWeight: 600 }}>
                                    Seed fehlt
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTrainingPreview(ev);
                                }}
                                className="px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-95"
                                style={{
                                  background: "rgba(37,99,235,0.14)",
                                  border: "1px solid var(--border)",
                                  color: "var(--text)",
                                }}
                                title="Vorschau öffnen"
                              >
                                Vorschau
                              </button>
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (training) {
                                  const seed = resolveSeedForEvent(ev);
                                  if (seed || !isGymTraining(ev)) {
                                    writeGlobalLiveSeed(seed || fallbackSeedForNonGymEvent(ev));
                                    navigateToLiveTraining(ev.id);
                                  }
                                }
                              }}
                              className="px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-95"
                              style={{ background: "rgba(16,185,129,0.95)", color: "#06120c" }}
                            >
                              Starten
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(ev.id);
                              }}
                              className="px-3 py-2 rounded-xl text-sm hover:opacity-95"
                              style={{ color: "rgba(239,68,68,0.85)", background: "rgba(239,68,68,0.10)" }}
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

            {/* FAB mit Plus-Menü */}
            <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
              {isPlusMenuOpen && (
                <div
                  className="rounded-2xl border shadow-xl overflow-hidden mb-2 text-[var(--text)]"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      openCreateModal("appointment");
                    }}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--surface2)]"
                  >
                    Termin anlegen
                  </button>
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      openCreateModal("training");
                    }}
                    className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--surface2)]"
                  >
                    Training anlegen
                  </button>
                  {onUpdateEvents && (
                    <>
                      <div style={{ height: 1, background: "var(--border)" }} />
                      <button
                        type="button"
                        onClick={handlePlanShift}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-[var(--surface2)]"
                      >
                        Plan um +1 verschieben
                      </button>
                    </>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                className="flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-xl shadow-black/20 hover:opacity-95 transition-transform"
                style={{
                  background: isPlusMenuOpen ? "rgba(37,99,235,0.85)" : "var(--primary)",
                  color: "#061226",
                  border: "1px solid var(--border)",
                  transform: isPlusMenuOpen ? "rotate(45deg)" : "rotate(0deg)",
                }}
              >
                +
              </button>
            </div>
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
          data-overlay-open="true"
          onClick={closeInfoSheet}
        >
          <div
            className="w-full max-w-2xl rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            style={surfaceBox}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="flex justify-center mb-2">
              <div className="w-12 h-1.5 rounded-full" style={{ background: "var(--border)" }} />
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>
                  {normalizeTitle(infoSheetEvent.title)}
                </div>
                <div className="text-sm mt-1" style={muted}>
                  {infoSheetEvent.date}
                  {infoSheetEvent.startTime ? ` • ${infoSheetEvent.startTime}` : ""}
                  {infoSheetEvent.endTime ? ` – ${infoSheetEvent.endTime}` : ""}
                </div>
                {isTrainingEvent(infoSheetEvent) && (
                  <div className="text-xs mt-1" style={muted}>
                    {eventLabel(infoSheetEvent)}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeInfoSheet}
                className="text-xl hover:opacity-95 shrink-0"
                style={muted}
              >
                ✕
              </button>
            </div>

            {isTrainingEvent(infoSheetEvent) && (
              <>
                <div className="rounded-xl p-4 space-y-4" style={surfaceSoft}>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
                      Startzeit
                    </label>
                    <input
                      type="time"
                      value={infoSheetEvent.startTime || ""}
                      onChange={(e) => updateEventTime(infoSheetEvent.id, e.target.value, infoSheetEvent.endTime)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm"
                      style={inputStyle}
                    />
                  </div>
                  {(() => {
                    const seed = resolveSeedForEvent(infoSheetEvent);
                    const counts = countSeed(seed);
                    if (counts.exercises > 0) {
                      return (
                        <div>
                          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
                            Übungen ({counts.exercises} Üb. • {counts.sets} Sätze)
                          </label>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {seed?.exercises?.map((ex, idx) => (
                              <div key={idx} className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(0,0,0,0.2)" }}>
                                <div className="font-medium" style={{ color: "var(--text)" }}>
                                  {ex.name || "Übung"}
                                </div>
                                {ex.sets && ex.sets.length > 0 && (
                                  <div className="text-xs mt-1" style={muted}>
                                    {ex.sets.length} {ex.sets.length === 1 ? "Satz" : "Sätze"}
                                    {ex.sets[0]?.reps !== undefined && ` • ${ex.sets[0].reps}${isGymTraining(infoSheetEvent) ? " Wdh" : " min"}`}
                                    {ex.sets[0]?.weight !== undefined && ` • ${ex.sets[0].weight}${isGymTraining(infoSheetEvent) ? " kg" : " km"}`}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {infoSheetEvent.description && (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
                        Beschreibung
                      </label>
                      <div className="text-sm" style={{ color: "var(--text)" }}>
                        {infoSheetEvent.description}
                      </div>
                    </div>
                  )}
                  {infoSheetEvent.notes && (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
                        Notizen
                      </label>
                      <div className="text-sm" style={{ color: "var(--text)" }}>
                        {infoSheetEvent.notes}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isTrainingEvent(infoSheetEvent)) {
                        const seed = resolveSeedForEvent(infoSheetEvent);
                        if (seed || !isGymTraining(infoSheetEvent)) {
                          writeGlobalLiveSeed(seed || fallbackSeedForNonGymEvent(infoSheetEvent));
                          navigateToLiveTraining(infoSheetEvent.id);
                          closeInfoSheet();
                        } else {
                          alert("Kein Seed gefunden. Bitte Plan erneut importieren.");
                        }
                      }
                    }}
                    className="flex-1 px-4 py-3.5 rounded-xl text-base font-semibold hover:opacity-95"
                    style={{ background: "rgba(16,185,129,0.95)", color: "#06120c" }}
                  >
                    Training starten
                  </button>
                  <button
                    type="button"
                    onClick={closeInfoSheet}
                    className="px-4 py-3.5 rounded-xl text-sm hover:opacity-95"
                    style={surfaceSoft}
                  >
                    Schließen
                  </button>
                </div>
              </>
            )}

            {!isTrainingEvent(infoSheetEvent) && (
              <div className="rounded-xl p-4" style={surfaceSoft}>
                <div className="text-sm" style={{ color: "var(--text)" }}>
                  {infoSheetEvent.description || "Keine weiteren Details."}
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={infoSheetEvent.startTime || ""}
                    onChange={(e) => updateEventTime(infoSheetEvent.id, e.target.value, infoSheetEvent.endTime)}
                    className="w-full rounded-lg px-3 py-2.5 text-sm"
                    style={inputStyle}
                  />
                </div>
                {infoSheetEvent.endTime && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-2" style={{ color: "var(--text)" }}>
                      Endzeit
                    </label>
                    <input
                      type="time"
                      value={infoSheetEvent.endTime || ""}
                      onChange={(e) => updateEventTime(infoSheetEvent.id, infoSheetEvent.startTime || "", e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm"
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Termin / Training erstellen */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4" data-overlay-open="true">
          <div className="w-full max-w-md rounded-2xl text-sm flex flex-col max-h-[85vh] overflow-hidden" style={surfaceBox}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-base font-semibold" style={{ color: "var(--text)" }}>
                {createMode === "training" ? "Training anlegen" : "Termin anlegen"}
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="text-sm hover:opacity-95"
                style={muted}
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!effectiveIsPro && (
                <div className="rounded-xl px-3 py-2.5 text-sm mb-3" style={surfaceSoft}>
                  <span style={muted}>
                    Free: {Math.max(0, Number(calendar7DaysRemaining))} übrig für Termine/Trainings &gt; 7 Tage voraus.
                  </span>
                </div>
              )}

              <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium" style={muted}>
                  Titel
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-base"
                  style={inputStyle}
                  placeholder={createMode === "training" ? "z.B. Push" : "z.B. Meeting"}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium" style={muted}>
                    Datum
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2.5 text-base"
                    style={inputStyle}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium" style={muted}>
                      Start
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                      className="w-full rounded-xl border px-3 py-2.5 text-base"
                      style={inputStyle}
                    />
                  </div>

                  {createMode === "appointment" ? (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium" style={muted}>
                        Ende
                      </label>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                        className="w-full rounded-xl border px-3 py-2.5 text-base"
                        style={inputStyle}
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              </div>

              {createMode === "appointment" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium" style={muted}>
                      Kategorie
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        if (categoryCreateMode === "select") {
                          setCategoryCreateMode("create");
                          setNewCategoryLabel("");
                        } else {
                          setCategoryCreateMode("select");
                          setNewCategoryLabel("");
                        }
                      }}
                      className="text-sm underline-offset-2 hover:underline"
                      style={muted}
                    >
                      {categoryCreateMode === "select" ? "Neue Kategorie" : "Aus Auswahl"}
                    </button>
                  </div>

                  {categoryCreateMode === "select" ? (
                    <select
                      value={appointmentCategory}
                      onChange={(e) => setAppointmentCategory(e.target.value as AppointmentCategory)}
                      className="w-full rounded-xl border px-3 py-2.5 text-base"
                      style={inputStyle}
                    >
                      {allCategories.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2.5 text-base"
                        style={inputStyle}
                        placeholder="z.B. Familie, Uni, Termine, Arzt..."
                      />
                      <div className="text-sm" style={muted}>
                        Beim Speichern wird die Kategorie dauerhaft gespeichert.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium" style={muted}>
                    Trainingstyp
                  </label>
                  <select
                    value={trainingType}
                    onChange={(e) => setTrainingType(e.target.value as TrainingType)}
                    className="w-full rounded-xl border px-3 py-2.5 text-base"
                    style={inputStyle}
                  >
                    {Object.keys(TRAINING_TYPE_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {TRAINING_TYPE_LABELS[k as TrainingType]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium" style={muted}>
                  Beschreibung (optional)
                </label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full min-h-[90px] rounded-xl border px-3 py-2.5 text-base"
                  style={inputStyle}
                  placeholder="Notizen / Details"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium" style={muted}>
                  Notizen (optional)
                </label>
                <input
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-base"
                  style={inputStyle}
                  placeholder="z.B. Ort / Reminder"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="px-4 py-2 rounded-xl border text-sm font-medium hover:opacity-95"
                  style={surfaceSoft}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-95"
                  style={{ background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" }}
                >
                  Speichern
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CalendarPage;
