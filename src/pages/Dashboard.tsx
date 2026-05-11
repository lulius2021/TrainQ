import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useModalStore } from '../store/useModalStore';
import {
  Plus,
  Calendar,
  Sparkles,
  RefreshCw,
  ChevronRight,
  X,
  Clock,
  Battery,
  Play,
  Bike,
  Trophy,
  Zap,
  MapPin,
  Route,
  Timer,
  Flame,
  // Users — removed (community widget handles it)
} from 'lucide-react';
import { IconFigureRun } from '../assets/icons/IconFigureRun';
import { IconDumbbellFill } from '../assets/icons/IconDumbbellFill';
import { hapticMedium } from '../native/haptics';
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { parseISODateLocal } from '../utils/calendarGeneration';
import { de } from 'date-fns/locale';
import { shiftWorkouts } from '../utils/trainingSchedule';

import { useLiveTrainingStore } from '../store/useLiveTrainingStore';
import { persistActiveLiveWorkout } from '../utils/trainingHistory';
import { getScopedItem, setScopedItem } from '../utils/scopedStorage';
import type { CalendarEvent, LiveWorkout } from '../types/training';
import type { DeloadPlan } from '../types/deload';
import type { AdaptiveSuggestion, AdaptiveAnswers } from '../types/adaptive';
import { useTheme } from '../context/ThemeContext';
import { getActiveUserId } from '../utils/session';
import { track } from '../analytics/track';
import WorkoutPlannerModal from '../components/training/WorkoutPlannerModal';
import { BottomSheet } from '../components/common/BottomSheet';
import ShiftPlanModal from '../components/training/ShiftPlanModal';
import AdaptiveTrainingModal from '../components/adaptive/AdaptiveTrainingModal';
import { ProfileService } from '../services/ProfileService';
import { readDeloadPlan, readDeloadDismissedUntil, writeDeloadDismissedUntil, writeDeloadPlan } from '../utils/deload/storage';
import { computeAvgSessionsPerWeek, computeNextDueISO, isDeloadDue, getFirstTrainingDateISO, addDaysISO } from '../utils/deload/schedule';
import DeloadBanner from '../components/deload/DeloadBanner';
import DeloadPlanModal from '../components/deload/DeloadPlanModal';
import RecoveryScoreWidget from '../components/deload/RecoveryScoreWidget';
import PostDeloadFeedback, { shouldShowPostDeloadFeedback } from '../components/deload/PostDeloadFeedback';
import WellbeingCheckIn from '../components/wellness/WellbeingCheckIn';
import { useDeloadScore } from '../hooks/useDeloadScore';
import { writeGlobalLiveSeed, type LiveTrainingSeed } from '../utils/liveTrainingSeed';
import { applyAdaptiveToSeed } from '../utils/adaptiveSeed';
import { buildUserAdaptiveContext } from '../utils/adaptivePersonalization';
import { getAdaptiveTemplate } from '../data/adaptiveTemplates';
import { readOnboardingDataFromStorage } from '../context/OnboardingContext';
import { loadWorkoutHistory, type WorkoutHistoryEntry } from '../utils/workoutHistory';
import { startFreeTraining } from '../utils/startSession';
import { formatPace, formatDistanceKm } from '../utils/gpsUtils';
import NutritionDashboardWidget from '../components/nutrition/NutritionDashboardWidget';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { useI18n } from '../i18n/useI18n';

// --- HELPER ---
const formatNumber = (num: number) => {
  return num.toLocaleString(navigator.language);
};

const STORAGE_KEY_EVENTS = "trainq_calendar_events";

