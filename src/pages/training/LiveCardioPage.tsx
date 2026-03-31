// src/pages/training/LiveCardioPage.tsx
// Strava-style live GPS tracking for Laufen / Radfahren

import React, { useEffect, useRef, useState } from "react";
import {
  MapPin, Pause, Play, Square, Flag, ChevronDown,
} from "lucide-react";
import { useGpsTracking } from "../../hooks/useGpsTracking";
import CardioMap, { type MapStyle } from "../../components/cardio/CardioMap";
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
import { ProfileService } from "../../services/ProfileService";
import {
  formatPace,
  formatDistanceKm,
  formatElevation,
  formatSpeed,
  computeCalories,
  computePace,
} from "../../utils/gpsUtils";
import { useSafeAreaInsets } from "../../hooks/useSafeAreaInsets";
import { useAuth } from "../../context/AuthContext";
import { postWorkoutToFeed } from "../../services/community/postWorkout";
import type { CalendarEvent, LiveWorkout } from "../../types/training";
import type { GpsPoint, LapEntry, CardioInterval, CardioTarget } from "../../types/cardio";

function downsampleGpsPoints(points: GpsPoint[], maxPoints: number): GpsPoint[] {
  if (points.length <= maxPoints) return points;
  const step = points.length / maxPoints;
  const result: GpsPoint[] = [];
  for (let i = 0; i < maxPoints; i++) result.push(points[Math.round(i * step)]);
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}

