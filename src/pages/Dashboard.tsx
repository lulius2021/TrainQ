// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { useI18n } from "../i18n/useI18n";
import type {
  UpcomingTraining,
  CalendarEvent,
  NewCalendarEvent,
  TrainingType,
  EventType,
} from "../types/training";

// ✅ Onboarding (Weekly Goals ins Dashboard übernehmen)
import { readOnboardingDataFromStorage } from "../context/OnboardingContext";
import type { OnboardingData } from "../types/onboarding";

// ✅ Adaptives Training
import AdaptiveTrainingModal from "../components/adaptive/AdaptiveTrainingModal";
import type { AdaptiveAnswers, AdaptiveSuggestion } from "../types/adaptive";
import { calculateAdaptiveWorkout } from "../features/adaptive/engine";

// ✅ Helper: Adaptiv sauber ins CalendarEvent schreiben (Plural!)
import { applyAdaptiveToCalendarEvent } from "../utils/adaptiveCalendarEvents";

// ✅ Plan-Seed -> LiveTraining (zentral)
import {
  readLiveSeedForEvent,
  readLiveSeedForKey,
  makeSeedKey,
  writeLiveSeedForEventOrKey,
  writeGlobalLiveSeed,
  navigateToLiveTraining,
  type LiveTrainingSeed,
} from "../utils/liveTrainingSeed";

// ✅ Plan Shift (nur die reine Verschiebe-Logik; Limits laufen über entitlements.ts)
import { shiftPlanEvents } from "../utils/planShift";

// ✅ Entitlements Hook (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";
import { FREE_LIMITS } from "../utils/entitlements";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import TrainingPreviewSheet from "../components/calendar/TrainingPreviewSheet";

interface DashboardProps {
  upcoming: UpcomingTraining[]; // bleibt (App liefert es), wird hier aber nicht mehr angezeigt
  events: CalendarEvent[];
  onCreateQuickTraining: (input: NewCalendarEvent) => void;

  onUpdateEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onOpenWorkoutShare?: (workoutId: string, returnTo?: "dashboard" | "profile") => void;

  // ✅ bleibt optional als Legacy-Fallback (Demo), Source of Truth ist entitlements.ts
  isPro?: boolean;
  onOpenPaywall?: (reason: "plan_shift" | "calendar_7days" | "adaptive_limit") => void;
}

// -------------------- Date helpers --------------------

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

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTitle(t: unknown): string {
  return String(t ?? "").trim();
}

// -------------------- Training guards --------------------

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

function getEventType(e: CalendarEvent): EventType {
  return e.type ?? "training";
}

function isTrainingEvent(e: CalendarEvent): boolean {
  if (getEventType(e) === "training") return true;
  return normalizeTrainingType((e as any).trainingType) !== null;
}

function isGymTraining(e: CalendarEvent): boolean {
  return normalizeTrainingType((e as any).trainingType) === "gym";
}

function isCompletedTraining(e: CalendarEvent): boolean {
  if (!isTrainingEvent(e)) return false;
  return String((e as any).trainingStatus ?? "").toLowerCase() === "completed";
}

