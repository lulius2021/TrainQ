// src/pages/CalendarPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import type { CalendarEvent, NewCalendarEvent, TrainingType } from "../types/training";

// ✅ Entitlements (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";

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

interface CalendarPageProps {
  events: CalendarEvent[];
  onAddEvent: (input: NewCalendarEvent) => void;
  onDeleteEvent: (id: string) => void;

  /** optional (für Free-Limit 7 Tage) */
  isPro?: boolean;
  onOpenPaywall?: (reason: "plan_shift" | "calendar_7days" | "adaptive_limit") => void;
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
  isPro = false,
  onOpenPaywall,
}) => {
  const { isPro: isProEntitlements, canUseCalendar7, consumeCalendar7, calendar7DaysRemaining } = useEntitlements();
  const effectiveIsPro = isProEntitlements || isPro;

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
  const [previousView, setPreviousView] = useState<ViewMode | null>(null);
  const [createMode, setCreateMode] = useState<"appointment" | "training">("appointment");

  const [customCategories, setCustomCategories] = useState<CategoryDef[]>(() => {
    if (typeof window === "undefined") return [];
    const parsed = safeParse<CategoryDef[]>(window.localStorage.getItem(STORAGE_KEY_CATEGORIES), []);
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

  const todayKey = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories));
    } catch {
      // ignore
    }
  }, [customCategories]);

  // -------------------- Navigation --------------------

  const goToday = () => {
    const today = startOfDay(new Date());
    setSelectedDate(today);

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
    setPreviewEvent(event);
    setPreviewOpen(true);
  };

  const closeTrainingPreview = () => {
    setPreviewOpen(false);
    setPreviewEvent(null);
  };

  const previewSeed = useMemo(() => (previewEvent ? resolveSeedForEvent(previewEvent) : null), [previewEvent]);
  const previewCounts = useMemo(() => countSeed(previewSeed), [previewSeed]);

  const startPreviewedTraining = () => {
    if (!previewEvent) return;

    const seed = resolveSeedForEvent(previewEvent);

    if (isGymTraining(previewEvent) && !seed) {
      window.alert("Kein Trainings-Seed gefunden. Bitte Plan erneut in den Kalender übernehmen.");
      return;
    }

    const toWrite = seed ?? fallbackSeedForNonGymEvent(previewEvent);

    writeGlobalLiveSeed(toWrite);
    closeTrainingPreview();
    navigateToLiveTraining(previewEvent.id);
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
        onOpenPaywall?.("calendar_7days");
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

      // ✅ Seed parallel unter stable key speichern (inkl. Legacy-Key Migration)
      const t = normalizeTitle(form.title);
      writeLiveSeedForEventOrKey({
        dateISO: form.date,
        title: t,
        seed: seedForCreatedTraining(t, trainingType),
      });
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

  const canStartPreview = useMemo(() => {
    if (!previewEvent) return false;
    if (!isTrainingEvent(previewEvent)) return false;
    return isGymTraining(previewEvent) ? !!previewSeed : true;
  }, [previewEvent, previewSeed]);

  const eventLabel = (ev: CalendarEvent): string | null => {
    if (isTrainingEvent(ev)) {
      const trainingType = getTrainingType(ev);
      if (trainingType && TRAINING_TYPE_LABELS[trainingType]) return TRAINING_TYPE_LABELS[trainingType];
      return "Training";
    }
    return getCategoryLabel((ev as any).category);
  };

  // -------------------- UI --------------------

  return (
    <>
      <div className="w-full">
        <div className="mx-auto w-full max-w-5xl px-2 pt-4 pb-24 space-y-2">
          {/* Header / Pager */}
          <div className="flex items-center">
            <div className="w-full inline-flex items-center rounded-full px-1" style={surfaceBox}>
              <button
                type="button"
                onClick={goPrev}
                className="h-10 w-10 text-base flex items-center justify-center rounded-full hover:opacity-95"
                aria-label="Zurück"
                title="Zurück"
                style={{ color: "var(--text)" }}
              >
                ‹
              </button>

              <span className="flex-1 text-center text-[12px] whitespace-nowrap" style={muted}>
                {viewMode === "month" ? monthLabel : viewMode === "week" ? weekLabel : dayLabelFull}
              </span>

              <button
                type="button"
                onClick={goNext}
                className="h-10 w-10 text-base flex items-center justify-center rounded-full hover:opacity-95"
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
            <div className="inline-flex rounded-full p-1 text-sm" style={surfaceBox}>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className="px-5 py-2 rounded-full transition"
                style={viewMode === "day" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
              >
                Tag
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className="px-5 py-2 rounded-full transition"
                style={viewMode === "week" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
              >
                Woche
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className="px-5 py-2 rounded-full transition"
                style={viewMode === "month" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
              >
                Monat
              </button>
            </div>

            <button
              type="button"
              onClick={goToday}
              className="shrink-0 rounded-full px-4 py-2 text-[12px] hover:opacity-95"
              style={surfaceBox}
              title={viewMode === "day" ? "Heute" : "Heute (öffnet Tagesansicht)"}
            >
              <span style={muted}>Heute</span>
            </button>
          </div>

          {/* Main */}
          <div className="relative rounded-2xl p-3 shadow-lg shadow-black/10 min-h-[430px]" style={surfaceBox}>
            {/* Monatsansicht */}
            {viewMode === "month" && (
              <div className="space-y-2">
                <div className="grid grid-cols-7 text-center text-[11px]" style={muted}>
                  {weekdayShort.map((wd) => (
                    <div key={wd} className="py-0.5">
                      {wd}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-xs sm:text-sm">
                  {monthGrid.map((day) => {
                    const key = dateKey(day);
                    const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                    const isToday = key === todayKey;
                    const isSelected = key === selectedKey;
                    const dayEvents = eventsByDate.get(key) ?? [];

                    const minH = monthWeeks === 5 ? 96 : 78;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openDayViewFromDate(day, "month")}
                        className="flex flex-col rounded-2xl px-2 py-2 text-left transition hover:opacity-95"
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
                          <span className="text-[11px] sm:text-xs">{day.getDate().toString().padStart(2, "0")}</span>
                        </div>

                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((ev) => {
                            const isDone = isCompletedTraining(ev);
                            const isTraining = isTrainingEvent(ev);
                            const dot = isDone
                              ? "rgba(16,185,129,0.85)"
                              : isTraining
                              ? "rgba(37,99,235,0.55)"
                              : "rgba(148,163,184,0.55)";
                            return <div key={ev.id} className="h-1.5 w-full rounded-full" style={{ background: dot }} />;
                          })}
                          {dayEvents.length > 3 && (
                            <div className="text-[9px]" style={muted}>
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
              <div className="flex flex-col text-xs min-h-[360px] h-full">
                <p className="text-[11px] mb-1" style={muted}>
                  Woche {weekLabel}
                </p>

                <div className="grid grid-cols-7 gap-1 flex-1">
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
                        className="flex flex-col h-full rounded-2xl p-2 text-left transition hover:opacity-95"
                        style={{
                          background: "var(--surface2)",
                          border: isToday ? "1px solid rgba(59,130,246,0.45)" : "1px solid var(--border)",
                          color: "var(--text)",
                        }}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px]" style={muted}>
                            {weekdayShort[idx]}
                          </span>
                          <span className="text-[11px]">{d.getDate().toString().padStart(2, "0")}</span>
                        </div>

                        <div className="mt-1 space-y-1 flex-1">
                          {dayEvents.length === 0 && (
                            <span className="text-[10px]" style={muted}>
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
                                className="rounded-md px-1.5 py-0.5"
                                style={{
                                  background: done ? "rgba(16,185,129,0.10)" : "rgba(0,0,0,0.06)",
                                  border: "1px solid var(--border)",
                                  borderLeft: `4px solid ${leftBorder}`,
                                }}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-medium truncate">{normalizeTitle(ev.title)}</span>
                                  <span className="text-[9px]" style={muted}>
                                    {ev.startTime}
                                  </span>
                                </div>

                                {done && (
                                  <div className="mt-0.5 text-[9px] font-semibold" style={{ color: "rgba(16,185,129,0.85)" }}>
                                    Gemacht
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {rest > 0 && (
                            <div className="text-[10px]" style={muted}>
                              +{rest}
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
              <div className="flex flex-col text-xs min-h-[360px] h-full">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px]" style={muted}>
                    {dayLabelFull}
                  </p>
                  {(previousView === "month" || previousView === "week") && (
                    <button
                      type="button"
                      onClick={handleBackFromDay}
                      className="text-[11px] underline-offset-2 hover:underline"
                      style={muted}
                    >
                      Zurück zur {previousView === "month" ? "Monatsansicht" : "Wochenansicht"}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl p-4 space-y-2 flex-1" style={surfaceSoft}>
                  {eventsForSelectedDay.length === 0 ? (
                    <span className="text-[11px]" style={muted}>
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
                          className="rounded-xl px-3 py-2 flex flex-col gap-1"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderLeft: `4px solid ${leftBorder}`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-semibold truncate">{normalizeTitle(ev.title)}</span>

                              {isCompletedTraining(ev) && (
                                <span
                                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
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

                            <span className="text-[10px] whitespace-nowrap" style={muted}>
                              {isTrainingEvent(ev)
                                ? ev.startTime
                                  ? ev.startTime
                                  : ""
                                : `${ev.startTime}${ev.endTime ? ` – ${ev.endTime}` : ""}`}
                            </span>
                          </div>

                          {label && (
                            <div className="text-[10px]" style={muted}>
                              {label}
                            </div>
                          )}
                          {ev.description && (
                            <div className="text-[11px]" style={muted}>
                              {ev.description}
                            </div>
                          )}

                          {training && (
                            <div className="mt-1 flex items-center justify-between rounded-lg px-2.5 py-2" style={surfaceSoft}>
                              <div className="text-[11px]" style={muted}>
                                {counts.exercises} Üb. • {counts.sets} Sätze
                                {showSeedMissingWarning && (
                                  <span style={{ marginLeft: 8, color: "rgba(245,158,11,0.95)" }}>Seed fehlt</span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => openTrainingPreview(ev)}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold hover:opacity-95"
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

                          <div className="mt-1 flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleDelete(ev.id)}
                              className="text-[10px] hover:opacity-95"
                              style={{ color: "rgba(239,68,68,0.85)" }}
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
                setForm((prev) => ({ ...prev, date: selectedKey, startTime: "", endTime: "" }));
                setCreateMode("appointment");
                setAppointmentCategory("alltag");
                setCategoryCreateMode("select");
                setNewCategoryLabel("");
                setTrainingType("gym");
                setIsCreateOpen(true);
              }}
              className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl shadow-xl shadow-black/20 hover:opacity-95"
              style={{ background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Training Vorschau Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl p-4 shadow-lg shadow-black/30 space-y-3" style={surfaceBox}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px]" style={muted}>
                  Trainings-Vorschau
                </div>
                <div className="text-base font-semibold">{normalizeTitle(previewEvent?.title) || "Training"}</div>
                {previewEvent && (
                  <div className="text-[11px]" style={muted}>
                    {previewEvent.date}
                    {previewEvent.startTime ? ` • ${previewEvent.startTime}` : ""}
                    {!isTrainingEvent(previewEvent) && previewEvent.endTime ? `–${previewEvent.endTime}` : ""}
                  </div>
                )}
              </div>

              <button type="button" onClick={closeTrainingPreview} className="text-xs hover:opacity-95" style={muted}>
                ✕
              </button>
            </div>

            <div className="rounded-xl px-3 py-2" style={surfaceSoft}>
              <div className="flex items-center justify-between">
                <div className="text-[11px]" style={muted}>
                  Umfang
                </div>
                <div className="text-[11px]">
                  {previewCounts.exercises} Üb. • {previewCounts.sets} Sätze
                </div>
              </div>

              {previewEvent && isGymTraining(previewEvent) && !previewSeed && (
                <div className="mt-1 text-[11px]" style={{ color: "rgba(245,158,11,0.95)" }}>
                  Hinweis: Kein Plan-Seed gefunden. Plan bitte erneut in den Kalender übernehmen.
                </div>
              )}

              {previewEvent && !isGymTraining(previewEvent) && !previewSeed && (
                <div className="mt-1 text-[11px]" style={muted}>
                  Kein Plan-Seed nötig (MVP). Du kannst trotzdem starten.
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={startPreviewedTraining}
                disabled={!canStartPreview}
                className="flex-1 px-4 py-2 rounded-2xl text-sm font-semibold shadow hover:opacity-95 disabled:cursor-not-allowed"
                style={
                  canStartPreview
                    ? { background: "rgba(16,185,129,0.95)", color: "#06120c" }
                    : { background: "rgba(148,163,184,0.25)", color: "var(--muted)" }
                }
              >
                Training starten
              </button>

              <button
                type="button"
                onClick={closeTrainingPreview}
                className="px-3 py-2 rounded-2xl text-[12px] hover:opacity-95"
                style={surfaceSoft}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Termin / Training erstellen */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl p-4 space-y-3 text-xs" style={surfaceBox}>
            <div className="flex items-center justify-between mb-1">
              <div className="inline-flex rounded-full p-1 text-[11px]" style={surfaceSoft}>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("appointment");
                    setCategoryCreateMode("select");
                    setNewCategoryLabel("");
                  }}
                  className="px-3 py-1.5 rounded-full"
                  style={
                    createMode === "appointment"
                      ? { background: "var(--primary)", color: "#061226" }
                      : { color: "var(--text)" }
                  }
                >
                  Termin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreateMode("training");
                    setForm((p) => ({ ...p, endTime: "" }));
                  }}
                  className="px-3 py-1.5 rounded-full"
                  style={
                    createMode === "training"
                      ? { background: "var(--primary)", color: "#061226" }
                      : { color: "var(--text)" }
                  }
                >
                  Training
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs hover:opacity-95"
                style={muted}
              >
                ✕
              </button>
            </div>

            {!effectiveIsPro && (
              <div className="rounded-xl px-3 py-2 text-[10px]" style={surfaceSoft}>
                <span style={muted}>
                  Free: {Math.max(0, Number(calendar7DaysRemaining))} übrig für Termine/Trainings &gt; 7 Tage voraus.
                </span>
              </div>
            )}

            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px]" style={muted}>
                  Titel
                </label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg border px-2 py-2"
                  style={inputStyle}
                  placeholder={createMode === "training" ? "z.B. Push" : "z.B. Meeting"}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px]" style={muted}>
                    Datum
                  </label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2"
                    style={inputStyle}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px]" style={muted}>
                      Start
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                      className="w-full rounded-lg border px-2 py-2"
                      style={inputStyle}
                    />
                  </div>

                  {createMode === "appointment" ? (
                    <div className="space-y-1">
                      <label className="block text-[11px]" style={muted}>
                        Ende
                      </label>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                        className="w-full rounded-lg border px-2 py-2"
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
                    <label className="block text-[11px]" style={muted}>
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
                      className="text-[11px] underline-offset-2 hover:underline"
                      style={muted}
                    >
                      {categoryCreateMode === "select" ? "Neue Kategorie" : "Aus Auswahl"}
                    </button>
                  </div>

                  {categoryCreateMode === "select" ? (
                    <select
                      value={appointmentCategory}
                      onChange={(e) => setAppointmentCategory(e.target.value as AppointmentCategory)}
                      className="w-full rounded-lg border px-2 py-2 text-[12px]"
                      style={inputStyle}
                    >
                      {allCategories.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1">
                      <input
                        value={newCategoryLabel}
                        onChange={(e) => setNewCategoryLabel(e.target.value)}
                        className="w-full rounded-lg border px-2 py-2 text-[12px]"
                        style={inputStyle}
                        placeholder="z.B. Familie, Uni, Termine, Arzt..."
                      />
                      <div className="text-[10px]" style={muted}>
                        Beim Speichern wird die Kategorie dauerhaft gespeichert.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="block text-[11px]" style={muted}>
                    Trainingstyp
                  </label>
                  <select
                    value={trainingType}
                    onChange={(e) => setTrainingType(e.target.value as TrainingType)}
                    className="w-full rounded-lg border px-2 py-2 text-[12px]"
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

              <div className="space-y-1">
                <label className="block text-[11px]" style={muted}>
                  Beschreibung (optional)
                </label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full min-h-[70px] rounded-lg border px-2 py-2"
                  style={inputStyle}
                  placeholder="Notizen / Details"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px]" style={muted}>
                  Notizen (optional)
                </label>
                <input
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg border px-2 py-2"
                  style={inputStyle}
                  placeholder="z.B. Ort / Reminder"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3 py-1.5 rounded-xl border text-[11px] hover:opacity-95"
                  style={surfaceSoft}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl text-[11px] font-medium hover:opacity-95"
                  style={{ background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" }}
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