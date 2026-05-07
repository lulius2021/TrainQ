// src/hooks/useGpsTracking.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import type { GpsPoint, CardioSessionState, LapEntry } from "../types/cardio";
import {
  checkLocationPermission,
  requestLocationPermission,
  watchPosition,
  clearWatch,
  type WatchCallbackId,
} from "../native/geolocation";
import { haversineDistance, computePace } from "../utils/gpsUtils";
import { saveGpsSession, loadGpsSession, clearGpsSession } from "../utils/gpsSessionPersistence";
import type { GpsSignalStrength } from "../components/cardio/GpsSignalIndicator";

const MAX_ACCURACY_M = 20;          // reject points with worse accuracy (after grace)
const INITIAL_ACCURACY_M = 100;    // accept coarse points for first 10s
const INITIAL_GRACE_MS = 10000;    // 10s grace period with relaxed accuracy
const GPS_SIGNAL_WEAK_M = 10;      // accuracy > this = "weak" signal
const MAX_SPEED_MS = 12;           // reject points > 12 m/s (43 km/h, unrealistic for running)
const AUTO_PAUSE_SPEED_MS = 0.5;   // below this → standing still
const AUTO_PAUSE_TIMEOUT_MS = 10000; // 10 s below threshold → auto-pause
const AUTO_RESUME_SPEED_MS = 1.0;  // above this after auto-pause → resume
const MIN_ELEVATION_GAIN_M = 2;
const PERSIST_INTERVAL_MS = 5000;  // Save every 5 seconds
const SMOOTHING_WINDOW = 3;        // 3-point moving average

/** Derive GPS signal quality from accuracy in meters. */
function deriveGpsSignal(accuracy: number | undefined): GpsSignalStrength {
  if (accuracy === undefined) return "searching";
  if (accuracy > INITIAL_ACCURACY_M) return "searching";
  if (accuracy > GPS_SIGNAL_WEAK_M) return "weak";
  return "good";
}

/** Apply 3-point moving average smoothing to a point based on its neighbours. */
function smoothedCoords(
  points: GpsPoint[],
  index: number,
): { lat: number; lng: number } {
  const half = Math.floor(SMOOTHING_WINDOW / 2);
  const start = Math.max(0, index - half);
  const end = Math.min(points.length, start + SMOOTHING_WINDOW);
  const window = points.slice(start, end);
  const lat = window.reduce((s, p) => s + p.lat, 0) / window.length;
  const lng = window.reduce((s, p) => s + p.lng, 0) / window.length;
  return { lat, lng };
}

