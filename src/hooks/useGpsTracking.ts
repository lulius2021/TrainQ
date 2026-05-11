// src/hooks/useGpsTracking.ts
// Robust GPS tracking hook with auto-reconnect, watchdog, and proper cleanup

import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import type { GpsPoint, CardioSessionState, LapEntry } from "../types/cardio";
import {
  checkLocationPermission,
  requestLocationPermission,
  GpsWatcher,
} from "../native/geolocation";
import { haversineDistance, computePace } from "../utils/gpsUtils";
import { saveGpsSession, loadGpsSession, clearGpsSession } from "../utils/gpsSessionPersistence";
import type { GpsSignalStrength } from "../components/cardio/GpsSignalIndicator";

// --------------- Constants ---------------

const MAX_ACCURACY_M = 25;            // reject points with worse accuracy (after grace)
const INITIAL_ACCURACY_M = 100;       // accept coarse points for first 15s
const INITIAL_GRACE_MS = 15000;       // 15s grace period with relaxed accuracy
const GPS_SIGNAL_WEAK_M = 15;         // accuracy > this = "weak" signal
const MAX_SPEED_MS = 15;              // reject > 54 km/h (covers fast cycling)
const AUTO_PAUSE_SPEED_MS = 0.3;      // below this → standing still
const AUTO_PAUSE_TIMEOUT_MS = 8000;   // 8s below threshold → auto-pause
const AUTO_RESUME_SPEED_MS = 0.8;     // above this after auto-pause → resume
const MIN_ELEVATION_CHANGE_M = 3;     // ignore altitude noise below this
const PERSIST_INTERVAL_MS = 5000;     // save every 5 seconds
const SMOOTHING_WINDOW = 3;           // 3-point moving average
const MAX_POINT_GAP_MS = 30000;       // if gap > 30s, don't compute distance for that segment
const SIGNAL_LOST_TIMEOUT_MS = 10000; // mark signal as "searching" after 10s silence

// --------------- Helpers ---------------

function deriveGpsSignal(accuracy: number | undefined): GpsSignalStrength {
  if (accuracy === undefined) return "searching";
  if (accuracy > INITIAL_ACCURACY_M) return "searching";
  if (accuracy > GPS_SIGNAL_WEAK_M) return "weak";
  return "good";
}

function smoothedCoords(
  points: GpsPoint[],
  index: number,
): { lat: number; lng: number } {
  const half = Math.floor(SMOOTHING_WINDOW / 2);
  const start = Math.max(0, index - half);
  const end = Math.min(points.length, start + SMOOTHING_WINDOW);
  const win = points.slice(start, end);
  const lat = win.reduce((s, p) => s + p.lat, 0) / win.length;
  const lng = win.reduce((s, p) => s + p.lng, 0) / win.length;
  return { lat, lng };
}

