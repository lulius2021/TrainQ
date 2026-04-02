// src/pages/training/LiveTrainingPage.tsx
//
// ✅ FIX 1: Übungen starten IMMER unter dem Header-Block (kein Überlappen mehr)
// ✅ FIX 2: Kein “App springt nach oben” mehr -> KEIN dynamisches Messen/ResizeObserver mehr
// ✅ Header + Footer bleiben fixed und verschieben sich nicht, egal wie viele Übungen du addest
//
// ✅ Requested now:
// - Header (Zeit + Training beenden) etwas höher
// - Footer (Minimieren/Abbrechen) etwas tiefer

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppCard } from "../../components/ui/AppCard";
import { AppButton } from "../../components/ui/AppButton";
import { PageHeader } from "../../components/ui/PageHeader";
import type {
  CalendarEvent,
  LiveExercise,
  LiveSet,
  LiveWorkout,
  SportType,
  TrainingStatus,
  TrainingType,
} from "../../types/training";

import ExerciseEditor from "../../components/training/ExerciseEditor";
import ConfettiOverlay from "../../components/training/ConfettiOverlay";
import LiveCardioPage from "./LiveCardioPage";
import { LiveStatsPanel } from "../../components/training/LiveStatsPanel";
import { LiveStatsOverlay } from "../../components/training/LiveStatsOverlay";
import RestTimerBar from "../../components/training/RestTimerBar";
import RestTimerModal from "../../components/training/RestTimerModal";
import ExerciseLibraryModal from "../../components/training/ExerciseLibraryModal";
import ExerciseDetailView from "../../components/exercises/ExerciseDetailView";
import { BottomSheet } from "../../components/common/BottomSheet";
import type { Exercise } from "../../data/exerciseLibrary";
import { EXERCISES } from "../../data/exerciseLibrary";
import { getCustomExercises } from "../../utils/customExercisesStore";

import {
  readGlobalLiveSeed,
  clearGlobalLiveSeed,
  type LiveTrainingSeed,
  resolveLiveSeed,
} from "../../utils/liveTrainingSeed";

import { applyAdaptiveToSeed } from "../../utils/adaptiveSeed";
import { upsertTrainingTemplate, buildTrainingTemplateSignature } from "../../services/trainingTemplatesService";
import type { TrainingTemplate, TrainingTemplateExercise } from "../../types/trainingTemplates";

import {
  getActiveLiveWorkout,
  persistActiveLiveWorkout,
  startLiveWorkout,
  completeLiveWorkout,
  abortLiveWorkout,
  applyTrainingStatusToEvent,
  getLastSetsForExercise,
  getExerciseSessionCount,
} from "../../utils/trainingHistory";
import { loadWorkoutHistory } from "../../utils/workoutHistory";

import { useLiveTrainingStore } from "../../store/useLiveTrainingStore";
import { grantWorkoutXp } from "../../store/useAvatarStore";
import { useAuth } from "../../context/AuthContext";
import { postWorkoutToFeed } from "../../services/community/postWorkout";
import AvatarStageUpModal from "../../components/avatar/AvatarStageUpModal";
import { buildPRBaseline, checkSetPR, type PRBaseline } from "../../utils/prDetection";
import { getWeightSuggestion, type WeightSuggestion } from "../../utils/weightSuggestion";
import { calculateWarmupSets } from "../../utils/warmupCalculator";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { KeyboardAccessoryBar } from "../../components/keyboard/KeyboardAccessoryBar";
import { PlateCalculatorSheet } from "../../components/plates/PlateCalculatorSheet";
import { formatMmSs, formatTimeParts } from "../../utils/timeFormat";
import { clearLiveTrainingState, setLiveTrainingState, startFreshLiveActivity, type LiveActivityPayload } from "../../native/liveActivity";
import { App as CapApp } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import WheelPicker from "../../components/ui/WheelPicker";
import { ProfileService } from "../../services/ProfileService";
import { useSafeAreaInsets } from "../../hooks/useSafeAreaInsets";
import { useTheme } from "../../context/ThemeContext";

type LiveTrainingPageProps = {
  events: CalendarEvent[];
  onUpdateEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onExit: () => void;
  eventId?: string;
  initialWorkout?: Partial<LiveWorkout>;
  onMinimize?: () => void;
  onShareWorkout?: (workoutId: string) => void;
};

// --- FORCE LIVE ACTIVITY START (DEBUG) ---


class LiveTrainingErrorBoundary extends React.Component<
  { onExit: () => void; children: React.ReactNode; theme: import("../../theme/types").Theme },
  { hasError: boolean; errorMessage?: string }
