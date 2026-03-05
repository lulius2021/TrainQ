// src/pages/training/LiveCardioPage.tsx
// Gym-style GPS tracking page for Laufen / Radfahren
// Same header (timer + "Beenden"), footer ("Minimieren" + "Abbrechen"),
// and review modal as the gym LiveTrainingPage.

import React, { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useGpsTracking } from "../../hooks/useGpsTracking";
import CardioMap from "../../components/cardio/CardioMap";
import CardioStatsPanel from "../../components/cardio/CardioStatsPanel";
import { addWorkoutEntry } from "../../utils/workoutHistory";
import { useLiveTrainingStore } from "../../store/useLiveTrainingStore";
import { clearLiveTrainingState } from "../../native/liveActivity";
import {
  clearActiveLiveWorkout,
  persistActiveLiveWorkout,
  abortLiveWorkout,
  applyTrainingStatusToEvent,
} from "../../utils/trainingHistory";
import { grantWorkoutXp } from "../../store/useAvatarStore";
import { formatTimeParts } from "../../utils/timeFormat";
import { AppButton } from "../../components/ui/AppButton";
import { PageHeader } from "../../components/ui/PageHeader";
import { useSafeAreaInsets } from "../../hooks/useSafeAreaInsets";
import type { CalendarEvent, LiveWorkout } from "../../types/training";

type LiveCardioPageProps = {
  workout: LiveWorkout;
  eventId?: string;
  onUpdateEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  onExit: () => void;
  onMinimize?: () => void;
  onShareWorkout?: (workoutId: string) => void;
};