// --------------- Hook ---------------

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

  // Refs for mutable tracking state (avoid re-render on every GPS tick)
  const watcherRef             = useRef<GpsWatcher | null>(null);
  const pointsRef              = useRef<GpsPoint[]>([]);
  const distanceRef            = useRef(0);
  const elevationRef           = useRef(0);
  const pausedAtRef            = useRef<number | undefined>(undefined);
  const totalPausedRef         = useRef(0);
  const startedAtRef           = useRef(0);
  const stoppedAtRef           = useRef<number | undefined>(undefined);
  const lapsRef                = useRef<LapEntry[]>([]);
  const permissionCacheRef     = useRef<boolean | null>(null);
  const stateStatusRef         = useRef<CardioSessionState["status"]>("idle");
  const persistTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const restoredRef            = useRef(false);
  const slowSinceRef           = useRef<number | null>(null);
  const isAutoPausedRef        = useRef(false);
  const signalLostTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStateWithRef = useCallback((next: CardioSessionState | ((prev: CardioSessionState) => CardioSessionState)) => {
    setState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      stateStatusRef.current = resolved.status;
      return resolved;
    });
  }, []);

  // --------------- Persistence ---------------

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

  // --------------- Signal lost timer ---------------

  const resetSignalLostTimer = useCallback(() => {
    if (signalLostTimerRef.current) {
      clearTimeout(signalLostTimerRef.current);
    }
    signalLostTimerRef.current = setTimeout(() => {
      // No point received for a while — show searching state
      if (stateStatusRef.current === "tracking") {
        setGpsSignal("searching");
      }
    }, SIGNAL_LOST_TIMEOUT_MS);
  }, []);

  const clearSignalLostTimer = useCallback(() => {
    if (signalLostTimerRef.current) {
      clearTimeout(signalLostTimerRef.current);
      signalLostTimerRef.current = null;
    }
  }, []);

  // --------------- Point processing ---------------

  const addPoint = useCallback((point: GpsPoint) => {
    // Always update signal strength (even for rejected points)
    setGpsSignal(deriveGpsSignal(point.accuracy));
    resetSignalLostTimer();

    // Don't process points while paused (manual or auto)
    if (stateStatusRef.current === "paused" && !isAutoPausedRef.current) return;

    // Reject low-accuracy points (relaxed during initial grace period)
    const elapsed = Date.now() - (startedAtRef.current || Date.now());
    const maxAcc = elapsed < INITIAL_GRACE_MS ? INITIAL_ACCURACY_M : MAX_ACCURACY_M;
    if (point.accuracy && point.accuracy > maxAcc) return;

    const prev = pointsRef.current;
    const lastPoint = prev[prev.length - 1];

    // Speed validation
    let speedMs = point.speed ?? 0; // prefer GPS-chip speed
    if (lastPoint) {
      const dt = (point.timestamp - lastPoint.timestamp) / 1000;
      if (dt > 0) {
        const dist = haversineDistance(lastPoint, point);
        const computedSpeed = dist / dt;

        // Use GPS chip speed if available, otherwise computed
        if (speedMs <= 0) speedMs = computedSpeed;

        // Reject unrealistic speed
        if (computedSpeed > MAX_SPEED_MS) return;
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
        // Auto-resume: speed picked back up
        if (isAutoPausedRef.current && speedMs > AUTO_RESUME_SPEED_MS) {
          isAutoPausedRef.current = false;
          if (pausedAtRef.current) {
            totalPausedRef.current += point.timestamp - pausedAtRef.current;
            pausedAtRef.current = undefined;
          }
          setStateWithRef((p) => ({
            ...p,
            status: "tracking",
            pausedAt: undefined,
            totalPausedMs: totalPausedRef.current,
          }));
        }
      }
    }

    // If auto-paused, don't accumulate distance
    if (isAutoPausedRef.current) return;

    // Add point and compute smoothed distance
    const newPoints = [...prev, point];
    const idx = newPoints.length - 1;

    let addedDistance = 0;
    if (idx >= 1) {
      const dt = point.timestamp - newPoints[idx - 1].timestamp;

      // Skip distance if there's a large time gap (app was suspended)
      if (dt <= MAX_POINT_GAP_MS) {
        const smoothedCurr = smoothedCoords(newPoints, idx);
        const smoothedPrev = smoothedCoords(newPoints, idx - 1);
        addedDistance = haversineDistance(
          { ...newPoints[idx - 1], ...smoothedPrev },
          { ...point, ...smoothedCurr },
        );
        // Reject teleport jumps (> 500m in one tick)
        if (addedDistance > 500) return;
      }
    }

    // Elevation gain (with noise filter)
    let addedElevation = 0;
    if (
      lastPoint &&
      typeof lastPoint.altitude === "number" &&
      typeof point.altitude === "number"
    ) {
      const diff = point.altitude - lastPoint.altitude;
      if (diff > MIN_ELEVATION_CHANGE_M) addedElevation = diff;
    }

    pointsRef.current = newPoints;
    distanceRef.current += addedDistance;
    elevationRef.current += addedElevation;

    // Pace: rolling 30s window for responsive updates
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
  }, [setStateWithRef, persistState, resetSignalLostTimer]);

  // --------------- GPS Watcher management ---------------

  const createWatcher = useCallback((): GpsWatcher => {
    const watcher = new GpsWatcher({
      onPoint: addPoint,
      onError: (err) => {
        if (import.meta.env.DEV) console.warn("[GPS] Watch error:", err);
      },
      onSignalLost: () => {
        setGpsSignal("searching");
      },
      onReconnected: () => {
        if (import.meta.env.DEV) console.log("[GPS] Reconnected successfully");
      },
    });
    return watcher;
  }, [addPoint]);

  const destroyWatcher = useCallback(async () => {
    if (watcherRef.current) {
      await watcherRef.current.destroy();
      watcherRef.current = null;
    }
  }, []);

  // --------------- Public API ---------------

  const startTracking = useCallback(async () => {
    const granted = permissionCacheRef.current ?? await requestLocationPermission();
    permissionCacheRef.current = granted;
    if (!granted) return false;

    // Clean up any existing watcher
    await destroyWatcher();

    const now = Date.now();
    startedAtRef.current = now;
    pointsRef.current = [];
    distanceRef.current = 0;
    elevationRef.current = 0;
    totalPausedRef.current = 0;
    pausedAtRef.current = undefined;
    stoppedAtRef.current = undefined;
    lapsRef.current = [];
    slowSinceRef.current = null;
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

    setGpsSignal("searching");

    const watcher = createWatcher();
    watcherRef.current = watcher;
    await watcher.start();

    startPersistTimer();
    resetSignalLostTimer();
    return true;
  }, [createWatcher, destroyWatcher, setStateWithRef, startPersistTimer, resetSignalLostTimer]);

  const pauseTracking = useCallback(async () => {
    await destroyWatcher();
    clearSignalLostTimer();

    pausedAtRef.current = Date.now();
    slowSinceRef.current = null;
    isAutoPausedRef.current = false;

    setStateWithRef((prev) => ({ ...prev, status: "paused", pausedAt: Date.now() }));
    persistState();
  }, [destroyWatcher, clearSignalLostTimer, setStateWithRef, persistState]);

  const resumeTracking = useCallback(async () => {
    if (pausedAtRef.current) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = undefined;
    }
    slowSinceRef.current = null;
    isAutoPausedRef.current = false;

    // Clean up and create fresh watcher
    await destroyWatcher();

    const watcher = createWatcher();
    watcherRef.current = watcher;
    await watcher.start();

    setStateWithRef((prev) => ({
      ...prev,
      status: "tracking",
      pausedAt: undefined,
      totalPausedMs: totalPausedRef.current,
    }));

    startPersistTimer();
    resetSignalLostTimer();
  }, [createWatcher, destroyWatcher, setStateWithRef, startPersistTimer, resetSignalLostTimer]);

  const stopTracking = useCallback(async () => {
    await destroyWatcher();
    clearSignalLostTimer();

    if (pausedAtRef.current) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = undefined;
    }
    stoppedAtRef.current = Date.now();

    stopPersistTimer();
    clearGpsSession();

    setStateWithRef((prev) => ({
      ...prev,
      status: "stopped",
      totalPausedMs: totalPausedRef.current,
    }));
  }, [destroyWatcher, clearSignalLostTimer, stopPersistTimer, setStateWithRef]);

  const addLap = useCallback(() => {
    const elapsedMs = getElapsedMsNow();
    const newLap: LapEntry = {
      number: lapsRef.current.length + 1,
      distanceM: distanceRef.current,
      elapsedMs,
    };
    lapsRef.current = [...lapsRef.current, newLap];
    setStateWithRef((prev) => ({ ...prev, laps: lapsRef.current }));
  }, [setStateWithRef]); // eslint-disable-line react-hooks/exhaustive-deps

  // --------------- Session restore on mount ---------------

  useEffect(() => {
    checkLocationPermission().then((granted) => {
      permissionCacheRef.current = granted;
    });

    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = loadGpsSession();
      if (saved) {
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
          // Was tracking — account for time gap since kill
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

          // Restart GPS with robust watcher
          const watcher = createWatcher();
          watcherRef.current = watcher;
          watcher.start();
          startPersistTimer();
          resetSignalLostTimer();
        }
      }
    }

    return () => {
      watcherRef.current?.destroy();
      watcherRef.current = null;
      stopPersistTimer();
      clearSignalLostTimer();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --------------- App state listener (background/foreground) ---------------

  useEffect(() => {
    let listener: Awaited<ReturnType<typeof App.addListener>> | null = null;

    App.addListener("appStateChange", async ({ isActive }) => {
      if (!isActive) {
        // Going to background — persist immediately
        persistState();
        return;
      }

      // App returned to foreground
      const status = stateStatusRef.current;
      if (status !== "tracking") return;

      // Check if watcher is still alive
      if (!watcherRef.current || !watcherRef.current.isActive) {
        if (import.meta.env.DEV) console.log("[GPS] Watcher dead after foreground — restarting");

        // Clean up dead watcher
        if (watcherRef.current) {
          await watcherRef.current.destroy();
        }

        const watcher = createWatcher();
        watcherRef.current = watcher;
        await watcher.start();
      }
    }).then((h) => { listener = h; });

    return () => { listener?.remove(); };
  }, [addPoint, persistState, createWatcher]);

  // --------------- Elapsed time ---------------

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
