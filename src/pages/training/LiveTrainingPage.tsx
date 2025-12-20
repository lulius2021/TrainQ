// src/pages/training/LiveTrainingPage.tsx
//
// Fullscreen Live-Trainingsmodus (ohne Tabs)
//
// ✅ Source of Truth für Profil/Diagramme: src/utils/workoutHistory.ts
// ✅ WICHTIG: Das Schreiben in workoutHistory passiert NUR in completeLiveWorkout()
//            (src/utils/trainingHistory.ts) -> exakt 1 Eintrag pro "Training beenden"

import React, { useEffect, useMemo, useRef, useState } from "react";
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

// Seed API
import {
  readGlobalLiveSeed,
  clearGlobalLiveSeed,
  type LiveTrainingSeed,
  resolveLiveSeed,
} from "../../utils/liveTrainingSeed";

// ✅ Adaptive -> Seed Transform
import { applyAdaptiveToSeed } from "../../utils/adaptiveSeed";

// ✅ Zentrale History/Store API
import {
  getActiveLiveWorkout,
  persistActiveLiveWorkout,
  startLiveWorkout,
  completeLiveWorkout,
  abortLiveWorkout,
  applyTrainingStatusToEvent,
  getLastSetsForExercise,
} from "../../utils/trainingHistory";

type LiveTrainingPageProps = {
  events: CalendarEvent[];
  onUpdateEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onExit: () => void;
  eventId?: string;
  initialWorkout?: Partial<LiveWorkout>;
};

function nowISO(): string {
  return new Date().toISOString();
}

