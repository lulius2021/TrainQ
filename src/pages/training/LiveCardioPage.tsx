// src/pages/training/LiveCardioPage.tsx
// Full-screen GPS tracking page for Laufen / Radfahren

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, MapPin } from "lucide-react";
import { useGpsTracking } from "../../hooks/useGpsTracking";
import CardioMap from "../../components/cardio/CardioMap";
import CardioStatsPanel from "../../components/cardio/CardioStatsPanel";
import CardioControls from "../../components/cardio/CardioControls";
import CardioSummary from "../../components/cardio/CardioSummary";
import { addWorkoutEntry } from "../../utils/workoutHistory";
import { useLiveTrainingStore } from "../../store/useLiveTrainingStore";
import { clearGlobalLiveSeed } from "../../utils/liveTrainingSeed";
import { clearLiveTrainingState } from "../../native/liveActivity";
import { computePace } from "../../utils/gpsUtils";
import type { GpsPoint } from "../../types/cardio";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

type LiveCardioPageProps = {
  sport: "Laufen" | "Radfahren";
  title: string;
  calendarEventId?: string;
  onExit: () => void;
  onMinimize?: () => void;
};

const LiveCardioPage: React.FC<LiveCardioPageProps> = ({
  sport,
  title,
  calendarEventId,
  onExit,
  onMinimize,
}) => {
  const { state, startTracking, pauseTracking, resumeTracking, stopTracking, getElapsedMs } =
    useGpsTracking();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-start tracking on mount
  useEffect(() => {
    if (state.status === "idle") {
      startTracking().then((ok) => {
        if (!ok) setPermissionDenied(true);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Elapsed time ticker
  useEffect(() => {
    if (state.status === "tracking") {
      timerRef.current = setInterval(() => {
        setElapsedMs(getElapsedMs());
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      // Update one last time when paused
      setElapsedMs(getElapsedMs());
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.status, getElapsedMs]);

  const handleStart = useCallback(async () => {
    const ok = await startTracking();
    if (!ok) setPermissionDenied(true);
  }, [startTracking]);

  const handlePause = useCallback(() => {
    pauseTracking();
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  }, [pauseTracking]);

  const handleResume = useCallback(() => {
    resumeTracking();
  }, [resumeTracking]);

  const handleStop = useCallback(() => {
    stopTracking();
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    setShowSummary(true);
  }, [stopTracking]);

  const handleSave = useCallback(() => {
    const duration = getElapsedMs();
    const distanceKm = state.distanceM / 1000;
    const durationSec = duration / 1000;
    const paceSecPerKm =
      distanceKm > 0 && durationSec > 0 ? durationSec / distanceKm : undefined;

    addWorkoutEntry(
      {
        calendarEventId,
        title: title || (sport === "Laufen" ? "Lauf" : "Radfahrt"),
        sport,
        startedAt: new Date(state.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        durationSec: Math.round(durationSec),
        exercises: [],
        distanceKm: distanceKm > 0 ? Math.round(distanceKm * 100) / 100 : undefined,
        paceSecPerKm: paceSecPerKm ? Math.round(paceSecPerKm) : undefined,
      },
      { allowEmptyExercises: true },
    );

    // Clean up
    clearGlobalLiveSeed();
    clearLiveTrainingState();
    useLiveTrainingStore.getState().finishWorkout();
    onExit();
  }, [state, getElapsedMs, sport, title, calendarEventId, onExit]);

  const handleDiscard = useCallback(() => {
    clearGlobalLiveSeed();
    clearLiveTrainingState();
    useLiveTrainingStore.getState().finishWorkout();
    onExit();
  }, [onExit]);

  // Summary screen
  if (showSummary) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg-primary)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <CardioSummary
          points={state.points}
          distanceM={state.distanceM}
          elevationGainM={state.elevationGainM}
          durationMs={getElapsedMs()}
          sport={sport}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      </div>
    );
  }

  // Permission denied screen
  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col items-center justify-center px-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <MapPin size={48} className="text-[var(--text-secondary)] mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">GPS-Zugriff benötigt</h2>
        <p className="text-sm text-[var(--text-secondary)] text-center mb-6">
          Bitte erlaube den Standortzugriff in den Einstellungen, um GPS-Tracking zu nutzen.
        </p>
        <button
          onClick={onExit}
          className="px-6 py-3 rounded-xl bg-blue-500 text-white font-semibold text-sm"
        >
          Zurück
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={onMinimize || onExit}
          className="flex items-center gap-1 text-blue-500 text-sm font-medium"
        >
          <ChevronLeft size={20} />
          {onMinimize ? "Minimieren" : "Zurück"}
        </button>
        <div className="text-sm font-semibold text-[var(--text-primary)]">
          {sport === "Laufen" ? "Laufen" : "Radfahren"}
        </div>
        <div className="w-16" />
      </div>

      {/* Map - takes up available space */}
      <div className="flex-1 min-h-0">
        <CardioMap
          points={state.points}
          isTracking={state.status === "tracking"}
          className="w-full h-full"
        />
      </div>

      {/* Stats */}
      <div className="py-3">
        <CardioStatsPanel
          distanceM={state.distanceM}
          paceSecPerKm={state.currentPaceSecPerKm}
          elapsedMs={elapsedMs}
          elevationGainM={state.elevationGainM}
          sport={sport}
        />
      </div>

      {/* Controls */}
      <div className="pb-8" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
        <CardioControls
          status={state.status}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
        />
      </div>
    </div>
  );
};

export default LiveCardioPage;