const LiveCardioPage: React.FC<LiveCardioPageProps> = ({
  workout,
  eventId,
  onUpdateEvents,
  onExit,
  onMinimize,
  onShareWorkout,
}) => {
  const { state: gpsState, startTracking, stopTracking } = useGpsTracking();
  const insets = useSafeAreaInsets();

  // Timer (identical pattern to gym LiveTrainingPage)
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAtMsRef = useRef<number>(Date.now());
  const tickRef = useRef<number | null>(null);

  // Modal state
  const [showFinishReview, setShowFinishReview] = useState(false);
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [xpToast, setXpToast] = useState<number | null>(null);

  // Auto-start GPS on mount
  useEffect(() => {
    startTracking().then((ok) => {
      if (!ok) setPermissionDenied(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer tick (from workout.startedAt, like gym)
  useEffect(() => {
    const started = new Date(workout.startedAt).getTime();
    startedAtMsRef.current = Number.isFinite(started) ? started : Date.now();

    setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAtMsRef.current) / 1000)));

    tickRef.current = window.setInterval(() => {
      const base = startedAtMsRef.current;
      setElapsedSec(Math.max(0, Math.floor((Date.now() - base) / 1000)));
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [workout.id, workout.startedAt]);

  // Elapsed text (same format as gym)
  const parts = formatTimeParts(elapsedSec);
  const elapsedText = parts.h > 0
    ? `${parts.h}:${parts.mm}:${parts.ss}`
    : `${parseInt(parts.mm, 10)}:${parts.ss}`;

  // Distance text for review
  const distanceKm = gpsState.distanceM / 1000;
  const distanceText = distanceKm > 0
    ? `${(Math.round(distanceKm * 100) / 100).toFixed(2)} km`
    : "-";

  const sport = workout.sport as "Laufen" | "Radfahren";

  // -------- Finish / Abort / Minimize (mirrored from gym) --------

  const handleFinishClick = () => {
    setReviewName(workout.title || (sport === "Laufen" ? "Lauf" : "Radfahrt"));
    setShowFinishReview(true);
  };

  const confirmFinish = () => {
    stopTracking();

    const durationSec = elapsedSec;
    const km = gpsState.distanceM / 1000;
    const paceSecPerKm = km > 0 && durationSec > 0 ? durationSec / km : undefined;

    const entry = addWorkoutEntry(
      {
        calendarEventId: workout.calendarEventId,
        title: reviewName || (sport === "Laufen" ? "Lauf" : "Radfahrt"),
        sport,
        startedAt: workout.startedAt,
        endedAt: new Date().toISOString(),
        durationSec: Math.round(durationSec),
        exercises: [],
        distanceKm: km > 0 ? Math.round(km * 100) / 100 : undefined,
        paceSecPerKm: paceSecPerKm ? Math.round(paceSecPerKm) : undefined,
      },
      { allowEmptyExercises: true },
    );

    // Mark calendar event
    if (eventId) {
      onUpdateEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? applyTrainingStatusToEvent(e, "completed", { workoutId: entry.id }) : e
        ),
      );
    }

    clearActiveLiveWorkout();
    clearLiveTrainingState();
    useLiveTrainingStore.getState().finishWorkout();

    // Grant XP
    const { granted } = grantWorkoutXp(entry);
    if (granted > 0) setXpToast(granted);

    if (typeof onShareWorkout === "function") {
      onShareWorkout(entry.id);
    } else {
      onExit();
    }
  };

  const handleAbortClick = () => {
    setShowAbortConfirm(true);
  };

  const confirmAbort = () => {
    stopTracking();
    abortLiveWorkout(workout);
    clearLiveTrainingState();
    useLiveTrainingStore.getState().cancelWorkout();
    onExit();
  };

  const minimize = () => {
    if (workout.isActive) {
      persistActiveLiveWorkout({ ...workout, isMinimized: true });
    }
    if (typeof onMinimize === "function") onMinimize();
    else onExit();
  };

  // Permission denied screen
  if (permissionDenied) {
    return (
      <div
        className="fixed inset-0 z-[60] bg-[var(--bg-color)] flex flex-col items-center justify-center px-6"
        style={{ paddingTop: `${Math.max(insets.top, 16)}px` }}
      >
        <MapPin size={48} className="text-[var(--text-muted)] mb-4" />
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-color)" }}>
          GPS-Zugriff benötigt
        </h2>
        <p className="text-sm text-center mb-6" style={{ color: "var(--text-muted)" }}>
          Bitte erlaube den Standortzugriff in den Einstellungen, um GPS-Tracking zu nutzen.
        </p>
        <AppButton onClick={onExit} variant="primary">
          Zurück
        </AppButton>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[var(--bg-color)] text-[var(--text-color)] w-screen"
        style={{ touchAction: "pan-y" }}
      >
        {/* FIXED HEADER (identical to gym) */}
        <div
          className="fixed top-0 left-0 right-0 z-[70] backdrop-blur-xl border-b border-[var(--border-color)] flex flex-col gap-0"
          style={{ backgroundColor: "var(--nav-bg)" }}
        >
          <div className="px-4 pb-0" style={{ paddingTop: Math.max(insets.top, 16) + 12 }}>
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
        </div>

        {/* SCROLLABLE CONTENT */}
        <main
          className="flex-1 flex flex-col min-h-0"
          style={{
            paddingTop: `calc(${insets.top}px + 112px)`,
            paddingBottom: `calc(${Math.max(insets.bottom, 0)}px + 72px)`,
          }}
        >
          {/* Map */}
          <div className="flex-1 min-h-0">
            <CardioMap
              points={gpsState.points}
              isTracking={gpsState.status === "tracking"}
              className="w-full h-full"
            />
          </div>

          {/* Stats */}
          <div className="py-3">
            <CardioStatsPanel
              distanceM={gpsState.distanceM}
              paceSecPerKm={gpsState.currentPaceSecPerKm}
              elapsedMs={elapsedSec * 1000}
              elevationGainM={gpsState.elevationGainM}
              sport={sport}
            />
          </div>
        </main>

        {/* FIXED FOOTER (identical to gym) */}
        <div
          className="fixed bottom-0 left-0 right-0 z-[70] backdrop-blur-xl border-t border-[var(--border-color)] px-4 pt-2"
          style={{
            backgroundColor: "var(--nav-bg)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex gap-3">
              <AppButton
                onClick={minimize}
                variant="secondary"
                className="flex-1 h-12 btn-haptic bg-[var(--card-bg)] text-[var(--text-color)] border border-[var(--border-color)]"
              >
                Minimieren
              </AppButton>
              <AppButton
                onClick={handleAbortClick}
                variant="ghost"
                className="flex-1 h-12 text-red-500 hover:bg-red-500/10 hover:text-red-600 btn-haptic"
                title="Training abbrechen"
              >
                Abbrechen
              </AppButton>
            </div>
          </div>
        </div>
      </div>

      {/* --- SAFETY MODALS (copied from gym) --- */}

      {/* 1. Abort Confirmation */}
      {showAbortConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-white/10 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-black dark:text-white mb-2">Training abbrechen?</h3>
            <p className="text-slate-600 dark:text-zinc-400 text-sm mb-6 leading-relaxed">
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
                className="w-full py-3.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-semibold active:scale-95 transition-transform"
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
          <div className="w-full max-w-md bg-white dark:bg-[#121214] rounded-t-[32px] sm:rounded-[32px] p-6 pb-12 sm:pb-6 shadow-2xl border-t sm:border border-white/10 animate-in slide-in-from-bottom-10 fade-in duration-200">
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full mx-auto mb-6 sm:hidden" />

            <h2 className="text-2xl font-bold text-black dark:text-white mb-6 text-center">Zusammenfassung</h2>

            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                  Name des Trainings
                </label>
                <input
                  type="text"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-zinc-900 text-black dark:text-white text-lg font-semibold px-4 py-3.5 rounded-xl border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-300"
                  placeholder="Training Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-2xl flex flex-col items-center">
                  <span className="text-slate-400 dark:text-zinc-500 text-xs font-medium uppercase mb-1">Dauer</span>
                  <span className="text-xl font-bold text-black dark:text-white tabular-nums">{elapsedText}</span>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-2xl flex flex-col items-center">
                  <span className="text-slate-400 dark:text-zinc-500 text-xs font-medium uppercase mb-1">Distanz</span>
                  <span className="text-xl font-bold text-black dark:text-white tabular-nums">{distanceText}</span>
                </div>
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
                className="w-full py-3 rounded-xl text-slate-500 dark:text-zinc-500 font-medium hover:text-slate-800 dark:hover:text-zinc-300 transition-colors"
              >
                Zurück zum Training
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
    </>
  );
};

export default LiveCardioPage;
