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
import { LiveStatsPanel } from "../../components/training/LiveStatsPanel";
import { LiveStatsOverlay } from "../../components/training/LiveStatsOverlay";
import RestTimerBar from "../../components/training/RestTimerBar";
import ExerciseLibraryModal from "../../components/training/ExerciseLibraryModal";
import ExerciseInfoModal from "../../components/exercises/ExerciseInfoModal";
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

import {
  getActiveLiveWorkout,
  persistActiveLiveWorkout,
  startLiveWorkout,
  completeLiveWorkout,
  abortLiveWorkout,
  applyTrainingStatusToEvent,
  getLastSetsForExercise,
} from "../../utils/trainingHistory";

import { useLiveTrainingStore } from "../../store/useLiveTrainingStore";
import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { KeyboardAccessoryBar } from "../../components/keyboard/KeyboardAccessoryBar";
import { PlateCalculatorSheet } from "../../components/plates/PlateCalculatorSheet";
import { formatMmSs } from "../../utils/timeFormat";
import { clearLiveTrainingState, setLiveTrainingState, type LiveActivityPayload } from "../../native/liveActivity";
import { LiveActivity } from "capacitor-live-activity"; // Import requested by prompt
import { Haptics, ImpactStyle } from "@capacitor/haptics";

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
  { onExit: () => void; children: React.ReactNode },
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
    return (
      <div className="flex h-screen w-screen items-center justify-center px-4 bg-zinc-950 text-white">
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
  if (rounded <= 0) return undefined;

  return Math.max(10, Math.min(300, rounded));
}

function formatTimeParts(totalSec: number): { h: number; mm: string; ss: string } {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return { h, mm: String(m).padStart(2, "0"), ss: String(sec).padStart(2, "0") };
}

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

