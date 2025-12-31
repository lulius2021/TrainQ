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
import ExerciseLibraryModal from "../../components/training/ExerciseLibraryModal";
import type { Exercise } from "../../data/exerciseLibrary";

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

  // ✅ App.tsx kann onMinimize übergeben (optional)
  onMinimize?: () => void;
};

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
  // 1) expliziter Sport schlägt alles (auch legacy strings)
  if (sport === "Gym") return "Gym";
  if (sport === "Laufen") return "Laufen";
  if (sport === "Radfahren") return "Radfahren";
  if (sport === "Custom") return "Custom";

  // 2) UI trainingType
  if (type === "laufen") return "Laufen";
  if (type === "radfahren") return "Radfahren";
  if (type === "custom") return "Custom";

  // 3) Fallback
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
    // ✅ leer = kein Timer (User muss es setzen)
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

export default function LiveTrainingPage({
  events,
  onUpdateEvents,
  onExit,
  eventId,
  initialWorkout,
  onMinimize,
}: LiveTrainingPageProps) {
  const event = useMemo(
    () => (eventId ? events.find((e) => e.id === eventId) : undefined),
    [events, eventId]
  );

  const [workout, setWorkout] = useState<LiveWorkout | null>(null);

  // Timer (aus startedAt ableiten, damit Recovery korrekt ist)
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const tickRef = useRef<number | null>(null);
  const startedAtMsRef = useRef<number | null>(null);

  // Active rest timer (MVP: one active bar)
  const [activeRest, setActiveRest] = useState<{
    exerciseId: string;
    setId: string;
    restSeconds: number;
  } | null>(null);

  // ✅ Übungsbibliothek Modal (Multi-Add)
  const [libraryOpen, setLibraryOpen] = useState(false);

  // ✅ Auto-Scroll auf neu hinzugefügte Übung
  const [pendingScrollToExerciseId, setPendingScrollToExerciseId] = useState<string | null>(null);
  const exerciseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ✅ Init: Active -> GlobalSeed -> resolveSeed(eventId/date|title) -> Event -> Default
  useEffect(() => {
    if (workout) return;

    // 1) Recovery: aktives Workout existiert (nur wenn wirklich aktiv + passt zur eventId)
    const active = getActiveLiveWorkout();
    const isReallyActive = !!active && active.isActive === true;

    // ✅ Wenn eventId gesetzt ist, NUR matchen, wenn active.calendarEventId exakt passt.
    const matchesEvent = !eventId ? true : String(active?.calendarEventId || "") === String(eventId);

    if (isReallyActive && matchesEvent) {
      const merged = { ...active, ...(initialWorkout as any) } as LiveWorkout;
      setWorkout(merged);

      const started = new Date(merged.startedAt).getTime();
      startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
      return;
    }

    // 2) Global Seed
    const globalSeed = readGlobalLiveSeed();
    if (globalSeed) {
      clearGlobalLiveSeed();

      const seedToUse = event?.adaptiveSuggestion ? applyAdaptiveToSeed(globalSeed, event.adaptiveSuggestion) : globalSeed;

      const w = startLiveWorkout({
        title: seedToUse.title || "Training",
        sport: seedSportToSportType(seedToUse.sport),
        calendarEventId: eventId,
        initialExercises: seedToInitialExercises(seedToUse),
      });

      const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
      setWorkout(merged);

      const started = new Date(merged.startedAt).getTime();
      startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
      return;
    }

    // 3) Seed resolver (eventId oder date|title)
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
      setWorkout(merged);

      const started = new Date(merged.startedAt).getTime();
      startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
      return;
    }

    // 4) Event fallback
    const title = event?.title || "Training";
    const sport = trainingTypeToSport((event as any)?.trainingType, (event as any)?.sport);

    const w = startLiveWorkout({
      title,
      sport,
      calendarEventId: eventId,
      initialExercises: [],
    });

    const merged = { ...w, ...(initialWorkout as any) } as LiveWorkout;
    setWorkout(merged);

    const started = new Date(merged.startedAt).getTime();
    startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();
    setElapsedSec(Math.max(0, Math.floor((Date.now() - (startedAtMsRef.current ?? Date.now())) / 1000)));
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

  // ✅ Tick läuft erst wenn workout da ist; Zeit wird aus startedAt berechnet (robust, kein Drift)
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

  // -------- Actions: Exercises --------

  const addExerciseDirect = (ex?: { exerciseId?: string; name: string }) => {
    if (!workout) return;

    const exId = uid();
    const setId = uid();

    const cardio = workout.sport === "Laufen" || workout.sport === "Radfahren";

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

    setWorkout((prev) => (prev ? { ...prev, exercises: [...prev.exercises, newEx] } : prev));
    setPendingScrollToExerciseId(exId);
  };

  const removeExercise = (exerciseId: string) => {
    if (!workout) return;

    setWorkout((prev) => (prev ? { ...prev, exercises: prev.exercises.filter((e) => e.id !== exerciseId) } : prev));
    setActiveRest((r) => (r?.exerciseId === exerciseId ? null : r));

    if (pendingScrollToExerciseId === exerciseId) setPendingScrollToExerciseId(null);
    delete exerciseRefs.current[exerciseId];
  };

  const updateExercise = (exerciseId: string, patch: Partial<LiveExercise>) => {
    if (!workout) return;

    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((e) => {
              if (e.id !== exerciseId) return e;

              const next: any = { ...e, ...patch };

              if ("restSeconds" in (patch as any)) {
                next.restSeconds = normalizeRestSeconds((patch as any).restSeconds);
              }

              return next as LiveExercise;
            }),
          }
        : prev
    );
  };

  const addSet = (exerciseId: string) => {
    if (!workout) return;

    const cardio = workout.sport === "Laufen" || workout.sport === "Radfahren";
    const newSetId = uid();

    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((e) =>
              e.id === exerciseId
                ? {
                    ...e,
                    sets: [
                      ...e.sets,
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
              return { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) };
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
    for (const ex of workout.exercises) {
      map.set(ex.id, getLastSetsForExercise(ex));
    }
    return map;
  }, [workout?.exercises]);

  // -------- Finish / Abort / Minimize --------

  const markCalendarEvent = (status: TrainingStatus, workoutId?: string) => {
    if (!eventId) return;
    onUpdateEvents((prev) => prev.map((e) => (e.id === eventId ? applyTrainingStatusToEvent(e, status, { workoutId }) : e)));
  };

  const finishTraining = () => {
    if (!workout) return;
    const completed = completeLiveWorkout(workout);
    markCalendarEvent("completed", completed.id);
    onExit();
  };

  const abortAndExit = () => {
    if (!workout) {
      onExit();
      return;
    }
    abortLiveWorkout(workout);
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

  // -------- Render --------

  if (!workout) {
    return <div className="flex h-screen w-screen items-center justify-center text-white/60">Lade Live-Training…</div>;
  }

  const t = formatTimeParts(elapsedSec);
  const showHours = t.h > 0;
  const elapsedText = showHours ? `${t.h}:${t.mm}:${t.ss}` : `${Number(t.mm)}:${t.ss}`;

  const isCardioLibrary = workout.sport === "Laufen" || workout.sport === "Radfahren";

  return (
    <div className="relative flex h-screen w-screen flex-col text-slate-100">
      {/* Header: Timer + Training beenden (Minimieren/Abbrechen sind unten) */}
      <div className="sticky top-0 z-40 px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-brand-card/90 backdrop-blur px-3 py-3 shadow-lg shadow-black/30">
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
      </div>

      {/* Rest Timer */}
      {activeRest && (
        <div className="px-4 pt-3">
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
        {workout.exercises.length === 0 ? (
          <>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
              Noch keine {isCardioWorkout ? "Einheiten" : "Übungen"}. Füge unten{" "}
              {isCardioWorkout ? "eine Einheit" : "eine Übung"} hinzu.
            </div>

            {/* ✅ + Übung als letztes Element (auch wenn leer) */}
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
            {workout.exercises.map((ex) => (
              <div
                key={ex.id}
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
                />
              </div>
            ))}

            {/* ✅ + Übung unter die letzte Übung (immer das letzte Element) */}
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-4 text-sm font-semibold text-white/90 hover:bg-white/5"
            >
              + {isCardioWorkout ? "Einheit" : "Übung"} hinzufügen
            </button>
          </div>
        )}

        <div className="h-24" />
      </main>

      {/* Bottom Actions: Minimieren/Abbrechen hierhin verschoben */}
      <footer className="sticky bottom-0 border-t border-white/10 bg-brand-card/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            type="button"
            onClick={minimize}
            className="flex-1 h-11 rounded-2xl border border-white/15 bg-black/30 px-4 text-[13px] font-semibold text-white/90 hover:bg-white/5 whitespace-nowrap"
          >
            Minimieren
          </button>

          <button
            type="button"
            onClick={abortAndExit}
            className="flex-1 h-11 rounded-2xl border border-white/15 bg-black/30 px-4 text-[13px] text-white/75 hover:bg-white/5 whitespace-nowrap"
            title="Training abbrechen"
          >
            Abbrechen
          </button>
        </div>
      </footer>

      {/* Übungsbibliothek Modal */}
      <ExerciseLibraryModal
        open={libraryOpen}
        isCardioLibrary={isCardioLibrary}
        title={isCardioLibrary ? "Cardio-Bibliothek" : "Übungsbibliothek"}
        onClose={() => setLibraryOpen(false)}
        onPick={(exercise: Exercise) => {
          addExerciseDirect({ exerciseId: exercise.id, name: exercise.name });
        }}
        onPickCustom={() => {
          addExerciseDirect({ name: isCardioLibrary ? "Neue Einheit" : "Neue Übung" });
        }}
      />
    </div>
  );
}