function clampRestSeconds(sec: number): number {
  if (!Number.isFinite(sec)) return 90;
  return Math.max(30, Math.min(300, Math.round(sec)));
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function trainingTypeToSport(
  type?: TrainingType,
  sport?: SportType | string
): SportType {
  // 1. expliziter Sport schlägt alles
  if (sport === "Laufen") return "Laufen";
  if (sport === "Radfahren") return "Radfahren";
  if (sport === "Custom") return "Custom";

  // 2. UI trainingType
  if (type === "laufen") return "Laufen";
  if (type === "radfahren") return "Radfahren";
  if (type === "custom") return "Custom";

  // 3. Fallback
  return "Gym";
}

function seedSportToSportType(seedSport?: LiveTrainingSeed["sport"]): SportType {
  if (seedSport === "Laufen") return "Laufen";
  if (seedSport === "Radfahren") return "Radfahren";
  return "Gym";
}

function seedToInitialExercises(seed: LiveTrainingSeed): Array<{
  exerciseId?: string;
  name: string;
  sets: Array<{ reps?: number; weight?: number; notes?: string }>;
  restSeconds?: number;
}> {
  return (seed.exercises || []).map((be) => ({
    exerciseId: be.exerciseId,
    name: be.name || "Übung",
    restSeconds: 90, // später: aus Seed übernehmen (C)
    sets: (be.sets || []).map((s) => ({
      reps: s.reps,
      weight: s.weight,
      notes: (s as any).notes, // falls Seed notes hat
    })),
  }));
}

export default function LiveTrainingPage({
  events,
  onUpdateEvents,
  onExit,
  eventId,
  initialWorkout,
}: LiveTrainingPageProps) {
  const event = useMemo(
    () => (eventId ? events.find((e) => e.id === eventId) : undefined),
    [events, eventId]
  );

  const [workout, setWorkout] = useState<LiveWorkout | null>(null);

  // Timer (aus startedAt ableiten, damit Recovery korrekt ist)
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const tickRef = useRef<number | null>(null);

  // Active rest timer (MVP: one active bar)
  const [activeRest, setActiveRest] = useState<{
    exerciseId: string;
    setId: string;
    restSeconds: number;
  } | null>(null);

  // ✅ Init: Active -> GlobalSeed -> resolveSeed(eventId/date|title) -> Event -> Default
  useEffect(() => {
    if (workout) return;

    // 1) Recovery: aktives Workout existiert
    const active = getActiveLiveWorkout();
    if (active) {
      const merged = { ...active, ...(initialWorkout as any) } as LiveWorkout;
      setWorkout(merged);

      const started = new Date(merged.startedAt).getTime();
      const diff = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setElapsedSec(diff);
      return;
    }

    // 2) Global Seed
    const globalSeed = readGlobalLiveSeed();
    if (globalSeed) {
      clearGlobalLiveSeed();

      const seedToUse =
        event?.adaptiveSuggestion ? applyAdaptiveToSeed(globalSeed, event.adaptiveSuggestion) : globalSeed;

      const w = startLiveWorkout({
        title: seedToUse.title || "Training",
        sport: seedSportToSportType(seedToUse.sport),
        calendarEventId: eventId,
        initialExercises: seedToInitialExercises(seedToUse),
      });

      const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
      setWorkout(merged);

      const started = new Date(merged.startedAt).getTime();
      const diff = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setElapsedSec(diff);
      return;
    }

    // 3) Seed resolver (eventId oder date|title)
    const resolvedSeed = resolveLiveSeed({
      eventId,
      dateISO: event?.date,
      title: event?.title,
    });

    if (resolvedSeed) {
      const seedToUse =
        event?.adaptiveSuggestion ? applyAdaptiveToSeed(resolvedSeed, event.adaptiveSuggestion) : resolvedSeed;

      const w = startLiveWorkout({
        title: seedToUse.title || event?.title || "Training",
        sport: seedSportToSportType(seedToUse.sport),
        calendarEventId: eventId,
        initialExercises: seedToInitialExercises(seedToUse),
      });

      const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
      setWorkout(merged);

      const started = new Date(merged.startedAt).getTime();
      const diff = Math.max(0, Math.floor((Date.now() - started) / 1000));
      setElapsedSec(diff);
      return;
    }

    // 4) Event fallback
    const title = event?.title || "Training";
const sport = trainingTypeToSport(
  (event as any)?.trainingType,
  (event as any)?.sport
);

    const w = startLiveWorkout({
      title,
      sport,
      calendarEventId: eventId,
      initialExercises: [],
    });

    const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
    setWorkout(merged);

    const started = new Date(merged.startedAt).getTime();
    const diff = Math.max(0, Math.floor((Date.now() - started) / 1000));
    setElapsedSec(diff);
  }, [workout, eventId, event?.date, event?.title, (event as any)?.trainingType, event?.adaptiveSuggestion, initialWorkout]);

  // ✅ Tick läuft erst wenn workout da ist
  useEffect(() => {
    if (!workout) return;

    tickRef.current = window.setInterval(() => {
      setElapsedSec((p) => p + 1);
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [workout?.id]);

  // ✅ Persist Active Workout bei jeder Änderung (nur solange aktiv)
  useEffect(() => {
    if (!workout) return;
    if (!workout.isActive) return;
    persistActiveLiveWorkout(workout);
  }, [workout]);

  // -------- Actions: Exercises --------

  const addExercise = () => {
    if (!workout) return;

    const ex: LiveExercise = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now()),
      name: "Neue Übung",
      sets: [
        {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : String(Date.now()) + "_set",
          completed: false,
        },
      ],
      restSeconds: 90,
    };

    setWorkout((prev) => (prev ? { ...prev, exercises: [...prev.exercises, ex] } : prev));
  };

  const removeExercise = (exerciseId: string) => {
    if (!workout) return;

    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.filter((e) => e.id !== exerciseId),
          }
        : prev
    );
    setActiveRest((r) => (r?.exerciseId === exerciseId ? null : r));
  };

  const updateExercise = (exerciseId: string, patch: Partial<LiveExercise>) => {
    if (!workout) return;

    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((e) => {
              if (e.id !== exerciseId) return e;
              return {
                ...e,
                ...patch,
                restSeconds:
                  typeof patch.restSeconds === "number"
                    ? clampRestSeconds(patch.restSeconds)
                    : (e as any).restSeconds,
              };
            }),
          }
        : prev
    );
  };

  const addSet = (exerciseId: string) => {
    if (!workout) return;

    const newSetId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now()) + "_set";

    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((e) =>
              e.id === exerciseId
                ? { ...e, sets: [...e.sets, { id: newSetId, completed: false }] }
                : e
            ),
          }
        : prev
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    if (!workout) return;

    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((e) =>
              e.id === exerciseId ? { ...e, sets: e.sets.filter((s) => s.id !== setId) } : e
            ),
          }
        : prev
    );

    setActiveRest((r) => (r?.setId === setId && r.exerciseId === exerciseId ? null : r));
  };

  const updateSet = (exerciseId: string, setId: string, patch: Partial<LiveSet>) => {
    if (!workout) return;

    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((e) => {
              if (e.id !== exerciseId) return e;
              return {
                ...e,
                sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
              };
            }),
          }
        : prev
    );
  };

  const toggleSetCompleted = (exerciseId: string, setId: string) => {
    if (!workout) return;

    setWorkout((prev) => {
      if (!prev) return prev;

      const ex = prev.exercises.find((x) => x.id === exerciseId);
      if (!ex) return prev;

      const nextExercises = prev.exercises.map((e) => {
        if (e.id !== exerciseId) return e;

        const nextSets = e.sets.map((s) => {
          if (s.id !== setId) return s;

          const nextCompleted = !s.completed;

          if (nextCompleted) {
            setActiveRest({ exerciseId, setId, restSeconds: (e as any).restSeconds ?? 90 });
          } else {
            setActiveRest((r) => (r?.exerciseId === exerciseId && r.setId === setId ? null : r));
          }

          return {
            ...s,
            completed: nextCompleted,
            completedAt: nextCompleted ? nowISO() : undefined,
          };
        });

        return { ...e, sets: nextSets };
      });

      return { ...prev, exercises: nextExercises };
    });
  };

  // -------- Grey values (Übungs-History) --------
  const historyByExerciseLocalId = useMemo(() => {
    if (!workout) return new Map<string, ReturnType<typeof getLastSetsForExercise> | null>();

    const map = new Map<string, ReturnType<typeof getLastSetsForExercise> | null>();
    for (const ex of workout.exercises) {
      map.set(ex.id, getLastSetsForExercise(ex));
    }
    return map;
  }, [workout?.exercises]);

  // -------- Finish / Abort --------

  const markCalendarEvent = (status: TrainingStatus, workoutId?: string) => {
    if (!eventId) return;
    onUpdateEvents((prev) =>
      prev.map((e) => (e.id === eventId ? applyTrainingStatusToEvent(e, status, { workoutId }) : e))
    );
  };

  const finishTraining = () => {
    if (!workout) return;

    // ✅ completeLiveWorkout schreibt:
    // - History Store
    // - ExerciseHistory Patch
    // - 1 WorkoutHistoryEntry (Source of Truth)
    const completed = completeLiveWorkout(workout);

    // Kalender markieren
    markCalendarEvent("completed", completed.id);

    // Exit
    onExit();
  };

  const exitWithoutFinish = () => {
    if (!workout) {
      onExit();
      return;
    }
    abortLiveWorkout(workout);
    onExit();
  };

  // -------- Render --------

  if (!workout) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
        Lade Live-Training…
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <button
          onClick={exitWithoutFinish}
          className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
        >
          Zurück
        </button>

        <div className="text-center">
          <div className="text-[11px] text-slate-400">
            Live Training {workout.sport ? `• ${workout.sport}` : ""}
          </div>
          <div className="text-lg font-semibold tabular-nums">{formatTime(elapsedSec)}</div>
        </div>

        <button
          onClick={finishTraining}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Training beenden
        </button>
      </header>

      {/* Rest Timer (MVP: ein aktiver Balken) */}
      {activeRest && (
        <div className="px-4 pt-3">
          <div className="mb-2 text-xs text-slate-400">Pause</div>
          <RestTimerBar
            key={`${activeRest.exerciseId}_${activeRest.setId}`}
            seconds={activeRest.restSeconds}
            running={true}
            onDone={() => setActiveRest(null)}
          />
        </div>
      )}

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2">
          <div className="text-[11px] text-slate-400">Training</div>
          <div className="text-sm font-semibold text-slate-100">{workout.title}</div>
        </div>

        {workout.exercises.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm text-slate-300">
            Noch keine Übungen. Füge unten eine Übung hinzu.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {workout.exercises.map((ex) => (
              <ExerciseEditor
                key={ex.id}
                exercise={ex}
                history={historyByExerciseLocalId.get(ex.id) ?? null}
                onChange={(patch: Partial<LiveExercise>) => updateExercise(ex.id, patch)}
                onRemove={() => removeExercise(ex.id)}
                onAddSet={() => addSet(ex.id)}
                onRemoveSet={(setId: string) => removeSet(ex.id, setId)}
                onSetChange={(setId: string, patch: Partial<LiveSet>) => updateSet(ex.id, setId, patch)}
                onToggleSet={(setId: string) => toggleSetCompleted(ex.id, setId)}
              />
            ))}
          </div>
        )}

        <div className="h-24" />
      </main>

      {/* Bottom Actions */}
      <footer className="sticky bottom-0 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            onClick={addExercise}
            className="flex-1 rounded-2xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-900"
          >
            + Übung hinzufügen
          </button>
        </div>
      </footer>
    </div>
  );
}