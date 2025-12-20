// src/pages/Dashboard.tsx

import React, { useMemo, useState } from "react";
import type { UpcomingTraining, CalendarEvent, NewCalendarEvent } from "../types/training";
import { FeedbackBar } from "../components/feedback/FeedbackBar";

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

// ✅ Plan Shift
import {
  shiftPlanEvents,
  canUsePlanShiftFree,
  incrementPlanShiftUsage,
  getPlanShiftUsage,
} from "../utils/planShift";

interface DashboardProps {
  upcoming: UpcomingTraining[];
  events: CalendarEvent[];
  onCreateQuickTraining: (input: NewCalendarEvent) => void;

  /**
   * Optional (empfohlen): Damit Dashboard Events auch ändern kann (z.B. Adaptiv/Shift).
   * Übergib in App.tsx: onUpdateEvents={setEvents}
   */
  onUpdateEvents?: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;

  /**
   * Monetarisierung Hooks (MVP):
   * - isPro: true => keine Limits
   * - onOpenPaywall: wird bei Limit erreicht aufgerufen
   */
  isPro?: boolean;
  onOpenPaywall?: (reason: "plan_shift" | "calendar_7days" | "adaptive_limit") => void;
}

// Manuelle Einzel-Trainings aus dem Dashboard
interface ManualTraining {
  id: string;
  date: string; // YYYY-MM-DD
  sport: string;
  title: string;
  details: string;
}

const PLAN_SHIFT_FREE_LIMIT = 5;

type TrainingType = "gym" | "laufen" | "radfahren" | "custom";

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTitle(t: unknown): string {
  return String(t ?? "").trim();
}

/**
 * ✅ TrainingType normalisieren: akzeptiert "Gym" und "gym", etc.
 */
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

function isTrainingEvent(e: CalendarEvent): boolean {
  const type = (e.type ?? "training") as any;
  if (type === "training") return true;
  return !!normalizeTrainingType((e as any).trainingType);
}

function isGymTraining(e: CalendarEvent): boolean {
  return normalizeTrainingType((e as any).trainingType) === "gym";
}

