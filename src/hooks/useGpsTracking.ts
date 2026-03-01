// src/hooks/useGpsTracking.ts
// GPS tracking hook for cardio sessions

import { useCallback, useEffect, useRef, useState } from "react";
import type { GpsPoint, CardioSessionState } from "../types/cardio";
import {
  requestLocationPermission,
  watchPosition,
  clearWatch,
  type WatchCallbackId,
} from "../native/geolocation";
import {
  haversineDistance,
  computeElevationGain,
  computePace,
  filterByAccuracy,
} from "../utils/gpsUtils";

const MAX_ACCURACY_M = 30;

export function useGpsTracking() {
  const [state, setState] = useState<CardioSessionState>({
    status: "idle",
    points: [],
    startedAt: 0,
    totalPausedMs: 0,
    distanceM: 0,
    elevationGainM: 0,
    currentPaceSecPerKm: undefined,
  });

  const watchIdRef = useRef<WatchCallbackId | null>(null);
  const pointsRef = useRef<GpsPoint[]>([]);
  const distanceRef = useRef(0);
  const elevationRef = useRef(0);
  const pausedAtRef = useRef<number | undefined>(undefined);
  const totalPausedRef = useRef(0);
  const startedAtRef = useRef(0);

  const addPoint = useCallback((point: GpsPoint) => {
    // Filter out inaccurate points
    if (point.accuracy && point.accuracy > MAX_ACCURACY_M) return;

    const prev = pointsRef.current;
    const lastPoint = prev[prev.length - 1];

    // Compute incremental distance
    let addedDistance = 0;
    if (lastPoint) {
      addedDistance = haversineDistance(lastPoint, point);
      // Filter out GPS jumps (> 100m between consecutive points at walking/running pace)
      if (addedDistance > 100 && prev.length > 1) return;
    }

    // Compute incremental elevation
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
    pointsRef.current = newPoints;
    distanceRef.current += addedDistance;
    elevationRef.current += addedElevation;

    // Compute current pace from last ~60 seconds of points
    const now = point.timestamp;
    const recentStart = now - 60000;
    const recentPoints = newPoints.filter((p) => p.timestamp >= recentStart);
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
    });
  }, []);

  const startTracking = useCallback(async () => {
    const granted = await requestLocationPermission();
    if (!granted) return false;

    const now = Date.now();
    startedAtRef.current = now;
    pointsRef.current = [];
    distanceRef.current = 0;
    elevationRef.current = 0;
    totalPausedRef.current = 0;
    pausedAtRef.current = undefined;

    setState({
      status: "tracking",
      points: [],
      startedAt: now,
      totalPausedMs: 0,
      distanceM: 0,
      elevationGainM: 0,
      currentPaceSecPerKm: undefined,
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
    setState((prev) => ({
      ...prev,
      status: "stopped",
      totalPausedMs: totalPausedRef.current,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Elapsed time (excluding paused time)
  const getElapsedMs = useCallback((): number => {
    if (state.status === "idle") return 0;
    const now = state.status === "paused" ? (pausedAtRef.current ?? Date.now()) : Date.now();
    return now - startedAtRef.current - totalPausedRef.current;
  }, [state.status]);

  return {
    state,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    getElapsedMs,
  };
}