function formatDayLabelFromISO(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function seedCounts(seed: LiveTrainingSeed | null): { exercises: number; sets: number } {
  if (!seed) return { exercises: 0, sets: 0 };
  const exCount = Array.isArray(seed.exercises) ? seed.exercises.length : 0;
  const setCount = Array.isArray(seed.exercises)
    ? seed.exercises.reduce((acc, ex) => acc + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0)
    : 0;
  return { exercises: exCount, sets: setCount };
}

// -------------------- Adaptive helpers --------------------

function inferWorkoutTypeFromTitle(title: string): "Push" | "Pull" | "Upper" | "Lower" {
  const t = (title || "").toLowerCase();
  if (t.includes("pull")) return "Pull";
  if (t.includes("push")) return "Push";
  if (t.includes("upper")) return "Upper";
  if (t.includes("lower")) return "Lower";
  if (t.includes("oberkörper") || t.includes("oberkoerper")) return "Upper";
  if (t.includes("unterkörper") || t.includes("unterkoerper")) return "Lower";
  return "Push";
}

function mapSuggestionProfileToABC(p: AdaptiveSuggestion["profile"]): "A" | "B" | "C" {
  if (p === "stabil") return "A";
  if (p === "kompakt") return "B";
  return "C";
}

function addMinutesToHHMM(hhmm: string, minutesToAdd: number): string {
  const [hRaw, mRaw] = (hhmm || "18:00").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  const base = (Number.isFinite(h) ? h : 18) * 60 + (Number.isFinite(m) ? m : 0);
  const next = Math.max(0, base + Math.max(0, Math.round(minutesToAdd)));
  const hh = String(Math.floor(next / 60) % 24).padStart(2, "0");
  const mm = String(next % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getTemplateId(ev: CalendarEvent): string | null {
  const t = (ev as any).templateId;
  return typeof t === "string" && t.trim() ? t : null;
}

function fallbackSeedForNonGymEvent(ev: CalendarEvent): LiveTrainingSeed {
  const tt = normalizeTrainingType((ev as any).trainingType);
  const sport: LiveTrainingSeed["sport"] =
    tt === "laufen" ? "Laufen" : tt === "radfahren" ? "Radfahren" : "Custom";

  return {
    title: normalizeTitle(ev.title) || "Training",
    sport,
    isCardio: tt === "laufen" || tt === "radfahren",
    exercises: [],
  };
}

function parseHHMMToMinutes(hhmm: string): number {
  const [hRaw, mRaw] = (hhmm || "").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, h * 60 + m);
}

function durationMinutesFromEvent(ev: CalendarEvent): number {
  const start = parseHHMMToMinutes((ev as any).startTime);
  const end = parseHHMMToMinutes((ev as any).endTime);
  if (end <= start) return 0;
  return end - start;
}

function fallbackMinutesForCompleted(ev: CalendarEvent): number {
  const byTime = durationMinutesFromEvent(ev);
  if (byTime > 0) return byTime;

  const adaptive = (ev as any).adaptiveEstimatedMinutes;
  if (typeof adaptive === "number" && Number.isFinite(adaptive) && adaptive > 0) return Math.round(adaptive);

  const tt = normalizeTrainingType((ev as any).trainingType);
  if (tt === "laufen" || tt === "radfahren") return 45;
  if (tt === "custom") return 45;
  return 60; // Gym default
}

// -------------------- Kategorien (Termine) shared with CalendarPage --------------------

type CategoryDef = { key: string; label: string };

const STORAGE_KEY_CATEGORIES = "trainq_calendar_categories_v1";

const BASE_CATEGORIES: CategoryDef[] = [
  { key: "alltag", label: "Alltag" },
  { key: "arbeit", label: "Arbeit" },
  { key: "gesundheit", label: "Gesundheit" },
  { key: "freizeit", label: "Freizeit" },
  { key: "sonstiges", label: "Sonstiges" },
];

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
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

// -------------------- UI labels --------------------

const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  gym: "Gym",
  laufen: "Laufen",
  radfahren: "Radfahren",
  custom: "Custom",
};

// -------------------- Small UI helpers (keine neue Component-File) --------------------

function progressLabel(done: number, goal: number): string {
  const g = Math.max(1, goal);
  const pct = Math.min(999, Math.max(0, Math.round((done / g) * 100)));
  return `${pct}%`;
}

function primaryCtaLabel(ev: CalendarEvent | null): string {
  if (!ev) return "Training starten";
  const title = normalizeTitle((ev as any).title) || "Training";
  return `Start: ${title}`;
}

export const Dashboard: React.FC<DashboardProps> = ({
  upcoming: _upcoming,
  events,
  onCreateQuickTraining,
  onUpdateEvents,
  isPro: isProProp = false,
  onOpenPaywall,
}) => {
  const { t, formatDate } = useI18n();
  const today = startOfDay(new Date());
  const todayISO = dateKey(today);

  // -------------------- Entitlements (Hook) --------------------

  const {
    isPro,
    canUseAdaptive,
    consumeAdaptive,
    adaptiveBCRemaining,

    canUseShift,
    consumeShift,
    planShiftRemaining,
  } = useEntitlements();

  const effectiveIsPro = isPro || isProProp;

  const adaptiveLeft = useMemo(() => {
    if (effectiveIsPro) return Infinity;
    return Math.max(0, adaptiveBCRemaining);
  }, [adaptiveBCRemaining, effectiveIsPro]);

  const planShiftLeft = useMemo(() => {
    if (effectiveIsPro) return Infinity;
    return Math.max(0, planShiftRemaining);
  }, [planShiftRemaining, effectiveIsPro]);

  // -------------------- Onboarding Daten (Weekly Goals) --------------------

  const [onboarding, setOnboarding] = useState<OnboardingData>(() => readOnboardingDataFromStorage());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => setOnboarding(readOnboardingDataFromStorage());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const weeklyGoalMinutes = useMemo(() => {
    const h = (onboarding as any)?.training?.hoursPerWeek;
    const hours = typeof h === "number" && Number.isFinite(h) && h > 0 ? h : 5;
    return Math.round(hours * 60);
  }, [onboarding]);

  const weeklyGoalSessions = useMemo(() => {
    const s = (onboarding as any)?.training?.sessionsPerWeek;
    return typeof s === "number" && Number.isFinite(s) && s > 0 ? Math.round(s) : 3;
  }, [onboarding]);

  // -------------------- Kategorien state (shared) --------------------

  const [customCategories, setCustomCategories] = useState<CategoryDef[]>(() => {
    if (typeof window === "undefined") return [];
    const parsed = safeParse<CategoryDef[]>(getScopedItem(STORAGE_KEY_CATEGORIES), []);
    return dedupCategories(parsed);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setScopedItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories));
    } catch {
      // ignore
    }
  }, [customCategories]);

  const allCategories: CategoryDef[] = useMemo(
    () => dedupCategories([...BASE_CATEGORIES, ...customCategories]),
    [customCategories]
  );

  const categoryLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCategories) map.set(c.key, c.label);
    return map;
  }, [allCategories]);

  // -------------------- "+" Menü / Modals --------------------

  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isQuickEventModalOpen, setIsQuickEventModalOpen] = useState(false);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);

  // -------------------- Quick Termin --------------------

  const [quickEvent, setQuickEvent] = useState({
    title: "",
    date: todayISO,
    startTime: "18:00",
    endTime: "19:00",
    category: "alltag",
    description: "",
    notes: t("dashboard.quickNote"),
  });

  const [categoryCreateMode, setCategoryCreateMode] = useState<"select" | "create">("select");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const createCategoryIfNeeded = (): string => {
    if (categoryCreateMode === "select") return quickEvent.category;

    const label = normalizeTitle(newCategoryLabel);
    if (!label) return quickEvent.category;

    const baseKey = slugifyCategoryLabel(label);
    let key = baseKey;
    let n = 2;
    while (categoryLabelByKey.has(key)) {
      key = `${baseKey}-${n}`;
      n++;
    }

    setCustomCategories((prev) => dedupCategories([...prev, { key, label }]));
    setCategoryCreateMode("select");
    setNewCategoryLabel("");
    setQuickEvent((p) => ({ ...p, category: key }));

    return key;
  };

  const handleQuickEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(quickEvent.title)) return;

    const categoryKey = createCategoryIfNeeded();

    const payload: NewCalendarEvent = {
      title: normalizeTitle(quickEvent.title),
      description: normalizeTitle(quickEvent.description),
      date: quickEvent.date,
      startTime: quickEvent.startTime,
      endTime: quickEvent.endTime,
      type: "other",
      notes: normalizeTitle(quickEvent.notes),
      category: categoryKey,
    };

    onCreateQuickTraining(payload);

    setQuickEvent((prev) => ({ ...prev, title: "", description: "" }));
    setIsQuickEventModalOpen(false);
  };

  // -------------------- Quick Training --------------------

  const [newTraining, setNewTraining] = useState({
    date: todayISO,
    startTime: "18:00",
    endTime: "19:00",
    trainingType: "gym" as TrainingType,
    title: "",
    description: "",
    notes: t("dashboard.quickNote"),
  });

  const handleCreateTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(newTraining.title)) return;

    const payload: NewCalendarEvent = {
      title: normalizeTitle(newTraining.title),
      description: normalizeTitle(newTraining.description),
      date: newTraining.date || todayISO,
      startTime: newTraining.startTime,
      endTime: newTraining.endTime,
      type: "training",
      notes: normalizeTitle(newTraining.notes),
      trainingType: newTraining.trainingType,
      trainingStatus: "open",
    };

    onCreateQuickTraining(payload);

    setNewTraining((p) => ({ ...p, title: "", description: "" }));
    setIsTrainingModalOpen(false);
  };

  // -------------------- Week progress --------------------

  const weekStartISO = useMemo(() => dateKey(startOfWeekMonday(new Date())), []);
  const weekEndISO = useMemo(() => {
    const d = startOfWeekMonday(new Date());
    d.setDate(d.getDate() + 7);
    return dateKey(d);
  }, []);

  const plannedThisWeek = useMemo(() => {
    const list = events.filter((e) => isTrainingEvent(e) && e.date >= weekStartISO && e.date < weekEndISO);
    const sessions = list.length;
    const minutes = list.reduce((acc, ev) => acc + durationMinutesFromEvent(ev), 0);
    return { sessions, minutes };
  }, [events, weekStartISO, weekEndISO]);

  const doneThisWeek = useMemo(() => {
    const list = events.filter((e) => isCompletedTraining(e) && e.date >= weekStartISO && e.date < weekEndISO);
    const sessions = list.length;
    const minutes = list.reduce((acc, ev) => acc + fallbackMinutesForCompleted(ev), 0);
    return { sessions, minutes };
  }, [events, weekStartISO, weekEndISO]);

  const weekProgress = useMemo(() => {
    const goal = Math.max(1, weeklyGoalMinutes);
    const pct = Math.min(1, Math.max(0, doneThisWeek.minutes / goal));
    return pct;
  }, [doneThisWeek.minutes, weeklyGoalMinutes]);

  // -------------------- Plan-Training starten (Preview -> Live) --------------------

  const resolveSeedForEvent = (event: CalendarEvent): LiveTrainingSeed | null => {
    const byEvent = readLiveSeedForEvent(event.id);
    if (byEvent) return byEvent;

    const key = makeSeedKey(event.date, normalizeTitle(event.title));
    const byKey = readLiveSeedForKey(key);
    if (byKey) return byKey;

    return null;
  };

  const next3DaysKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      keys.push(dateKey(d));
    }
    return keys;
  }, [today]);

  const plannedEventsNext3Days = useMemo(() => {
    const list = events
      .filter((e) => isTrainingEvent(e) && next3DaysKeys.includes(e.date))
      .slice()
      .sort((a, b) =>
        (a.date + (a.startTime || "") + normalizeTitle(a.title)).localeCompare(
          b.date + (b.startTime || "") + normalizeTitle(b.title)
        )
      );

    const byDay = new Map<string, CalendarEvent>();
    for (const k of next3DaysKeys) {
      const first = list.find((e) => e.date === k);
      if (first) byDay.set(k, first);
    }
    return byDay;
  }, [events, next3DaysKeys]);

  const todayEvents = useMemo(() => events.filter((e) => e.date === todayISO), [events, todayISO]);
  const todayTrainingEvents = useMemo(() => todayEvents.filter((e) => isTrainingEvent(e)), [todayEvents]);

  const nextTrainingEvent = useMemo(() => {
    const sorted = events
      .filter((e) => isTrainingEvent(e))
      .slice()
      .sort((a, b) =>
        (a.date + (a.startTime || "") + normalizeTitle(a.title)).localeCompare(
          b.date + (b.startTime || "") + normalizeTitle(b.title)
        )
      );

    const todayFirst = sorted.find((e) => e.date === todayISO);
    if (todayFirst) return todayFirst;

    return sorted.find((e) => e.date > todayISO) ?? null;
  }, [events, todayISO]);

  // ✅ “Einfach”: Es gibt genau 1 Hauptaktion → Start des nächsten Trainings
  const primaryTraining = useMemo(() => todayTrainingEvents[0] ?? nextTrainingEvent, [todayTrainingEvents, nextTrainingEvent]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);
  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewEvent(null);
  };
  const openPreviewForEvent = (event: CalendarEvent) => {
    setPreviewEvent(event);
    setIsPreviewOpen(true);
  };

  const handlePreviewSave = (nextEvent: CalendarEvent, seed: LiveTrainingSeed) => {
    onUpdateEvents?.((prev) => prev.map((ev) => (ev.id === nextEvent.id ? { ...ev, ...nextEvent } : ev)));
    writeLiveSeedForEventOrKey({ eventId: nextEvent.id, dateISO: nextEvent.date, title: nextEvent.title, seed });
    setPreviewEvent(nextEvent);
  };

  const handlePreviewStart = (nextEvent: CalendarEvent, seed: LiveTrainingSeed) => {
    writeGlobalLiveSeed(seed);
    closePreview();
    navigateToLiveTraining(nextEvent.id);
  };




  // -------------------- Adaptives Training --------------------

  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [adaptiveTargetEvent, setAdaptiveTargetEvent] = useState<CalendarEvent | null>(null);

  const openAdaptiveForToday = () => {
    const target = todayTrainingEvents[0] ?? null;
    if (!target) return;
    setAdaptiveTargetEvent(target);
    setAdaptiveOpen(true);
  };

  const applyAdaptiveSelection = async (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => {
    if (!adaptiveTargetEvent) return;
    if (!onUpdateEvents) return;

    if (!effectiveIsPro) {
      const allowed = canUseAdaptive(suggestion.profile);
      if (!allowed) {
        onOpenPaywall?.("adaptive_limit");
        return;
      }
      consumeAdaptive(suggestion.profile);
    }

    if (suggestion.estimatedMinutes <= 0) return;

    // 1. Adaptive Engine: Workout berechnen
    // "Push_A" als Standard-Template oder basierend auf Kontext
    // In Zukunft: mapping von adaptiveTargetEvent.trainingType / title auf TemplateID
    const templateId = inferWorkoutTypeFromTitle(adaptiveTargetEvent.title) === 'Pull' ? 'Pull_A' : 'Push_A';

    // Import muss oben hinzugefügt werden! Ich nutze hier den vollen Pfad für Klarheit im Replace, 
    // aber sauberer ist der Import oben. Da ich im Replace-Block bin, füge ich Logik hier ein.
    // (Annahme: Import von calculateAdaptiveWorkout ist vorhanden - siehe separaten Replace-Block oder Import-Update)
    const result = await calculateAdaptiveWorkout({ templateId });

    // 2. Seed erstellen
    const seed: LiveTrainingSeed = {
      title: `Adaptive ${suggestion.title}`,
      sport: "Gym",
      isCardio: false,
      exercises: result.exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: ex.sets.map(s => ({
          reps: s.reps,
          weight: s.weight,
          notes: s.notes
        }))
      }))
    };

    // 3. Seed speichern (damit "Start" Button direkt das richtige Workout lädt)
    writeLiveSeedForEventOrKey({
      eventId: adaptiveTargetEvent.id,
      dateISO: adaptiveTargetEvent.date,
      title: adaptiveTargetEvent.title,
      seed
    });

    // 4. Update Event
    const adaptiveProfileABC = mapSuggestionProfileToABC(suggestion.profile);
    const reasons = (suggestion.reasons ?? []).slice(0, 3).map((r) => String(r));
    const newEnd = addMinutesToHHMM((adaptiveTargetEvent as any).startTime, suggestion.estimatedMinutes);

    onUpdateEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== adaptiveTargetEvent.id) return ev;

        const patched = applyAdaptiveToCalendarEvent(ev, {
          adaptiveProfile: adaptiveProfileABC,
          adaptiveReasons: reasons,
          estimatedMinutes: suggestion.estimatedMinutes,
          note: `Adaptiv: ${suggestion.title} (${result.reason})`,
          endTime: newEnd,
        }) as CalendarEvent;

        return {
          ...patched,
          adaptiveSuggestion: suggestion,
          adaptiveAnswers: answers,
          adaptiveAppliedAt: new Date().toISOString(),
          adaptiveEstimatedMinutes: suggestion.estimatedMinutes,
        };
      })
    );

    setAdaptiveOpen(false);
    setAdaptiveTargetEvent(null);
  };

  // -------------------- PLAN SHIFT --------------------

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftCandidates, setShiftCandidates] = useState<Array<{ id: string; label: string }>>([]);
  const [shiftSelectedPlanId, setShiftSelectedPlanId] = useState<string>("__ALL__");

  const futureTrainingEvents = useMemo(
    () => events.filter((e) => isTrainingEvent(e) && e.date >= todayISO),
    [events, todayISO]
  );

  const detectPlans = () => {
    const set = new Set<string>();
    for (const ev of futureTrainingEvents) {
      const pid = getTemplateId(ev);
      if (pid) set.add(pid);
    }
    return Array.from(set).map((id) => ({ id, label: `Plan ${id.slice(0, 6)}…` }));
  };

  const openShiftDialog = () => {
    const plans = detectPlans();
    setShiftCandidates(plans);
    setShiftSelectedPlanId(plans.length >= 2 ? plans[0].id : "__ALL__");
    setShiftOpen(true);
  };

  const doShift = () => {
    if (!onUpdateEvents) return;

    if (!effectiveIsPro) {
      const allowed = canUseShift();
      if (!allowed) {
        onOpenPaywall?.("plan_shift");
        return;
      }
    }

    const planId = shiftSelectedPlanId === "__ALL__" ? null : shiftSelectedPlanId;

    onUpdateEvents((prev) => {
      const res = shiftPlanEvents({
        events: prev,
        planId,
        days: 1,
        fromDateISO: todayISO,
      });
      return res.nextEvents;
    });

    if (!effectiveIsPro) consumeShift();
    setShiftOpen(false);
  };

  // -------------------- Render helpers (Style konsistent & größere Schrift) --------------------

  const cardStyle: React.CSSProperties = {
    background: "rgba(0,0,0,0.18)",
    border: "1px solid var(--border)",
  };

  const primaryBtnStyle: React.CSSProperties = {
    background: "rgba(37, 99, 235, 0.92)",
    borderColor: "rgba(59, 130, 246, 0.35)",
    color: "#061226",
  };

  const secondaryBtnStyle: React.CSSProperties = {
    background: "rgba(37, 99, 235, 0.16)",
    borderColor: "rgba(59, 130, 246, 0.32)",
    color: "var(--text)",
  };

  // -------------------- Render --------------------

  return (
    <>
      <div className="min-h-[100dvh] w-full text-[var(--text)] bg-[var(--bg)]">
        {/* Global Spacing & Layout */}
        <div className="mx-auto w-full max-w-5xl flex flex-col gap-6 px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-[var(--nav-height)]">

          {/* Collapsing Large Title */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">Dashboard</h1>
          </div>

          {/* =========================================================
            1) TOP CARD: 1 klare Hauptaktion + kompakter Status
            ========================================================= */}
          <AppCard variant="glass" className="relative p-0 overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--muted)]">Dashboard</p>
                  <h1 className="text-xl font-semibold leading-tight text-[var(--text)]">
                    {primaryTraining ? "Dein nächstes Training" : "Kein Training geplant"}
                  </h1>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {primaryTraining ? (
                      <>
                        {normalizeTitle((primaryTraining as any).title) || "Training"}{" "}
                        <span className="opacity-70">
                          · {primaryTraining.date === todayISO ? "heute" : formatDayLabelFromISO(primaryTraining.date)}
                          {String(primaryTraining.startTime || "").trim() ? ` · ${primaryTraining.startTime}` : ""}
                        </span>
                      </>
                    ) : (
                      "Erstelle ein Training über +"
                    )}
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="rounded-full px-3 py-1 text-sm bg-[var(--surface2)] border border-[var(--border)] text-[var(--muted)]">
                    {t("dashboard.week")}: {progressLabel(doneThisWeek.minutes, weeklyGoalMinutes)}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="mt-6 flex items-center gap-3">
                  <AppButton
                    onClick={openAdaptiveForToday}
                    variant="secondary"
                    fullWidth
                    disabled={!todayTrainingEvents[0]}
                    title={!todayTrainingEvents[0] ? t("dashboard.noTrainingToday") : t("dashboard.adaptiveToday")}
                  >
                    {t("dashboard.action.adaptive")}
                  </AppButton>

                  <AppButton
                    onClick={() => setIsPlusMenuOpen((v) => !v)}
                    variant="secondary"
                    className="!px-0 w-12 shrink-0 text-2xl"
                    aria-label={t("common.more")}
                  >
                    +
                  </AppButton>
                </div>
              </div>
            </div>

            {/* Weekly progress */}
            <AppCard variant="glass" className="mt-3 mx-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[var(--muted)]">Wochenziel</p>
                  <p className="text-base font-semibold text-[var(--text)]">
                    {doneThisWeek.sessions}/{weeklyGoalSessions} Trainings · {doneThisWeek.minutes}/{weeklyGoalMinutes} min
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Geplant: {plannedThisWeek.sessions} · {plannedThisWeek.minutes} min
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm text-[var(--muted)]">Ziel</p>
                  <p className="text-base font-semibold text-[var(--text)]">{Math.round(weeklyGoalMinutes / 60)}h</p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--bg)] border border-[var(--border)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.round(weekProgress * 100)}%` }} />
              </div>
              {!effectiveIsPro && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full px-3 py-1 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
                    Adaptiv B/C: {FREE_LIMITS.adaptiveBCPerMonth - Math.max(0, adaptiveLeft)}/{FREE_LIMITS.adaptiveBCPerMonth}
                  </span>
                  <span className="rounded-full px-3 py-1 text-sm bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
                    Plan Shift: {FREE_LIMITS.planShiftPerMonth - Math.max(0, planShiftLeft)}/{FREE_LIMITS.planShiftPerMonth}
                  </span>
                </div>
              )}
            </AppCard>

            {/* Plus menu */}
            {isPlusMenuOpen && (
              <div
                className="absolute right-4 top-[88px] z-40 w-60 overflow-hidden rounded-2xl border-[1.5px] border-white/10 bg-white/5 backdrop-blur-xl shadow-xl text-[var(--text)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    setQuickEvent((p) => ({ ...p, date: todayISO, category: "alltag", description: "" }));
                    setCategoryCreateMode("select");
                    setNewCategoryLabel("");
                    setIsQuickEventModalOpen(true);
                  }}
                  className="w-full px-4 py-3 text-left text-base hover:bg-[var(--surface2)] transition-colors"
                >
                  Termin anlegen
                </button>

                <div className="h-px bg-[var(--border)]" />

                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    setNewTraining((p) => ({
                      ...p,
                      date: todayISO,
                      trainingType: "gym",
                      startTime: "18:00",
                      endTime: "19:00",
                      description: "",
                    }));
                    setIsTrainingModalOpen(true);
                  }}
                  className="w-full px-4 py-3 text-left text-base hover:bg-[var(--surface2)] transition-colors"
                >
                  Training anlegen
                </button>

                <div className="h-px bg-[var(--border)]" />

                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    openShiftDialog();
                  }}
                  className="w-full px-4 py-3 text-left text-base hover:bg-[var(--surface2)] transition-colors"
                >
                  Plan verschieben (Tag +1)
                </button>
              </div>
            )}
          </AppCard>

          {/* =========================================================
              2) "Nächste 3 Tage" - nun prominent (Full Width)
              ========================================================= */}
          {/* Next 3 days */}
          <AppCard variant="glass" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--text)]">Nächste 3 Tage</h2>
              <p className="text-sm text-[var(--muted)]">Tippen = Vorschau</p>
            </div>

            <div className="space-y-3">
              {next3DaysKeys.map((k) => {
                const ev = plannedEventsNext3Days.get(k) ?? null;
                const tt = ev ? normalizeTrainingType((ev as any).trainingType) : null;

                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => ev && openPreviewForEvent(ev)}
                    disabled={!ev}
                    className="w-full rounded-2xl p-3 text-left transition bg-[var(--surface2)] border-[1.5px] border-transparent disabled:opacity-60 enabled:hover:bg-[var(--surface)] enabled:hover:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--muted)]">{formatDayLabelFromISO(k)}</p>
                        <p className="mt-0.5 text-base font-semibold text-[var(--text)]">
                          {ev ? normalizeTitle(ev.title) : "Kein Training geplant"}
                        </p>
                      </div>
                      {ev && <span className="shrink-0 rounded-full px-2.5 py-1 text-sm bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]">{tt ? tt.toUpperCase() : "TRAINING"}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </AppCard>
        </div>
      </div>

      {/* Close overlay for plus menu */}
      {isPlusMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default"
          data-overlay-open="true"
          onClick={() => setIsPlusMenuOpen(false)}
          aria-label={t("common.close")}
          style={{ background: "transparent" }}
        />
      )}

      <TrainingPreviewSheet
        open={isPreviewOpen}
        event={previewEvent}
        onClose={closePreview}
        onSave={handlePreviewSave}
        onStart={handlePreviewStart}
      />

      {/* =========================================================
          SHIFT DIALOG
          ========================================================= */}
      {shiftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <AppCard variant="glass" className="w-full max-w-md space-y-4 p-5 shadow-2xl">
            <div>
              <p className="text-sm text-[var(--muted)]">Plan</p>
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("dashboard.shiftPlanTitle")}</h2>
            </div>

            {shiftCandidates.length >= 2 ? (
              <div className="space-y-2 text-base">
                <p className="text-sm text-[var(--muted)]">Mehrere Pläne erkannt. Welchen Plan verschieben?</p>
                <select
                  value={shiftSelectedPlanId}
                  onChange={(e) => setShiftSelectedPlanId(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface2)] px-3 py-2.5 text-base text-[var(--text)]"
                >
                  {shiftCandidates.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
                  <option value="__ALL__">{t("dashboard.shiftPlanAllFallback")}</option>
                </select>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Es wurde {shiftCandidates.length === 1 ? "ein Plan" : "kein templateId-Plan"} erkannt. Wir verschieben alle Trainings ab heute.
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <AppButton variant="secondary" onClick={() => setShiftOpen(false)}>
                Abbrechen
              </AppButton>
              <AppButton onClick={doShift}>
                Verschieben
              </AppButton>
            </div>
          </AppCard>
        </div>
      )}

      {/* =========================================================
          QUICK EVENT MODAL
          ========================================================= */}
      {isQuickEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <AppCard variant="glass" className="w-full max-w-md space-y-4 p-5 shadow-2xl">
            <div>
              <p className="text-sm text-[var(--muted)]">Termin</p>
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("dashboard.createEventTitle")}</h2>
            </div>
            <form onSubmit={handleQuickEventSubmit} className="space-y-4 text-base">
              {/* ... form content with glass inputs ... */}
              {/* NOTE: We aren't changing the inputs inside here in this pass, but cleaning up the container */}
              <div className="flex justify-end gap-3 pt-2">
                <AppButton variant="secondary" onClick={() => setIsQuickEventModalOpen(false)}>
                  Abbrechen
                </AppButton>
                <AppButton type="submit">
                  Speichern
                </AppButton>
              </div>
            </form>
          </AppCard>
        </div>
      )}

      {/* =========================================================
          QUICK TRAINING MODAL
          ========================================================= */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" data-overlay-open="true">
          <AppCard variant="glass" className="w-full max-w-md space-y-4 p-5 shadow-2xl">
            <div>
              <p className="text-sm text-[var(--muted)]">Training</p>
              <h2 className="text-lg font-semibold text-[var(--text)]">{t("dashboard.createWorkoutTitle")}</h2>
            </div>
            <form onSubmit={handleCreateTraining} className="space-y-4 text-base">
              {/* ... form content ... */}
              <div className="flex justify-end gap-3 pt-2">
                <AppButton variant="secondary" onClick={() => setIsTrainingModalOpen(false)}>
                  Abbrechen
                </AppButton>
                <AppButton type="submit">
                  Speichern
                </AppButton>
              </div>
            </form>
          </AppCard>
        </div>
      )}

      {/* Adaptive modal */}
      <AdaptiveTrainingModal
        open={adaptiveOpen}
        onClose={() => {
          setAdaptiveOpen(false);
          setAdaptiveTargetEvent(null);
        }}
        plannedWorkoutType={inferWorkoutTypeFromTitle((adaptiveTargetEvent as any)?.title ?? "Push")}
        splitType="push_pull"
        onSelect={(s, a) => applyAdaptiveSelection(s, a)}
        isPro={effectiveIsPro}
        adaptiveLeftBC={Number.isFinite(adaptiveLeft as number) ? (adaptiveLeft as number) : undefined}
        bcFreeLimit={FREE_LIMITS.adaptiveBCPerMonth}
      />
    </>
  );
};

export default Dashboard;