function formatElapsedSec(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Compute per-lap display data from cumulative snapshots. */
function getLapRows(laps: LapEntry[]): Array<{
  number: number;
  distKm: string;
  pace: string;
  elapsed: string;
}> {
  return laps.map((lap, i) => {
    const prev = laps[i - 1];
    const lapDistM   = lap.distanceM - (prev?.distanceM ?? 0);
    const lapElapsMs = lap.elapsedMs  - (prev?.elapsedMs  ?? 0);
    const pace       = computePace(lapDistM, lapElapsMs);
    return {
      number: lap.number,
      distKm: (lapDistM / 1000).toFixed(2),
      pace: formatPace(pace),
      elapsed: formatElapsedSec(Math.round(lapElapsMs / 1000)),
    };
  });
}

/** ±15 s tolerance for pace zone colouring */
const PACE_ZONE_TOLERANCE_SEC = 15;

interface IntervalInfo {
  interval: CardioInterval;
  indexInCycle: number;
  remainingSec: number;
  totalIntervals: number;
}

function getIntervalInfo(intervals: CardioInterval[], elapsedSec: number): IntervalInfo | null {
  if (!intervals.length) return null;
  const cycleDur = intervals.reduce((s, i) => s + i.durationSec, 0);
  if (cycleDur === 0) return null;
  const pos = elapsedSec % cycleDur;
  let acc = 0;
  for (let i = 0; i < intervals.length; i++) {
    acc += intervals[i].durationSec;
    if (pos < acc) {
      return {
        interval: intervals[i],
        indexInCycle: i,
        remainingSec: acc - pos,
        totalIntervals: intervals.length,
      };
    }
  }
  return null;
}

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
  const {
    state: gps,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    addLap,
    getElapsedMs,
  } = useGpsTracking();

  const insets     = useSafeAreaInsets();
  const { user: authUser } = useAuth();
  const sport      = workout.sport as "Laufen" | "Radfahren";
  const isCycling  = sport === "Radfahren";
  const accentColor = "#2563EB"; // Blue

  // Timer — stable ref-based approach, never stalls
  const [elapsedSec, setElapsedSec] = useState(0);
  const getElapsedMsRef = useRef(getElapsedMs);
  getElapsedMsRef.current = getElapsedMs;

  // Modal / UI state
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showFinishReview, setShowFinishReview]  = useState(false);
  const [showAbortConfirm, setShowAbortConfirm]  = useState(false);
  const [showStopMenu, setShowStopMenu]           = useState(false);
  const [reviewName, setReviewName]               = useState("");
  const [xpToast, setXpToast]                     = useState<number | null>(null);
  const [startBusy, setStartBusy]                 = useState(false);
  const [mapStyle, setMapStyle]                   = useState<MapStyle>("street");
  const [showMapStyleSheet, setShowMapStyleSheet] = useState(false);

  // GPS starts on explicit user tap — iOS requires a real interaction to show the permission dialog
  const handleStart = async () => {
    setStartBusy(true);
    const ok = await startTracking();
    setStartBusy(false);
    if (!ok) setPermissionDenied(true);
  };

  // Paused-aware timer — runs once, always reads latest getElapsedMs via ref
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor(getElapsedMsRef.current() / 1000));
    }, 500);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived metrics
  const distanceM  = gps.distanceM;
  const distanceKm = distanceM / 1000;

  // Avg pace / avg speed
  const avgPaceSecPerKm =
    distanceKm > 0 && elapsedSec > 0 ? elapsedSec / distanceKm : undefined;
  const avgSpeedKmh =
    distanceKm > 0 && elapsedSec > 0 ? distanceKm / (elapsedSec / 3600) : 0;
  const curSpeedKmh =
    gps.currentPaceSecPerKm ? 3600 / gps.currentPaceSecPerKm : 0;

  const bodyWeight = ProfileService.getUserProfile().weight || 75;
  const calories   = computeCalories(distanceM, bodyWeight, sport);

  const isPaused = gps.status === "paused";
  const lapRows  = getLapRows(gps.laps);

  // Cardio target (pace zone + intervals)
  const cardioTarget: CardioTarget | undefined = workout.cardioTarget;
  const intervalInfo = cardioTarget?.intervals
    ? getIntervalInfo(cardioTarget.intervals, elapsedSec)
    : null;
  // Effective target pace: per-interval override OR overall target
  const effectiveTargetPace =
    intervalInfo?.interval.targetPaceSecPerKm ?? cardioTarget?.targetPaceSecPerKm;

  // ── Handlers ──────────────────────────────────────────────

  const handlePauseResume = async () => {
    if (isPaused) await resumeTracking();
    else pauseTracking();
  };

  const handleFinishClick = () => {
    setShowStopMenu(false);
    setReviewName(workout.title || (isCycling ? "Radfahrt" : "Lauf"));
    setShowFinishReview(true);
  };

  const handleAbortClick = () => {
    setShowStopMenu(false);
    setShowAbortConfirm(true);
  };

  const confirmFinish = () => {
    stopTracking();
    const km             = gps.distanceM / 1000;
    const durationSec    = elapsedSec;
    const paceSecPerKm   = km > 0 && durationSec > 0 ? durationSec / km : undefined;
    const sampled        = gps.points.length > 0
      ? downsampleGpsPoints(gps.points, 200) : undefined;
    const savedElevation = gps.elevationGainM > 0
      ? Math.round(gps.elevationGainM) : undefined;
    const savedCalories  = calories > 0 ? calories : undefined;

    const entry = addWorkoutEntry(
      {
        calendarEventId: workout.calendarEventId,
        title: reviewName || (isCycling ? "Radfahrt" : "Lauf"),
        sport,
        startedAt: workout.startedAt,
        endedAt:   new Date().toISOString(),
        durationSec: Math.round(durationSec),
        exercises: [],
        distanceKm: km > 0 ? Math.round(km * 100) / 100 : undefined,
        paceSecPerKm: paceSecPerKm ? Math.round(paceSecPerKm) : undefined,
        gpsPoints: sampled,
        elevationGainM: savedElevation,
        calories: savedCalories,
      },
      { allowEmptyExercises: true },
    );

    if (eventId) {
      onUpdateEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? applyTrainingStatusToEvent(e, "completed", { workoutId: entry.id }) : e
        )
      );
    }
    clearActiveLiveWorkout();
    clearLiveTrainingState();
    useLiveTrainingStore.getState().finishWorkout();

    if (authUser?.id) postWorkoutToFeed(entry, authUser.id);

    const { granted } = grantWorkoutXp(entry);
    if (granted > 0) setXpToast(granted);

    if (typeof onShareWorkout === "function") onShareWorkout(entry.id);
    else onExit();
  };

  const confirmAbort = () => {
    stopTracking();
    abortLiveWorkout(workout);
    clearLiveTrainingState();
    useLiveTrainingStore.getState().cancelWorkout();
    onExit();
  };

  const minimize = () => {
    if (workout.isActive) persistActiveLiveWorkout({ ...workout, isMinimized: true });
    if (typeof onMinimize === "function") onMinimize();
    else onExit();
  };

  // ── Permission denied ──────────────────────────────────────

  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6" style={{ background: "var(--bg-color)" }}>
        <MapPin size={48} className="opacity-40 mb-4" style={{ color: "var(--text-secondary)" }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-color)" }}>GPS-Zugriff benötigt</h2>
        <p className="text-sm text-center mb-6" style={{ color: "var(--text-secondary)" }}>
          Bitte erlaube den Standortzugriff in den Einstellungen.
        </p>
        <button
          onClick={onExit}
          className="px-8 py-3 rounded-2xl font-semibold"
          style={{ backgroundColor: accentColor }}
        >
          Zurück
        </button>
      </div>
    );
  }

  // ── Main Strava-style layout ────────────────────────────────

  return (
    <>
      <div className="fixed inset-0 z-[60] overflow-hidden" style={{ background: "var(--bg-color)" }}>

        {/* ── Full-screen map ── */}
        <CardioMap
          points={gps.points}
          isTracking={gps.status === "tracking"}
          className="absolute inset-0 w-full h-full"
          controlsTopOffset={Math.max(insets.top, 16) + 56}
          mapStyle={mapStyle}
          onLayersPress={() => setShowMapStyleSheet(true)}
        />

        {/* ── Top overlay (timer + sport + minimize) ── */}
        <div
          className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
            paddingTop: Math.max(insets.top, 16),
          }}
        >
          <div className="flex items-start justify-between px-5 pt-3 pb-6">
            {/* Minimize */}
            <button
              type="button"
              onClick={minimize}
              className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"
            >
              <ChevronDown size={22} className="text-white" />
            </button>

            {/* Timer + sport */}
            <div className="text-center">
              <div className="text-white font-black tabular-nums text-2xl leading-none drop-shadow">
                {formatElapsedSec(elapsedSec)}
              </div>
              <div className="text-white/70 text-[11px] uppercase tracking-widest mt-0.5">
                {isPaused ? "Pausiert" : isCycling ? "Radfahren" : "Laufen"}
              </div>
            </div>

            {/* Spacer */}
            <div className="w-10" />
          </div>
        </div>

        {/* ── Bottom stats + controls panel ── */}
        <div
          className="absolute bottom-0 left-0 right-0 z-10"
          style={{ display: showMapStyleSheet ? "none" : undefined,
            background: "var(--card-bg)",
            backdropFilter: "blur(20px)",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTop: "1px solid var(--border-color)",
          }}
        >
          {/* Primary metric: Distance */}
          <div className="text-center pt-3 pb-0.5 px-4">
            <div
              className="font-black tabular-nums leading-none tracking-tight"
              style={{ fontSize: "clamp(48px, 14vw, 64px)", color: "var(--text-color)" }}
            >
              {formatDistanceKm(distanceM)}
            </div>
            <div className="text-xs uppercase tracking-[0.25em] mt-0.5" style={{ color: "var(--text-secondary)" }}>KM</div>
          </div>

          {/* Interval countdown */}
          {intervalInfo && gps.status !== "idle" && (
            <IntervalCountdownBar
              info={intervalInfo}
              intervals={cardioTarget!.intervals!}
              isTracking={gps.status === "tracking"}
            />
          )}

          {/* Pace zone indicator */}
          {effectiveTargetPace && gps.status !== "idle" && (
            <PaceZoneBar
              targetPaceSecPerKm={effectiveTargetPace}
              currentPaceSecPerKm={gps.currentPaceSecPerKm}
            />
          )}

          {/* Secondary metrics grid */}
          <div className="grid grid-cols-3 px-6 pt-2 pb-0 gap-x-2 text-center">
            {isCycling ? (
              <>
                <MetricCell
                  value={curSpeedKmh > 0 ? curSpeedKmh.toFixed(1) : "--.-"}
                  label="km/h"
                />
                <MetricCell
                  value={avgSpeedKmh > 0 ? avgSpeedKmh.toFixed(1) : "--.-"}
                  label="Ø km/h"
                />
              </>
            ) : (
              <>
                <MetricCell
                  value={formatPace(gps.currentPaceSecPerKm)}
                  label="Pace/km"
                />
                <MetricCell
                  value={formatPace(avgPaceSecPerKm)}
                  label="Ø Pace"
                />
              </>
            )}
            <MetricCell
              value={formatElevation(gps.elevationGainM)}
              label="Hm"
            />
          </div>

          {/* Extra row: calories */}
          <div className="flex justify-center gap-8 pb-0 text-center">
            <MetricCell value={String(calories)} label="kcal" small />
            {!isCycling && (
              <MetricCell
                value={formatSpeed(gps.currentPaceSecPerKm) + " km/h"}
                label="Speed"
                small
              />
            )}
          </div>

          {/* Lap list */}
          {lapRows.length > 0 && (
            <div className="mx-4 mb-1 max-h-[72px] overflow-y-auto rounded-xl" style={{ background: "var(--button-bg)" }}>
              {[...lapRows].reverse().map((lap) => (
                <div
                  key={lap.number}
                  className="flex items-center justify-between px-3 py-1.5 last:border-0"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <span className="text-xs w-14" style={{ color: "var(--text-secondary)" }}>Runde {lap.number}</span>
                  <span className="text-xs font-semibold" style={{ color: "var(--text-color)" }}>{lap.distKm} km</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{lap.pace}</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{lap.elapsed}</span>
                </div>
              ))}
            </div>
          )}

          {/* Controls: LAP | PAUSE/PLAY | STOP */}
          <div className="flex items-center justify-between px-10 py-3">
            {/* Lap */}
            <CircleButton onPress={addLap} size={56} outlined>
              <Flag size={20} style={{ color: "var(--text-color)" }} />
            </CircleButton>

            {/* Start (idle) / Pause / Resume */}
            <CircleButton
              onPress={gps.status === "idle" ? handleStart : handlePauseResume}
              size={72}
              color={accentColor}
              shadow="0 0 28px rgba(37,99,235,0.5)"
            >
              {gps.status === "idle"
                ? startBusy
                  ? <div className="w-7 h-7 rounded-full border-4 border-white border-t-transparent animate-spin" />
                  : <Play size={30} className="text-white ml-1" />
                : isPaused
                  ? <Play size={30} className="text-white ml-1" />
                  : <Pause size={28} className="text-white" />}
            </CircleButton>

            {/* Stop */}
            <CircleButton
              onPress={() => setShowStopMenu(true)}
              size={56}
              outlined
              borderColor="rgba(255,59,48,0.5)"
            >
              <Square size={18} className="text-red-400 fill-current" />
            </CircleButton>
          </div>

          {/* Safe area */}
          <div style={{ height: Math.max(insets.bottom, 16) }} />
        </div>
      </div>

      {/* ── Stop menu (save / discard) ── */}
      {showStopMenu && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowStopMenu(false)}
        >
          <div
            className="w-full max-w-md rounded-t-[28px] p-6 pb-10 space-y-3"
            style={{ background: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--border-color)" }} />
            <div className="text-center mb-4">
              <div className="font-bold text-lg" style={{ color: "var(--text-color)" }}>Training beenden?</div>
              <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                {formatDistanceKm(distanceM)} km · {formatElapsedSec(elapsedSec)}
              </div>
            </div>
            <button
              onClick={handleFinishClick}
              className="w-full py-4 rounded-2xl font-bold text-white text-base"
              style={{ backgroundColor: accentColor }}
            >
              Speichern & Beenden
            </button>
            <button
              onClick={handleAbortClick}
              className="w-full py-4 rounded-2xl font-semibold text-red-400 bg-red-500/10"
            >
              Verwerfen
            </button>
            <button
              onClick={() => setShowStopMenu(false)}
              className="w-full py-3 rounded-2xl text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Weiter trainieren
            </button>
          </div>
        </div>
      )}

      {/* ── Abort confirmation ── */}
      {showAbortConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl p-6 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
            <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <Square size={24} className="text-red-400" />
            </div>
            <h3 className="font-bold text-lg mb-2" style={{ color: "var(--text-color)" }}>Training verwerfen?</h3>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              Alle {formatDistanceKm(distanceM)} km gehen verloren.
            </p>
            <button onClick={confirmAbort}
              className="w-full py-3.5 rounded-2xl bg-red-500 text-white font-bold mb-3">
              Ja, verwerfen
            </button>
            <button onClick={() => setShowAbortConfirm(false)}
              className="w-full py-3 text-sm"
              style={{ color: "var(--text-secondary)" }}>
              Zurück
            </button>
          </div>
        </div>
      )}

      {/* ── Finish review sheet ── */}
      {showFinishReview && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-md">
          <div
            className="w-full max-w-md rounded-t-[32px] p-6 pb-10 animate-in slide-in-from-bottom-10 fade-in duration-200"
            style={{ background: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "var(--border-color)" }} />
            <h2 className="font-bold text-xl text-center mb-5" style={{ color: "var(--text-color)" }}>Zusammenfassung</h2>

            {/* Name input */}
            <input
              type="text"
              value={reviewName}
              onChange={(e) => setReviewName(e.target.value)}
              placeholder={isCycling ? "Radfahrt" : "Lauf"}
              className="w-full px-4 py-3 rounded-xl font-semibold outline-none mb-4"
              style={{
                background: "var(--button-bg)",
                color: "var(--text-color)",
                border: "1px solid var(--border-color)",
              }}
            />

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatCard label="Distanz" value={`${formatDistanceKm(distanceM)} km`} />
              <StatCard label="Zeit"    value={formatElapsedSec(elapsedSec)} />
              <StatCard
                label={isCycling ? "Ø Speed" : "Ø Pace"}
                value={isCycling
                  ? (avgSpeedKmh > 0 ? avgSpeedKmh.toFixed(1) + " km/h" : "--")
                  : formatPace(avgPaceSecPerKm)}
              />
              <StatCard label="Höhenmeter" value={`${formatElevation(gps.elevationGainM)} m`} />
              <StatCard label="Kalorien"   value={`${calories} kcal`} />
              {gps.laps.length > 0 && (
                <StatCard label="Runden" value={String(gps.laps.length)} />
              )}
            </div>

            {/* Lap detail */}
            {lapRows.length > 0 && (
              <div className="rounded-xl mb-4 overflow-hidden" style={{ background: "var(--button-bg)" }}>
                <div className="grid grid-cols-4 px-3 py-1.5 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  <span>Runde</span><span className="text-right">Dist.</span>
                  <span className="text-right">Pace</span><span className="text-right">Zeit</span>
                </div>
                {lapRows.map((l) => (
                  <div key={l.number} className="grid grid-cols-4 px-3 py-2 text-xs" style={{ color: "var(--text-color)", borderTop: "1px solid var(--border-color)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{l.number}</span>
                    <span className="text-right">{l.distKm} km</span>
                    <span className="text-right" style={{ color: "var(--text-secondary)" }}>{l.pace}</span>
                    <span className="text-right" style={{ color: "var(--text-secondary)" }}>{l.elapsed}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={confirmFinish}
              className="w-full py-4 rounded-2xl font-bold text-white text-base mb-3"
              style={{ backgroundColor: accentColor }}
            >
              Speichern
            </button>
            <button
              onClick={() => setShowFinishReview(false)}
              className="w-full py-3 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              Weiter trainieren
            </button>
          </div>
        </div>
      )}

      {/* ── Map style bottom sheet ── */}
      {showMapStyleSheet && (
        <div
          className="fixed inset-0 z-[120] flex flex-col justify-end"
          onClick={() => setShowMapStyleSheet(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative rounded-t-3xl px-5 pt-5"
            style={{ background: "var(--card-bg)", borderTop: "1px solid var(--border-color)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "var(--border-color)" }} />
            <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Kartenansicht</p>

            <div className="flex flex-col gap-2">
              {(["street", "satellite", "dark"] as MapStyle[]).map((style) => {
                const isActive = mapStyle === style;
                // Static tile preview — Europe z=3 x=4 y=2
                const previewUrl: Record<MapStyle, string> = {
                  street:    "https://a.basemaps.cartocdn.com/rastertiles/voyager/3/4/2.png",
                  dark:      "https://a.basemaps.cartocdn.com/dark_all/3/4/2.png",
                  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/4",
                };
                const label: Record<MapStyle, string> = { street: "Karte", satellite: "Satellit", dark: "Dunkel" };
                const sub:   Record<MapStyle, string> = { street: "Standard", satellite: "Luftbild", dark: "Nacht" };
                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() => { setMapStyle(style); setShowMapStyleSheet(false); }}
                    className="flex items-center justify-between rounded-2xl px-4 py-3 transition-all active:scale-[0.98]"
                    style={{
                      background: isActive ? "rgba(59,130,246,0.12)" : "var(--bg-color)",
                      border: isActive ? "2px solid #3B82F6" : "2px solid var(--border-color)",
                    }}
                  >
                    {/* Left: map tile preview */}
                    <div className="w-20 h-14 rounded-xl overflow-hidden flex-shrink-0 border" style={{ borderColor: "var(--border-color)" }}>
                      <img
                        src={previewUrl[style]}
                        alt={label[style]}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    {/* Middle: name + subtitle */}
                    <div className="flex-1 text-left ml-3">
                      <div className="text-sm font-semibold" style={{ color: isActive ? "#3B82F6" : "var(--text-color)" }}>
                        {label[style]}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{sub[style]}</div>
                    </div>

                    {/* Right: checkmark */}
                    {isActive && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#3B82F6" }}>
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ height: Math.max(insets.bottom + 16, 32) }} />
          </div>
        </div>
      )}

      {/* XP Toast */}
      {xpToast !== null && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] px-4 py-2 rounded-full text-white font-bold text-sm shadow-lg animate-in fade-in slide-in-from-top-4 duration-300"
          style={{ backgroundColor: accentColor }}
          onAnimationEnd={() => setTimeout(() => setXpToast(null), 1500)}
        >
          +{xpToast} XP
        </div>
      )}
    </>
  );
};

// ── Small helper components ──────────────────────────────────

function MetricCell({
  value, label, small = false,
}: { value: string; label: string; small?: boolean }) {
  return (
    <div>
      <div
        className={`font-bold tabular-nums ${small ? "text-base" : "text-[22px]"} leading-tight`}
        style={{ color: "var(--text-color)" }}
      >
        {value}
      </div>
      <div className="uppercase tracking-wider mt-0.5" style={{ fontSize: 9, color: "var(--text-secondary)" }}>
        {label}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: "var(--button-bg)" }}>
      <div className="font-bold text-lg" style={{ color: "var(--text-color)" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: "var(--text-secondary)" }}>{label}</div>
    </div>
  );
}

function CircleButton({
  onPress, size, children, color, outlined, shadow, borderColor,
}: {
  onPress: () => void;
  size: number;
  children: React.ReactNode;
  color?: string;
  outlined?: boolean;
  shadow?: string;
  borderColor?: string;
}) {
  return (
    <button
      type="button"
      onPointerUp={(e) => { e.preventDefault(); onPress(); }}
      className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
      style={{
        width: size,
        height: size,
        backgroundColor: outlined ? "transparent" : (color ?? "var(--button-bg)"),
        border: outlined
          ? `2px solid ${borderColor ?? "var(--border-color)"}`
          : color
          ? "none"
          : "none",
        boxShadow: shadow,
      }}
    >
      {children}
    </button>
  );
}

// ── Pace zone bar ────────────────────────────────────────────

function PaceZoneBar({
  targetPaceSecPerKm,
  currentPaceSecPerKm,
}: {
  targetPaceSecPerKm: number;
  currentPaceSecPerKm?: number;
}) {
  const diff = currentPaceSecPerKm != null
    ? currentPaceSecPerKm - targetPaceSecPerKm
    : null;
  const onTarget = diff !== null && Math.abs(diff) <= PACE_ZONE_TOLERANCE_SEC;
  const tooFast  = diff !== null && diff < -PACE_ZONE_TOLERANCE_SEC;

  let zoneColor = "#6b7280";   // gray  → no data
  let zoneLabel = "–";
  let zoneSub   = `Ziel: ${formatPace(targetPaceSecPerKm)}/km`;
  if (diff !== null) {
    if (onTarget) {
      zoneColor = "#22c55e";  // green
      zoneLabel = "Im Zielbereich";
    } else if (tooFast) {
      zoneColor = "#f59e0b";  // amber — too fast (might be fine but warn)
      zoneLabel = `+${Math.abs(Math.round(diff))}s schneller`;
    } else {
      zoneColor = "#ef4444";  // red — too slow
      zoneLabel = `${Math.round(diff)}s langsamer`;
    }
    zoneSub = `Ziel ${formatPace(targetPaceSecPerKm)} · Aktuell ${formatPace(currentPaceSecPerKm)}/km`;
  }

  return (
    <div
      className="mx-4 mb-1 rounded-xl px-4 py-2 flex items-center gap-3"
      style={{ background: `${zoneColor}1A`, border: `1.5px solid ${zoneColor}55` }}
    >
      {/* Colour dot */}
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: zoneColor }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate" style={{ color: zoneColor }}>{zoneLabel}</div>
        <div className="text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{zoneSub}</div>
      </div>
      {/* Pace delta bar */}
      {diff !== null && (
        <div className="flex-shrink-0 w-16 h-2 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
          {/* Fill represents how far off target (capped at ±30s = full bar) */}
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(100, (Math.abs(diff) / 30) * 100)}%`,
              backgroundColor: zoneColor,
              marginLeft: diff > 0 ? 0 : "auto",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Interval countdown bar ───────────────────────────────────

function IntervalCountdownBar({
  info,
  intervals,
  isTracking,
}: {
  info: IntervalInfo;
  intervals: CardioInterval[];
  isTracking: boolean;
}) {
  const { interval, indexInCycle, remainingSec } = info;
  const isWork = interval.type === "work";
  const color  = isWork ? "#3B82F6" : "#22c55e";
  const label  = interval.label ?? (isWork ? "Belastung" : "Erholung");

  // Next interval
  const nextInterval = intervals[(indexInCycle + 1) % intervals.length];

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const countdown = `${mins}:${secs.toString().padStart(2, "0")}`;

  // Progress within this interval (0→1)
  const progress = 1 - remainingSec / interval.durationSec;

  return (
    <div className="mx-4 mb-2">
      {/* Current interval row */}
      <div
        className="rounded-xl px-4 py-2.5 flex items-center gap-3"
        style={{ background: `${color}1A`, border: `1.5px solid ${color}55` }}
      >
        {/* Type pill */}
        <div
          className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
          style={{ backgroundColor: color, color: "#fff" }}
        >
          {label}
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${progress * 100}%`, backgroundColor: color }}
          />
        </div>

        {/* Countdown */}
        <div
          className="text-base font-black tabular-nums flex-shrink-0"
          style={{ color: isTracking ? color : "var(--text-secondary)" }}
        >
          {countdown}
        </div>
      </div>

      {/* Next interval hint */}
      <div className="flex justify-end mt-0.5 pr-1">
        <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
          Nächste: {nextInterval.label ?? (nextInterval.type === "work" ? "Belastung" : "Erholung")}
          {" "}({Math.floor(nextInterval.durationSec / 60)}:{String(nextInterval.durationSec % 60).padStart(2, "0")} min)
        </span>
      </div>
    </div>
  );
}

export default LiveCardioPage;
