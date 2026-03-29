// src/pages/training/LiveCardioPage.tsx
// Strava-style live GPS tracking for Laufen / Radfahren

import React, { useEffect, useRef, useState } from "react";
import {
  MapPin, Pause, Play, Square, Flag, ChevronDown, Minus,
} from "lucide-react";
import { useGpsTracking } from "../../hooks/useGpsTracking";
import CardioMap from "../../components/cardio/CardioMap";
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
import type { GpsPoint, LapEntry } from "../../types/cardio";

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

  // Auto-start GPS
  useEffect(() => {
    startTracking().then((ok) => { if (!ok) setPermissionDenied(true); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const km           = gps.distanceM / 1000;
    const durationSec  = elapsedSec;
    const paceSecPerKm = km > 0 && durationSec > 0 ? durationSec / km : undefined;
    const sampled      = gps.points.length > 0
      ? downsampleGpsPoints(gps.points, 200) : undefined;

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
      } as any,
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
          style={{
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

            {/* Pause / Resume — big orange */}
            <CircleButton
              onPress={handlePauseResume}
              size={72}
              color={accentColor}
              shadow="0 0 28px rgba(37,99,235,0.5)"
            >
              {isPaused
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

export default LiveCardioPage;
