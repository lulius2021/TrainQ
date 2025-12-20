// src/pages/debug/TrainQCoreDebug.tsx
// TrainQ Launch: Core Debug UI (DE)

import { useMemo, useState } from "react";

import type {
  AdaptiveProfile,
  CalendarWorkout,
  SplitType,
  TrainingPlan,
} from "../../types";

import AdaptiveTrainingModal from "../../components/adaptive/AdaptiveTrainingModal";

import {
  loadCoreState,
  createPlan,
  ensureCalendarForActivePlan,
  applyAdaptiveToWorkout,
} from "../../services/trainqCore";

// ------------------------------
// Helpers
// ------------------------------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapSuggestionProfileToCore(p: "stabil" | "kompakt" | "fokus"): AdaptiveProfile {
  if (p === "stabil") return "A";
  if (p === "kompakt") return "B";
  return "C";
}

function badgeClass(status: string): string {
  if (status === "completed") return "bg-emerald-500/20 text-emerald-200 border-emerald-500/20";
  if (status === "skipped") return "bg-red-500/20 text-red-200 border-red-500/20";
  if (status === "adaptive") return "bg-sky-400/20 text-sky-200 border-sky-400/20";
  return "bg-white/10 text-white/70 border-white/10";
}

// ------------------------------
// Component
// ------------------------------

export default function TrainQCoreDebug() {
  const [state, setState] = useState(() => loadCoreState());
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);

  const activePlan: TrainingPlan | null = useMemo(
    () => state.plans.find((p) => p.isActive) ?? null,
    [state.plans]
  );

  const splitType: SplitType = activePlan?.splitType ?? "push_pull";

  const today = todayISO();

  const todayWorkout: CalendarWorkout | null = useMemo(() => {
    return state.calendarWorkouts.find((w) => w.date === today) ?? null;
  }, [state.calendarWorkouts, today]);

  const reload = () => setState(loadCoreState());

  // ------------------------------
  // Actions
  // ------------------------------

  const createDefaultPlan = () => {
    const start = todayISO();

    const plan = {
      name: "TrainQ Push/Pull (Debug)",
      sport: "Gym" as const,
      splitType: "push_pull" as const,
      startDate: start,
      weeklyRules: [
        { weekday: 1, workoutType: "Push" as const }, // Mo
        { weekday: 3, workoutType: "Pull" as const }, // Mi
        { weekday: 5, workoutType: "Push" as const }, // Fr
      ],
      isActive: true,
    };

    createPlan(plan as any, { activate: true });
    reload();
  };

  const generateNext28Days = () => {
    ensureCalendarForActivePlan({ days: 28, fromDate: todayISO() as any });
    reload();
  };

  const openAdaptive = () => {
    if (!todayWorkout) {
      window.alert("Kein heutiger Kalendereintrag gefunden. Erst Plan erstellen + Kalender generieren.");
      return;
    }
    setAdaptiveOpen(true);
  };

  // ------------------------------
  // Render
  // ------------------------------

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-5 space-y-4">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] text-white/60">Debug</div>
            <h1 className="text-xl font-extrabold">TrainQ Core Debug</h1>
            <div className="mt-1 text-xs text-white/60">
              Heute: <span className="font-mono">{today}</span>
            </div>
          </div>

          <button
            onClick={reload}
            className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/5"
          >
            Neu laden
          </button>
        </div>

        {/* Plan */}
        <div className="rounded-2xl bg-brand-card border border-white/10 p-4 shadow-lg shadow-black/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold">Aktiver Plan</div>
              <div className="mt-1 text-xs text-white/70">
                {activePlan ? (
                  <>
                    <span className="font-semibold">{activePlan.name}</span>{" "}
                    <span className="text-white/50">({activePlan.splitType})</span>
                  </>
                ) : (
                  <span className="text-white/60">Kein aktiver Plan</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createDefaultPlan}
                className="rounded-xl bg-brand-primary hover:bg-brand-primary/90 px-3 py-2 text-xs font-bold text-black"
              >
                Default Plan erstellen
              </button>
              <button
                onClick={generateNext28Days}
                className="rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs text-white/80 hover:bg-white/5"
              >
                Kalender +28 Tage
              </button>
            </div>
          </div>
        </div>

        {/* Today */}
        <div className="rounded-2xl bg-brand-card border border-white/10 p-4 shadow-lg shadow-black/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold">Heutiger Kalendereintrag</div>

              {todayWorkout ? (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-white/70">
                    Typ: <span className="font-semibold">{todayWorkout.workoutType}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-1 rounded-full border ${badgeClass(
                        todayWorkout.status
                      )}`}
                    >
                      {todayWorkout.status}
                    </span>

                    {todayWorkout.adaptiveProfile && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-sky-400/15 text-sky-200 border border-sky-400/20">
                        Profil {todayWorkout.adaptiveProfile}
                      </span>
                    )}

                    {typeof todayWorkout.estimatedMinutes === "number" && (
                      <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70 border border-white/10">
                        {todayWorkout.estimatedMinutes} min
                      </span>
                    )}
                  </div>

                  {todayWorkout.adaptiveReasons?.length ? (
                    <div className="text-[11px] text-white/60">
                      Gründe:{" "}
                      <span className="text-white/70">
                        {todayWorkout.adaptiveReasons.slice(0, 4).join(" · ")}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-xs text-white/60">
                  Kein Eintrag für heute. Erstelle Plan und generiere Kalender.
                </div>
              )}
            </div>

            <button
              onClick={openAdaptive}
              disabled={!todayWorkout}
              className={[
                "rounded-xl px-3 py-2 text-xs font-extrabold transition",
                todayWorkout
                  ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                  : "bg-white/10 text-white/40 cursor-not-allowed",
              ].join(" ")}
            >
              Adaptiv testen
            </button>
          </div>
        </div>
      </div>

      {/* Adaptive Modal */}
      {todayWorkout && (
        <AdaptiveTrainingModal
          open={adaptiveOpen}
          onClose={() => setAdaptiveOpen(false)}
          plannedWorkoutType={todayWorkout.workoutType}
          splitType={splitType}
          onSelect={(suggestion, _answers) => {
            if (suggestion.estimatedMinutes <= 0) return;

            applyAdaptiveToWorkout(todayWorkout.id, {
              adaptiveProfile: mapSuggestionProfileToCore(suggestion.profile),
              adaptiveReasons: (suggestion.reasons ?? []).map(String),
              estimatedMinutes: suggestion.estimatedMinutes,
              note: `Adaptiv: ${suggestion.title}`,
            });

            setAdaptiveOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}