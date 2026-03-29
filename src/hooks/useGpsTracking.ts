// src/hooks/useGpsTracking.ts

import { useCallback, useEffect, useRef, useState } from "react";
import type { GpsPoint, CardioSessionState, LapEntry } from "../types/cardio";
import {
  requestLocationPermission,
  watchPosition,
  clearWatch,
  type WatchCallbackId,
} from "../native/geolocation";
import { haversineDistance, computePace } from "../utils/gpsUtils";

const MAX_ACCURACY_M = 100;

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

  const watchIdRef       = useRef<WatchCallbackId | null>(null);
  const pointsRef        = useRef<GpsPoint[]>([]);
  const distanceRef      = useRef(0);
  const elevationRef     = useRef(0);
  const pausedAtRef      = useRef<number | undefined>(undefined);
  const totalPausedRef   = useRef(0);
  const startedAtRef     = useRef(0);
  const stoppedAtRef     = useRef<number | undefined>(undefined);
  const lapsRef          = useRef<LapEntry[]>([]);

  const addPoint = useCallback((point: GpsPoint) => {
    if (point.accuracy && point.accuracy > MAX_ACCURACY_M) return;

    const prev = pointsRef.current;
    const lastPoint = prev[prev.length - 1];

    let addedDistance = 0;
    if (lastPoint) {
      addedDistance = haversineDistance(lastPoint, point);
      if (addedDistance > 500 && prev.length > 1) return;
    }

    let addedElevation = 0;
    if (
      lastPoint &&
      typeof lastPoint.altitude === "number" &&
      typeof point.altitude === "number"
    ) {
      const diff = point.altitude - lastPoint.altitude;
      if (diff > 0) addedElevation = diff;
    }

    const newPoints = [...prev, point];
    pointsRef.current  = newPoints;
    distanceRef.current  += addedDistance;
    elevationRef.current += addedElevation;

    // Current pace from last ~60 seconds of points
    const now = point.timestamp;
    const recentPoints = newPoints.filter((p) => p.timestamp >= now - 60000);
    let recentDistance = 0;
    for (let i = 1; i < recentPoints.length; i++) {
      recentDistance += haversineDistance(recentPoints[i - 1], recentPoints[i]);
    }
    const recentDurationMs =
      recentPoints.length >= 2
        ? recentPoints[recentPoints.length - 1].timestamp - recentPoints[0].timestamp
        : 0;
    const pace = computePace(recentDistance, recentDurationMs);

    setState({
      status: "tracking",
      points: newPoints,
      startedAt: startedAtRef.current,
      totalPausedMs: totalPausedRef.current,
      distanceM: distanceRef.current,
      elevationGainM: elevationRef.current,
      currentPaceSecPerKm: pace,
      laps: lapsRef.current,
    });
  }, []);

  const startTracking = useCallback(async () => {
    const granted = await requestLocationPermission();
    if (!granted) return false;

    const now = Date.now();
    startedAtRef.current  = now;
    pointsRef.current     = [];
    distanceRef.current   = 0;
    elevationRef.current  = 0;
    totalPausedRef.current  = 0;
    pausedAtRef.current     = undefined;
    stoppedAtRef.current    = undefined;
    lapsRef.current         = [];

    setState({
      status: "tracking",
      points: [],
      startedAt: now,
      totalPausedMs: 0,
      distanceM: 0,
      elevationGainM: 0,
      currentPaceSecPerKm: undefined,
      laps: [],
    });

    const id = await watchPosition(addPoint);
    watchIdRef.current = id;
    return true;
  }, [addPoint]);

  const pauseTracking = useCallback(() => {
    if (watchIdRef.current) {
      clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    pausedAtRef.current = Date.now();
    setState((prev) => ({ ...prev, status: "paused", pausedAt: Date.now() }));
  }, []);

  const resumeTracking = useCallback(async () => {
    if (pausedAtRef.current) {
      totalPausedRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = undefined;
    }
    const id = await watchPosition(addPoint);
    watchIdRef.current = id;
    setState((prev) => ({
      ...prev,
      status: "tracking",
      pausedAt: undefined,
      totalPausedMs: totalPausedRef.current,
    }));
  }, [addPoint]);

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
    setState((prev) => ({
      ...prev,
      status: "stopped",
      totalPausedMs: totalPausedRef.current,
    }));
  }, []);

  /** Record a manual lap at the current position/time. */
  const addLap = useCallback(() => {
    const elapsedMs = getElapsedMsNow();
    const newLap: LapEntry = {
      number: lapsRef.current.length + 1,
      distanceM: distanceRef.current,
      elapsedMs,
    };
    lapsRef.current = [...lapsRef.current, newLap];
    setState((prev) => ({ ...prev, laps: lapsRef.current }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (watchIdRef.current) clearWatch(watchIdRef.current);
    };
  }, []);

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
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    addLap,
    getElapsedMs,
  };
}