> {
  state = { hasError: false, errorMessage: undefined };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      console.error("[LiveTraining] render error", error);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const { theme } = this.props;
    return (
      <div
        className="flex h-screen w-screen items-center justify-center px-4"
        style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
      >
        <AppCard className="w-full max-w-md text-center">
          <div className="text-sm font-semibold">Live-Training ist abgestürzt.</div>
          <div className="mt-2 text-xs text-zinc-400">
            {this.state.errorMessage || "Bitte erneut versuchen."}
          </div>
          <AppButton
            onClick={this.props.onExit}
            className="mt-3"
            fullWidth
            variant="secondary"
          >
            Zurück
          </AppButton>
        </AppCard>
      </div>
    );
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * ✅ Restzeit ist OPTIONAL:
 * - undefined/null/""/NaN => kein Timer
 * - sonst clamp 10s..300s
 */
function normalizeRestSeconds(input: unknown): number | undefined {
  if (input == null) return undefined;

  const n =
    typeof input === "number"
      ? input
      : typeof input === "string"
        ? Number(input.trim())
        : Number(String(input).trim());

  if (!Number.isFinite(n)) return undefined;

  const rounded = Math.round(n);
  if (rounded < 0) return 0;

  return Math.min(600, rounded);
}

// formatTimeParts is now imported from ../../utils/timeFormat

function trainingTypeToSport(type?: TrainingType, sport?: SportType | string): SportType {
  if (sport === "Gym") return "Gym";
  if (sport === "Laufen") return "Laufen";
  if (sport === "Radfahren") return "Radfahren";
  if (sport === "Custom") return "Custom";

  if (type === "laufen") return "Laufen";
  if (type === "radfahren") return "Radfahren";
  if (type === "custom") return "Custom";

  return "Gym";
}

function seedSportToSportType(seedSport?: LiveTrainingSeed["sport"]): SportType {
  if (seedSport === "Gym") return "Gym";
  if (seedSport === "Laufen") return "Laufen";
  if (seedSport === "Radfahren") return "Radfahren";
  if (seedSport === "Custom") return "Custom";
  return "Gym";
}

function seedToInitialExercises(
  seed: LiveTrainingSeed
): Array<{
  exerciseId?: string;
  name: string;
  sets: Array<{ reps?: number; weight?: number; notes?: string }>;
  restSeconds?: number;
}> {
  return (seed.exercises || []).map((be) => ({
    exerciseId: be.exerciseId,
    name: be.name || "Übung",
    restSeconds: undefined,
    sets: (be.sets || []).map((s) => ({
      reps: s.reps,
      weight: s.weight,
      notes: (s as any).notes,
    })),
  }));
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function toNumberOrUndefined(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : undefined;
}

function isBodyweightExercise(id?: string): boolean {
  if (!id) return false;
  const ex = EXERCISES.find(e => e.id === id) || getCustomExercises().find(e => e.id === id);
  return ex?.equipment?.includes("bodyweight") ?? false;
}

export default function LiveTrainingPage({
  events,
  onUpdateEvents,
  onExit,
  eventId,
  initialWorkout,
  onMinimize,
  onShareWorkout,
}: LiveTrainingPageProps) {
  const { user: authUser } = useAuth();

  const event = useMemo(
    () => (eventId ? events.find((e) => e.id === eventId) : undefined),
    [events, eventId]
  );

  const [workout, setWorkout] = useState<LiveWorkout | null>(null);
  const [initDone, setInitDone] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // Safety Modals State
  const [showFinishReview, setShowFinishReview] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(0);

  // Save-as-Template Flow
  const [showSaveTemplatePrompt, setShowSaveTemplatePrompt] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplEmoji, setTplEmoji] = useState("💪");
  const [tplColor, setTplColor] = useState("#3B82F6");
  const pendingCompletedWorkoutRef = useRef<import("../../types/training").CompletedWorkout | null>(null);
  const postFinishExitFnRef = useRef<(() => void) | null>(null);

  // PR Detection State
  const [prBaseline, setPrBaseline] = useState<Map<string, PRBaseline> | null>(null);
  const [prSets, setPrSets] = useState<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [stageUpData, setStageUpData] = useState<{ stage: number; variant: "bulk" | "speed" } | null>(null);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const completedWorkoutIdRef = useRef<string | null>(null);

  const { theme } = useTheme();





  // Live Activity cleanup on unmount
  useEffect(() => {
    return () => { clearLiveTrainingState(); };
  }, []);
  const [initError, setInitError] = useState<string | null>(null);

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const tickRef = useRef<number | null>(null);
  const startedAtMsRef = useRef<number | null>(null);

  const [activeRest, setActiveRest] = useState<{
    exerciseId: string;
    setId: string;
    restSeconds: number;
  } | null>(null);
  const [restRemainingSec, setRestRemainingSec] = useState<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [swappingExerciseId, setSwappingExerciseId] = useState<string | null>(null);

  // Build smart swap suggestions: scored by muscle overlap, movement, and user history
  const swapSuggestions = useMemo(() => {
    if (!swappingExerciseId || !workout) return [];
    const swappingEx = workout.exercises.find(e => e.id === swappingExerciseId);
    if (!swappingEx) return [];

    const srcLib = swappingEx.exerciseId ? EXERCISES.find(e => e.id === swappingEx.exerciseId) : null;
    const srcMuscles: string[] = srcLib?.primaryMuscles ?? [];
    const srcSecondary: string[] = srcLib?.secondaryMuscles ?? [];
    const srcMovement: string = srcLib?.movement ?? "";

    // Build set of exerciseIds the user has trained before
    const history = loadWorkoutHistory();
    const trainedIds = new Set<string>();
    const trainedCounts = new Map<string, number>();
    for (const w of history) {
      for (const e of w.exercises ?? []) {
        if (!e.exerciseId) continue;
        trainedIds.add(e.exerciseId);
        trainedCounts.set(e.exerciseId, (trainedCounts.get(e.exerciseId) ?? 0) + 1);
      }
    }

    const scored = EXERCISES
      .filter(e => e.id !== swappingEx.exerciseId)
      .map(e => {
        let score = 0;
        const eMuscles: string[] = e.primaryMuscles ?? [];
        const eSecondary: string[] = e.secondaryMuscles ?? [];

        // Primary muscle overlap (highest weight)
        const primaryMatch = eMuscles.filter(m => srcMuscles.includes(m)).length;
        score += primaryMatch * 10;

        // Cross-match: candidate primary hits source secondary and vice-versa
        const crossMatch = eMuscles.filter(m => srcSecondary.includes(m)).length
          + eSecondary.filter(m => srcMuscles.includes(m)).length;
        score += crossMatch * 4;

        // Same movement pattern (push/pull/squat/hinge etc.)
        if (srcMovement && e.movement === srcMovement) score += 6;

        // User has done this exercise before
        const count = trainedCounts.get(e.id) ?? 0;
        if (count >= 5) score += 8;
        else if (count >= 2) score += 5;
        else if (count >= 1) score += 2;

        return { exercise: e, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(({ exercise }) => exercise);

    return scored;
  }, [swappingExerciseId, workout]);
  const liveActivityLastUpdateRef = useRef(0);

  const [pendingScrollToExerciseId, setPendingScrollToExerciseId] = useState<string | null>(null);
  const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mainRef = useRef<HTMLDivElement | null>(null);

  const { keyboardHeight, isOpen: keyboardOpen } = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const [focusedWeightField, setFocusedWeightField] = useState<{
    exerciseId: string;
    setId: string;
    currentWeight?: number;
  } | null>(null);
  const [plateSheetOpen, setPlateSheetOpen] = useState(false);

  // Body nicht scrollen
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Load PR baseline when workout is available
  useEffect(() => {
    if (!workout?.id) return;
    setPrBaseline(buildPRBaseline(workout.id));
  }, [workout?.id]);

  // ✅ Init: Active -> GlobalSeed -> resolveSeed -> Event -> Default
  useEffect(() => {
    if (workout) return;
    const log = (...args: unknown[]) => {
      if (import.meta.env.DEV) console.log("[LiveTraining]", ...args);
    };

    const setAndMark = (next: LiveWorkout) => {
      setInitError(null);
      setWorkout(next);
      setInitDone(true);
    };

    // Called only for FRESH starts (not resumes) — starts Live Activity immediately
    const launchLiveActivity = (w: LiveWorkout) => {
      const allSets = w.exercises.flatMap((e) => e.sets || []);
      startFreshLiveActivity({
        exerciseName: w.title || "Training",
        setInfo: "Training gestartet",
        setDetail: "",
        completedSets: 0,
        totalSetsCount: allSets.length,
        restEndsAt: 0,
        progress: 0,
      });
    };

    try {
      // ✅ 0. CHECK ZUSTAND STORE FIRST (Priority)
      const storedWorkout = useLiveTrainingStore.getState().activeWorkout;
      if (storedWorkout && storedWorkout.isActive) {
        log("Resuming from Zustand Store", storedWorkout.id);
        setAndMark(storedWorkout);
        return;
      }

      const active = getActiveLiveWorkout();
      const isReallyActive = !!active && active.isActive === true;
      const matchesEvent = !eventId ? true : String(active?.calendarEventId || "") === String(eventId);

      log("init", {
        eventId,
        hasEvent: !!event,
        hasActive: !!active,
        isReallyActive,
        matchesEvent,
      });

      if (isReallyActive && matchesEvent) {
        const merged = { ...active, ...(initialWorkout as any) } as LiveWorkout;
        setAndMark(merged);

        const started = new Date(merged.startedAt).getTime();
        startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
        setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
        return;
      }

      const globalSeed = readGlobalLiveSeed();
      if (globalSeed) {
        clearGlobalLiveSeed();

        const seedToUse = event?.adaptiveSuggestion
          ? applyAdaptiveToSeed(globalSeed, event.adaptiveSuggestion)
          : globalSeed;

        const w = startLiveWorkout({
          title: seedToUse.title || "Training",
          sport: seedSportToSportType(seedToUse.sport),
          calendarEventId: eventId,
          initialExercises: seedToInitialExercises(seedToUse),
        });

        const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
        setAndMark(merged);
        launchLiveActivity(merged);

        const started = new Date(merged.startedAt).getTime();
        startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
        setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
        return;
      }

      const resolvedSeed = resolveLiveSeed({
        eventId,
        dateISO: event?.date,
        title: event?.title,
      });

      if (resolvedSeed) {
        const seedToUse = event?.adaptiveSuggestion
          ? applyAdaptiveToSeed(resolvedSeed, event.adaptiveSuggestion)
          : resolvedSeed;

        const w = startLiveWorkout({
          title: seedToUse.title || event?.title || "Training",
          sport: seedSportToSportType(seedToUse.sport),
          calendarEventId: eventId,
          initialExercises: seedToInitialExercises(seedToUse),
        });

        const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
        setAndMark(merged);
        launchLiveActivity(merged);

        const started = new Date(merged.startedAt).getTime();
        startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
        setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
        return;
      }

      const title = event?.title || "Training";
      const sport = trainingTypeToSport((event as any)?.trainingType, (event as any)?.sport);

      const w = startLiveWorkout({
        title,
        sport,
        calendarEventId: eventId,
        initialExercises: [],
      });

      const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
      setAndMark(merged);
      launchLiveActivity(merged);

      const started = new Date(merged.startedAt).getTime();
      startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
    } catch (err) {
      if (import.meta.env.DEV) console.error("[LiveTraining] init error", err);
      setInitError("Live-Training konnte nicht gestartet werden.");
      setInitDone(true);
    }
  }, [
    workout,
    eventId,
    event?.date,
    event?.title,
    (event as any)?.trainingType,
    (event as any)?.sport,
    event?.adaptiveSuggestion,
    initialWorkout,
  ]);

  const isCardioWorkout = workout?.sport === "Laufen" || workout?.sport === "Radfahren";

  // Weight suggestions for all exercises (from workout history)
  const weightSuggestions = useMemo(() => {
    const map = new Map<string, WeightSuggestion | null>();
    if (!workout?.exercises) return map;
    for (const ex of workout.exercises) {
      const key = ex.id;
      if (!map.has(key)) {
        map.set(key, getWeightSuggestion(ex.name, { exerciseId: ex.exerciseId }));
      }
    }
    return map;
  }, [workout?.exercises?.length]);

  const totalSets = useMemo(() => {
    if (!workout) return 0;
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    // Only count COMPLETED sets
    return exercises.reduce((acc, ex) => {
      const sets = Array.isArray(ex.sets) ? ex.sets : [];
      return acc + sets.filter(s => s.completed).length;
    }, 0);
  }, [workout]);

  // -------- Modals / Sheets --------
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);
  const [timerEditExerciseId, setTimerEditExerciseId] = useState<string | null>(null);

  const handleOpenDetails = (liveExerciseId: string) => {
    if (!workout) return;

    // 1. Active Workout Exercise finden
    const workoutExercise = workout.exercises.find(e => e.id === liveExerciseId);
    if (!workoutExercise) return;

    // 2. Suche im Library Store (Beste Quelle für Bilder)
    let fullExercise = EXERCISES.find(e => e.id === workoutExercise.exerciseId);

    // 3. Wenn nicht im static store, suche in den Custom Exercises
    if (!fullExercise) {
      const customExercises = getCustomExercises();
      fullExercise = customExercises.find(e => e.id === workoutExercise.exerciseId);
    }

    // 4. Fallback: Nimm das Workout-Exercise-Objekt als Exercise (hat meist name, etc.)
    const finalExercise = (fullExercise || workoutExercise) as unknown as Exercise;

    setPreviewExercise(finalExercise);
  };

  const handleOpenTimer = (liveExerciseId: string) => {
    setTimerEditExerciseId(liveExerciseId);
  };

  const activeTimerExercise = useMemo(() => {
    if (!timerEditExerciseId || !workout) return null;
    return workout.exercises.find(e => e.id === timerEditExerciseId) ?? null;
  }, [workout, timerEditExerciseId]);

  const handleSetRestTime = (seconds: number) => {
    if (!timerEditExerciseId) return;
    updateExercise(timerEditExerciseId, { restSeconds: seconds });
    setTimerEditExerciseId(null);
  };

  const topMuscleGroups = useMemo(() => {
    if (!workout) return [];
    if (workout.sport === "Laufen" || workout.sport === "Radfahren" || workout.sport === "Custom") return [];

    const byId = new Map(EXERCISES.map((ex) => [ex.id, ex]));
    const counts = new Map<string, number>();
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];

    exercises.forEach((ex) => {
      if (!ex.exerciseId) return;
      const meta = byId.get(ex.exerciseId);
      if (!meta) return;
      const weight = Math.max(1, (ex.sets || []).filter(s => s.completed).length); // Weight by completed sets
      meta.primaryMuscles.forEach((m) => {
        counts.set(m, (counts.get(m) ?? 0) + weight);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([m]) => m);
  }, [workout, workout?.exercises]);

  const overlayData = useMemo(() => {
    if (!workout) return null;

    const t = formatTimeParts(elapsedSec);
    const showHours = t.h > 0;
    const elapsedText = showHours ? `${t.h}:${t.mm}:${t.ss}` : `${Number(t.mm)}:${t.ss}`;
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];

    const overlayMode =
      workout.sport === "Laufen" ? "run" : workout.sport === "Radfahren" ? "bike" : workout.sport === "Gym" ? "gym" : "other";

    const firstPendingExerciseIndex = exercises.findIndex((ex) => (ex.sets || []).some((s) => !s.completed));
    const activeExerciseIndex = firstPendingExerciseIndex >= 0 ? firstPendingExerciseIndex : Math.max(0, exercises.length - 1);
    const activeExercise = exercises[activeExerciseIndex];
    const activeSets = activeExercise?.sets || [];
    const firstPendingSetIndex = activeSets.findIndex((s) => !s.completed);
    const activeSetIndex = firstPendingSetIndex >= 0 ? firstPendingSetIndex : Math.max(0, activeSets.length - 1);
    const activeSet = activeSetIndex >= 0 ? activeSets[activeSetIndex] : undefined;

    const setReps = typeof activeSet?.reps === "number" ? activeSet.reps : undefined;
    const setWeight = typeof activeSet?.weight === "number" ? activeSet.weight : undefined;
    const setDetail =
      setWeight != null && setReps != null
        ? `${setWeight}kg x ${setReps}`
        : setReps != null
          ? `${setReps} Wdh`
          : setWeight != null
            ? `${setWeight}kg`
            : "";

    const cardioDistance = exercises.reduce((acc, ex) => {
      return acc + (ex.sets || []).reduce((sAcc, s) => (s.completed && typeof s.weight === "number" ? sAcc + s.weight : sAcc), 0);
    }, 0);
    const cardioMinutes = exercises.reduce((acc, ex) => {
      return acc + (ex.sets || []).reduce((sAcc, s) => (s.completed && typeof s.reps === "number" ? sAcc + s.reps : sAcc), 0);
    }, 0);

    const overlaySubtitle = isCardioWorkout
      ? activeExercise
        ? `Einheit ${activeExerciseIndex + 1}/${exercises.length}`
        : "Einheit 0/0"
      : activeSet
        ? `Satz ${activeSetIndex + 1} von ${activeSets.length}`
        : activeExercise
          ? `Übung ${activeExerciseIndex + 1}/${exercises.length}`
          : "Übung 0/0";

    const overlayPrimaryText = isCardioWorkout
      ? cardioDistance > 0
        ? `${cardioDistance.toFixed(1)} km in ${elapsedText}`
        : cardioMinutes > 0
          ? `${elapsedText} • ${cardioMinutes} min`
          : `${elapsedText}`
      : restRemainingSec != null && restRemainingSec > 0
        ? `Pause ${formatMmSs(restRemainingSec)}`
        : activeSet
          ? `Satz ${activeSetIndex + 1}/${activeSets.length}${setDetail ? ` • ${setDetail}` : ""}`
          : activeExercise
            ? `Übung ${activeExerciseIndex + 1}/${exercises.length}`
            : "Workout läuft";

    const overlayRightTopText = restRemainingSec != null && restRemainingSec > 0 ? `${restRemainingSec} Sek.` : undefined;

    return {
      elapsedText,
      exercises,
      overlayMode,
      overlaySubtitle,
      overlayPrimaryText,
      overlayRightTopText,
      cardioDistance,
      activeExercise,
      activeSet,
      activeSetIndex,
    };
  }, [workout, elapsedSec, restRemainingSec, isCardioWorkout]);

  // ... (ticks and timers remain same)

  // ...

  const toggleSetCompleted = (exerciseId: string, setId: string, autofill?: { weight?: number; reps?: number }) => {
    if (!workout) return;

    // Capture side-effect values from current (non-stale) workout state
    const exerciseForPR = workout.exercises.find((e) => e.id === exerciseId);
    const setForPR = exerciseForPR?.sets?.find((s) => s.id === setId);
    const wasCompleted = setForPR?.completed ?? false; // current state BEFORE toggle
    const isTogglingOn = !wasCompleted;
    const rest = exerciseForPR ? normalizeRestSeconds((exerciseForPR as any).restSeconds) : undefined;

    // Single state update — autofill + toggle in one pass
    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];

      const nextExercises = prevExercises.map((e) => {
        if (e.id !== exerciseId) return e;

        const sets = Array.isArray(e.sets) ? e.sets.filter(Boolean) : [];
        const nextSets = sets.map((s) => {
          if (!s || s.id !== setId) return s;
          const nowCompleted = !s.completed;
          const filled: typeof s = { ...s };
          // Apply autofill only when toggling ON and field is empty
          if (nowCompleted && autofill) {
            if (autofill.weight != null && !s.weight) filled.weight = autofill.weight;
            if (autofill.reps != null && !s.reps) filled.reps = autofill.reps;
          }
          return { ...filled, completed: nowCompleted, completedAt: nowCompleted ? nowISO() : undefined };
        });

        return { ...e, sets: nextSets } as LiveExercise;
      });

      return { ...prev, exercises: nextExercises };
    });

    // Side effects OUTSIDE the updater
    if (isTogglingOn) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { });
      if (typeof rest === "number" && rest > 0) {
        setActiveRest({ exerciseId, setId, restSeconds: rest });
      }
    } else {
      setActiveRest((r) => (r?.exerciseId === exerciseId && r.setId === setId ? null : r));
    }

    // PR Detection: only one gold set per exercise (the strongest)
    if (isTogglingOn && exerciseForPR && setForPR && prBaseline) {
      const result = checkSetPR(
        exerciseForPR.name,
        { weight: setForPR.weight, reps: setForPR.reps },
        prBaseline
      );
      if (result.isPR) {
        const newWeight = Number(setForPR.weight ?? 0);
        const newReps = Number(setForPR.reps ?? 0);
        const newE1RM = newReps >= 1 && newReps <= 10 ? newWeight * (1 + newReps / 30) : newWeight;

        setPrSets((prev) => {
          const next = new Set(prev);
          const allSets = exerciseForPR.sets ?? [];
          for (const s of allSets) {
            if (s && prev.has(s.id) && s.id !== setId) {
              const sW = Number(s.weight ?? 0);
              const sR = Number(s.reps ?? 0);
              const sE1RM = sR >= 1 && sR <= 10 ? sW * (1 + sR / 30) : sW;
              if (newE1RM >= sE1RM) {
                next.delete(s.id);
              } else {
                return prev;
              }
            }
          }
          next.add(setId);
          return next;
        });
        setShowConfetti(true);
        Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => { });
      }
    } else if (!isTogglingOn) {
      setPrSets((prev) => {
        if (!prev.has(setId)) return prev;
        const next = new Set(prev);
        next.delete(setId);
        return next;
      });
    }
  };

  // Deep link handler: trainq://complete-set → toggles active set
  const overlayDataRef = useRef(overlayData);
  overlayDataRef.current = overlayData;
  useEffect(() => {
    const sub = CapApp.addListener("appUrlOpen", (data) => {
      if (!data.url.startsWith("trainq://complete-set")) return;
      const current = overlayDataRef.current;
      if (!current?.activeExercise || current.activeSetIndex == null) return;
      const setId = current.activeExercise.sets?.[current.activeSetIndex]?.id;
      if (setId) toggleSetCompleted(current.activeExercise.id, setId);
    });
    return () => { sub.then((h) => h.remove()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ... (history remain same)

  // ...

  // Update render of ExerciseEditor:
  /*
    <ExerciseEditor
        ...
        onOpenExerciseDetails={handleOpenDetails}
        onOpenTimer={handleOpenTimer}
        ...
    />
  */

  // Update JSX return to include modals:


  // ✅ Tick läuft erst wenn workout da ist; Zeit wird aus startedAt berechnet
  useEffect(() => {
    if (!workout) return;

    const started = new Date(workout.startedAt).getTime();
    startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();

    setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));

    tickRef.current = window.setInterval(() => {
      const base = startedAtMsRef.current ?? Date.now();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - base) / 1000)));
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [workout?.id, workout?.startedAt]);

  // ✅ Rest countdown for overlay
  useEffect(() => {
    if (restTimerRef.current) {
      window.clearInterval(restTimerRef.current);
      restTimerRef.current = null;
    }

    if (!activeRest) {
      setRestRemainingSec(null);
      return;
    }

    const startedAt = Date.now();
    setRestRemainingSec(activeRest.restSeconds);

    restTimerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, activeRest.restSeconds - elapsed);
      setRestRemainingSec(remaining);
      if (remaining <= 0 && restTimerRef.current) {
        window.clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    }, 1000);

    return () => {
      if (restTimerRef.current) {
        window.clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    };
  }, [activeRest]);

  // ✅ Persist Active Workout bei jeder Änderung (nur solange aktiv)
  // Syncs to BOTH: legacy (utils) and Zustand (store)
  useEffect(() => {
    if (!workout) return;
    if (!workout.isActive) return;
    persistActiveLiveWorkout(workout);
    useLiveTrainingStore.getState().updateWorkout(workout); // ✅ Sync to Store
  }, [workout]);

  // ✅ Scroll Effect
  useEffect(() => {
    if (!pendingScrollToExerciseId) return;
    const el = exerciseRefs.current[pendingScrollToExerciseId];
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollToExerciseId(null);
    });
  }, [pendingScrollToExerciseId, workout?.exercises?.length]);

  // -------- Actions --------

  const addExerciseDirect = (ex?: { exerciseId?: string; name: string }) => {
    if (!workout) return;

    const exId = uid();
    const setId = uid();
    const cardio = isCardioWorkout;

    const newEx: LiveExercise = {
      id: exId,
      exerciseId: ex?.exerciseId,
      name: ex?.name || (cardio ? "Neue Einheit" : "Neue Übung"),
      sets: [
        {
          id: setId,
          completed: false,
          reps: cardio ? 30 : undefined,
          weight: (!cardio && isBodyweightExercise(ex?.exerciseId))
            ? (ProfileService.getUserProfile().weight || undefined)
            : undefined,
          notes: "",
        } as any,
      ],
      restSeconds: undefined,
    } as any;

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
      return { ...prev, exercises: [...prevExercises, newEx] };
    });
    setPendingScrollToExerciseId(exId);
  };

  const removeExercise = (exerciseId: string) => {
    if (!workout) return;

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
      return { ...prev, exercises: prevExercises.filter((e) => e.id !== exerciseId) };
    });
    setActiveRest((r) => (r?.exerciseId === exerciseId ? null : r));
    setFocusedWeightField((f) => (f?.exerciseId === exerciseId ? null : f));

    if (pendingScrollToExerciseId === exerciseId) setPendingScrollToExerciseId(null);
    delete exerciseRefs.current[exerciseId];
  };

  // ✅ MEMOIZED PROPS FOR LIBRARY MODAL (Moved here to have access to dependencies)
  const addExerciseDirectRef = useRef(addExerciseDirect);
  useEffect(() => { addExerciseDirectRef.current = addExerciseDirect; }, [addExerciseDirect]);

  const libraryCategory = useMemo(() => {
    return workout?.sport === "Laufen" ? "running" : workout?.sport === "Radfahren" ? "cycling" : "gym";
  }, [workout?.sport]);

  const existingExerciseIds = useMemo(() => {
    return (overlayData?.exercises ?? []).map(e => e.exerciseId).filter(Boolean) as string[];
  }, [overlayData?.exercises]);

  const handleCloseLibrary = useCallback(() => setLibraryOpen(false), []);
  const handleCloseSwap = useCallback(() => setSwappingExerciseId(null), []);

  const handlePickExercise = useCallback((ex: any) => {
    if (addExerciseDirectRef.current) {
      addExerciseDirectRef.current({ exerciseId: ex.id, name: ex.name });
    }
    // Modal bleibt offen — Nutzer kann mehrere Übungen auswählen
  }, []);

  const handlePickSwap = useCallback((ex: any) => {
    if (!swappingExerciseId) return;
    setWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.id === swappingExerciseId
            ? { ...e, exerciseId: ex.id, name: ex.name }
            : e
        ),
      };
    });
    setSwappingExerciseId(null);
  }, [swappingExerciseId]);

  const moveExercise = (exerciseId: string, direction: "up" | "down") => {
    if (!workout) return;
    const idx = workout.exercises.findIndex((e) => e.id === exerciseId);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= workout.exercises.length) return;

    const newExercises = [...workout.exercises];
    [newExercises[idx], newExercises[newIdx]] = [newExercises[newIdx], newExercises[idx]];
    setWorkout((prev) => (prev ? { ...prev, exercises: newExercises } : prev));
  };

  const updateExercise = (exerciseId: string, patch: Partial<LiveExercise>) => {
    if (!workout) return;

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
      return {
        ...prev,
        exercises: prevExercises.map((e) => {
          if (e.id !== exerciseId) return e;

          const next: any = { ...e, ...patch };
          if ("restSeconds" in (patch as any)) next.restSeconds = normalizeRestSeconds((patch as any).restSeconds);
          return next as LiveExercise;
        }),
      };
    });
  };

  const addSet = (exerciseId: string) => {
    if (!workout) return;

    const cardio = isCardioWorkout;
    const newSetId = uid();

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
      return {
        ...prev,
        exercises: prevExercises.map((e) => {
          if (e.id !== exerciseId) return e;

          const sets = Array.isArray(e.sets) ? e.sets : [];

          // Smart Add: Default to last set's values
          let defaultWeight = undefined;
          let defaultReps = cardio ? 10 : undefined;

          if (sets.length > 0) {
            const lastSet = sets[sets.length - 1];
            if (typeof lastSet.weight === "number") defaultWeight = lastSet.weight;
            if (typeof lastSet.reps === "number") defaultReps = lastSet.reps;
          } else {
            // First set added manually (after delete)
            if (!cardio && isBodyweightExercise(e.exerciseId)) {
              defaultWeight = ProfileService.getUserProfile().weight || undefined;
            }
          }

          const newSet: LiveSet = {
            id: newSetId,
            completed: false,
            reps: defaultReps,
            weight: defaultWeight,
            notes: "",
          } as any;

          return {
            ...e,
            sets: [...sets, newSet],
          };
        }),
      };
    });
  };

  const addWarmupSets = (exerciseId: string) => {
    if (!workout) return;
    // Get working weight from history (last trained weight) or fall back to current first set
    const historyEntry = historyByExerciseLocalId.get(exerciseId);
    const historyWeight = historyEntry?.sets?.find((s) => typeof s.weight === "number" && s.weight > 0)?.weight;

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
      return {
        ...prev,
        exercises: prevExercises.map((e) => {
          if (e.id !== exerciseId) return e;
          const sets = Array.isArray(e.sets) ? e.sets : [];
          // Use history weight first, then fall back to first working set in current workout
          const firstWorking = sets.find((s) => (s as any).type !== "w");
          const currentWeight = (typeof firstWorking?.weight === "number" && firstWorking.weight > 0)
            ? firstWorking.weight : 0;
          const workingWeight = historyWeight ?? currentWeight;
          const calculated = workingWeight > 20 ? calculateWarmupSets(workingWeight) : [];
          // Create warmup sets with type: "w" so ExerciseEditor shows "W" label
          const warmupLiveSets = (calculated.length > 0
            ? calculated.map((ws) => ({
                id: uid(),
                weight: ws.weight,
                reps: ws.reps,
                completed: false,
                type: "w",
              }))
            : [{
                id: uid(),
                weight: undefined,
                reps: undefined,
                completed: false,
                type: "w",
              }]) as unknown as LiveSet[];
          return { ...e, sets: [...warmupLiveSets, ...sets] };
        }),
      };
    });
  };

  const removeSet = (exerciseId: string, setId: string) => {
    if (!workout) return;

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
      return {
        ...prev,
        exercises: prevExercises.map((e) =>
          e.id === exerciseId ? { ...e, sets: (e.sets || []).filter((s) => s && s.id !== setId) } : e
        ),
      };
    });

    setActiveRest((r) => (r?.setId === setId && r.exerciseId === exerciseId ? null : r));
    setFocusedWeightField((f) => (f?.exerciseId === exerciseId && f.setId === setId ? null : f));
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<LiveSet>) => {
    if (!workout) return;

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];
      return {
        ...prev,
        exercises: prevExercises.map((e) => {
          if (e.id !== exerciseId) return e;
          const sets = Array.isArray(e.sets) ? e.sets.filter(Boolean) : [];
          return { ...e, sets: sets.map((s) => (s && s.id === setId ? { ...s, ...patch } : s)) };
        }),
      };
    });
  };



  // -------- Grey values (Übungs-History) --------
  const historyByExerciseLocalId = useMemo(() => {
    if (!workout) return new Map<string, ReturnType<typeof getLastSetsForExercise> | null>();
    const map = new Map<string, ReturnType<typeof getLastSetsForExercise> | null>();
    for (const ex of workout.exercises) map.set(ex.id, getLastSetsForExercise(ex));
    return map;
  }, [workout?.exercises]);

  const sessionCountByExerciseId = useMemo(() => {
    if (!workout) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const ex of workout.exercises) map.set(ex.id, getExerciseSessionCount(ex));
    return map;
  }, [workout?.exercises]);

  const buildLiveActivityPayload = useCallback((): LiveActivityPayload | null => {
    if (!workout || !overlayData) return null;

    const exercises = workout.exercises;
    const activeExerciseIndex = overlayData.activeExercise ? exercises.indexOf(overlayData.activeExercise) : -1;
    const currentEx = activeExerciseIndex !== -1 ? exercises[activeExerciseIndex] : null;

    // Overall progress across all exercises
    const allSets = exercises.flatMap((e) => e.sets || []);
    const allCompleted = allSets.filter((s) => s.completed).length;
    const overallProgress = allSets.length > 0 ? allCompleted / allSets.length : 0;

    if (!currentEx) {
      return {
        exerciseName: workout.title || "Training",
        setInfo: "Training läuft",
        setDetail: "",
        completedSets: allCompleted,
        totalSetsCount: allSets.length,
        restEndsAt: 0,
        progress: overallProgress,
      };
    }

    const totalSetsCount = currentEx.sets?.length || 0;
    const completedSets = (currentEx.sets || []).filter((s) => s.completed).length;
    const setNumber = (overlayData.activeSetIndex ?? 0) + 1;
    const currentSetInfo = `Satz ${setNumber} von ${totalSetsCount}`;

    // Detail for active set: "80 kg × 8 Wdh"
    const activeSet = overlayData.activeSetIndex != null ? currentEx.sets?.[overlayData.activeSetIndex] : undefined;
    let setDetail = "";
    if (activeSet) {
      const w = activeSet.weight ? `${activeSet.weight} kg` : "";
      const r = activeSet.reps ? `${activeSet.reps} Wdh` : "";
      setDetail = w && r ? `${w} × ${r}` : w || r;
    }

    const restEndsAt = restRemainingSec != null && restRemainingSec > 0
      ? Math.floor(Date.now() / 1000) + restRemainingSec
      : 0;

    return {
      exerciseName: currentEx.name || "Übung",
      setInfo: currentSetInfo,
      setDetail,
      completedSets,
      totalSetsCount,
      restEndsAt,
      progress: overallProgress,
    };
  }, [workout, overlayData, restRemainingSec]);

  useEffect(() => {
    if (!workout || !workout.isActive) return;

    const now = Date.now();
    if (now - liveActivityLastUpdateRef.current < 1500) return;
    liveActivityLastUpdateRef.current = now;

    const payload = buildLiveActivityPayload();
    if (!payload) return;
    setLiveTrainingState(payload);
  }, [
    workout?.isActive,
    elapsedSec,
    totalSets,
    restRemainingSec,
    overlayData?.exercises.length,
    overlayData?.cardioDistance,
    overlayData?.overlayPrimaryText,
    overlayData?.overlayRightTopText,
    topMuscleGroups.join("|"),
    buildLiveActivityPayload,
  ]);

  // -------- Finish / Abort / Minimize --------

  const markCalendarEvent = (status: TrainingStatus, workoutId?: string) => {
    if (!eventId) return;
    onUpdateEvents((prev) =>
      prev.map((e) => (e.id === eventId ? applyTrainingStatusToEvent(e, status, { workoutId }) : e))
    );
  };

  const handleFinishClick = () => {
    if (!workout || statsOpen) return;
    setReviewName(workout.title || "Training");
    setReviewRating(0);
    setShowFinishReview(true);
  };

  const doExit = (workoutId: string) => {
    if (typeof onShareWorkout === "function") {
      onShareWorkout(workoutId);
    } else {
      onExit();
    }
  };

  const confirmFinish = () => {
    if (!workout) return;
    const finalWorkout = { ...workout, title: reviewName, rating: reviewRating > 0 ? reviewRating : undefined } as any; // Apply renamed title + rating
    const completed = completeLiveWorkout(finalWorkout);
    markCalendarEvent("completed", completed.id);
    clearLiveTrainingState();
    useLiveTrainingStore.getState().finishWorkout();
    Haptics.notification({ type: NotificationType.Success }).catch(() => { });

    // Auto-post to community feed (fire-and-forget)
    if (authUser?.id) {
      postWorkoutToFeed(completed, authUser.id);
    }

    // Grant avatar XP
    const { granted, stageUp } = grantWorkoutXp(completed);
    if (granted > 0) setXpToast(granted);

    if (stageUp) {
      completedWorkoutIdRef.current = completed.id;
      setStageUpData(stageUp);
      // Delay exit until modal is dismissed
      return;
    }

    setShowFinishReview(false);

    // Free training (no calendar event) → offer to save as template
    if (!eventId && !isCardioWorkout) {
      pendingCompletedWorkoutRef.current = completed;
      postFinishExitFnRef.current = () => doExit(completed.id);
      setTplName(reviewName || completed.title || "Training");
      setTplEmoji("💪");
      setTplColor("#3B82F6");
      setShowSaveTemplatePrompt(true);
      return;
    }

    doExit(completed.id);
  };

  const handleSkipSaveTemplate = () => {
    setShowSaveTemplatePrompt(false);
    setShowSaveTemplateModal(false);
    postFinishExitFnRef.current?.();
    postFinishExitFnRef.current = null;
  };

  const handleConfirmSaveTemplate = () => {
    setShowSaveTemplatePrompt(false);
    setShowSaveTemplateModal(true);
  };

  const handleSaveTemplate = () => {
    const completed = pendingCompletedWorkoutRef.current;
    if (!completed || !authUser?.id) {
      handleSkipSaveTemplate();
      return;
    }
    const templateExercises: TrainingTemplateExercise[] = (completed.exercises || []).map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: (ex.sets || [])
        .filter((s) => s.completed)
        .map((s) => ({
          id: s.id,
          reps: s.reps,
          weight: s.weight,
          setType: s.setType,
          notes: s.notes,
        })),
    }));
    const now = new Date().toISOString();
    const tpl: TrainingTemplate = {
      id: `tpl_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      userId: authUser.id,
      name: tplName.trim() || completed.title || "Training",
      sportType: completed.sport,
      exercises: templateExercises,
      signature: buildTrainingTemplateSignature(templateExercises),
      createdAt: now,
      updatedAt: now,
    };
    upsertTrainingTemplate(authUser.id, tpl);
    setShowSaveTemplateModal(false);
    postFinishExitFnRef.current?.();
    postFinishExitFnRef.current = null;
  };

  const handleAbortClick = () => {
    if (statsOpen) return;
    setShowAbortConfirm(true);
  };

  const confirmAbort = () => {
    if (!workout) {
      onExit();
      return;
    }
    abortLiveWorkout(workout);
    clearLiveTrainingState();
    useLiveTrainingStore.getState().cancelWorkout();
    onExit();
  };

  const minimize = () => {
    if (statsOpen) return;
    if (workout && workout.isActive) {
      const next = { ...workout, isMinimized: true };
      setWorkout(next);
      persistActiveLiveWorkout(next);
    }
    if (typeof onMinimize === "function") onMinimize();
    else onExit();
  };

  // -------- Plates --------

  const platesEnabled = !isCardioWorkout && !!focusedWeightField;
  const showPlatesButton = platesEnabled && !plateSheetOpen && keyboardOpen;

  const openPlates = () => {
    if (!platesEnabled) return;
    const el = document.activeElement as HTMLElement | null;
    el?.blur?.();
    requestAnimationFrame(() => setPlateSheetOpen(true));
  };

  const applyPlatesWeight = (totalKg: number) => {
    if (!focusedWeightField) return;
    updateSet(focusedWeightField.exerciseId, focusedWeightField.setId, { weight: totalKg } as any);
    setFocusedWeightField((prev) => (prev ? { ...prev, currentWeight: totalKg } : prev));
    setPlateSheetOpen(false);
  };

  // -------- Render --------

  if (!workout) {
    return (
      <div
        className="flex h-screen w-screen items-center justify-center px-4"
        style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
      >
        <AppCard className="w-full max-w-md text-center">
          <div className="text-sm font-semibold">Lade Live-Training…</div>
          {initDone && (
            <>
              <div className="mt-2 text-xs" style={{ color: theme.colors.textSecondary }}>
                {initError || "Kein Live-Workout gefunden."}
              </div>
              <AppButton
                onClick={onExit}
                className="mt-3"
                variant="secondary"
                fullWidth
              >
                Zurück
              </AppButton>
            </>
          )}
        </AppCard>
      </div>
    );
  }

  // Redirect cardio sports to dedicated GPS tracking page
  if (isCardioWorkout) {
    return (
      <LiveCardioPage
        workout={workout}
        eventId={eventId}
        onUpdateEvents={onUpdateEvents}
        onExit={onExit}
        onMinimize={onMinimize}
        onShareWorkout={onShareWorkout}
      />
    );
  }

  const elapsedText = overlayData?.elapsedText ?? "0:00";
  const isCardioLibrary = isCardioWorkout;
  const exercises = overlayData?.exercises ?? [];

  // ✅ STABIL: Reserve space für fixed Header + optional Restbar
  // Header liegt jetzt etwas höher -> daher Reserve leicht reduziert.
  // Header liegt jetzt etwas höher -> daher Reserve leicht reduziert.
  // ✅ STABIL: Reserve space für fixed Header + optional Restbar
  // Header liegt jetzt etwas höher -> daher Reserve leicht reduziert.
  const mainPadTop = activeRest
    ? `calc(${insets.top}px + 150px)`
    : `calc(${insets.top}px + 112px)`;

  // Footer-Höhe inkl. Stats + Buttons, damit nichts überlappt.
  const footerHeightPx = 72;
  const mainPadBottom = `calc(${Math.max(insets.bottom, 0)}px + ${footerHeightPx}px)`;

  const overlaySubtitle = overlayData?.overlaySubtitle ?? "";
  const overlayPrimaryText = overlayData?.overlayPrimaryText ?? "";
  const overlayRightTopText = overlayData?.overlayRightTopText;

  return (
    <>
      <ConfettiOverlay show={showConfetti} onDone={() => setShowConfetti(false)} />
      <LiveTrainingErrorBoundary onExit={onExit} theme={theme}>
        <div
          className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] w-screen"
          style={{ touchAction: "pan-y" }}
        >
          {/* ✅ FIXED HEADER */}
          <div
            className="fixed top-0 left-0 right-0 z-[70] backdrop-blur-xl border-b border-[var(--border-color)] flex flex-col gap-0"
            style={{
              backgroundColor: "var(--nav-bg)",
            }}
          >
            <div className="px-4 pb-0" style={{ paddingTop: Math.max(insets.top, 16) }}>
              <PageHeader
                title={elapsedText}
                className="py-0 pb-2"
                rightAction={
                  <AppButton
                    onClick={handleFinishClick}
                    variant="primary"
                    size="sm"
                    className="px-6 shadow-[0_0_20px_theme(colors.sky.500/50%)] btn-haptic"
                  >
                    Beenden
                  </AppButton>
                }
              />
            </div>
            {/* ✅ INTEGRATED STATS PANEL */}
            <LiveStatsPanel workout={workout} onOpenOverlay={() => setStatsOpen(true)} />
          </div>

          {/* ✅ MAIN SCROLL AREA */}
          <main
            ref={mainRef}
            className="flex-1 w-full overflow-y-auto overflow-x-hidden px-4"
            style={{
              paddingTop: mainPadTop,
              paddingBottom: mainPadBottom,
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch"
            }}
          >
            <div className="py-4 max-w-5xl mx-auto w-full">


              {exercises.length === 0 ? (
                <AppCard variant="soft" className="p-5 text-center bg-[var(--card-bg)]">
                  <div className="text-base mb-4 text-[var(--text-secondary)]">
                    Noch keine {isCardioWorkout ? "Einheiten" : "Übungen"}. Füge unten eine hinzu.
                  </div>
                  <AppButton onClick={() => setLibraryOpen(true)} className="w-full btn-haptic" variant="secondary">
                    + {isCardioWorkout ? "Einheit" : "Übung"} hinzufügen
                  </AppButton>
                </AppCard>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {exercises.map((ex, exIdx) => (
                    <div key={`${ex.id}-${exIdx}`} ref={(node) => { exerciseRefs.current[ex.id] = node; }}>
                      <ExerciseEditor
                        exercise={ex}
                        history={historyByExerciseLocalId.get(ex.id) ?? null}
                        isCardio={isCardioWorkout}
                        activeRest={activeRest}
                        restRemainingSec={restRemainingSec ?? undefined}
                        onChange={(patch: Partial<LiveExercise>) => updateExercise(ex.id, patch)}
                        onRemove={() => removeExercise(ex.id)}
                        onAddSet={() => addSet(ex.id)}
                        onRemoveSet={(setId: string) => removeSet(ex.id, setId)}
                        onSetChange={(setId: string, patch: Partial<LiveSet>) => updateSet(ex.id, setId, patch)}
                        onToggleSet={(setId: string, autofill?: { weight?: number; reps?: number }) => toggleSetCompleted(ex.id, setId, autofill)}
                        onWeightFocus={(setId: string, currentWeight?: unknown) => { if (!isCardioWorkout) setFocusedWeightField({ exerciseId: ex.id, setId, currentWeight: toNumberOrUndefined(currentWeight) }); }}
                        onSwap={() => setSwappingExerciseId(ex.id)}
                        onMoveUp={exIdx > 0 ? () => moveExercise(ex.id, "up") : undefined}
                        onMoveDown={exIdx < exercises.length - 1 ? () => moveExercise(ex.id, "down") : undefined}
                        onOpenExerciseDetails={handleOpenDetails}
                        onOpenTimer={handleOpenTimer}
                        weightSuggestion={weightSuggestions.get(ex.id)}
                        onAddWarmupSets={!isCardioWorkout ? () => addWarmupSets(ex.id) : undefined}
                        historySessionCount={sessionCountByExerciseId.get(ex.id) ?? 0}
                        prSets={prSets}
                      />
                    </div>
                  ))}

                  <AppButton onClick={() => setLibraryOpen(true)} variant="ghost" fullWidth className="py-6 border-dashed border-2 bg-transparent hover:bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-color)] btn-haptic">
                    + {isCardioWorkout ? "Einheit" : "Übung"} hinzufügen
                  </AppButton>
                </div>
              )}
            </div>
          </main>

          {/* ✅ FIXED FOOTER */}
          <div
            className="fixed bottom-0 left-0 right-0 z-[70] backdrop-blur-xl border-t border-[var(--border-color)] px-4 pt-2"
            style={{
              backgroundColor: "var(--nav-bg)",
              paddingBottom: "env(safe-area-inset-bottom)"
            }}
          >
            {/* Rest Timer Progress Bar */}
            {activeRest && restRemainingSec != null && restRemainingSec > 0 && (
              <div className="absolute top-0 left-0 right-0 h-[3px] overflow-hidden">
                <div
                  className="h-full bg-[#007AFF] absolute right-0 transition-all duration-1000 ease-linear"
                  style={{ width: `${(restRemainingSec / activeRest.restSeconds) * 100}%` }}
                />
              </div>
            )}

            <div className="mx-auto w-full max-w-5xl">
              <div className="flex gap-3">
                <AppButton onClick={minimize} variant="secondary" className="flex-1 h-12 btn-haptic bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)]">
                  Minimieren
                </AppButton>
                <AppButton onClick={handleAbortClick} variant="ghost" className="flex-1 h-12 text-red-500 hover:bg-red-500/10 hover:text-red-600 btn-haptic" title="Training abbrechen">
                  Abbrechen
                </AppButton>
              </div>
            </div>
          </div>

          <ExerciseLibraryModal
            open={libraryOpen}
            onClose={handleCloseLibrary}
            category={libraryCategory}
            onPick={handlePickExercise}
            existingExerciseIds={existingExerciseIds}
          />

          {/* Swap modal */}
          {swappingExerciseId && (
            <ExerciseLibraryModal
              open={true}
              title={`Tauschen: ${workout?.exercises.find(e => e.id === swappingExerciseId)?.name ?? "Übung"}`}
              onClose={handleCloseSwap}
              category="gym"
              onPick={handlePickSwap}
              swapMode
              suggestedExercises={swapSuggestions}
            />
          )}

          {workout && (
            <LiveStatsOverlay
              isOpen={statsOpen}
              onClose={() => setStatsOpen(false)}
              workout={workout}
              historyMap={historyByExerciseLocalId}
            />
          )}

          <PlateCalculatorSheet
            open={plateSheetOpen}
            onClose={() => setPlateSheetOpen(false)}
            onApply={applyPlatesWeight}
          />

          <KeyboardAccessoryBar
            visible={keyboardOpen && !plateSheetOpen}
            keyboardHeight={keyboardHeight}
            rightButton={
              <AppButton
                onClick={() => (document.activeElement as HTMLElement)?.blur()}
                variant="secondary"
                size="sm"
                className="rounded-full backdrop-blur shadow-lg border border-white/10 text-white"
              >
                Fertig
              </AppButton>
            }
          />

          <ExerciseDetailView
            isOpen={!!previewExercise}
            exercise={previewExercise}
            onClose={() => setPreviewExercise(null)}
          />

          <RestTimerModal
            open={!!timerEditExerciseId}
            onClose={() => setTimerEditExerciseId(null)}
            initialSeconds={activeTimerExercise?.restSeconds || 90}
            onSave={(seconds) => {
              if (timerEditExerciseId) updateExercise(timerEditExerciseId, { restSeconds: seconds });
            }}
          />
        </div>

        {/* --- SAFETY MODALS --- */}

        {/* 1. Abort Confirmation */}
        {showAbortConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center" style={{ backgroundColor: "var(--card-bg)", borderWidth: 1, borderColor: "var(--border-color)" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-red-500 mb-4" style={{ backgroundColor: "rgba(239,68,68,0.12)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: "var(--text-color)" }}>Training abbrechen?</h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Alle bisherigen Daten dieses Workouts gehen verloren. Bist du sicher?
              </p>
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={confirmAbort}
                  className="w-full py-3.5 rounded-xl bg-red-500 text-white font-bold active:scale-95 transition-transform"
                >
                  Ja, Abbrechen
                </button>
                <button
                  onClick={() => setShowAbortConfirm(false)}
                  className="w-full py-3.5 rounded-xl font-semibold active:scale-95 transition-transform"
                  style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
                >
                  Nein, Weiter trainieren
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Finish Review */}
        {showFinishReview && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4">
            <div className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200" style={{ backgroundColor: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}>
              <div className="w-12 h-1.5 rounded-full mx-auto mb-6 sm:hidden" style={{ backgroundColor: "var(--border-color)" }} />

              <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "var(--text-color)" }}>Zusammenfassung</h2>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Name des Trainings</label>
                  <input
                    type="text"
                    value={reviewName}
                    onChange={e => setReviewName(e.target.value)}
                    className="w-full text-lg font-semibold px-4 py-3.5 rounded-xl border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    style={{ backgroundColor: "var(--input-bg)", color: "var(--text-color)" }}
                    placeholder="Training Name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl flex flex-col items-center" style={{ backgroundColor: "var(--bg-color)" }}>
                    <span className="text-xs font-medium uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Dauer</span>
                    <span className="text-xl font-bold tabular-nums" style={{ color: "var(--text-color)" }}>{overlayData?.elapsedText}</span>
                  </div>
                  <div className="p-4 rounded-2xl flex flex-col items-center" style={{ backgroundColor: "var(--bg-color)" }}>
                    <span className="text-xs font-medium uppercase mb-1" style={{ color: "var(--text-secondary)" }}>Volumen</span>
                    <span className="text-xl font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
                      {isCardioWorkout
                        ? (overlayData?.cardioDistance ? overlayData.cardioDistance.toFixed(1) + " km" : "-")
                        : (workout?.exercises.reduce((acc, ex) => acc + (ex.sets || []).reduce((sAcc, s) => (s.completed && typeof s.weight === 'number' && typeof s.reps === 'number' ? sAcc + (s.weight * s.reps) : sAcc), 0), 0) / 1000).toFixed(1) + " t"
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Star Rating */}
              <div className="mb-6">
                <label className="block text-xs font-bold uppercase tracking-wider mb-3 text-center" style={{ color: "var(--text-secondary)" }}>Wie war das Training?</label>
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onPointerDown={(e) => { e.stopPropagation(); setReviewRating(reviewRating === star ? 0 : star); }}
                      className="text-3xl transition-transform active:scale-90"
                      style={{ filter: star <= reviewRating ? "none" : "grayscale(1) opacity(0.3)" }}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={confirmFinish}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all"
                >
                  Final Speichern
                </button>
                <button
                  onClick={() => setShowFinishReview(false)}
                  className="w-full py-3 rounded-xl font-medium transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Zurück zum Training
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save as Template – Prompt */}
        {showSaveTemplatePrompt && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4">
            <div className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200" style={{ backgroundColor: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}>
              <div className="w-12 h-1.5 rounded-full mx-auto mb-6 sm:hidden" style={{ backgroundColor: "var(--border-color)" }} />
              <div className="text-4xl text-center mb-4">📋</div>
              <h2 className="text-xl font-bold text-center mb-2" style={{ color: "var(--text-color)" }}>Als Vorlage speichern?</h2>
              <p className="text-sm text-center mb-8" style={{ color: "var(--text-secondary)" }}>
                Speichere dieses Training als Vorlage, um es später schnell wieder zu starten.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleConfirmSaveTemplate}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-lg shadow-lg shadow-blue-500/30 active:scale-[0.98] transition-all"
                >
                  Ja, als Vorlage speichern
                </button>
                <button
                  onClick={handleSkipSaveTemplate}
                  className="w-full py-3 rounded-xl font-medium transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Überspringen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save as Template – Editor */}
        {showSaveTemplateModal && (
          <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md sm:p-4">
            <div className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-200" style={{ backgroundColor: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}>
              <div className="w-12 h-1.5 rounded-full mx-auto mb-6 sm:hidden" style={{ backgroundColor: "var(--border-color)" }} />
              <h2 className="text-xl font-bold mb-6" style={{ color: "var(--text-color)" }}>Vorlage erstellen</h2>

              {/* Emoji Picker */}
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Emoji</label>
                <div className="flex gap-2 flex-wrap">
                  {["💪", "🏋️", "🔥", "⚡", "🎯", "🦾", "💥", "🏆"].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setTplEmoji(em)}
                      className="w-11 h-11 rounded-xl text-xl flex items-center justify-center transition-all active:scale-90"
                      style={{
                        backgroundColor: tplEmoji === em ? tplColor + "33" : "var(--bg-color)",
                        border: tplEmoji === em ? `2px solid ${tplColor}` : "2px solid transparent",
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "var(--text-secondary)" }}>Farbe</label>
                <div className="flex gap-3">
                  {["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTplColor(c)}
                      className="w-9 h-9 rounded-full transition-all active:scale-90"
                      style={{
                        backgroundColor: c,
                        outline: tplColor === c ? `3px solid ${c}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Name Input */}
              <div className="mb-8">
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Name</label>
                <input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  className="w-full text-base font-semibold px-4 py-3.5 rounded-xl border border-transparent focus:outline-none transition-all"
                  style={{ backgroundColor: "var(--input-bg)", color: "var(--text-color)", border: `1.5px solid ${tplColor}40` }}
                  placeholder="Vorlage benennen…"
                  maxLength={60}
                />
              </div>

              {/* Exercises Preview */}
              {pendingCompletedWorkoutRef.current && pendingCompletedWorkoutRef.current.exercises.length > 0 && (
                <div className="mb-8 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-color)" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>Übungen</p>
                  {pendingCompletedWorkoutRef.current.exercises.slice(0, 5).map((ex) => (
                    <p key={ex.id} className="text-sm py-0.5" style={{ color: "var(--text-color)" }}>· {ex.name}</p>
                  ))}
                  {pendingCompletedWorkoutRef.current.exercises.length > 5 && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>+{pendingCompletedWorkoutRef.current.exercises.length - 5} weitere</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSaveTemplate}
                  className="w-full py-4 rounded-2xl font-bold text-lg text-white shadow-lg active:scale-[0.98] transition-all"
                  style={{ backgroundColor: tplColor, boxShadow: `0 8px 24px ${tplColor}40` }}
                >
                  {tplEmoji} Vorlage speichern
                </button>
                <button
                  onClick={handleSkipSaveTemplate}
                  className="w-full py-3 rounded-xl font-medium transition-colors"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* XP Toast */}
        {xpToast !== null && (
          <div
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] px-4 py-2 rounded-full bg-green-500/90 text-white font-bold text-sm shadow-lg animate-in fade-in slide-in-from-top-4 duration-300"
            onAnimationEnd={() => setTimeout(() => setXpToast(null), 1500)}
          >
            +{xpToast} XP
          </div>
        )}

        {/* Stage-Up Modal */}
        <AvatarStageUpModal
          data={stageUpData}
          onDismiss={() => {
            setStageUpData(null);
            const cid = completedWorkoutIdRef.current;
            completedWorkoutIdRef.current = null;
            if (typeof onShareWorkout === "function" && cid) {
              onShareWorkout(cid);
            } else {
              onExit();
            }
          }}
        />

      </LiveTrainingErrorBoundary>
    </>
  );
}