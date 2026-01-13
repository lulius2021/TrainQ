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
import RestTimerBar from "../../components/training/RestTimerBar";
import ExerciseLibraryModal from "../../components/training/ExerciseLibraryModal";
import type { Exercise } from "../../data/exerciseLibrary";
import { EXERCISES } from "../../data/exerciseLibrary";

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

import { useKeyboardHeight } from "../../hooks/useKeyboardHeight";
import { KeyboardAccessoryBar } from "../../components/keyboard/KeyboardAccessoryBar";
import { PlateCalculatorSheet } from "../../components/plates/PlateCalculatorSheet";
import { formatMmSs } from "../../utils/timeFormat";
import { clearLiveTrainingState, setLiveTrainingState, type LiveActivityPayload } from "../../native/liveActivity";

type LiveTrainingPageProps = {
  events: CalendarEvent[];
  onUpdateEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onExit: () => void;
  eventId?: string;
  initialWorkout?: Partial<LiveWorkout>;
  onMinimize?: () => void;
  onShareWorkout?: (workoutId: string) => void;
};

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
      <div className="flex h-screen w-screen items-center justify-center px-4" style={{ color: "var(--text)" }}>
        <div
          className="w-full max-w-md rounded-2xl p-4 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-sm font-semibold">Live-Training ist abgestürzt.</div>
          <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            {this.state.errorMessage || "Bitte erneut versuchen."}
          </div>
          <button
            type="button"
            onClick={this.props.onExit}
            className="mt-3 min-h-[40px] rounded-md px-4 py-2 text-sm font-semibold hover:opacity-95"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            Zurück
          </button>
        </div>
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
    return exercises.reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);
  }, [workout]);

  const topMuscleGroups = useMemo(() => {
    if (!workout) return [];
    if (workout.sport === "Laufen" || workout.sport === "Radfahren") return [];

    const byId = new Map(EXERCISES.map((ex) => [ex.id, ex]));
    const counts = new Map<string, number>();
    const exercises = Array.isArray(workout.exercises) ? workout.exercises : [];

    exercises.forEach((ex) => {
      if (!ex.exerciseId) return;
      const meta = byId.get(ex.exerciseId);
      if (!meta) return;
      const weight = Math.max(1, ex.sets?.length ?? 0);
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
      return acc + (ex.sets || []).reduce((sAcc, s) => (typeof s.weight === "number" ? sAcc + s.weight : sAcc), 0);
    }, 0);
    const cardioMinutes = exercises.reduce((acc, ex) => {
      return acc + (ex.sets || []).reduce((sAcc, s) => (typeof s.reps === "number" ? sAcc + s.reps : sAcc), 0);
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
    };
  }, [workout, elapsedSec, restRemainingSec, isCardioWorkout]);

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
  useEffect(() => {
    if (!workout) return;
    if (!workout.isActive) return;
    persistActiveLiveWorkout(workout);
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
          const rest = normalizeRestSeconds((e as any).restSeconds);

          if (nextCompleted && typeof rest === "number") {
            setActiveRest({ exerciseId, setId, restSeconds: rest });
          } else if (!nextCompleted) {
            setActiveRest((r) => (r?.exerciseId === exerciseId && r.setId === setId ? null : r));
          }

          return { ...s, completed: nextCompleted, completedAt: nextCompleted ? nowISO() : undefined };
        });

        return { ...e, sets: nextSets } as LiveExercise;
      });

      return { ...prev, exercises: nextExercises };
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
    const badge = workout.sport === "Laufen" ? "RUN" : workout.sport === "Radfahren" ? "BIKE" : workout.sport === "Gym" ? "GYM" : "WORKOUT";
    const avatarLetter = (workout.title || "W").trim().slice(0, 1).toUpperCase();
    const deepLink = `trainq://live?workoutId=${workout.id}`;
    return {
      workoutId: workout.id,
      badge,
      title: workout.title || workout.sport,
      subtitle: overlayData.overlaySubtitle,
      primaryLine: overlayData.overlayPrimaryText,
      avatarLetter,
      deepLink,
      updatedAt: Date.now(),
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
      <div className="flex h-screen w-screen items-center justify-center px-4" style={{ color: "var(--text)" }}>
        <div
          className="w-full max-w-md rounded-2xl p-4 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="text-sm font-semibold">Lade Live-Training…</div>
          {initDone && (
            <>
              <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                {initError || "Kein Live-Workout gefunden."}
              </div>
              <button
                type="button"
                onClick={onExit}
                className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-95"
                style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
              >
                Zurück
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const elapsedText = overlayData?.elapsedText ?? "0:00";
  const isCardioLibrary = isCardioWorkout;
  const exercises = overlayData?.exercises ?? [];

  // ✅ STABIL: Reserve space für fixed Header + optional Restbar
  // Header liegt jetzt etwas höher -> daher Reserve leicht reduziert.
  const mainPadTop = activeRest
    ? "calc(max(env(safe-area-inset-top), 10px) + 124px)"
    : "calc(max(env(safe-area-inset-top), 10px) + 70px)";

  // Footer-Höhe inkl. Stats + Buttons, damit nichts überlappt.
  const footerHeightPx = 140;
  const mainPadBottom = `calc(max(env(safe-area-inset-bottom), 0px) + ${footerHeightPx}px)`;

  const overlaySubtitle = overlayData?.overlaySubtitle ?? "";
  const overlayPrimaryText = overlayData?.overlayPrimaryText ?? "";
  const overlayRightTopText = overlayData?.overlayRightTopText;

  return (
    <LiveTrainingErrorBoundary onExit={onExit}>
      <div className="relative flex h-screen w-screen flex-col overflow-hidden text-slate-100">
      {/* ✅ FIXED HEADER */}
      <div className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-brand-card/90 backdrop-blur px-3 py-2.5 shadow-lg shadow-black/30">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="text-center sm:text-left">
              <div className="tabular-nums text-3xl sm:text-4xl font-semibold text-white/90 leading-none">
                {elapsedText}
              </div>
            </div>

            <div className="flex justify-stretch sm:justify-end">
              <button
                type="button"
                onClick={finishTraining}
                className="h-11 w-full sm:w-auto min-w-[180px] px-6 rounded-2xl bg-brand-primary text-black text-[13px] font-semibold hover:bg-brand-primary/90 whitespace-nowrap"
              >
                Training beenden
              </button>
            </div>
          </div>
        </div>

        {activeRest && (
          <div className="px-1 pt-3">
            <RestTimerBar
              key={`${activeRest.exerciseId}_${activeRest.setId}`}
              seconds={activeRest.restSeconds}
              running={true}
              onDone={() => setActiveRest(null)}
            />
          </div>
        )}
      </div>

      {/* ✅ ONLY ÜBUNGEN SCROLLEN */}
      <main
        ref={mainRef}
        className="flex-1 min-h-0 overflow-y-auto px-4"
        style={{
          paddingTop: mainPadTop,
          paddingBottom: mainPadBottom,
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div className="py-4">
          {exercises.length === 0 ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
                Noch keine {isCardioWorkout ? "Einheiten" : "Übungen"}. Füge unten{" "}
                {isCardioWorkout ? "eine Einheit" : "eine Übung"} hinzu.
              </div>

              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="mt-3 w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-sm font-semibold text-white/90 hover:bg-white/5"
              >
                + {isCardioWorkout ? "Einheit" : "Übung"} hinzufügen
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              {exercises.map((ex, exIdx) => (
                <div
                  key={`${ex.id}-${exIdx}`}
                  ref={(node) => {
                    exerciseRefs.current[ex.id] = node;
                  }}
                >
                  <ExerciseEditor
                    exercise={ex}
                    history={historyByExerciseLocalId.get(ex.id) ?? null}
                    isCardio={isCardioWorkout}
                    onChange={(patch: Partial<LiveExercise>) => updateExercise(ex.id, patch)}
                    onRemove={() => removeExercise(ex.id)}
                    onAddSet={() => addSet(ex.id)}
                    onRemoveSet={(setId: string) => removeSet(ex.id, setId)}
                    onSetChange={(setId: string, patch: Partial<LiveSet>) => updateSet(ex.id, setId, patch)}
                    onToggleSet={(setId: string) => toggleSetCompleted(ex.id, setId)}
                    onWeightFocus={(setId: string, currentWeight?: unknown) => {
                      if (isCardioWorkout) return;
                      setFocusedWeightField({
                        exerciseId: ex.id,
                        setId,
                        currentWeight: toNumberOrUndefined(currentWeight),
                      });
                    }}
                    onMoveUp={exIdx > 0 ? () => moveExercise(ex.id, "up") : undefined}
                    onMoveDown={exIdx < exercises.length - 1 ? () => moveExercise(ex.id, "down") : undefined}
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-sm font-semibold text-white/90 hover:bg-white/5"
              >
                + {isCardioWorkout ? "Einheit" : "Übung"} hinzufügen
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ✅ FIXED FOOTER */}
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),0px)] pt-0">
        <div className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-brand-card/90 backdrop-blur px-3 py-3 shadow-lg shadow-black/30">
          {/* ✅ Volumen/Zeit-Anzeige */}
          <div className="mb-2 flex items-center justify-center gap-4 text-xs text-white/70">
            {!isCardioWorkout && (
              <>
                <span>Volumen: {totalVolume.toFixed(1)} kg</span>
                <span>•</span>
              </>
            )}
            <span>{totalSets} {totalSets === 1 ? "Satz" : "Sätze"}</span>
            <span>•</span>
            <span>Zeit: {elapsedText}</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={minimize}
              className="flex-1 h-11 rounded-2xl border border-white/12 bg-black/25 px-4 text-[13px] font-semibold text-white/90 hover:bg-white/5 whitespace-nowrap"
            >
              Minimieren
            </button>

            <button
              type="button"
              onClick={abortAndExit}
              className="flex-1 h-11 rounded-2xl border border-white/12 bg-black/25 px-4 text-[13px] text-white/80 hover:bg-white/5 whitespace-nowrap"
              title="Training abbrechen"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>

      {/* Übungsbibliothek Modal */}
      <ExerciseLibraryModal
        open={libraryOpen}
        isCardioLibrary={isCardioLibrary}
        title={isCardioLibrary ? "Cardio-Bibliothek" : "Übungsbibliothek"}
        onClose={() => setLibraryOpen(false)}
        existingExerciseIds={exercises.map((ex) => ex.exerciseId).filter(Boolean) as string[]}
        onPick={(exercise: Exercise) => addExerciseDirect({ exerciseId: exercise.id, name: exercise.name })}
        onPickCustom={() => addExerciseDirect({ name: isCardioLibrary ? "Neue Einheit" : "Neue Übung" })}
      />

      {/* Platten Button */}
      <KeyboardAccessoryBar
        visible={showPlatesButton}
        keyboardHeight={keyboardHeight}
        offsetPx={3}
        rightButton={
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={openPlates}
            style={{
              height: 40,
              minWidth: 170,
              padding: "0 16px",
              borderRadius: 10,
              background: "rgba(72,140,255,0.95)",
              border: "1px solid rgba(255,255,255,0.14)",
              color: "white",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: "0.2px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.22)",
            }}
          >
            Platten
          </button>
        }
      />

      {/* Platten Sheet */}
      <PlateCalculatorSheet
        open={plateSheetOpen}
        onClose={() => setPlateSheetOpen(false)}
        initialTotalKg={focusedWeightField?.currentWeight ?? 0}
        onApply={(totalKg: number) => applyPlatesWeight(totalKg)}
      />
      </div>
    </LiveTrainingErrorBoundary>
  );
}
