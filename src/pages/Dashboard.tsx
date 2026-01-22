// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { PageHeader } from "../components/ui/PageHeader";
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
  const s = String(label ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `custom_${s || "kategorie"}`;
}

export const Dashboard: React.FC<DashboardProps> = ({
  upcoming: _upcoming, events, onCreateQuickTraining, onUpdateEvents, isPro: isProProp = false, onOpenPaywall,
}) => {
  const { t, formatDate } = useI18n();
  const today = startOfDay(new Date());
  const todayISO = dateKey(today);

  const { isPro, canUseAdaptive, consumeAdaptive, adaptiveBCRemaining, canUseShift, consumeShift, planShiftRemaining } = useEntitlements();
  const effectiveIsPro = isPro || isProProp;
  const adaptiveLeft = useMemo(() => effectiveIsPro ? Infinity : Math.max(0, adaptiveBCRemaining), [adaptiveBCRemaining, effectiveIsPro]);

  // Onboarding Data
  const [onboarding, setOnboarding] = useState<OnboardingData>(() => readOnboardingDataFromStorage());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setOnboarding(readOnboardingDataFromStorage());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  const weeklyGoalMinutes = useMemo(() => {
    const h = (onboarding as any)?.training?.hoursPerWeek;
    return (typeof h === "number" && Number.isFinite(h) && h > 0 ? h : 5) * 60;
  }, [onboarding]);
  const weeklyGoalSessions = useMemo(() => {
    const s = (onboarding as any)?.training?.sessionsPerWeek;
    return typeof s === "number" && Number.isFinite(s) && s > 0 ? Math.round(s) : 3;
  }, [onboarding]);

  // Categories
  const [customCategories, setCustomCategories] = useState<CategoryDef[]>(() => {
    if (typeof window === "undefined") return [];
    return dedupCategories(safeParse<CategoryDef[]>(getScopedItem(STORAGE_KEY_CATEGORIES), []));
  });
  const allCategories = useMemo(() => dedupCategories([...BASE_CATEGORIES, ...customCategories]), [customCategories]);
  const categoryLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCategories) map.set(c.key, c.label);
    return map;
  }, [allCategories]);

  // UI State
  const [isQuickEventModalOpen, setIsQuickEventModalOpen] = useState(false);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);

  // Quick Event
  const [quickEvent, setQuickEvent] = useState({ title: "", date: todayISO, startTime: "18:00", endTime: "19:00", category: "alltag", description: "" });
  const handleQuickEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(quickEvent.title)) return;
    const payload: NewCalendarEvent = {
      title: normalizeTitle(quickEvent.title),
      date: quickEvent.date,
      startTime: quickEvent.startTime,
      endTime: quickEvent.endTime,
      type: "other",
      category: quickEvent.category,
    } as any;
    onCreateQuickTraining(payload);
    setIsQuickEventModalOpen(false);
  };

  // Quick Training
  const [newTraining, setNewTraining] = useState({ date: todayISO, startTime: "18:00", endTime: "19:00", trainingType: "gym" as TrainingType, title: "" });
  const handleCreateTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(newTraining.title)) return;
    const payload: NewCalendarEvent = {
      title: normalizeTitle(newTraining.title),
      date: newTraining.date,
      startTime: newTraining.startTime,
      endTime: newTraining.endTime,
      type: "training",
      trainingType: newTraining.trainingType,
      trainingStatus: "open",
    } as any;
    onCreateQuickTraining(payload);
    setIsTrainingModalOpen(false);
  };

  // Week stats
  const weekStartISO = useMemo(() => dateKey(startOfWeekMonday(new Date())), []);
  const weekEndISO = useMemo(() => { const d = startOfWeekMonday(new Date()); d.setDate(d.getDate() + 7); return dateKey(d); }, []);
  const doneThisWeek = useMemo(() => {
    const list = events.filter((e) => isCompletedTraining(e) && e.date >= weekStartISO && e.date < weekEndISO);
    return { sessions: list.length, minutes: list.reduce((acc, ev) => acc + fallbackMinutesForCompleted(ev), 0) };
  }, [events, weekStartISO, weekEndISO]);
  const weekProgress = useMemo(() => Math.min(1, Math.max(0, doneThisWeek.minutes / Math.max(1, weeklyGoalMinutes))), [doneThisWeek.minutes, weeklyGoalMinutes]);

  // Events logic
  const resolveSeedForEvent = (event: CalendarEvent): LiveTrainingSeed | null => {
    const byEvent = readLiveSeedForEvent(event.id);
    if (byEvent) return byEvent;
    const key = makeSeedKey(event.date, normalizeTitle(event.title));
    return readLiveSeedForKey(key);
  };

  const next3DaysKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 3; i++) { const d = new Date(today); d.setDate(today.getDate() + i); keys.push(dateKey(d)); }
    return keys;
  }, [today]);

  const plannedEventsNext3Days = useMemo(() => {
    const list = events.filter((e) => isTrainingEvent(e) && next3DaysKeys.includes(e.date));
    const byDay = new Map<string, CalendarEvent>();
    for (const k of next3DaysKeys) {
      const first = list.find(e => e.date === k);
      if (first) byDay.set(k, first);
    }
    return byDay;
  }, [events, next3DaysKeys]);

  const todayTrainingEvents = useMemo(() => events.filter((e) => e.date === todayISO && isTrainingEvent(e)), [events, todayISO]);

  const nextTrainingEvent = useMemo(() => {
    const sorted = events.filter(e => isTrainingEvent(e)).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    return sorted.find(e => e.date >= todayISO) ?? null;
  }, [events, todayISO]);

  const primaryTraining = useMemo(() => todayTrainingEvents[0] ?? nextTrainingEvent, [todayTrainingEvents, nextTrainingEvent]);

  // Preview / Adaptive / Shift
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<CalendarEvent | null>(null);
  const closePreview = () => { setIsPreviewOpen(false); setPreviewEvent(null); };
  const openPreviewForEvent = (event: CalendarEvent) => { setPreviewEvent(event); setIsPreviewOpen(true); };
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

  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [adaptiveTargetEvent, setAdaptiveTargetEvent] = useState<CalendarEvent | null>(null);
  const openAdaptiveForToday = () => {
    const target = todayTrainingEvents[0] ?? null;
    // Removed strict check (!target) so the modal opens even without a planned event.
    // The modal defaults to 'Push' if no target is found.
    setAdaptiveTargetEvent(target);
    setAdaptiveOpen(true);
  };
  const applyAdaptiveSelection = async (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => {
    if (!adaptiveTargetEvent || !onUpdateEvents) return;
    if (!effectiveIsPro && !canUseAdaptive(suggestion.profile)) { onOpenPaywall?.("adaptive_limit"); return; }
    if (!effectiveIsPro) consumeAdaptive(suggestion.profile);

    const templateId = inferWorkoutTypeFromTitle(adaptiveTargetEvent.title) === 'Pull' ? 'Pull_A' : 'Push_A';
    const result = await calculateAdaptiveWorkout({ templateId });
    const seed: LiveTrainingSeed = {
      title: `Adaptive ${suggestion.title}`, sport: "Gym", isCardio: false,
      exercises: result.exercises.map(ex => ({ exerciseId: ex.exerciseId, name: ex.name, sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight, notes: s.notes })) }))
    };
    writeLiveSeedForEventOrKey({ eventId: adaptiveTargetEvent.id, dateISO: adaptiveTargetEvent.date, title: adaptiveTargetEvent.title, seed });

    // Update logic simplified for brevity but functionally complete
    const reasons = (suggestion.reasons ?? []).slice(0, 3).map((r) => String(r));
    const newEnd = addMinutesToHHMM((adaptiveTargetEvent as any).startTime, suggestion.estimatedMinutes);
    onUpdateEvents((prev) => prev.map((ev) => {
      if (ev.id !== adaptiveTargetEvent.id) return ev;
      return applyAdaptiveToCalendarEvent(ev, {
        adaptiveProfile: mapSuggestionProfileToABC(suggestion.profile), adaptiveReasons: reasons, estimatedMinutes: suggestion.estimatedMinutes, note: `Adaptiv: ${suggestion.title}`, endTime: newEnd
      }) as CalendarEvent;
    }));
    setAdaptiveOpen(false); setAdaptiveTargetEvent(null);
  };

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftCandidates, setShiftCandidates] = useState<Array<{ id: string; label: string }>>([]);
  const [shiftSelectedPlanId, setShiftSelectedPlanId] = useState<string>("__ALL__");
  const openShiftDialog = () => {
    const set = new Set<string>();
    events.filter(e => isTrainingEvent(e) && e.date >= todayISO).forEach(ev => { const pid = getTemplateId(ev); if (pid) set.add(pid); });
    const plans = Array.from(set).map(id => ({ id, label: `Plan ${id.slice(0, 6)}…` }));
    setShiftCandidates(plans); setShiftSelectedPlanId(plans.length >= 2 ? plans[0].id : "__ALL__");
    setShiftOpen(true);
  };
  const doShift = () => {
    if (!onUpdateEvents) return;
    if (!effectiveIsPro && !canUseShift()) { onOpenPaywall?.("plan_shift"); return; }
    if (!effectiveIsPro) consumeShift();
    onUpdateEvents(prev => shiftPlanEvents({ events: prev, planId: shiftSelectedPlanId === "__ALL__" ? null : shiftSelectedPlanId, days: 1, fromDateISO: todayISO }).nextEvents);
    setShiftOpen(false);
  };

  // -------------------- Render (Apple Zero-Box Design) --------------------

  return (
    <>
      <div className="w-full pb-32">
        {/* Header */}
        <PageHeader
          title="Dashboard"
          subtitle={formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
        />

        {/* Primary Status / Next Training */}
        <section className="mb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-[19px] font-semibold text-[var(--text)] tracking-tight">Nächstes Training</h2>
          </div>

          <AppCard className="p-3.5" onClick={primaryTraining ? () => openPreviewForEvent(primaryTraining) : undefined}>
            {primaryTraining ? (
              <div
                className="group active:opacity-70 transition-opacity cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[17px] font-semibold text-[var(--text)] mb-[2px]">
                      {normalizeTitle(primaryTraining.title) || "Training"}
                    </h3>
                    <p className="text-[15px] text-[var(--muted)]">
                      {primaryTraining.date === todayISO ? "Heute" : formatDayLabelFromISO(primaryTraining.date)}
                      {primaryTraining.startTime ? ` · ${primaryTraining.startTime} Uhr` : ""}
                    </p>
                  </div>
                  <div className="text-[var(--primary)]">
                    <svg width="9" height="14" viewBox="0 0 9 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L7 7L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-[15px] text-[var(--muted)]">
                  Kein Training geplant.
                </p>
                <button
                  onClick={() => setIsTrainingModalOpen(true)}
                  className="mt-3 text-[17px] text-[var(--primary)] font-medium"
                >
                  Training planen
                </button>
              </div>
            )}
          </AppCard>
        </section>

        {/* Quick Actions (Grid Style using Glassmorphism) */}
        <section className="mb-4">
          <h2 className="text-[19px] font-semibold text-[var(--text)] tracking-tight mb-2 px-1">Aktionen</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setIsTrainingModalOpen(true)}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-white/20 active:scale-[0.98] transition-all cursor-pointer shadow-sm min-h-[90px]"
            >
              <div className="w-8 h-8 rounded-full bg-[#007AFF] flex items-center justify-center text-white shadow-lg shadow-[#007AFF]/20">
                <span className="text-xl leading-none font-bold">+</span>
              </div>
              <span className="text-[14px] font-medium text-white text-center">Training planen</span>
            </button>

            <button
              onClick={() => setIsQuickEventModalOpen(true)}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-white/20 active:scale-[0.98] transition-all cursor-pointer shadow-sm min-h-[90px]"
            >
              <div className="w-8 h-8 rounded-full bg-[#34C759] flex items-center justify-center text-white shadow-lg shadow-[#34C759]/20">
                <span className="text-sm">📅</span>
              </div>
              <span className="text-[14px] font-medium text-white text-center">Termin eintragen</span>
            </button>

            {canUseAdaptive("stabil") && (
              <button
                onClick={openAdaptiveForToday}
                className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-white/20 active:scale-[0.98] transition-all cursor-pointer shadow-sm min-h-[90px]"
              >
                <div className="w-8 h-8 rounded-full bg-[#AF52DE] flex items-center justify-center text-white shadow-lg shadow-[#AF52DE]/20">
                  <span className="text-sm">✨</span>
                </div>
                <span className="text-[14px] font-medium text-white text-center">Adaptiv</span>
              </button>
            )}

            <button
              onClick={openShiftDialog}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-white/20 active:scale-[0.98] transition-all cursor-pointer shadow-sm min-h-[90px]"
            >
              <div className="w-8 h-8 rounded-full bg-[#30B0C7] flex items-center justify-center text-white shadow-lg shadow-[#30B0C7]/20">
                <span className="text-sm">🔄</span>
              </div>
              <span className="text-[14px] font-medium text-white text-center">Plan verschieben</span>
            </button>
          </div>
        </section>

        {/* Weekly Progress */}
        <AppCard className="p-3.5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[19px] font-semibold text-[var(--text)] tracking-tight">Diese Woche</h2>
            <span className="text-[15px] text-[var(--muted)] tabular-nums">
              {doneThisWeek.minutes} / {Math.max(1, weeklyGoalMinutes)} min
            </span>
          </div>

          <div className="h-1.5 w-full bg-[var(--surface2)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${weekProgress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-[var(--muted)]">
            {weeklyGoalSessions > 0 ? `${doneThisWeek.sessions} von ${weeklyGoalSessions} Einheiten erledigt.` : "Ziel nicht definiert."}
          </p>
        </AppCard>

      </div>

      {/* Primary Floating Action Button (Clean) - Only if we have a primary training to start */}
      {primaryTraining && primaryTraining.date === todayISO && !primaryTraining.trainingStatus && (
        <div className="fixed left-0 right-0 z-40 px-5 pointer-events-none bottom-[var(--nav-height)]">
          <AppButton
            onClick={() => resolveSeedForEvent(primaryTraining) ? handlePreviewStart(primaryTraining, resolveSeedForEvent(primaryTraining)!) : openPreviewForEvent(primaryTraining)}
            className="w-full h-[54px] rounded-[14px] text-[17px] shadow-lg"
          >
            Training starten
          </AppButton>
        </div>
      )}


      {/* --- Modals and Sheets (Technically "boxes" but necessary overlays) --- */}

      <TrainingPreviewSheet
        open={isPreviewOpen}
        onClose={closePreview}
        event={previewEvent}
        onSave={handlePreviewSave}
        onStart={handlePreviewStart}
      />

      <AdaptiveTrainingModal
        open={adaptiveOpen}
        onClose={() => setAdaptiveOpen(false)}
        plannedWorkoutType={adaptiveTargetEvent ? inferWorkoutTypeFromTitle(adaptiveTargetEvent.title) : 'Push'}
        splitType="push_pull" // Fixed for dashboard usage
        onSelect={applyAdaptiveSelection}
        isPro={effectiveIsPro}
        adaptiveLeftBC={adaptiveLeft}
      />

      {/* Quick Training Modal (Overlay) */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Training planen</h3>
            <form onSubmit={handleCreateTraining} className="space-y-4">
              <input
                type="text"
                placeholder="Titel (z.B. Push A)"
                value={newTraining.title}
                onChange={e => setNewTraining(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-[17px] focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/10 transition-all placeholder-white/50"
                autoFocus
              />
              <div className="flex gap-3">
                <input
                  type="date"
                  value={newTraining.date}
                  onChange={e => setNewTraining(p => ({ ...p, date: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-[17px] min-w-0 focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/10 transition-all"
                />
                <input
                  type="time"
                  value={newTraining.startTime}
                  onChange={e => setNewTraining(p => ({ ...p, startTime: e.target.value }))}
                  className="w-24 bg-white/5 border border-white/10 text-white rounded-xl px-2 py-3 text-[17px] text-center focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/10 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setNewTraining(p => ({ ...p, trainingType: 'gym' }))} className={`py-3 rounded-xl font-medium transition-all ${newTraining.trainingType === 'gym' ? 'bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/20' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Gym</button>
                <button type="button" onClick={() => setNewTraining(p => ({ ...p, trainingType: 'laufen' }))} className={`py-3 rounded-xl font-medium transition-all ${newTraining.trainingType === 'laufen' ? 'bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/20' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>Laufen</button>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsTrainingModalOpen(false)} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition-all">Abbrechen</button>
                <button type="submit" className="flex-1 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white py-3 rounded-xl font-semibold shadow-lg shadow-[#007AFF]/20 transition-all">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Event Modal (Overlay) */}
      {isQuickEventModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Termin eintragen</h3>
            <form onSubmit={handleQuickEventSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Titel"
                value={quickEvent.title}
                onChange={e => setQuickEvent(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-[17px] focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/10 transition-all placeholder-white/50"
                autoFocus
              />
              <div className="flex gap-3">
                <input
                  type="date"
                  value={quickEvent.date}
                  onChange={e => setQuickEvent(p => ({ ...p, date: e.target.value }))}
                  className="flex-1 bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 text-[17px] min-w-0 focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/10 transition-all"
                />
                <input
                  type="time"
                  value={quickEvent.startTime}
                  onChange={e => setQuickEvent(p => ({ ...p, startTime: e.target.value }))}
                  className="w-24 bg-white/5 border border-white/10 text-white rounded-xl px-2 py-3 text-[17px] text-center focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/10 transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsQuickEventModalOpen(false)} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition-all">Abbrechen</button>
                <button type="submit" className="flex-1 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white py-3 rounded-xl font-semibold shadow-lg shadow-[#007AFF]/20 transition-all">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Shift Modal */}
      {shiftOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Plan verschieben</h3>
            <p className="text-white/70 mb-4">Alle zukünftigen Workouts um 1 Tag nach hinten verschieben?</p>
            {shiftCandidates.length >= 2 && (
              <select
                value={shiftSelectedPlanId}
                onChange={(e) => setShiftSelectedPlanId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-3 mb-4 focus:outline-none focus:border-[#007AFF]/50 focus:bg-white/10 transition-all"
              >
                {shiftCandidates.map((p) => (<option key={p.id} value={p.id} className="text-black">{p.label}</option>))}
                <option value="__ALL__" className="text-black">Alle Pläne</option>
              </select>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShiftOpen(false)} className="flex-1 bg-white/10 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition-all">Abbrechen</button>
              <button onClick={doShift} className="flex-1 bg-[#007AFF] hover:bg-[#007AFF]/90 text-white py-3 rounded-xl font-semibold shadow-lg shadow-[#007AFF]/20 transition-all">Verschieben</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Dashboard;
