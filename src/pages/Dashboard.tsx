// src/pages/Dashboard.tsx

import React, { useEffect, useMemo, useState } from "react";
import type {
  UpcomingTraining,
  CalendarEvent,
  NewCalendarEvent,
  TrainingType,
  EventType,
} from "../types/training";
import { FeedbackBar } from "../components/feedback/FeedbackBar";

// ✅ Onboarding (Weekly Goals ins Dashboard übernehmen)
import { readOnboardingDataFromStorage } from "../context/OnboardingContext";
import type { OnboardingData } from "../types/onboarding";

// ✅ Adaptives Training
import AdaptiveTrainingModal from "../components/adaptive/AdaptiveTrainingModal";
import type { AdaptiveAnswers, AdaptiveSuggestion } from "../types/adaptive";

// ✅ Helper: Adaptiv sauber ins CalendarEvent schreiben (Plural!)
import { applyAdaptiveToCalendarEvent } from "../utils/adaptiveCalendarEvents";

// ✅ Plan-Seed -> LiveTraining (zentral)
import {
  readLiveSeedForEvent,
  readLiveSeedForKey,
  makeSeedKey,
  writeGlobalLiveSeed,
  navigateToLiveTraining,
  type LiveTrainingSeed,
} from "../utils/liveTrainingSeed";

// ✅ Plan Shift (nur die reine Verschiebe-Logik; Limits laufen über entitlements.ts)
import { shiftPlanEvents } from "../utils/planShift";

// ✅ Entitlements Hook (Single Source of Truth)
import { useEntitlements } from "../hooks/useEntitlements";
import { FREE_LIMITS } from "../utils/entitlements";

interface DashboardProps {
  upcoming: UpcomingTraining[];
  events: CalendarEvent[];
  onCreateQuickTraining: (input: NewCalendarEvent) => void;

  onUpdateEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;

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
  return normalizeTrainingType(e.trainingType) !== null;
}

function isGymTraining(e: CalendarEvent): boolean {
  return normalizeTrainingType(e.trainingType) === "gym";
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
  const t = ev.templateId;
  return typeof t === "string" && t.trim() ? t : null;
}

