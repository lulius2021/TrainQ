import React, { useCallback, useEffect, useRef, useState } from "react";
import type { LiveExercise, LiveSet, LiveWorkout } from "../../types/training";
import type { GPSTrackingData } from "../../hooks/useGPSTracking";
import RouteSVG from "./RouteSVG";

// ─── Types ────────────────────────────────────────────────────────────────────

type Segment = {
  exerciseId: string;
  exerciseName: string;
  setId: string;
  setIndex: number;       // index within the exercise
  totalSets: number;      // total sets in this exercise
  exerciseIndex: number;  // index of exercise in workout
  totalExercises: number;
  targetMinutes: number | null;
  targetKm: number | null;
  targetPaceMinPerKm: number | null; // derived: targetMinutes / targetKm
  restSecondsAfter: number | null;   // rest time after this segment
};

function buildSegments(exercises: LiveExercise[]): Segment[] {
  const out: Segment[] = [];
  for (let ei = 0; ei < exercises.length; ei++) {
    const ex = exercises[ei];
    const sets = ex.sets ?? [];
    for (let si = 0; si < sets.length; si++) {
      const s = sets[si];
      const tMin = typeof s.reps === "number" && s.reps > 0 ? s.reps : null;
      const tKm = typeof s.weight === "number" && s.weight > 0 ? s.weight : null;
      const tPace = tMin != null && tKm != null ? tMin / tKm : null;
      // Rest applies between sets within an exercise (not after last set)
      const isLastInExercise = si === sets.length - 1;
      out.push({
        exerciseId: ex.id,
        exerciseName: ex.name || "Abschnitt",
        setId: s.id,
        setIndex: si,
        totalSets: sets.length,
        exerciseIndex: ei,
        totalExercises: exercises.length,
        targetMinutes: tMin,
        targetKm: tKm,
        targetPaceMinPerKm: tPace,
        restSecondsAfter: !isLastInExercise && ex.restSeconds ? ex.restSeconds : null,
      });
    }
  }
  return out;
}