export default function LiveTrainingPage({
  events,
  onUpdateEvents,
  onExit,
  eventId,
  initialWorkout,
  onMinimize,
  onShareWorkout,
}: LiveTrainingPageProps) {
  const event = useMemo(
    () => (eventId ? events.find((e) => e.id === eventId) : undefined),
    [events, eventId]
  );

  const [workout, setWorkout] = useState<LiveWorkout | null>(null);
  const [initDone, setInitDone] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  // --- Quick Stats Logic for Action Sheet ---
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!workout?.startedAt) return;
    const start = new Date(workout.startedAt).getTime();
    if (isNaN(start)) return;

    setElapsedMs(Date.now() - start); // Init
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 1000);
    return () => clearInterval(interval);
  }, [workout?.startedAt]);

  const quickStats = useMemo(() => {
    let sets = 0;
    let volume = 0;
    workout?.exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (s.completed) {
          sets++;
          const w = s.weight || 0;
          const r = s.reps || 0;
          volume += w * r;
        }
      });
    });
    return { sets, volume };
  }, [workout]);

  const formatQuickDuration = (ms: number) => {
    const sec = Math.floor((ms / 1000) % 60);
    const min = Math.floor((ms / 1000 / 60) % 60);
    const hrs = Math.floor(ms / 1000 / 3600);
    if (hrs > 0) return `${hrs}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${min}:${String(sec).padStart(2, "0")}`;
  };

  // --- LIVE ACTIVITY LOGIC (SIMPLIFIED) ---
  const startLiveActivity = async () => {
    try {
      const currentExercise = workout?.exercises[0]; // fallback to first ex
      const exName = currentExercise?.name || "Training läuft";
      const setTxt = "Satz 1";

      await LiveActivity.startActivity({
        id: "TRAINQ_LIVE_WORKOUT",
        attributes: {}, // EMPTY as requested
        contentState: {
          exerciseName: exName,
          setInfo: setTxt,
          progressValue: 0.0
        } as any,
      });
      console.log("✅ Widget gestartet");
    } catch (e) {
      console.error("❌ Widget Fehler:", e);
    }
  };

  const endLiveActivity = async () => {
    try {
      await LiveActivity.endActivity({
        id: "TRAINQ_LIVE_WORKOUT",
        contentState: {
          exerciseName: "Training beendet",
          setInfo: "Fertig",
          progressValue: 1.0
        } as any
      });
    } catch (e) { }
  };

  useEffect(() => {
    // Start automatically on mount
    startLiveActivity();

    return () => {
      endLiveActivity();
    };
  }, []);
  // ---------------------------------
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
  const liveActivityLastUpdateRef = useRef(0);

  const [pendingScrollToExerciseId, setPendingScrollToExerciseId] = useState<string | null>(null);
  const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mainRef = useRef<HTMLDivElement | null>(null);

  const { keyboardHeight, isOpen: keyboardOpen } = useKeyboardHeight();
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

      const started = new Date(merged.startedAt).getTime();
      startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
    } catch (err) {
      console.error("[LiveTraining] init error", err);
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

  // ✅ Volumen/Zeit-Berechnung (Hooks dürfen nicht hinter Early-Returns liegen)
  const totalVolume = useMemo(() => {
    if (!workout) return 0;
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    return exercises.reduce((acc, ex) => {
      return (
        acc +
        (ex.sets || []).reduce((setAcc, set) => {
          // NUR wenn abgehakt, zähle dazu
          if (!set.completed) return setAcc;
          const reps = typeof set.reps === "number" ? set.reps : 0;
          const weight = typeof set.weight === "number" ? set.weight : 0;
          return setAcc + reps * weight;
        }, 0)
      );
    }, 0);
  }, [workout]);

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

    // Debug log to confirm image source
    console.log("Opening details for:", finalExercise.name, "ID:", finalExercise.id, "Image:", finalExercise.image || finalExercise.imageSrc);

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

  const toggleSetCompleted = (exerciseId: string, setId: string) => {
    if (!workout) return;

    setWorkout((prev) => {
      if (!prev) return prev;
      const prevExercises = Array.isArray(prev.exercises) ? prev.exercises : [];

      const nextExercises = prevExercises.map((e) => {
        if (e.id !== exerciseId) return e;

        const sets = Array.isArray(e.sets) ? e.sets : [];
        const nextSets = sets.map((s) => {
          if (s.id !== setId) return s;


          const nextCompleted = !s.completed;
          let rest = normalizeRestSeconds((e as any).restSeconds);

          if (nextCompleted) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });

            // Auto-start Timer Logic
            if (!rest && !isCardioWorkout) {
              rest = 90; // Default to 90s if unset
              // We should also persist this default to the exercise so next time it's consistent
              // Ideally this happens via side-effect or we mutate e copy. 
              // However, doing state update inside mapper is tricky.
              // We will just use the value locally for the timer start.
            }

            if (typeof rest === "number" && rest > 0) {
              setActiveRest({ exerciseId, setId, restSeconds: rest });
            }
          } else {
            setActiveRest((r) => (r?.exerciseId === exerciseId && r.setId === setId ? null : r));
          }

          return { ...s, completed: nextCompleted, completedAt: nextCompleted ? nowISO() : undefined };
        });

        return { ...e, sets: nextSets } as LiveExercise;
      });

      return { ...prev, exercises: nextExercises };
    });
  };

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
          weight: undefined,
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
        exercises: prevExercises.map((e) =>
          e.id === exerciseId
            ? {
              ...e,
              sets: [
                ...(Array.isArray(e.sets) ? e.sets : []),
                {
                  id: newSetId,
                  completed: false,
                  reps: cardio ? 10 : undefined,
                  weight: undefined,
                  notes: "",
                } as any,
              ],
            }
            : e
        ),
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
          e.id === exerciseId ? { ...e, sets: (e.sets || []).filter((s) => s.id !== setId) } : e
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
          const sets = Array.isArray(e.sets) ? e.sets : [];
          return { ...e, sets: sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) };
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

  const buildLiveActivityPayload = useCallback((): LiveActivityPayload | null => {
    if (!workout || !overlayData) return null;

    const exercises = workout.exercises;
    const activeExerciseIndex = overlayData.activeExercise ? exercises.indexOf(overlayData.activeExercise) : -1;
    const currentEx = activeExerciseIndex !== -1 ? exercises[activeExerciseIndex] : null;

    if (!currentEx) {
      return {
        exerciseName: workout.title || "Training",
        setInfo: "Training läuft",
        nextSet: "",
        progress: 0,
      };
    }

    const totalSets = currentEx.sets?.length || 0;
    // Current completed sets
    const completedSets = (currentEx.sets || []).filter((s) => s.completed).length;
    const progress = totalSets > 0 ? completedSets / totalSets : 0;

    // Set info
    const setNumber = (overlayData.activeSetIndex ?? 0) + 1;
    const currentSetInfo = `Satz ${setNumber} von ${totalSets}`;

    // Next set info
    let nextSetInfo = "Übung abgeschlossen";
    if (overlayData.activeSetIndex !== undefined && overlayData.activeSetIndex + 1 < totalSets) {
      const nextSet = currentEx.sets![overlayData.activeSetIndex + 1];
      if (nextSet) {
        const w = nextSet.weight ? `${nextSet.weight}kg` : "";
        const r = nextSet.reps ? `${nextSet.reps} Wdh` : "";
        nextSetInfo = `Nächstes: ${w} ${w && r ? "x" : ""} ${r}`.trim();
      }
    } else if (completedSets < totalSets) {
      nextSetInfo = "Nächster Satz wartet";
    }

    return {
      exerciseName: currentEx.name || "Übung",
      setInfo: currentSetInfo,
      nextSet: nextSetInfo,
      progress,
    };
  }, [workout, overlayData]);

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

  const finishTraining = () => {
    if (!workout) return;
    const completed = completeLiveWorkout(workout);
    markCalendarEvent("completed", completed.id);
    clearLiveTrainingState();
    useLiveTrainingStore.getState().finishWorkout(); // ✅ Clear Store
    if (typeof onShareWorkout === "function") {
      onShareWorkout(completed.id);
    } else {
      onExit();
    }
  };

  const abortAndExit = () => {
    if (!workout) {
      onExit();
      return;
    }
    abortLiveWorkout(workout);
    clearLiveTrainingState();
    useLiveTrainingStore.getState().cancelWorkout(); // ✅ Clear Store
    onExit();
  };

  const minimize = () => {
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
      <div className="flex h-screen w-screen items-center justify-center px-4 bg-[var(--bg)] text-[var(--text)]">
        <AppCard className="w-full max-w-md text-center">
          <div className="text-sm font-semibold">Lade Live-Training…</div>
          {initDone && (
            <>
              <div className="mt-2 text-xs text-[var(--muted)]">
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

  const elapsedText = overlayData?.elapsedText ?? "0:00";
  const isCardioLibrary = isCardioWorkout;
  const exercises = overlayData?.exercises ?? [];

  // ✅ STABIL: Reserve space für fixed Header + optional Restbar
  // Header liegt jetzt etwas höher -> daher Reserve leicht reduziert.
  // Header liegt jetzt etwas höher -> daher Reserve leicht reduziert.
  const mainPadTop = activeRest
    ? "calc(env(safe-area-inset-top) + 110px)"
    : "calc(env(safe-area-inset-top) + 72px)";

  // Footer-Höhe inkl. Stats + Buttons, damit nichts überlappt.
  const footerHeightPx = 140;
  const mainPadBottom = `calc(max(env(safe-area-inset-bottom), 0px) + ${footerHeightPx}px)`;

  const overlaySubtitle = overlayData?.overlaySubtitle ?? "";
  const overlayPrimaryText = overlayData?.overlayPrimaryText ?? "";
  const overlayRightTopText = overlayData?.overlayRightTopText;

  return (
    <>
      <LiveTrainingErrorBoundary onExit={onExit}>
        <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
          {/* ✅ FIXED HEADER - using AppCard variant="glass" structure but manually positioned */}
          {/* ✅ FIXED HEADER - using PageHeader for consistency */}
          <div className="fixed inset-x-0 top-0 z-50 bg-white/10 backdrop-blur-xl border-b border-[1.5px] border-white/10">
            <div className="px-4 pb-2" style={{ paddingTop: "max(env(safe-area-inset-top), 8px)" }}>
              <PageHeader
                title={elapsedText}
                className="py-0 pb-2"
                rightAction={
                  <AppButton
                    onClick={finishTraining}
                    variant="primary"
                    size="sm"
                    className="px-6 shadow-[0_0_20px_theme(colors.sky.500/50%)]"
                  >
                    Beenden
                  </AppButton>
                }
              />
              {/* <RestTimerBar> removed, moving logic to ExerciseEditor */}
            </div>
          </div>

          {/* ✅ ONLY ÜBUNGEN SCROLLEN */}
          <main
            ref={mainRef}
            className="flex-1 min-h-0 overflow-y-auto px-4"
            style={{ paddingTop: mainPadTop, paddingBottom: mainPadBottom, overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
          >
            <div className="py-4 max-w-5xl mx-auto w-full">
              {/* ✅ HUD / STATS PANEL */}
              <div className="-mx-4 mb-4 sticky -top-4 z-40">
                <LiveStatsPanel workout={workout} onOpenOverlay={() => setStatsOpen(true)} />
              </div>

              {exercises.length === 0 ? (
                <AppCard variant="soft" className="p-5 text-center">
                  <div className="text-base text-[var(--muted)] mb-4">
                    Noch keine {isCardioWorkout ? "Einheiten" : "Übungen"}. Füge unten eine hinzu.
                  </div>
                  <AppButton onClick={() => setLibraryOpen(true)} className="w-full" variant="secondary">
                    + {isCardioWorkout ? "Einheit" : "Übung"} hinzufügen
                  </AppButton>
                </AppCard>
              ) : (
                <div className="flex flex-col gap-4">
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
                        onToggleSet={(setId: string) => toggleSetCompleted(ex.id, setId)}
                        onWeightFocus={(setId: string, currentWeight?: unknown) => { if (!isCardioWorkout) setFocusedWeightField({ exerciseId: ex.id, setId, currentWeight: toNumberOrUndefined(currentWeight) }); }}
                        onMoveUp={exIdx > 0 ? () => moveExercise(ex.id, "up") : undefined}
                        onMoveDown={exIdx < exercises.length - 1 ? () => moveExercise(ex.id, "down") : undefined}
                        onOpenExerciseDetails={handleOpenDetails}
                        onOpenTimer={handleOpenTimer}
                      />
                    </div>
                  ))}

                  <AppButton onClick={() => setLibraryOpen(true)} variant="ghost" fullWidth className="py-6 border-dashed border-2 bg-transparent hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]">
                    + {isCardioWorkout ? "Einheit" : "Übung"} hinzufügen
                  </AppButton>
                </div>
              )}
            </div>
          </main>

          {/* ✅ FIXED FOOTER */}
          {/* ✅ FIXED FOOTER */}
          <div className="fixed inset-x-0 bottom-0 z-50 bg-white/10 backdrop-blur-xl border-t border-[1.5px] border-white/10 px-4 pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
            <div className="mx-auto w-full max-w-5xl">
              <div className="mb-2">
                {/* QUICK STATS ROW */}
                <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 grid grid-cols-3 gap-2 border border-zinc-800">
                  {/* 1. ZEIT */}
                  <div className="flex flex-col items-center justify-center border-r border-zinc-800 h-10">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Zeit</span>
                    <span className="text-white font-mono text-lg leading-none mt-1">{formatQuickDuration(elapsedMs)}</span>
                  </div>

                  {/* 2. SÄTZE */}
                  <div className="flex flex-col items-center justify-center border-r border-zinc-800 h-10">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Sätze</span>
                    <span className="text-blue-400 font-bold text-lg leading-none mt-1">{quickStats.sets}</span>
                  </div>

                  {/* 3. VOLUMEN */}
                  <div className="flex flex-col items-center justify-center h-10">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Volumen</span>
                    <span className="text-emerald-400 font-bold text-lg leading-none mt-1">{(quickStats.volume / 1000).toFixed(1)}t</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <AppButton onClick={minimize} variant="secondary" className="flex-1 h-12">
                  Minimieren
                </AppButton>
                <AppButton onClick={abortAndExit} variant="ghost" className="flex-1 h-12 text-red-400 hover:bg-red-500/10 hover:text-red-500" title="Training abbrechen">
                  Abbrechen
                </AppButton>
              </div>
            </div>
          </div>

          <ExerciseLibraryModal
            open={libraryOpen}
            onClose={() => setLibraryOpen(false)}
            category={workout?.sport === "Laufen" ? "running" : workout?.sport === "Radfahren" ? "cycling" : "gym"}
            onPick={(ex) => {
              addExerciseDirect({ exerciseId: ex.id, name: ex.name });
              setLibraryOpen(false);
            }}
            existingExerciseIds={exercises.map(e => e.exerciseId).filter(Boolean) as string[]}
          />

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
              platesEnabled ? (
                <AppButton
                  onClick={openPlates}
                  variant="primary"
                  size="sm"
                  className="rounded-full shadow-lg"
                >
                  Scheiben
                </AppButton>
              ) : (
                <AppButton
                  onClick={() => (document.activeElement as HTMLElement)?.blur()}
                  variant="secondary"
                  size="sm"
                  className="rounded-full backdrop-blur shadow-lg border border-white/10 text-white"
                >
                  Fertig
                </AppButton>
              )
            }
          />

          <ExerciseInfoModal
            isOpen={!!previewExercise}
            exercise={previewExercise}
            onClose={() => setPreviewExercise(null)}
          />

          <BottomSheet
            open={!!timerEditExerciseId}
            onClose={() => setTimerEditExerciseId(null)}
            height="auto"
            variant="docked"
            backdropClassName="bg-black/80"
            sheetStyle={{ background: "#1c1c1e", borderTop: "1px solid rgba(255,255,255,0.1)" }}
          >
            <div className="p-4 pb-8 space-y-4">
              <h3 className="text-center font-bold text-white mb-4">Pausenzeit Einstellung</h3>
              <div className="grid grid-cols-4 gap-3">
                {[30, 60, 90, 120, 150, 180, 240, 300].map(sec => (
                  <button
                    key={sec}
                    onClick={() => handleSetRestTime(sec)}
                    className={`h-12 rounded-xl text-sm font-semibold transition-all ${activeTimerExercise?.restSeconds === sec
                      ? "bg-[#007AFF] text-white"
                      : "bg-[#2c2c2e] text-white/70 hover:bg-[#3a3a3c]"
                      }`}
                  >
                    {sec < 60 ? `${sec}s` : formatMmSs(sec)}
                  </button>
                ))}
              </div>
            </div>
          </BottomSheet>
        </div>
      </LiveTrainingErrorBoundary>
    </>
  );
}