// --- LAST ACTIVITY CARD ---
const LastActivityCard: React.FC<{ workout: WorkoutHistoryEntry }> = ({ workout }) => {
  const { t, lang } = useI18n();
  const sport = (workout.sport || "Gym").toLowerCase();
  const isCardio = sport.includes("laufen") || sport.includes("radfahren");
  const isRun = sport.includes("laufen");
  const isCycle = sport.includes("radfahren");

  const mins = Math.max(0, Math.round((workout.durationSec ?? 0) / 60));
  const dateStr = (() => {
    try {
      const d = new Date(workout.endedAt || workout.startedAt);
      if (isNaN(d.getTime())) return "";
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
      if (diffDays === 0) return t("dashboard.lastActivity.today");
      if (diffDays === 1) return t("dashboard.lastActivity.yesterday");
      return d.toLocaleDateString(lang === "de" ? "de-DE" : "en-US", { day: "2-digit", month: "short" });
    } catch { return ""; }
  })();

  const sportConfig = isRun
    ? { icon: <IconFigureRun width={20} height={20} />, color: "#007AFF", bg: "rgba(0,122,255,0.1)", label: t("dashboard.lastActivity.run") }
    : isCycle
    ? { icon: <Bike size={20} />, color: "#007AFF", bg: "rgba(0,122,255,0.1)", label: t("dashboard.lastActivity.ride") }
    : { icon: <IconDumbbellFill width={20} height={12} />, color: "#007AFF", bg: "rgba(0,122,255,0.1)", label: t("dashboard.lastActivity.strength") };

  return (
    <div
      className="bg-[var(--card-bg)] rounded-[24px] p-5 border border-[var(--border-color)] active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-4 mb-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: sportConfig.bg, color: sportConfig.color }}
        >
          {sportConfig.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[15px] font-bold text-[var(--text-color)] truncate">
            {workout.title || sportConfig.label}
          </h4>
          <p className="text-xs text-[var(--text-secondary)]">{dateStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {/* Duration — always shown */}
        <div className="flex items-center gap-1.5">
          <Timer size={14} style={{ color: "var(--text-secondary)" }} />
          <span className="text-sm font-semibold text-[var(--text-color)]">{mins} min</span>
        </div>

        {/* Cardio: Distance */}
        {isCardio && workout.distanceKm != null && workout.distanceKm > 0 && (
          <div className="flex items-center gap-1.5">
            <Route size={14} style={{ color: sportConfig.color }} />
            <span className="text-sm font-semibold" style={{ color: sportConfig.color }}>
              {formatDistanceKm(workout.distanceKm * 1000)}
            </span>
          </div>
        )}

        {/* Cardio: Pace */}
        {isCardio && workout.paceSecPerKm != null && workout.paceSecPerKm > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap size={14} style={{ color: "var(--text-secondary)" }} />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {formatPace(workout.paceSecPerKm)}
            </span>
          </div>
        )}

        {/* Gym: Volume */}
        {!isCardio && workout.totalVolume > 0 && (
          <div className="flex items-center gap-1.5">
            <IconDumbbellFill width={14} height={8} style={{ color: "var(--text-secondary)" }} />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {formatNumber(workout.totalVolume)} kg
            </span>
          </div>
        )}

        {/* Gym: Exercise count */}
        {!isCardio && workout.exercises.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {workout.exercises.length} {t("dashboard.lastActivity.exercises")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};


const DashboardPage = () => {
  const { t } = useI18n();
  const [confirmPending, setConfirmPending] = useState<{ label: string; onConfirm: () => void } | null>(null);
  const activateShield = useModalStore((s) => s.activateShield);
  const askConfirm = useCallback((label: string, action: () => void) => {
    setConfirmPending({ label, onConfirm: action });
  }, []);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showTerminModal, setShowTerminModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showToast, setShowToast] = useState(false); // For visual feedback
  const { mode } = useTheme();
  const userId = getActiveUserId();
  // Weekly Goal State
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [weeklyCalories, setWeeklyCalories] = useState(0);
  const [weeklyGoal] = useState(300); // Default goal 300 min
  const [weeklyDistanceKm, setWeeklyDistanceKm] = useState(0);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0);
  const [lastActivity, setLastActivity] = useState<WorkoutHistoryEntry | null>(null);

  // Live Training Check
  const activeWorkout = useLiveTrainingStore((state) => state.activeWorkout);
  const isWorkoutActive = !!activeWorkout?.isActive;

  // Deload State
  const [deloadBannerState, setDeloadBannerState] = useState<"recommended" | "active" | null>(null);
  const [deloadPlan, setDeloadPlan] = useState<DeloadPlan | null>(null);
  const [showDeloadModal, setShowDeloadModal] = useState(false);
  const [showPostDeloadFeedback, setShowPostDeloadFeedback] = useState(false);

  // Recovery score (multi-factor deload decision)
  const { result: deloadScore } = useDeloadScore();

  const computeDeloadState = useCallback(() => {
    try {
      const userId = getActiveUserId();
      const plan = readDeloadPlan(userId);
      const todayISO = new Date().toISOString().slice(0, 10);

      // Active plan: today is within deload week
      if (plan && todayISO >= plan.startISO && todayISO <= plan.endISO) {
        setDeloadPlan(plan);
        setDeloadBannerState("active");
        return;
      }

      // Post-deload feedback window
      if (shouldShowPostDeloadFeedback(plan, userId)) {
        setShowPostDeloadFeedback(true);
      }

      // Compute whether deload is due (calendar-based)
      const raw = getScopedItem("trainq_calendar_events", userId);
      let calEvents: CalendarEvent[] = [];
      if (raw) {
        try { calEvents = JSON.parse(raw); } catch { /* ignore */ }
      }

      const avg = computeAvgSessionsPerWeek(calEvents);
      const firstDate = getFirstTrainingDateISO(calEvents);
      const dueISO = computeNextDueISO({
        firstTrainingISO: firstDate,
        lastDeloadStartISO: plan?.startISO ?? null,
        avgSessionsPerWeek: avg,
      });

      const dismissedUntil = readDeloadDismissedUntil(userId);
      const calendarDue = isDeloadDue({
        todayISO,
        dueISO,
        dismissedUntilISO: dismissedUntil,
        activePlan: plan ? { startISO: plan.startISO, endISO: plan.endISO } : null,
      });

      setDeloadPlan(null);
      // Show banner if calendar-based OR score-based (score >= 50)
      // Score is checked via deloadScore state (set by useDeloadScore hook)
      setDeloadBannerState(calendarDue ? "recommended" : null);
    } catch {
      setDeloadBannerState(null);
    }
  }, []);

  useEffect(() => {
    computeDeloadState();
  }, [computeDeloadState]);

  // Also trigger banner when score-based threshold is met (independent of calendar check)
  useEffect(() => {
    if (!deloadScore) return;
    // Only promote to "recommended" — don't override an "active" state
    if (deloadBannerState === "active") return;
    if (deloadScore.level !== "none" && deloadBannerState !== "recommended") {
      // Check dismiss
      const userId = getActiveUserId();
      const dismissed = readDeloadDismissedUntil(userId);
      if (dismissed) {
        const todayISO = new Date().toISOString().slice(0, 10);
        if (todayISO < dismissed) return;
      }
      setDeloadBannerState("recommended");
    }
  }, [deloadScore, deloadBannerState]);

  const handleDeloadDismiss = useCallback(() => {
    const userId = getActiveUserId();
    const todayISO = new Date().toISOString().slice(0, 10);
    const dismissUntil = addDaysISO(todayISO, 7);
    writeDeloadDismissedUntil(userId, dismissUntil);
    setDeloadBannerState(null);
  }, []);

  const handleDeloadSave = useCallback((plan: DeloadPlan) => {
    const userId = getActiveUserId();
    writeDeloadPlan(userId, plan);
    setDeloadPlan(plan);
    setDeloadBannerState("active");
    setShowDeloadModal(false);
  }, []);

  useEffect(() => {
    const loadWeeklyStats = () => {
      // Defer calculation to next tick to avoid blocking UI during interactions
      setTimeout(() => {
        try {
          const userId = getActiveUserId();
          const raw = getScopedItem("trainq_calendar_events", userId);
          if (!raw) {
            setWeeklyMinutes(0);
            return;
          }
          let events = [];
          try { events = JSON.parse(raw); } catch (e) {
            if (import.meta.env.DEV) console.warn("[Dashboard] corrupted calendar events, resetting", e);
            localStorage.removeItem("trainq_calendar_events");
          }
          if (!Array.isArray(events)) return;

          const now = new Date();
          const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
          const end = endOfWeek(now, { weekStartsOn: 1 });

          let totalMin = 0;
          let totalCalories = 0;
          events.forEach((ev: any) => {
            if (ev.type === 'training' && ev.trainingStatus === 'completed') {
              // Check date
              if (ev.date && isWithinInterval(parseISODateLocal(ev.date), { start, end })) {
                // Sum duration
                let dur = 0;
                if (typeof ev.durationMinutes === 'number') {
                  dur = ev.durationMinutes;
                } else if (typeof ev.duration === 'string') {
                  if (ev.duration.includes(':')) {
                    const parts = ev.duration.split(':').map(Number);
                    if (parts.length === 2) dur = (parts[0] * 60) + parts[1];
                    else if (parts.length === 3) dur = (parts[0] * 60) + parts[1]; // Ignore seconds for now
                  } else {
                    dur = parseInt(ev.duration) || 0;
                  }
                }
                // Normalize
                if (Number.isNaN(dur)) dur = 0;
                totalMin += dur;

                // Calorie Calc (Simple MET estimation)
                const weight = ProfileService.getUserProfile().weight || 75; // Default 75kg
                let met = 5; // Gym/Custom default
                const sport = (ev.sport || ev.trainingType || "").toLowerCase();
                if (sport.includes("laufen") || sport.includes("run")) met = 9;
                else if (sport.includes("rad") || sport.includes("bike") || sport.includes("cycling")) met = 7;

                // kcal = MET * kg * hours
                const kcal = met * weight * (dur / 60);
                totalCalories += kcal;
              }
            }
          });
          setWeeklyMinutes(totalMin);
          setWeeklyCalories(Math.round(totalCalories));
        } catch {
          // weekly stats calculation failed — ignore
        }
      }, 0);
    };

    loadWeeklyStats();
    window.addEventListener("trainq:update_events", loadWeeklyStats);
    return () => window.removeEventListener("trainq:update_events", loadWeeklyStats);
  }, []);

  // Load workout history for last activity + weekly distance
  useEffect(() => {
    const loadHistory = () => {
      try {
        const history = loadWorkoutHistory();
        if (!history || history.length === 0) {
          setLastActivity(null);
          setWeeklyDistanceKm(0);
          setWeeklyWorkouts(0);
          return;
        }

        // Last activity
        setLastActivity(history[0]);

        // Weekly stats from history
        const now = new Date();
        const start = startOfWeek(now, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });
        let totalDist = 0;
        let workoutCount = 0;

        history.forEach((w) => {
          try {
            const d = parseISO(w.endedAt || w.startedAt);
            if (isWithinInterval(d, { start, end })) {
              workoutCount++;
              if (w.distanceKm && w.distanceKm > 0) {
                totalDist += w.distanceKm;
              }
            }
          } catch { /* skip */ }
        });

        setWeeklyDistanceKm(Math.round(totalDist * 10) / 10);
        setWeeklyWorkouts(workoutCount);
      } catch { /* ignore */ }
    };

    loadHistory();
    window.addEventListener("trainq:workoutHistoryUpdated", loadHistory);
    return () => window.removeEventListener("trainq:workoutHistoryUpdated", loadHistory);
  }, []);

  const handleShiftConfirm = async (days: number) => {
    try {
      await shiftWorkouts(days);
      setShowShiftModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    }
  };

  // Adaptive Training State
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false);

  const adaptivePreviewExercises = useMemo(() => {
    // Fallback preview for gym (used when user has no workout history yet)
    const onboarding = readOnboardingDataFromStorage();
    const persona = onboarding.personal.persona || "beginner";
    const template = getAdaptiveTemplate("Push", persona);
    return template.map(tpl => ({ name: tpl.name }));
    // The modal will override this with personal history when available
  }, []);

  const handleOpenAdaptive = () => {
    // Fire-and-forget haptics — don't await (can hang on simulator)
    hapticMedium();
    setShowAdaptiveModal(true);
  };

  /** Save adaptive suggestion as a calendar event and return the event id */
  const saveAdaptiveToCalendar = (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers): string => {
    const userId = getActiveUserId() || "user";
    const eventId = crypto.randomUUID();
    const now = new Date();
    const sport = answers.sport ?? "gym";
    const seedSport = sport === "laufen" ? "Laufen" : sport === "radfahren" ? "Radfahren" : "Gym";
    const isCardio = seedSport !== "Gym";
    const baseSeed: LiveTrainingSeed = { title: "Training", sport: seedSport, isCardio, exercises: [] };
    const context = buildUserAdaptiveContext(sport, answers);
    const adaptedSeed = applyAdaptiveToSeed(baseSeed, suggestion, answers, context);

    const calendarEvent = {
      id: eventId,
      userId,
      title: `Training (Adaptiv: ${suggestion.title})`,
      date: format(now, "yyyy-MM-dd"),
      startTime: format(now, "HH:mm"),
      endTime: "",
      type: "training",
      trainingType: "gym",
      trainingStatus: "open",
      description: suggestion.subtitle,
      workoutData: { exercises: adaptedSeed.exercises },
      adaptiveAppliedAt: now.toISOString(),
      adaptiveReasons: suggestion.reasons || [],
      adaptiveProfile: suggestion.profile,
    };

    try {
      const raw = getScopedItem(STORAGE_KEY_EVENTS, userId);
      const events = raw ? JSON.parse(raw) : [];
      events.push(calendarEvent);
      setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(events), userId);
      window.dispatchEvent(new Event("trainq:update_events"));
    } catch (e) {
      if (import.meta.env.DEV) console.error("Failed to save adaptive calendar event", e);
    }

    return eventId;
  };

  /** Save to calendar only (no live start) */
  const handleAdaptiveSaveToCalendar = (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => {
    saveAdaptiveToCalendar(suggestion, answers);
    track("feature_used", { featureKey: "ADAPTIVE_SUGGESTION", profile: suggestion.profile, action: "calendar_save" });
    setShowAdaptiveModal(false);
  };

  /** Save to calendar AND start live training */
  const handleAdaptiveSelect = (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => {
    const eventId = saveAdaptiveToCalendar(suggestion, answers);
    const sport = answers.sport ?? "gym";
    const seedSport = sport === "laufen" ? "Laufen" : sport === "radfahren" ? "Radfahren" : "Gym";
    const isCardio = seedSport !== "Gym";
    const baseSeed: LiveTrainingSeed = { title: "Training", sport: seedSport, isCardio, exercises: [] };
    const context = buildUserAdaptiveContext(sport, answers);
    const adaptedSeed = applyAdaptiveToSeed(baseSeed, suggestion, answers, context);
    writeGlobalLiveSeed({ ...adaptedSeed, calendarEventId: eventId });
    track("feature_used", { featureKey: "ADAPTIVE_SUGGESTION", profile: suggestion.profile, action: "calendar_save_and_start" });
    setShowAdaptiveModal(false);
    window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/live-training" } }));
  };






  return (
    <div className="bg-[var(--bg-color)] text-[var(--text-color)]">

      <ShiftPlanModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        onConfirm={handleShiftConfirm}
      />

      {/* TOAST */}
      {showToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[200] bg-[var(--modal-bg)] text-[var(--text-color)] border border-[var(--border-color)] px-6 py-3 rounded-full font-bold shadow-xl animate-in slide-in-from-top-4 fade-in">
          {t("dashboard.planShifted")}
        </div>
      )}

      {/* Safe area spacer */}
      <div style={{ height: "env(safe-area-inset-top)" }} />

      {/* CONTENT */}
      {/* Dynamic padding bottom to account for MiniPlayer if active */}
      <div
        className="px-4 pt-4 space-y-3 max-w-md mx-auto transition-all duration-300"
        style={{ paddingBottom: isWorkoutActive ? "160px" : "120px" }}
      >


        {/* DELOAD BANNER */}
        {deloadBannerState && (
          <DeloadBanner
            state={deloadBannerState}
            plan={deloadPlan}
            onPlan={() => setShowDeloadModal(true)}
            onDismiss={handleDeloadDismiss}
            onAdjust={deloadBannerState === "active" ? () => setShowDeloadModal(true) : undefined}
            scoreResult={deloadScore}
          />
        )}

        {/* ADAPTIVES TRAINING */}
        <button
          onClick={handleOpenAdaptive}
          className="w-full relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-500 rounded-[24px] px-5 py-4 active:scale-[0.98] transition-transform text-left"
          style={{ color: 'white' }}
        >
          <div className="relative z-10 flex items-center justify-between force-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="text-[14px] font-bold leading-tight">{t("dashboard.adaptive.title")}</div>
                <div className="text-[11px] opacity-70 leading-tight truncate mt-0.5">{t("dashboard.adaptive.subtitle")}</div>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/20 px-3.5 py-2 rounded-full shrink-0 ml-3">
              {t("dashboard.adaptive.generate")}
              <ChevronRight size={14} />
            </div>
          </div>
        </button>


        {/* QUICK START — 3 full-width rows */}
        <div className="space-y-2">
          {[
            { label: t("dashboard.quickStart.gym"), sub: t("dashboard.quickStart.gym_sub"), icon: <IconDumbbellFill width={20} height={12} />, action: () => askConfirm(t("dashboard.quickStart.confirm_gym", { label: t("dashboard.quickStart.gym") }), () => startFreeTraining("gym")) },
            { label: t("dashboard.quickStart.running"), sub: t("dashboard.quickStart.cardio_sub"), icon: <IconFigureRun width={20} height={20} />, action: () => askConfirm(t("dashboard.quickStart.confirm_cardio", { label: t("dashboard.quickStart.running") }), () => startFreeTraining("laufen")) },
            { label: t("dashboard.quickStart.cycling"), sub: t("dashboard.quickStart.cardio_sub"), icon: <Bike size={20} />, action: () => askConfirm(t("dashboard.quickStart.confirm_cardio", { label: t("dashboard.quickStart.cycling") }), () => startFreeTraining("radfahren")) },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              disabled={isWorkoutActive}
              className="w-full rounded-[20px] px-4 py-3.5 flex items-center gap-4 active:scale-[0.98] transition-transform btn-haptic disabled:opacity-50 backdrop-blur-xl"
              style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}
            >
              <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(0,122,255,0.12)", color: "#007AFF" }}>
                {item.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="text-[14px] font-bold text-[var(--text-color)]">{item.label}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{item.sub}</div>
              </div>
              <ChevronRight size={18} style={{ color: "var(--text-muted)" }} />
            </button>
          ))}
        </div>

        {/* QUICK ACCESS — inline row */}
        <div className="flex gap-2">
          <button onClick={() => setShowPlanModal(true)} className="flex-1 rounded-[20px] px-4 py-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform btn-haptic backdrop-blur-xl"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <Plus size={16} style={{ color: "#007AFF" }} strokeWidth={2.5} />
            <span className="text-[13px] font-semibold text-[var(--text-color)]">{t("dashboard.quickAccess.plan")}</span>
          </button>
          <button onClick={() => setShowShiftModal(true)} className="flex-1 rounded-[20px] px-4 py-3 flex items-center justify-center gap-2 active:scale-[0.97] transition-transform btn-haptic backdrop-blur-xl"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <RefreshCw size={14} style={{ color: "#007AFF" }} />
            <span className="text-[13px] font-semibold text-[var(--text-color)]">{t("dashboard.quickAccess.shift")}</span>
          </button>
        </div>



        {/* WEEKLY OVERVIEW */}
        <div className="rounded-[24px] px-5 py-4 backdrop-blur-xl" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
          <h3 className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t("dashboard.weekOverview")}</h3>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[42px] font-black tabular-nums leading-none" style={{ color: "var(--text-color)" }}>{weeklyWorkouts}</span>
            <span className="text-[15px] font-semibold text-[var(--text-muted)]">{t("dashboard.week.workouts")}</span>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--accent-color)" }} />
              <span className="text-[13px] font-medium text-[var(--text-secondary)]">{weeklyMinutes} {t("dashboard.week.minutes")}</span>
            </div>
            {weeklyDistanceKm > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--text-muted)" }} />
                <span className="text-[13px] font-medium text-[var(--text-secondary)]">{weeklyDistanceKm} km</span>
              </div>
            )}
          </div>
        </div>

        {/* LAST ACTIVITY */}
        {lastActivity && (
          <div>
            <h3 className="text-[13px] font-bold text-[var(--text-muted)] mb-3 pl-1 uppercase tracking-wider">{t("dashboard.lastTraining")}</h3>
            <div className="rounded-[28px] p-4 flex items-center gap-4 backdrop-blur-xl" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(0,122,255,0.1)" }}>
                {lastActivity.sport === "gym" ? <IconDumbbellFill width={20} height={12} style={{ color: "#007AFF" }} /> : lastActivity.sport === "laufen" ? <IconFigureRun width={20} height={20} style={{ color: "#007AFF" }} /> : <Bike size={20} style={{ color: "#007AFF" }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: "var(--text-color)" }}>{lastActivity.title || lastActivity.sport}</div>
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {(() => { try { return format(parseISO(lastActivity.startedAt), "EEEE, d. MMM", { locale: de }); } catch { return ""; } })()}
                  {lastActivity.durationSec ? ` · ${Math.round(lastActivity.durationSec / 60)} min` : ""}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NUTRITION TRACKER */}
        {FEATURE_FLAGS.nutrition && <NutritionDashboardWidget />}


      </div>


      <DeloadPlanModal
        open={showDeloadModal}
        onClose={() => setShowDeloadModal(false)}
        onSave={handleDeloadSave}
      />

      {showPostDeloadFeedback && deloadPlan && (
        <PostDeloadFeedback
          plan={deloadPlan}
          onClose={() => setShowPostDeloadFeedback(false)}
        />
      )}

      <AdaptiveTrainingModal
        open={showAdaptiveModal}
        onClose={() => setShowAdaptiveModal(false)}
        plannedWorkoutType="Push"
        splitType="push_pull"
        onSelect={handleAdaptiveSelect}
        onSaveToCalendar={handleAdaptiveSaveToCalendar}
        previewExercises={adaptivePreviewExercises}
      />

      <WorkoutPlannerModal
        open={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSave={() => {}}
      />

      <BottomSheet
        open={!!confirmPending}
        onClose={() => { setConfirmPending(null); activateShield(); }}
        height="auto"
        showHandle={true}
        header={
          <div className="text-center space-y-1 px-6">
            <p className="text-[15px] font-bold" style={{ color: "var(--text-color)" }}>{t("dashboard.start_training_question")}</p>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{confirmPending?.label}</p>
          </div>
        }
        contentClassName="px-6 pb-6 pt-2 space-y-3"
      >
        <button
          onPointerDown={() => { confirmPending?.onConfirm(); setConfirmPending(null); activateShield(); }}
          className="w-full py-4 rounded-2xl text-[17px] font-bold text-white active:scale-[0.97] transition-transform"
          style={{ backgroundColor: "#007AFF" }}
        >
          {t("dashboard.confirm_start")}
        </button>
        <button
          onPointerDown={() => { setConfirmPending(null); activateShield(); }}
          className="w-full py-3 rounded-2xl text-[15px] font-semibold active:scale-[0.97] transition-transform"
          style={{ color: "var(--text-secondary)", backgroundColor: "var(--button-bg)" }}
        >
          {t("dashboard.confirm_cancel")}
        </button>
      </BottomSheet>

    </div>
  );
};

export default DashboardPage;