function formatDayLabelFromISO(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function seedCounts(seed: LiveTrainingSeed | null): { exercises: number; sets: number } {
  if (!seed) return { exercises: 0, sets: 0 };
  const exCount = Array.isArray(seed.exercises) ? seed.exercises.length : 0;
  const setCount =
    Array.isArray(seed.exercises)
      ? seed.exercises.reduce((acc, ex) => acc + (Array.isArray(ex.sets) ? ex.sets.length : 0), 0)
      : 0;
  return { exercises: exCount, sets: setCount };
}

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

export const Dashboard: React.FC<DashboardProps> = ({
  upcoming,
  events,
  onCreateQuickTraining,
  onUpdateEvents,
  isPro = false,
  onOpenPaywall,
}) => {
  const today = startOfDay(new Date());
  const todayISO = dateKey(today);

  // ---------- Kalender / Events State ----------
  const [quickEvent, setQuickEvent] = useState({
    title: "",
    date: todayISO,
    startTime: "18:00",
    endTime: "19:00",
  });

  const todayEvents = useMemo(() => events.filter((e) => e.date === todayISO), [events, todayISO]);

  // ---------- Manuelle Trainings (Dashboard) ----------
  const [manualTrainings, setManualTrainings] = useState<ManualTraining[]>([]);
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [newTraining, setNewTraining] = useState<ManualTraining>({
    id: "",
    date: todayISO,
    sport: "Gym",
    title: "",
    details: "",
  });

  const next3DaysKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      keys.push(dateKey(d));
    }
    return keys;
  }, [today]);

  const manualTrainingsNext3Days = manualTrainings
    .filter((t) => next3DaysKeys.includes(t.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ---------- Stats Training (MVP placeholders) ----------
  const plannedTrainingsThisWeek = upcoming.length;
  const completedTrainingsThisWeek = 0;
  const totalTrainingMinutesThisWeek = 0;

  // ---------- Quick Event (Termin) ----------
  const handleQuickEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(quickEvent.title)) return;

    onCreateQuickTraining({
      title: normalizeTitle(quickEvent.title),
      description: "",
      date: quickEvent.date,
      startTime: quickEvent.startTime,
      endTime: quickEvent.endTime,
      type: "other",
      notes: "Erstellt vom Dashboard",
    });

    setQuickEvent((prev) => ({ ...prev, title: "" }));
  };

  // ---------- Manuelle Trainings Funktionen ----------
  const handleCreateTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeTitle(newTraining.title)) return;

    const training: ManualTraining = {
      ...newTraining,
      id: generateId(),
      date: newTraining.date || todayISO,
      title: normalizeTitle(newTraining.title),
      details: normalizeTitle(newTraining.details),
    };

    setManualTrainings((prev) => [...prev, training]);

    setNewTraining({
      id: "",
      date: todayISO,
      sport: "Gym",
      title: "",
      details: "",
    });
    setIsTrainingModalOpen(false);
  };

  // ======================================================
  // ✅ Plan-Training starten (Seed -> Preview -> LiveTraining)
  // ======================================================

  const resolveSeedForEvent = (event: CalendarEvent): LiveTrainingSeed | null => {
    const byEvent = readLiveSeedForEvent(event.id);
    if (byEvent) return byEvent;

    const key = makeSeedKey(event.date, normalizeTitle(event.title));
    const byKey = readLiveSeedForKey(key);
    if (byKey) return byKey;

    return null;
  };

  const plannedEventsNext3Days = useMemo(() => {
    const list = events
      .filter((e) => isTrainingEvent(e) && next3DaysKeys.includes(e.date))
      .slice()
      .sort((a, b) => (a.date + a.startTime + a.title).localeCompare(b.date + b.startTime + b.title));

    const byDay = new Map<string, CalendarEvent>();
    for (const k of next3DaysKeys) {
      const first = list.find((e) => e.date === k);
      if (first) byDay.set(k, first);
    }
    return byDay;
  }, [events, next3DaysKeys]);

  const todayTrainingEvents = useMemo(() => {
    return todayEvents.filter((e) => isTrainingEvent(e));
  }, [todayEvents]);

  const nextTrainingEvent = useMemo(() => {
    const sorted = events
      .filter((e) => isTrainingEvent(e))
      .slice()
      .sort((a, b) => (a.date + a.startTime + a.title).localeCompare(b.date + b.startTime + b.title));

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

    // ✅ Gym braucht Seed
    if (isGymTraining(previewEvent) && !seed) {
      window.alert("Kein Trainings-Seed gefunden. Bitte Plan erneut in den Kalender übernehmen.");
      return;
    }

    // ✅ Non-Gym darf ohne Seed (Fallback)
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

  const startFreeTraining = () => {
    const empty: LiveTrainingSeed = {
      title: "Freies Training",
      sport: "Gym",
      isCardio: false,
      exercises: [],
    };
    writeGlobalLiveSeed(empty);
    navigateToLiveTraining(undefined);
  };

  const singleTodayTrainingPreview = useMemo(() => {
    if (todayEvents.length !== 1) return null;
    const only = todayEvents[0];
    if (!isTrainingEvent(only)) return null;
    const seed = resolveSeedForEvent(only);
    return { event: only, seed };
  }, [todayEvents]);

  // ======================================================
  // ✅ Adaptives Training (Dashboard Flow)
  // ======================================================

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

    if (!isPro) {
      onOpenPaywall?.("adaptive_limit");
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
        });

        return {
          ...patched,
          adaptiveSuggestion: suggestion as any,
          adaptiveAnswers: answers,
          adaptiveAppliedAt: new Date().toISOString(),
          adaptiveEstimatedMinutes: suggestion.estimatedMinutes,
        } as any;
      })
    );

    setAdaptiveOpen(false);
    setAdaptiveTargetEvent(null);
  };

  // ======================================================
  // ✅ PLAN SHIFT (um 1 Tag nach hinten)
  // ======================================================

  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftCandidates, setShiftCandidates] = useState<Array<{ id: string; label: string }>>([]);
  const [shiftSelectedPlanId, setShiftSelectedPlanId] = useState<string>("__ALL__");

  const futureTrainingEvents = useMemo(() => {
    return events.filter((e) => isTrainingEvent(e) && e.date >= todayISO);
  }, [events, todayISO]);

  const detectPlans = () => {
    const set = new Set<string>();
    for (const ev of futureTrainingEvents) {
      const pid = getTemplateId(ev);
      if (pid) set.add(pid);
    }
    const list = Array.from(set).map((id) => ({ id, label: `Plan ${id.slice(0, 6)}…` }));
    return list;
  };

  const openShiftDialog = () => {
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

    if (!isPro) {
      const allowed = canUsePlanShiftFree(PLAN_SHIFT_FREE_LIMIT);
      if (!allowed) {
        onOpenPaywall?.("plan_shift");
        window.alert(`Free-Limit erreicht: ${PLAN_SHIFT_FREE_LIMIT}× Plan verschieben pro Monat. (Pro entsperrt es)`);
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

    if (!isPro) incrementPlanShiftUsage();

    setShiftOpen(false);
  };

  const shiftUsage = useMemo(() => getPlanShiftUsage(), [shiftOpen]);

  // ---------- Next Training preview card ----------
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

  // ---------- Render ----------
  return (
    <>
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto flex h-full max-w-5xl flex-col gap-5 px-4 pb-24 pt-5">
          {/* Header */}
          <div className="flex items-end justify-between">
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <div className="text-xs text-white/50">
              Heute: <span className="font-mono">{todayISO}</span>
            </div>
          </div>

          {/* Top-Stats */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 shadow-lg shadow-black/30">
              <p className="text-xs text-white/60 mb-1">Trainings diese Woche</p>
              <p className="text-2xl font-semibold">
                {completedTrainingsThisWeek} / {plannedTrainingsThisWeek}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand-primary"
                  style={{
                    width:
                      plannedTrainingsThisWeek === 0 ? "0%" : `${(completedTrainingsThisWeek / plannedTrainingsThisWeek) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 shadow-lg shadow-black/30">
              <p className="text-xs text-white/60 mb-1">Zeit im Training</p>
              <p className="text-2xl font-semibold">
                {Math.floor(totalTrainingMinutesThisWeek / 60)}h {totalTrainingMinutesThisWeek % 60}m
              </p>
              <p className="mt-2 text-[11px] text-white/50">MVP Placeholder (kommt aus History/Stats)</p>
            </div>

            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 shadow-lg shadow-black/30">
              <p className="text-xs text-white/60 mb-1">Nächstes Training</p>
              {nextTrainingCard ? (
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">{nextTrainingCard.title}</p>
                  <p className="text-[11px] text-white/60">
                    {nextTrainingCard.dateLabel}
                    {nextTrainingCard.isToday ? " (heute)" : ""} · {nextTrainingCard.time}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/60">Kein Training geplant</p>
              )}
            </div>
          </div>

          {/* Plan Shift Card */}
          <div className="rounded-2xl bg-brand-card border border-white/5 p-4 shadow-lg shadow-black/30">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Plan verschieben</div>
                <div className="text-[11px] text-white/60">
                  Verschiebt alle geplanten Trainings ab heute um <span className="font-semibold text-white/80">1 Tag</span>.
                  So bleibt dein Split sauber, wenn du heute keine Zeit hast.
                </div>

                {!isPro && (
                  <div className="text-[11px] text-white/50">
                    Free: {shiftUsage.used}/{PLAN_SHIFT_FREE_LIMIT} Verschiebungen in {shiftUsage.monthKey} genutzt. Pro: unbegrenzt.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={openShiftDialog}
                className="shrink-0 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2 text-[12px] font-semibold text-white"
              >
                +1 Tag
              </button>
            </div>
          </div>

          {/* Trainingsvorschau + heutige Termine */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Nächste Trainings */}
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 shadow-lg shadow-black/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium">Trainingsplan – nächste 3 Tage</h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openAdaptiveForToday}
                    className="px-3 py-2 rounded-2xl bg-sky-500/20 hover:bg-sky-500/25 border border-sky-400/30 text-[12px] font-semibold text-sky-200"
                    title="Adaptives Training (nur heute, Plan bleibt unverändert)"
                  >
                    Adaptiv
                  </button>

                  <button
                    type="button"
                    onClick={startPlanTodayOrNextPreview}
                    className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-black shadow-lg shadow-black/30"
                    title="Öffnet die Vorschau (heutiges Training oder nächstes geplantes)"
                  >
                    Start
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewTraining((prev) => ({ ...prev, date: todayISO }));
                      setIsTrainingModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-2xl bg-brand-primary hover:bg-brand-primary/90 text-[12px] font-semibold"
                  >
                    Training +
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {next3DaysKeys.map((k) => {
                  const ev = plannedEventsNext3Days.get(k) ?? null;
                  const seed = ev ? resolveSeedForEvent(ev) : null;
                  const counts = seedCounts(seed);
                  const tt = ev ? normalizeTrainingType((ev as any).trainingType) : null;

                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        if (ev) openPreviewForEvent(ev);
                      }}
                      disabled={!ev}
                      className={[
                        "w-full rounded-xl bg-black/25 px-3 py-2 text-left transition",
                        ev ? "hover:bg-black/35" : "opacity-70 cursor-not-allowed",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-[11px] text-white/50">{formatDayLabelFromISO(k)}</div>
                          <div className="text-sm font-medium">{ev ? normalizeTitle(ev.title) : "Kein Training geplant"}</div>

                          {ev && (
                            <div className="text-[11px] text-white/60">
                              {counts.exercises > 0 || counts.sets > 0 ? `${counts.exercises} Übungen • ${counts.sets} Sätze` : "Noch keine Übungen"}
                            </div>
                          )}

                          {ev?.adaptiveProfile && typeof (ev as any).adaptiveEstimatedMinutes === "number" && (
                            <div className="text-[11px] text-sky-200/80">
                              Adaptiv {ev.adaptiveProfile} · {(ev as any).adaptiveEstimatedMinutes} min
                            </div>
                          )}
                        </div>

                        {ev && (
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70">
                              {tt ? tt.toUpperCase() : "TRAINING"}
                            </span>

                            <span
                              className={[
                                "text-[10px] px-2 py-1 rounded-full",
                                seed || !isGymTraining(ev) ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-white/60",
                              ].join(" ")}
                              title={
                                seed
                                  ? "Plan-Übungen vorhanden"
                                  : isGymTraining(ev)
                                  ? "Seed fehlt (Plan erneut in Kalender übernehmen)"
                                  : "Kein Seed nötig (Cardio/Custom)"
                              }
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

              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={startFreeTraining}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[12px] text-white/80 hover:bg-white/5"
                  title="Freies Training"
                >
                  Frei
                </button>
              </div>

              {manualTrainingsNext3Days.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-1.5">
                  <p className="text-[11px] text-white/60">Eigene Trainings (nächste 3 Tage)</p>
                  {manualTrainingsNext3Days.map((t) => (
                    <div key={t.id} className="flex items-start justify-between rounded-lg bg-black/30 px-3 py-2">
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-white/50">{t.date}</div>
                        <div className="text-sm font-medium">{t.title}</div>
                        {t.details && <div className="text-[11px] text-white/60">{t.details}</div>}
                      </div>
                      <span className="ml-3 text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70">
                        {t.sport}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Heutige Termine */}
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 shadow-lg shadow-black/30 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Heutige Termine ({todayEvents.length})</h2>
              </div>

              {singleTodayTrainingPreview ? (
                <button
                  type="button"
                  onClick={() => openPreviewForEvent(singleTodayTrainingPreview.event)}
                  className="rounded-xl bg-black/25 px-3 py-3 text-left hover:bg-black/35 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[11px] text-white/50">Training</div>
                      <div className="text-base font-semibold text-white">{normalizeTitle(singleTodayTrainingPreview.event.title)}</div>

                      {singleTodayTrainingPreview.event.adaptiveProfile &&
                        typeof (singleTodayTrainingPreview.event as any).adaptiveEstimatedMinutes === "number" && (
                          <div className="text-[11px] text-sky-200/80">
                            Adaptiv {singleTodayTrainingPreview.event.adaptiveProfile} · {(singleTodayTrainingPreview.event as any).adaptiveEstimatedMinutes} min
                          </div>
                        )}
                    </div>
                    <div className="text-[10px] text-white/60 whitespace-nowrap">
                      {singleTodayTrainingPreview.event.startTime}–{singleTodayTrainingPreview.event.endTime}
                    </div>
                  </div>
                </button>
              ) : todayEvents.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {todayEvents.map((event) => (
                    <div key={event.id} className="rounded-lg bg-black/25 px-3 py-2 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">{normalizeTitle(event.title)}</span>
                        <span className="text-[10px] text-white/60">
                          {event.startTime}–{event.endTime}
                        </span>
                      </div>
                      {event.description && <div className="text-white/70">{event.description}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-black/25 px-3 py-3 text-xs text-white/60">Keine Termine heute.</div>
              )}
            </div>
          </div>

          {/* Termin anlegen */}
          <div className="rounded-2xl bg-brand-card border border-white/5 p-4 shadow-lg shadow-black/30 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Termin anlegen</h2>
            </div>

            <form onSubmit={handleQuickEventSubmit} className="grid gap-2 md:grid-cols-4 text-xs">
              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Titel</label>
                <input
                  type="text"
                  value={quickEvent.title}
                  onChange={(e) => setQuickEvent((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-1"
                  placeholder="z.B. Meeting"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Datum</label>
                <input
                  type="date"
                  value={quickEvent.date}
                  onChange={(e) => setQuickEvent((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-1"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Start</label>
                <input
                  type="time"
                  value={quickEvent.startTime}
                  onChange={(e) => setQuickEvent((prev) => ({ ...prev, startTime: e.target.value }))}
                  className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-1"
                />
              </div>

              <div className="flex items-end">
                <div className="flex w-full gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="block text-[11px] text-white/60">Ende</label>
                    <input
                      type="time"
                      value={quickEvent.endTime}
                      onChange={(e) => setQuickEvent((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-1"
                    />
                  </div>
                  <button
                    type="submit"
                    className="self-end px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-[11px] font-medium"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            </form>
          </div>

          <FeedbackBar page="Dashboard" />
        </div>
      </div>

      {/* ---------------- MANUAL TRAINING MODAL ---------------- */}
      {isTrainingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-white/60">Eigenes Training</div>
                <div className="text-sm font-semibold text-white">Training hinzufügen</div>
              </div>
              <button
                type="button"
                onClick={() => setIsTrainingModalOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTraining} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">Datum</label>
                  <input
                    type="date"
                    value={newTraining.date}
                    onChange={(e) => setNewTraining((p) => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] text-white/60">Sport</label>
                  <select
                    value={newTraining.sport}
                    onChange={(e) => setNewTraining((p) => ({ ...p, sport: e.target.value }))}
                    className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2 text-[12px]"
                  >
                    <option value="Gym">Gym</option>
                    <option value="Laufen">Laufen</option>
                    <option value="Radfahren">Radfahren</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Titel</label>
                <input
                  type="text"
                  value={newTraining.title}
                  onChange={(e) => setNewTraining((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                  placeholder="z.B. 30 min Lauf"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-white/60">Details (optional)</label>
                <textarea
                  value={newTraining.details}
                  onChange={(e) => setNewTraining((p) => ({ ...p, details: e.target.value }))}
                  className="w-full min-h-[80px] rounded-lg bg-black/30 border border-white/20 px-2 py-2"
                  placeholder="z.B. Intervall / Pace / Notizen"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsTrainingModalOpen(false)}
                  className="rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-[12px] text-white/80 hover:bg-white/5"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-[12px] font-semibold text-black"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- SHIFT MODAL ---------------- */}
      {shiftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-white/60">Plan verschieben</div>
                <div className="text-sm font-semibold text-white">Um 1 Tag nach hinten</div>
              </div>
              <button
                type="button"
                onClick={() => setShiftOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            {shiftCandidates.length >= 2 ? (
              <div className="space-y-2 text-xs">
                <div className="text-[11px] text-white/60">
                  Mehrere Trainingspläne erkannt. Welchen Plan möchtest du verschieben?
                </div>
                <select
                  value={shiftSelectedPlanId}
                  onChange={(e) => setShiftSelectedPlanId(e.target.value)}
                  className="w-full rounded-lg bg-black/30 border border-white/20 px-2 py-2 text-[12px]"
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
              <div className="text-[11px] text-white/60">
                Es wurde {shiftCandidates.length === 1 ? "ein Plan" : "kein templateId-Plan"} erkannt. Wir verschieben alle Trainings ab heute.
              </div>
            )}

            {!isPro && (
              <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[11px] text-white/70">
                Free: {shiftUsage.used}/{PLAN_SHIFT_FREE_LIMIT} in {shiftUsage.monthKey}. Pro: unbegrenzt.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShiftOpen(false)}
                className="rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-[12px] text-white/80 hover:bg-white/5"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={doShift}
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-[12px] font-semibold text-black"
              >
                Verschieben
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- ADAPTIVE MODAL ---------------- */}
      <AdaptiveTrainingModal
        open={adaptiveOpen}
        onClose={() => {
          setAdaptiveOpen(false);
          setAdaptiveTargetEvent(null);
        }}
        plannedWorkoutType={inferWorkoutTypeFromTitle(adaptiveTargetEvent?.title ?? "Push")}
        splitType="push_pull"
        onSelect={(s, a) => applyAdaptiveSelection(s, a)}
      />

      {/* ---------------- PREVIEW MODAL ---------------- */}
      {isPreviewOpen && previewEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[11px] text-white/60">Vorschau</div>
                <div className="text-sm font-semibold text-white">{normalizeTitle(previewEvent.title)}</div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsPreviewOpen(false);
                  setPreviewEvent(null);
                }}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            {previewSeed ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-white/60">
                  <span>Übungen</span>
                  <span>
                    {seedCounts(previewSeed).exercises} • {seedCounts(previewSeed).sets} Sätze
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-3 text-xs text-white/70">
                {isGymTraining(previewEvent)
                  ? "Kein Trainings-Seed gefunden. (Plan ggf. erneut in den Kalender übernehmen)"
                  : "Kein Seed nötig (Cardio/Custom). Du kannst trotzdem starten."}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={startFreeTraining}
                className="rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-[12px] text-white/80 hover:bg-white/5"
              >
                Frei
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPreviewOpen(false);
                    setPreviewEvent(null);
                  }}
                  className="rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-[12px] text-white/80 hover:bg-white/5"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  onClick={startFromPreview}
                  className="rounded-xl px-4 py-2 text-[12px] font-semibold bg-emerald-500 hover:bg-emerald-400 text-black"
                >
                  Training starten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;