function formatPaceDisplay(minPerKm: number): string {
  // Round total seconds first to avoid the "X:60" overflow at boundaries
  // (e.g. 4.999 → floor=4, round((0.999)*60)=60 → "4:60").
  const totalSec = Math.round(minPerKm * 60);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

// ─── Pace gauge ───────────────────────────────────────────────────────────────

type PaceZone = "fast" | "target" | "slow" | "unknown";

function getPaceZone(currentMinPerKm: number, targetMinPerKm: number): PaceZone {
  // Higher min/km = slower. Target is a window of ±8%.
  const ratio = currentMinPerKm / targetMinPerKm;
  if (ratio < 0.92) return "fast";   // more than 8% faster than target
  if (ratio > 1.08) return "slow";   // more than 8% slower than target
  return "target";
}

const ZONE_COLORS: Record<PaceZone, { bg: string; text: string; label: string }> = {
  target: { bg: "bg-green-500/15 border-green-500/30", text: "text-green-400", label: "Perfektes Tempo" },
  slow:   { bg: "bg-red-500/15 border-red-500/30",     text: "text-red-400",   label: "Zu langsam" },
  fast:   { bg: "bg-orange-500/15 border-orange-500/30", text: "text-orange-400", label: "Zu schnell" },
  unknown: { bg: "bg-white/5 border-white/10",           text: "text-white",     label: "—" },
};

function PaceGauge({
  currentPaceMinPerKm,
  targetPaceMinPerKm,
  sport,
}: {
  currentPaceMinPerKm: string | null;
  targetPaceMinPerKm: number | null;
  sport: "Laufen" | "Radfahren";
}) {
  const currentNum = currentPaceMinPerKm
    ? (() => {
        const [m, s] = currentPaceMinPerKm.split(":").map(Number);
        return m + s / 60;
      })()
    : null;

  const zone: PaceZone =
    currentNum != null && targetPaceMinPerKm != null
      ? getPaceZone(currentNum, targetPaceMinPerKm)
      : "unknown";

  const { bg, text, label } = ZONE_COLORS[zone];

  const deviationSec =
    currentNum != null && targetPaceMinPerKm != null
      ? Math.round((currentNum - targetPaceMinPerKm) * 60)
      : null;

  return (
    <div className={`rounded-2xl border px-4 py-4 ${bg}`}>
      <div className="flex items-start justify-between mb-1">
        <span className="text-xs text-white/40 uppercase tracking-widest">
          {sport === "Laufen" ? "Pace" : "Tempo"}
        </span>
        {targetPaceMinPerKm != null && (
          <span className="text-xs text-white/40">
            Ziel: {formatPaceDisplay(targetPaceMinPerKm)} /km
          </span>
        )}
      </div>

      {/* Current pace — hero number */}
      <div className={`tabular-nums text-6xl font-bold leading-none tracking-tight ${text}`}>
        {currentPaceMinPerKm ?? "–:––"}
      </div>
      <div className="text-sm text-white/40 mt-1">min/km</div>

      {/* Zone label + deviation */}
      <div className="mt-2 flex items-center gap-2">
        <span className={`text-sm font-semibold ${text}`}>{label}</span>
        {deviationSec != null && zone !== "unknown" && (
          <span className="text-xs text-white/40">
            ({deviationSec > 0 ? "+" : ""}{deviationSec}s/km)
          </span>
        )}
      </div>

      {/* Visual zone bar */}
      {targetPaceMinPerKm != null && (
        <div className="mt-3 relative h-2 rounded-full bg-white/10 overflow-hidden">
          {/* Green zone: center ±8% */}
          <div
            className="absolute inset-y-0 bg-green-500/40 rounded-full"
            style={{ left: "37%", right: "37%" }}
          />
          {/* Current position marker */}
          {currentNum != null && (
            <div
              className={`absolute inset-y-0 w-1 rounded-full ${text.replace("text-", "bg-")}`}
              style={{
                left: `${Math.min(95, Math.max(5, 50 + (currentNum - targetPaceMinPerKm) / targetPaceMinPerKm * 200))}%`,
                transition: "left 1s ease-out",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, target, unit }: { current: number; target: number; unit: string }) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-white/40">
        <span>{current.toFixed(current >= 10 ? 1 : 2)} {unit}</span>
        <span>{(target - current).toFixed(current >= 10 ? 1 : 2)} {unit} noch</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-white/25">{target.toFixed(target >= 10 ? 1 : 2)} {unit} gesamt</div>
    </div>
  );
}

// ─── Signal badge ─────────────────────────────────────────────────────────────

function SignalBadge({ status, accuracyM }: { status: GPSTrackingData["status"]; accuracyM: number | null }) {
  if (status === "requesting" || status === "searching") {
    return <span className="text-xs text-yellow-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />GPS…</span>;
  }
  if (status === "denied" || status === "error") {
    return <span className="text-xs text-red-400">GPS ✕</span>;
  }
  if (status === "active") {
    const color = !accuracyM ? "bg-gray-400" : accuracyM <= 10 ? "bg-green-400" : accuracyM <= 25 ? "bg-yellow-400" : "bg-orange-400";
    return <span className="text-xs text-white/40 flex items-center gap-1"><span className={`w-1.5 h-1.5 rounded-full ${color}`} />{accuracyM ? `±${Math.round(accuracyM)}m` : "GPS"}</span>;
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  workout: LiveWorkout;
  gps: GPSTrackingData;
  elapsedSec: number;
  onFinish: () => void;
  onMinimize: () => void;
  onAbort: () => void;
  onCompleteSet: (exerciseId: string, setId: string) => void;
};

export default function StructuredCardioView({
  workout,
  gps,
  elapsedSec,
  onFinish,
  onMinimize,
  onAbort,
  onCompleteSet,
}: Props) {
  const sport = workout.sport as "Laufen" | "Radfahren";
  const segments = buildSegments(workout.exercises ?? []);

  // Find first incomplete segment
  const currentSegIdx = (() => {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const ex = (workout.exercises ?? []).find((e) => e.id === seg.exerciseId);
      const set = (ex?.sets ?? []).find((s) => s.id === seg.setId);
      if (set && !set.completed) return i;
    }
    return segments.length; // all done
  })();

  const allDone = currentSegIdx >= segments.length;
  const seg = allDone ? null : segments[currentSegIdx];

  // Track start time and GPS km for the current segment phase
  const segPhaseStartRef = useRef({ time: Date.now(), gpsKm: gps.distanceKm });
  const prevSegIdxRef = useRef(currentSegIdx);

  // Reset phase start when segment changes
  useEffect(() => {
    if (prevSegIdxRef.current !== currentSegIdx) {
      segPhaseStartRef.current = { time: Date.now(), gpsKm: gps.distanceKm };
      prevSegIdxRef.current = currentSegIdx;
    }
  }, [currentSegIdx, gps.distanceKm]);

  // Rest timer
  const [resting, setResting] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const restStartRef = useRef<number | null>(null);
  // Capture the rest duration at the moment rest starts so the countdown effect
  // doesn't read from a potentially-changed seg.restSecondsAfter.
  const restDurationRef = useRef(0);

  // Auto-advance countdown (3s before moving to next segment)
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  // When user explicitly cancels auto-advance, suppress re-triggering until
  // the segment actually advances (i.e. segTargetReached resets).
  const autoAdvanceSuppressedRef = useRef(false);

  const phaseElapsedSec = (Date.now() - segPhaseStartRef.current.time) / 1000;
  const segGpsKm = gps.distanceKm - segPhaseStartRef.current.gpsKm;

  // Check if current segment target is reached
  const segTimeReached = seg?.targetMinutes != null && phaseElapsedSec >= seg.targetMinutes * 60;
  const segDistReached = seg?.targetKm != null && segGpsKm >= seg.targetKm;
  const segTargetReached = (seg?.targetMinutes != null || seg?.targetKm != null) &&
    (segTimeReached || segDistReached);

  const advanceSegment = useCallback(() => {
    if (!seg) return;
    autoAdvanceSuppressedRef.current = false;
    setAutoCountdown(null);

    // Start rest timer if this segment has rest after it
    if (seg.restSecondsAfter && seg.restSecondsAfter > 0) {
      restDurationRef.current = seg.restSecondsAfter;
      setResting(true);
      setRestRemaining(seg.restSecondsAfter);
      restStartRef.current = Date.now();
    }

    onCompleteSet(seg.exerciseId, seg.setId);
  }, [seg, onCompleteSet]);

  // Auto-advance: start 3s countdown when target reached.
  // Guard with suppression ref so cancelling doesn't re-trigger immediately.
  useEffect(() => {
    if (!segTargetReached || resting || autoCountdown !== null || autoAdvanceSuppressedRef.current) return;
    setAutoCountdown(3);
  }, [segTargetReached, resting, autoCountdown]);

  // When segment index changes, unsuppress so a fresh segment can auto-advance.
  useEffect(() => {
    autoAdvanceSuppressedRef.current = false;
  }, [currentSegIdx]);

  // Countdown tick
  useEffect(() => {
    if (autoCountdown === null) return;
    if (autoCountdown <= 0) {
      advanceSegment();
      return;
    }
    const t = setTimeout(() => setAutoCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [autoCountdown, advanceSegment]);

  // Rest countdown tick — only depends on `resting` so we don't create
  // multiple overlapping intervals when restRemaining state updates.
  useEffect(() => {
    if (!resting) return;
    const t = setInterval(() => {
      if (!restStartRef.current) return;
      const elapsed = (Date.now() - restStartRef.current) / 1000;
      const rem = restDurationRef.current - elapsed;
      if (rem <= 0) {
        setResting(false);
        setRestRemaining(0);
        restStartRef.current = null;
        clearInterval(t);
      } else {
        setRestRemaining(rem);
      }
    }, 500);
    return () => clearInterval(t);
  }, [resting]);

  // Countdown timer displays
  const segTimeRemainingStr = seg?.targetMinutes != null
    ? formatCountdown(Math.max(0, seg.targetMinutes * 60 - phaseElapsedSec))
    : null;
  const segDistRemainingKm = seg?.targetKm != null ? Math.max(0, seg.targetKm - segGpsKm) : null;

  // Total workout totals
  const totalTargetKm = segments.reduce((s, g) => s + (g.targetKm ?? 0), 0);
  const totalTargetMin = segments.reduce((s, g) => s + (g.targetMinutes ?? 0), 0);

  const hasRoute = gps.trackPoints.length >= 2;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full w-full overflow-y-auto"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
        <div>
          <span className="text-xs text-white/40 uppercase tracking-widest">
            {sport === "Laufen" ? "Laufen" : "Radfahren"}
          </span>
          <div className="text-sm font-semibold text-white/70 leading-tight mt-0.5 truncate max-w-[200px]">
            {workout.title}
          </div>
        </div>
        <SignalBadge status={gps.status} accuracyM={gps.accuracyM} />
      </div>

      {/* ── REST PHASE ─────────────────────────────────────────────────── */}
      {resting && (
        <div className="mx-4 mb-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-5 text-center shrink-0">
          <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Erholung</div>
          <div className="tabular-nums text-5xl font-bold text-blue-400">{formatCountdown(restRemaining)}</div>
          <button
            type="button"
            onClick={() => { setResting(false); setRestRemaining(0); restStartRef.current = null; }}
            className="mt-3 text-xs text-white/40 underline"
          >
            Überspringen
          </button>
        </div>
      )}

      {/* ── SEGMENT HEADER ─────────────────────────────────────────────── */}
      {!resting && seg && (
        <div className="mx-4 mb-3 flex items-center justify-between shrink-0">
          <div>
            <div className="text-base font-semibold text-white leading-tight">{seg.exerciseName}</div>
            <div className="text-xs text-white/40 mt-0.5">
              {seg.totalSets > 1
                ? `Abschnitt ${seg.setIndex + 1} von ${seg.totalSets}`
                : seg.totalExercises > 1
                ? `${seg.exerciseIndex + 1} von ${seg.totalExercises}`
                : "Aktueller Abschnitt"}
            </div>
          </div>
          {/* Overall progress dots */}
          {segments.length > 1 && segments.length <= 10 && (
            <div className="flex gap-1">
              {segments.map((s, i) => {
                const ex = (workout.exercises ?? []).find((e) => e.id === s.exerciseId);
                const set = (ex?.sets ?? []).find((st) => st.id === s.setId);
                const done = set?.completed;
                const current = i === currentSegIdx;
                return (
                  <div
                    key={s.setId}
                    className={`w-2 h-2 rounded-full transition-all ${
                      done ? "bg-green-400" : current ? "bg-blue-400 scale-125" : "bg-white/20"
                    }`}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ALL DONE ───────────────────────────────────────────────────── */}
      {allDone && !resting && (
        <div className="mx-4 mb-3 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-5 text-center shrink-0">
          <div className="text-2xl font-bold text-green-400">Training abgeschlossen!</div>
          <div className="text-sm text-white/50 mt-1">
            {gps.distanceKm.toFixed(2)} km • {Math.floor(elapsedSec / 60)} min
          </div>
        </div>
      )}

      {/* ── PACE GAUGE ─────────────────────────────────────────────────── */}
      {!resting && seg && (
        <div className="mx-4 mb-3 shrink-0">
          <PaceGauge
            currentPaceMinPerKm={gps.paceMinPerKm}
            targetPaceMinPerKm={seg.targetPaceMinPerKm}
            sport={sport}
          />
        </div>
      )}

      {/* ── SEGMENT COUNTDOWNS ─────────────────────────────────────────── */}
      {!resting && seg && (
        <div className="mx-4 mb-3 grid grid-cols-2 gap-3 shrink-0">
          {/* Distance */}
          {seg.targetKm != null ? (
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/40 mb-1">Distanz</div>
              <div className="tabular-nums text-2xl font-bold text-white">
                {segDistRemainingKm != null ? segDistRemainingKm.toFixed(2) : segGpsKm.toFixed(2)}
              </div>
              <div className="text-xs text-white/30">
                {segDistRemainingKm != null ? "km noch" : "km"}
              </div>
              {seg.targetKm > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, (segGpsKm / seg.targetKm) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/40 mb-1">GPS Distanz</div>
              <div className="tabular-nums text-2xl font-bold text-white">{segGpsKm.toFixed(2)}</div>
              <div className="text-xs text-white/30">km</div>
            </div>
          )}

          {/* Time */}
          {seg.targetMinutes != null ? (
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/40 mb-1">Zeit</div>
              <div className={`tabular-nums text-2xl font-bold ${segTimeReached ? "text-green-400" : "text-white"}`}>
                {segTimeRemainingStr}
              </div>
              <div className="text-xs text-white/30">noch</div>
              {seg.targetMinutes > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, (phaseElapsedSec / (seg.targetMinutes * 60)) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/40 mb-1">Gesamt Zeit</div>
              <div className="tabular-nums text-2xl font-bold text-white">{formatCountdown(elapsedSec)}</div>
              <div className="text-xs text-white/30">elapsed</div>
            </div>
          )}
        </div>
      )}

      {/* Total workout progress (if > 1 segment) */}
      {segments.length > 1 && (totalTargetKm > 0 || totalTargetMin > 0) && (
        <div className="mx-4 mb-3 space-y-2 shrink-0">
          {totalTargetKm > 0 && (
            <ProgressBar current={gps.distanceKm} target={totalTargetKm} unit="km" />
          )}
          {totalTargetMin > 0 && (
            <ProgressBar current={elapsedSec / 60} target={totalTargetMin} unit="min" />
          )}
        </div>
      )}

      {/* ── AUTO-ADVANCE BANNER ─────────────────────────────────────────── */}
      {autoCountdown != null && !resting && (
        <div className="mx-4 mb-3 rounded-2xl border border-green-500/40 bg-green-500/15 px-4 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-semibold text-green-400">
            Ziel erreicht! Weiter in {autoCountdown}s…
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={advanceSegment} className="text-xs bg-green-500/30 text-green-300 rounded-lg px-3 py-1.5 font-semibold">
              Jetzt
            </button>
            <button type="button" onClick={() => { autoAdvanceSuppressedRef.current = true; setAutoCountdown(null); }} className="text-xs text-white/40 underline">
              Abbruch
            </button>
          </div>
        </div>
      )}

      {/* ── GPS ROUTE ──────────────────────────────────────────────────── */}
      <div className="mx-4 mb-3 shrink-0">
        {hasRoute ? (
          <div className="rounded-2xl border border-white/8 bg-white/3 p-2">
            <RouteSVG points={gps.trackPoints} height={110} showLiveDot />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/3 h-[70px] flex items-center justify-center">
            <span className="text-xs text-white/20">Route erscheint wenn du dich bewegst</span>
          </div>
        )}
      </div>

      {/* ── CONTROLS ───────────────────────────────────────────────────── */}
      <div className="mx-4 pb-3 space-y-2 shrink-0">
        {/* Manual advance — only when there's a next segment */}
        {!resting && !allDone && seg && (
          <button
            type="button"
            onClick={advanceSegment}
            className="w-full h-11 rounded-xl border border-white/10 bg-white/8 text-sm font-semibold text-white hover:bg-white/15"
          >
            ✓ Abschnitt abschließen
          </button>
        )}

        <button
          type="button"
          onClick={onFinish}
          className="w-full h-14 rounded-2xl bg-[#2563EB] text-white text-base font-bold shadow-[0_0_20px_theme(colors.blue.600/30%)] hover:bg-blue-500"
        >
          Training beenden
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onMinimize} className="h-11 rounded-xl border border-white/10 bg-white/8 text-sm font-semibold text-white hover:bg-white/15">
            Minimieren
          </button>
          <button type="button" onClick={onAbort} className="h-11 rounded-xl border border-white/10 bg-white/8 text-sm text-white/60 hover:bg-white/15">
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