export function useGpsTracking() {
  const [state, setState] = useState<CardioSessionState>({
    status: "idle",
    points: [],
    startedAt: 0,
    totalPausedMs: 0,
    distanceM: 0,
    elevationGainM: 0,
    currentPaceSecPerKm: undefined,
    laps: [],
  });

  const [gpsSignal, setGpsSignal] = useState<GpsSignalStrength>("searching");

  const watchIdRef            = useRef<WatchCallbackId | null>(null);
  const pointsRef             = useRef<GpsPoint[]>([]);
  const distanceRef           = useRef(0);
  const elevationRef          = useRef(0);
  const pausedAtRef           = useRef<number | undefined>(undefined);
  const totalPausedRef        = useRef(0);
  const startedAtRef          = useRef(0);
  const stoppedAtRef          = useRef<number | undefined>(undefined);
  const lapsRef               = useRef<LapEntry[]>([]);
  const permissionCacheRef    = useRef<boolean | null>(null);
  const stateStatusRef        = useRef<CardioSessionState["status"]>("idle");
  const persistTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredRef           = useRef(false);
  const slowSinceRef          = useRef<number | null>(null);    // auto-pause: timestamp when speed dropped below threshold
  const isAutoPausedRef       = useRef(false);

  const setStateWithRef = useCallback((next: CardioSessionState | ((prev: CardioSessionState) => CardioSessionState)) => {
    setState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      stateStatusRef.current = resolved.status;
      return resolved;
    });
  }, []);

  // Persist current GPS state to localStorage
  const persistState = useCallback(() => {
    const status = stateStatusRef.current;
    if (status !== "tracking" && status !== "paused") return;
    saveGpsSession({
      status: status as "tracking" | "paused",
      startedAt: startedAtRef.current,
      totalPausedMs: totalPausedRef.current,
      pausedAt: pausedAtRef.current,
      distanceM: distanceRef.current,
      elevationGainM: elevationRef.current,
      points: pointsRef.current,
      laps: lapsRef.current,
      lastSavedAt: Date.now(),
    });
  }, []);

  // Start periodic persistence
  const startPersistTimer = useCallback(() => {
    if (persistTimerRef.current) return;
    persistTimerRef.current = setInterval(persistState, PERSIST_INTERVAL_MS);
  }, [persistState]);

  const stopPersistTimer = useCallback(() => {
    if (persistTimerRef.current) {
      clearInterval(persistTimerRef.current);
      persistTimerRef.current = null;
    }
  }, []);

  const addPoint = useCallback((point: GpsPoint) => {
    // Update GPS signal strength on every incoming point (even rejected ones)
    setGpsSignal(deriveGpsSignal(point.accuracy));

    // Reject low-accuracy points — relaxed during initial grace period
    const elapsed = Date.now() - (startedAtRef.current || Date.now());
    const maxAcc = elapsed < INITIAL_GRACE_MS ? INITIAL_ACCURACY_M : MAX_ACCURACY_M;
    if (point.accuracy && point.accuracy > maxAcc) return;

    const prev = pointsRef.current;
    const lastPoint = prev[prev.length - 1];

    // Speed check between consecutive points
    let speedMs = 0;
    if (lastPoint) {
      const dt = (point.timestamp - lastPoint.timestamp) / 1000; // seconds
      if (dt > 0) {
        const dist = haversineDistance(lastPoint, point);
        speedMs = dist / dt;
        // Reject unrealistic speed (> 43 km/h)
        if (speedMs > MAX_SPEED_MS) return;
      }
    }

    // Auto-pause detection
    if (lastPoint) {
      if (speedMs < AUTO_PAUSE_SPEED_MS) {
        if (slowSinceRef.current === null) {
          slowSinceRef.current = point.timestamp;
        }
        const slowDuration = point.timestamp - slowSinceRef.current;
        if (slowDuration >= AUTO_PAUSE_TIMEOUT_MS && !isAutoPausedRef.current) {
          isAutoPausedRef.current = true;
          pausedAtRef.current = point.timestamp;
          setStateWithRef((p) => ({ ...p, status: "paused", pausedAt: point.timestamp }));
          persistState();
          return;
        }
      } else {
        slowSinceRef.current = null;
        // Auto-resume if we were auto-paused and speed picks up
        if (isAutoPausedRef.current && speedMs > AUTO_RESUME_SPEED_MS) {
          isAutoPausedRef.current = false;
          if (pausedAtRef.current) {
            totalPausedRef.current += point.timestamp - pausedAtRef.current;
            pausedAtRef.current = undefined;
          }
        }
      }
    }

    // If currently auto-paused, don't accumulate distance
    if (isAutoPausedRef.current) return;

    // Add point, then compute smoothed distance
    const newPoints = [...prev, point];
    const idx = newPoints.length - 1;

    // Smoothed coords for distance calculation (3-point moving average)
    let addedDistance = 0;
    if (idx >= 1) {
      const smoothedCurr = smoothedCoords(newPoints, idx);
      const smoothedPrev = smoothedCoords(newPoints, idx - 1);
      addedDistance = haversineDistance(
        { ...newPoints[idx - 1], ...smoothedPrev },
        { ...point, ...smoothedCurr },
      );
      // Reject teleport jumps
      if (addedDistance > 500 && prev.length > 1) return;
    }

    let addedElevation = 0;
    if (
      lastPoint &&
      typeof lastPoint.altitude === "number" &&
      typeof point.altitude === "number"
    ) {
      const diff = point.altitude - lastPoint.altitude;
      if (diff > MIN_ELEVATION_GAIN_M) addedElevation = diff;
    }

    pointsRef.current  = newPoints;
    distanceRef.current  += addedDistance;
    elevationRef.current += addedElevation;

    // Pace: use last 30 seconds for more responsive updates
    const now = point.timestamp;
    const recentPoints = newPoints.filter((p) => p.timestamp >= now - 30000);
    let recentDistance = 0;
    for (let i = 1; i < recentPoints.length; i++) {
      recentDistance += haversineDistance(recentPoints[i - 1], recentPoints[i]);
    }
    const recentDurationMs =
      recentPoints.length >= 2
        ? recentPoints[recentPoints.length - 1].timestamp - recentPoints[0].timestamp
        : 0;
    const pace = computePace(recentDistance, recentDurationMs);

    setStateWithRef({
      status: "tracking",
      points: newPoints,
      startedAt: startedAtRef.current,
      totalPausedMs: totalPausedRef.current,
      distanceM: distanceRef.current,
      elevationGainM: elevationRef.current,
      currentPaceSecPerKm: pace,
      laps: lapsRef.current,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startTracking = useCallback(async () => {
    const granted = permissionCacheRef.current ?? await requestLocationPermission();
    if (!granted) return false;

    const now = Date.now();
    startedAtRef.current    = now;
    pointsRef.current       = [];
    distanceRef.current     = 0;
    elevationRef.current    = 0;
    totalPausedRef.current  = 0;
    pausedAtRef.current     = undefined;
    stoppedAtRef.current    = undefined;
    lapsRef.current         = [];
    slowSinceRef.current    = null;
    isAutoPausedRef.current = false;

    setStateWithRef({
      status: "tracking",
      points: [],
      startedAt: now,
      totalPausedMs: 0,
      distanceM: 0,
      elevationGainM: 0,
      currentPaceSecPerKm: undefined,
      laps: [],
    });

    watchPosition(addPoint).then((id) => {
      watchIdRef.current = id;
    }).catch((err) => { if (import.meta.env.DEV) console.error("[GPS] watchPosition failed:", err); });

    startPersistTimer();
    return true;
  }, [addPoint, startPersistTimer]);

  const pauseTracking = useCallback(() => {
    if (watchIdRef.current) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    pausedAtRef.current = Date.now();
    slowSinceRef.current = null;
    isAutoPausedRef.current = false;
    setStateWithRef((prev) => ({ ...prev, status: "paused", pausedAt: Date.now() }));
    persistState(); // Save immediately on pause
  }, [persistState]);

  const resumeTracking = useCallback(async () => {
    if (pausedAtRef.current) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = undefined;
    }
    slowSinceRef.current = null;
    isAutoPausedRef.current = false;
    watchPosition(addPoint).then((id) => {
      watchIdRef.current = id;
    }).catch((err) => { if (import.meta.env.DEV) console.error("[GPS] watchPosition failed:", err); });
    setStateWithRef((prev) => ({
      ...prev,
      status: "tracking",
      pausedAt: undefined,
      totalPausedMs: totalPausedRef.current,
    }));
    startPersistTimer();
  }, [addPoint, startPersistTimer]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pausedAtRef.current) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = undefined;
    }
    stoppedAtRef.current = Date.now();
    stopPersistTimer();
    clearGpsSession(); // Clean up persisted state
    setStateWithRef((prev) => ({
      ...prev,
      status: "stopped",
      totalPausedMs: totalPausedRef.current,
    }));
  }, [stopPersistTimer]);

  const addLap = useCallback(() => {
    const elapsedMs = getElapsedMsNow();
    const newLap: LapEntry = {
      number: lapsRef.current.length + 1,
      distanceM: distanceRef.current,
      elapsedMs,
    };
    lapsRef.current = [...lapsRef.current, newLap];
    setStateWithRef((prev) => ({ ...prev, laps: lapsRef.current }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore session from localStorage on mount (app was killed and restarted)
  useEffect(() => {
    checkLocationPermission().then((granted) => {
      permissionCacheRef.current = granted;
    });

    // Try to restore a persisted GPS session
    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = loadGpsSession();
      if (saved) {
        // Restore all refs
        startedAtRef.current = saved.startedAt;
        pointsRef.current = saved.points;
        distanceRef.current = saved.distanceM;
        elevationRef.current = saved.elevationGainM;
        lapsRef.current = saved.laps;
        totalPausedRef.current = saved.totalPausedMs;

        if (saved.status === "paused") {
          pausedAtRef.current = saved.pausedAt ?? Date.now();
          setStateWithRef({
            status: "paused",
            points: saved.points,
            startedAt: saved.startedAt,
            totalPausedMs: saved.totalPausedMs,
            distanceM: saved.distanceM,
            elevationGainM: saved.elevationGainM,
            currentPaceSecPerKm: undefined,
            laps: saved.laps,
          });
        } else {
          // Was tracking — add paused time since last save and resume GPS
          const pausedSinceKill = Date.now() - saved.lastSavedAt;
          totalPausedRef.current += pausedSinceKill;

          setStateWithRef({
            status: "tracking",
            points: saved.points,
            startedAt: saved.startedAt,
            totalPausedMs: totalPausedRef.current,
            distanceM: saved.distanceM,
            elevationGainM: saved.elevationGainM,
            currentPaceSecPerKm: undefined,
            laps: saved.laps,
          });

          // Restart GPS watch
          watchPosition(addPoint).then((id) => {
            watchIdRef.current = id;
          }).catch((err) => { if (import.meta.env.DEV) console.error("[GPS] watchPosition failed:", err); });
          startPersistTimer();
        }
      }
    }

    return () => {
      if (watchIdRef.current) clearWatch(watchIdRef.current);
      stopPersistTimer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // App state change listener — restart GPS if killed in background
  useEffect(() => {
    let listener: Awaited<ReturnType<typeof App.addListener>> | null = null;

    App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        // Going to background — persist immediately
        persistState();
        return;
      }

      // App just became active — check if we were tracking but watch is gone
      const statusRef = stateStatusRef.current;
      if (statusRef === "tracking" && !watchIdRef.current) {
        watchPosition(addPoint).then((id) => {
          watchIdRef.current = id;
        }).catch((err) => { if (import.meta.env.DEV) console.error("[GPS] watchPosition failed:", err); });
      }
    }).then((h) => { listener = h; });

    return () => { listener?.remove(); };
  }, [addPoint, persistState]);

  function getElapsedMsNow(): number {
    if (startedAtRef.current === 0) return 0;
    const now =
      stoppedAtRef.current ??
      (pausedAtRef.current ?? Date.now());
    return Math.max(0, now - startedAtRef.current - totalPausedRef.current);
  }

  const getElapsedMs = useCallback((): number => {
    return getElapsedMsNow();
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state,
    gpsSignal,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    addLap,
    getElapsedMs,
  };
}