function fallbackSeedForNonGymEvent(ev: CalendarEvent): LiveTrainingSeed {
  const tt = normalizeTrainingType(ev.trainingType);
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
  const start = parseHHMMToMinutes(ev.startTime);
  const end = parseHHMMToMinutes(ev.endTime);
  if (end <= start) return 0;
  return end - start;
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

export const Dashboard: React.FC<DashboardProps> = ({
  upcoming,
  events,
  onCreateQuickTraining,
  onUpdateEvents,
  isPro: isProProp = false,
  onOpenPaywall,
}) => {
  const today = startOfDay(new Date());
  const todayISO = dateKey(today);

  // -------------------- Entitlements (Hook) --------------------

  const {
    isPro,
    canUseAdaptive,
    consumeAdaptive,
    adaptiveBCRemaining,

    // ✅ FIX: richtige Namen aus Hook
    canUseShift,
    consumeShift,
    planShiftRemaining,
  } = useEntitlements();

  const effectiveIsPro = isPro || isProProp;

  // ✅ Free-Limit Anzeige: Nur B/C zählen (A unbegrenzt free)
  const adaptiveLeft = useMemo(() => {
    if (effectiveIsPro) return Infinity;
    return Math.max(0, adaptiveBCRemaining);
  }, [adaptiveBCRemaining, effectiveIsPro]);

  // ✅ PlanShift remaining (Free)
  const planShiftLeft = useMemo(() => {
    if (effectiveIsPro) return Infinity;
    return Math.max(0, planShiftRemaining);
  }, [planShiftRemaining, effectiveIsPro]);

  // ✅ Onboarding Daten (für Weekly Goals im Dashboard)
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

  // -------------------- Kategorien state (shared with CalendarPage) --------------------

  const [customCategories, setCustomCategories] = useState<CategoryDef[]>(() => {
    if (typeof window === "undefined") return [];
    const parsed = safeParse<CategoryDef[]>(window.localStorage.getItem(STORAGE_KEY_CATEGORIES), []);
    return dedupCategories(parsed);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories));
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

  // ✅ Plan-Shift Warn/Confirm Step
  const [shiftWarnOpen, setShiftWarnOpen] = useState(false);

  // -------------------- Quick Termin (Dashboard -> Kalender) --------------------

  const [quickEvent, setQuickEvent] = useState({
    title: "",
    date: todayISO,
    startTime: "18:00",
    endTime: "19:00",
    category: "alltag",
    description: "",
    notes: "Erstellt vom Dashboard (+)",
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

  // -------------------- Quick Training (Dashboard -> Kalender) --------------------

  const [newTraining, setNewTraining] = useState({
    date: todayISO,
    startTime: "18:00",
    endTime: "19:00",
    trainingType: "gym" as TrainingType,
    title: "",
    description: "",
    notes: "Erstellt vom Dashboard (+)",
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

  // -------------------- Week progress (planned) --------------------

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
        (a.date + a.startTime + normalizeTitle(a.title)).localeCompare(
          b.date + b.startTime + normalizeTitle(b.title)
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
        (a.date + a.startTime + normalizeTitle(a.title)).localeCompare(
          b.date + b.startTime + normalizeTitle(b.title)
        )
      );

    const todayFirst = sorted.find((e) => e.date === todayISO);
    if (todayFirst) return todayFirst;

    return sorted.find((e) => e.date > todayISO) ?? null;
  }, [events, todayISO]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);
  const previewSeed = useMemo(() => (previewEvent ? resolveSeedForEvent(previewEvent) : null), [previewEvent]);

  const openPreviewForEvent = (event: CalendarEvent) => {
    setPreviewEvent(event);
    setIsPreviewOpen(true);
  };

  const startFromPreview = () => {
    if (!previewEvent) return;

    const seed = previewSeed;

    if (isGymTraining(previewEvent) && !seed) {
      window.alert("Kein Trainings-Seed gefunden. Bitte Plan erneut in den Kalender übernehmen.");
      return;
    }

    const toWrite = seed ?? fallbackSeedForNonGymEvent(previewEvent);

    writeGlobalLiveSeed(toWrite);
    setIsPreviewOpen(false);
    setPreviewEvent(null);

    navigateToLiveTraining(previewEvent.id);
  };

  const startPlanTodayOrNextPreview = () => {
    const preferred = todayTrainingEvents[0] ?? nextTrainingEvent;
    if (!preferred) {
      window.alert("Kein geplantes Training gefunden.");
      return;
    }
    openPreviewForEvent(preferred);
  };

  const singleTodayTrainingPreview = useMemo(() => {
    if (todayEvents.length !== 1) return null;
    const only = todayEvents[0];
    if (!isTrainingEvent(only)) return null;
    const seed = resolveSeedForEvent(only);
    return { event: only, seed };
  }, [todayEvents]);

  // -------------------- Adaptives Training --------------------

  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [adaptiveTargetEvent, setAdaptiveTargetEvent] = useState<CalendarEvent | null>(null);

  const openAdaptiveForToday = () => {
    const target = todayTrainingEvents[0] ?? null;
    if (!target) {
      window.alert("Heute ist kein geplantes Training im Kalender.");
      return;
    }
    setAdaptiveTargetEvent(target);
    setAdaptiveOpen(true);
  };

  const applyAdaptiveSelection = (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => {
    if (!adaptiveTargetEvent) return;

    if (!onUpdateEvents) {
      window.alert(
        "Adaptives Training ist noch nicht verdrahtet (Dashboard hat keine Schreibrechte auf Events). " +
          "Bitte in App.tsx onUpdateEvents={setEvents} an Dashboard übergeben."
      );
      return;
    }

    // ✅ Rule: A immer free. B/C limitiert; Hook entscheidet das.
    if (!effectiveIsPro) {
      const allowed = canUseAdaptive(suggestion.profile);
      if (!allowed) {
        onOpenPaywall?.("adaptive_limit");
        return;
      }
      consumeAdaptive(suggestion.profile);
    }

    if (suggestion.estimatedMinutes <= 0) {
      window.alert("Dieser Vorschlag ist heute deaktiviert.");
      return;
    }

    const adaptiveProfileABC = mapSuggestionProfileToABC(suggestion.profile);
    const reasons = (suggestion.reasons ?? []).slice(0, 3).map((r) => String(r));
    const newEnd = addMinutesToHHMM(adaptiveTargetEvent.startTime, suggestion.estimatedMinutes);

    onUpdateEvents((prev) =>
      prev.map((ev) => {
        if (ev.id !== adaptiveTargetEvent.id) return ev;

        const patched = applyAdaptiveToCalendarEvent(ev, {
          adaptiveProfile: adaptiveProfileABC,
          adaptiveReasons: reasons,
          estimatedMinutes: suggestion.estimatedMinutes,
          note: `Adaptiv: ${suggestion.title}`,
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

  const openShiftWarn = () => setShiftWarnOpen(true);

  const proceedToShiftDialog = () => {
    setShiftWarnOpen(false);

    const plans = detectPlans();
    setShiftCandidates(plans);
    setShiftSelectedPlanId(plans.length >= 2 ? plans[0].id : "__ALL__");
    setShiftOpen(true);
  };

  const doShift = () => {
    if (!onUpdateEvents) {
      window.alert(
        "Plan verschieben ist noch nicht verdrahtet (Dashboard hat keine Schreibrechte auf Events). " +
          "Bitte in App.tsx onUpdateEvents={setEvents} an Dashboard übergeben."
      );
      return;
    }

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

  // -------------------- Next Training card --------------------

  const nextTrainingCard = useMemo(() => {
    const ev = nextTrainingEvent;
    if (!ev) return null;
    return {
      title: normalizeTitle(ev.title),
      dateLabel: formatDayLabelFromISO(ev.date),
      time: `${ev.startTime}–${ev.endTime}`,
      isToday: ev.date === todayISO,
    };
  }, [nextTrainingEvent, todayISO]);

  // -------------------- Render --------------------

  return (
    <>
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto flex h-full w-full max-w-none flex-col gap-5 px-1 pb-24 pt-5 sm:px-2">
          {/* PRIMARY ACTION BAR */}
          <div className="tq-surface relative p-3">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={openAdaptiveForToday}
                className="h-12 rounded-2xl border text-sm font-semibold transition"
                style={{
                  background: "rgba(37, 99, 235, 0.18)",
                  borderColor: "rgba(59, 130, 246, 0.35)",
                  color: "var(--text)",
                }}
                title={!effectiveIsPro ? `Free: B/C noch ${adaptiveLeft} übrig (A immer frei)` : "Pro: unbegrenzt"}
              >
                Adaptiv
              </button>

              <button
                type="button"
                onClick={startPlanTodayOrNextPreview}
                className="h-12 rounded-2xl border text-sm font-semibold transition"
                style={{
                  background: "rgba(37, 99, 235, 0.85)",
                  borderColor: "rgba(59, 130, 246, 0.35)",
                  color: "#061226",
                }}
              >
                Start
              </button>

              <button
                type="button"
                onClick={() => setIsPlusMenuOpen((v) => !v)}
                className="h-12 rounded-2xl border text-xl font-semibold leading-none transition"
                style={{
                  background: "rgba(37, 99, 235, 0.18)",
                  borderColor: "rgba(59, 130, 246, 0.35)",
                  color: "var(--text)",
                }}
                aria-label="Mehr"
                title="Mehr"
              >
                +
              </button>
            </div>

            {/* Weekly Goals */}
            <div
              className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Wochenziel (aus Onboarding)
                </div>
                <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                  {plannedThisWeek.sessions}/{weeklyGoalSessions} Trainings · {plannedThisWeek.minutes}/{weeklyGoalMinutes} min (geplant)
                </div>
              </div>

              <span
                className="rounded-full px-2 py-1 text-[10px]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                }}
              >
                Ziel: {Math.round(weeklyGoalMinutes / 60)}h
              </span>
            </div>

            {/* Plus Menu */}
            {isPlusMenuOpen && (
              <div
                className="absolute right-3 top-[58px] z-40 w-56 overflow-hidden rounded-2xl border shadow-xl"
                style={{ background: "rgba(10,10,14,0.92)", borderColor: "var(--border)" }}
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
                  className="w-full px-4 py-3 text-left text-sm hover:opacity-95"
                  style={{ color: "var(--text)" }}
                >
                  Termin anlegen
                </button>

                <div style={{ height: 1, background: "var(--border)" }} />

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
                  className="w-full px-4 py-3 text-left text-sm hover:opacity-95"
                  style={{ color: "var(--text)" }}
                >
                  Training anlegen
                </button>

                <div style={{ height: 1, background: "var(--border)" }} />

                <button
                  type="button"
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    openShiftWarn();
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:opacity-95"
                  style={{ color: "var(--text)" }}
                >
                  Plan verschieben (Tag +1)
                </button>
              </div>
            )}

            {nextTrainingCard && (
              <div
                className="mt-3 flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)" }}
              >
                <div className="min-w-0">
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    Nächstes Training
                  </div>
                  <div className="truncate text-sm font-semibold">{nextTrainingCard.title}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {nextTrainingCard.dateLabel}
                    {nextTrainingCard.isToday ? " (heute)" : ""} · {nextTrainingCard.time}
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcoming?.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Upcoming (Top {Math.min(5, upcoming.length)})
                </div>

                <div className="space-y-1.5">
                  {upcoming.slice(0, 5).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)" }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold" style={{ color: "var(--text)" }}>
                          {u.title}
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                          {formatDayLabelFromISO(u.date)} · {u.time || "—"}
                        </div>
                      </div>

                      <span
                        className="ml-3 rounded-full px-2 py-1 text-[10px]"
                        style={{
                          background: "rgba(255,255,255,0.06)",
                          color: "var(--muted)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {String((u as any).sport || "").toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trainingsvorschau + Heutige Termine */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Next 3 days */}
            <div className="tq-surface space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">Trainingsplan – nächste 3 Tage</h2>
              </div>

              <div className="space-y-2">
                {next3DaysKeys.map((k) => {
                  const ev = plannedEventsNext3Days.get(k) ?? null;
                  const seed = ev ? resolveSeedForEvent(ev) : null;
                  const counts = seedCounts(seed);
                  const tt = ev ? normalizeTrainingType(ev.trainingType) : null;

                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => ev && openPreviewForEvent(ev)}
                      disabled={!ev}
                      className={[
                        "w-full rounded-xl px-3 py-2 text-left transition",
                        ev ? "hover:opacity-95" : "cursor-not-allowed opacity-70",
                      ].join(" ")}
                      style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                            {formatDayLabelFromISO(k)}
                          </div>

                          <div className="text-sm font-medium">
                            {ev ? normalizeTitle(ev.title) : "Kein Training geplant"}
                          </div>

                          {ev && (
                            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                              {counts.exercises > 0 || counts.sets > 0
                                ? `${counts.exercises} Übungen • ${counts.sets} Sätze`
                                : "Noch keine Übungen"}
                            </div>
                          )}

                          {ev && ev.adaptiveProfile && typeof ev.adaptiveEstimatedMinutes === "number" && (
                            <div className="text-[11px]" style={{ color: "rgba(59,130,246,0.85)" }}>
                              Adaptiv {ev.adaptiveProfile} · {ev.adaptiveEstimatedMinutes} min
                            </div>
                          )}
                        </div>

                        {ev && (
                          <div className="flex flex-col items-end gap-2">
                            <span
                              className="rounded-full px-2 py-1 text-[10px]"
                              style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}
                            >
                              {tt ? tt.toUpperCase() : "TRAINING"}
                            </span>

                            <span
                              className="rounded-full px-2 py-1 text-[10px]"
                              style={{
                                background:
                                  seed || !isGymTraining(ev)
                                    ? "rgba(16,185,129,0.16)"
                                    : "rgba(255,255,255,0.06)",
                                color:
                                  seed || !isGymTraining(ev)
                                    ? "rgba(167,243,208,0.95)"
                                    : "var(--muted)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {seed || !isGymTraining(ev) ? "bereit" : "Seed fehlt"}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Today events */}
            <div className="tq-surface space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Heutige Termine ({todayEvents.length})</h2>
              </div>

              {singleTodayTrainingPreview ? (
                <button
                  type="button"
                  onClick={() => openPreviewForEvent(singleTodayTrainingPreview.event)}
                  className="rounded-xl px-3 py-3 text-left transition"
                  style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                        Training
                      </div>
                      <div className="text-base font-semibold">
                        {normalizeTitle(singleTodayTrainingPreview.event.title)}
                      </div>

                      {singleTodayTrainingPreview.event.adaptiveProfile &&
                        typeof singleTodayTrainingPreview.event.adaptiveEstimatedMinutes === "number" && (
                          <div className="text-[11px]" style={{ color: "rgba(59,130,246,0.85)" }}>
                            Adaptiv {singleTodayTrainingPreview.event.adaptiveProfile} ·{" "}
                            {singleTodayTrainingPreview.event.adaptiveEstimatedMinutes} min
                          </div>
                        )}
                    </div>

                    <div className="whitespace-nowrap text-[10px]" style={{ color: "var(--muted)" }}>
                      {singleTodayTrainingPreview.event.startTime}–{singleTodayTrainingPreview.event.endTime}
                    </div>
                  </div>
                </button>
              ) : todayEvents.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {todayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="space-y-0.5 rounded-lg px-3 py-2"
                      style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{normalizeTitle(event.title)}</span>
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          {event.startTime}–{event.endTime}
                        </span>
                      </div>
                      {event.description && <div style={{ color: "var(--muted)" }}>{event.description}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-xl px-3 py-3 text-xs"
                  style={{
                    background: "rgba(0,0,0,0.18)",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                  }}
                >
                  Keine Termine heute.
                </div>
              )}
            </div>
          </div>

          <FeedbackBar page="Dashboard" />
        </div>
      </div>

      {/* CLICK OUTSIDE -> close plus menu */}
      {isPlusMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setIsPlusMenuOpen(false)}
          aria-label="Close"
          style={{ background: "transparent" }}
        />
      )}

      {/* SHIFT WARNING MODAL */}
      {shiftWarnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="tq-surface w-full max-w-md space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Hinweis
                </div>
                <div className="text-sm font-semibold">Plan verschieben</div>
              </div>
              <button
                type="button"
                onClick={() => setShiftWarnOpen(false)}
                className="text-xs"
                style={{ color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <div
              className="rounded-xl px-3 py-3 text-xs leading-relaxed"
              style={{
                background: "rgba(0,0,0,0.18)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              Du bist dabei, den{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>gesamten Trainingsplan ab heute</span> um{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>+1 Tag</span> nach hinten zu verschieben.
              <br />
              <br />
              Das betrifft alle geplanten Trainings (und ggf. mehrere Wochen). Bist du sicher?
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShiftWarnOpen(false)}
                className="rounded-xl border px-3 py-2 text-[12px]"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={proceedToShiftDialog}
                className="rounded-xl px-4 py-2 text-[12px] font-semibold"
                style={{ background: "rgba(37,99,235,0.9)", color: "#061226" }}
              >
                Weiter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT MODAL */}
      {shiftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="tq-surface w-full max-w-md space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Plan
                </div>
                <div className="text-sm font-semibold">Tag +1 (Plan verschieben)</div>
              </div>
              <button
                type="button"
                onClick={() => setShiftOpen(false)}
                className="text-xs"
                style={{ color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Verschiebt alle geplanten Trainings ab heute um{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>1 Tag</span>.
            </div>

            {shiftCandidates.length >= 2 ? (
              <div className="space-y-2 text-xs">
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Mehrere Trainingspläne erkannt. Welchen Plan möchtest du verschieben?
                </div>

                <select
                  value={shiftSelectedPlanId}
                  onChange={(e) => setShiftSelectedPlanId(e.target.value)}
                  className="w-full rounded-lg border px-2 py-2 text-[12px]"
                  style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  {shiftCandidates.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="__ALL__">Alle Trainings (Fallback)</option>
                </select>
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                Es wurde {shiftCandidates.length === 1 ? "ein Plan" : "kein templateId-Plan"} erkannt. Wir verschieben alle Trainings ab heute.
              </div>
            )}

            {!effectiveIsPro && (
              <div
                className="rounded-xl px-3 py-2 text-[11px]"
                style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                Free: {Math.max(0, planShiftLeft)}/{FREE_LIMITS.planShiftPerMonth} übrig diesen Monat. Pro: unbegrenzt.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShiftOpen(false)}
                className="rounded-xl border px-3 py-2 text-[12px]"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={doShift}
                className="rounded-xl px-4 py-2 text-[12px] font-semibold"
                style={{ background: "rgba(16,185,129,0.95)", color: "#06120c" }}
              >
                Verschieben
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK EVENT MODAL */}
      {isQuickEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="tq-surface w-full max-w-md space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Termin
                </div>
                <div className="text-sm font-semibold">Termin anlegen</div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickEventModalOpen(false)}
                className="text-xs"
                style={{ color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickEventSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                  Titel
                </label>
                <input
                  type="text"
                  value={quickEvent.title}
                  onChange={(e) => setQuickEvent((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border px-2 py-2"
                  style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="z.B. Meeting"
                  autoFocus
                />
              </div>

              {/* Kategorie + neue Kategorie */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
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
                    style={{ color: "var(--muted)" }}
                  >
                    {categoryCreateMode === "select" ? "Neue Kategorie" : "Aus Auswahl"}
                  </button>
                </div>

                {categoryCreateMode === "select" ? (
                  <select
                    value={quickEvent.category}
                    onChange={(e) => setQuickEvent((p) => ({ ...p, category: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2 text-[12px]"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
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
                      style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                      placeholder="z.B. Familie, Uni, Arzt..."
                    />
                    <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                      Beim Speichern wird die Kategorie dauerhaft gespeichert.
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    Datum
                  </label>
                  <input
                    type="date"
                    value={quickEvent.date}
                    onChange={(e) => setQuickEvent((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    Start
                  </label>
                  <input
                    type="time"
                    value={quickEvent.startTime}
                    onChange={(e) => setQuickEvent((prev) => ({ ...prev, startTime: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    Ende
                  </label>
                  <input
                    type="time"
                    value={quickEvent.endTime}
                    onChange={(e) => setQuickEvent((prev) => ({ ...prev, endTime: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                  Beschreibung (optional)
                </label>
                <textarea
                  value={quickEvent.description}
                  onChange={(e) => setQuickEvent((p) => ({ ...p, description: e.target.value }))}
                  className="min-h-[70px] w-full rounded-lg border px-2 py-2"
                  style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="Notizen / Details"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsQuickEventModalOpen(false)}
                  className="rounded-xl border px-3 py-2 text-[12px]"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-[12px] font-semibold"
                  style={{ background: "rgba(37,99,235,0.9)", color: "#061226" }}
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRAINING MODAL */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="tq-surface w-full max-w-md space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Training
                </div>
                <div className="text-sm font-semibold">Training anlegen</div>
              </div>
              <button
                type="button"
                onClick={() => setIsTrainingModalOpen(false)}
                className="text-xs"
                style={{ color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTraining} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    Datum
                  </label>
                  <input
                    type="date"
                    value={newTraining.date}
                    onChange={(e) => setNewTraining((p) => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    Trainingstyp
                  </label>
                  <select
                    value={newTraining.trainingType}
                    onChange={(e) => setNewTraining((p) => ({ ...p, trainingType: e.target.value as TrainingType }))}
                    className="w-full rounded-lg border px-2 py-2 text-[12px]"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  >
                    {Object.keys(TRAINING_TYPE_LABELS).map((k) => (
                      <option key={k} value={k}>
                        {TRAINING_TYPE_LABELS[k as TrainingType]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    Start
                  </label>
                  <input
                    type="time"
                    value={newTraining.startTime}
                    onChange={(e) => setNewTraining((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                    Ende
                  </label>
                  <input
                    type="time"
                    value={newTraining.endTime}
                    onChange={(e) => setNewTraining((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-2"
                    style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                  Titel
                </label>
                <input
                  type="text"
                  value={newTraining.title}
                  onChange={(e) => setNewTraining((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg border px-2 py-2"
                  style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="z.B. Push / 30 min Lauf / Intervalle"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px]" style={{ color: "var(--muted)" }}>
                  Beschreibung (optional)
                </label>
                <textarea
                  value={newTraining.description}
                  onChange={(e) => setNewTraining((p) => ({ ...p, description: e.target.value }))}
                  className="min-h-[80px] w-full rounded-lg border px-2 py-2"
                  style={{ background: "rgba(0,0,0,0.18)", borderColor: "var(--border)", color: "var(--text)" }}
                  placeholder="z.B. Pace / Notizen"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsTrainingModalOpen(false)}
                  className="rounded-xl border px-3 py-2 text-[12px]"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--border)", color: "var(--text)" }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-4 py-2 text-[12px] font-semibold"
                  style={{ background: "rgba(16,185,129,0.95)", color: "#06120c" }}
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADAPTIVE MODAL */}
      <AdaptiveTrainingModal
        open={adaptiveOpen}
        onClose={() => {
          setAdaptiveOpen(false);
          setAdaptiveTargetEvent(null);
        }}
        plannedWorkoutType={inferWorkoutTypeFromTitle(adaptiveTargetEvent?.title ?? "Push")}
        splitType="push_pull"
        onSelect={(s, a) => applyAdaptiveSelection(s, a)}
        isPro={effectiveIsPro}
        adaptiveLeftBC={Number.isFinite(adaptiveLeft as number) ? (adaptiveLeft as number) : undefined}
        bcFreeLimit={FREE_LIMITS.adaptiveBCPerMonth}
      />

      {/* PREVIEW MODAL */}
      {isPreviewOpen && previewEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="tq-surface w-full max-w-md space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Vorschau
                </div>
                <div className="text-sm font-semibold">{normalizeTitle(previewEvent.title)}</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsPreviewOpen(false);
                  setPreviewEvent(null);
                }}
                className="text-xs"
                style={{ color: "var(--muted)" }}
              >
                ✕
              </button>
            </div>

            {previewSeed ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
                  <span>Übungen</span>
                  <span>
                    {seedCounts(previewSeed).exercises} • {seedCounts(previewSeed).sets} Sätze
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="rounded-xl px-3 py-3 text-xs"
                style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--border)", color: "var(--muted)" }}
              >
                {isGymTraining(previewEvent)
                  ? "Kein Trainings-Seed gefunden. (Plan ggf. erneut in den Kalender übernehmen)"
                  : "Kein Seed nötig (Cardio/Custom). Du kannst trotzdem starten."}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsPreviewOpen(false);
                  setPreviewEvent(null);
                }}
                className="rounded-xl border px-3 py-2 text-[12px]"
                style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--border)", color: "var(--text)" }}
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={startFromPreview}
                className="rounded-xl px-4 py-2 text-[12px] font-semibold"
                style={{ background: "rgba(16,185,129,0.95)", color: "#06120c" }}
              >
                Training starten
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;