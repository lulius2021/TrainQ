import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

export type GPSPoint = {
  lat: number;
  lng: number;
  timestamp: number;
  accuracyM: number;
  speedMs: number | null;
  altitudeM: number | null;
};

export type GPSStatus =
  | "idle"
  | "requesting"
  | "searching"   // waiting for first accurate fix
  | "active"
  | "denied"
  | "error";

export type GPSTrackingData = {
  status: GPSStatus;
  accuracyM: number | null;
  distanceKm: number;
  speedKmh: number;
  paceMinPerKm: string | null; // e.g. "5:30"
  trackPoints: GPSPoint[];
  error: string | null;
};

// Haversine distance in km between two lat/lng points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatPace(speedMs: number): string | null {
  if (speedMs < 0.3) return null; // stopped / too slow
  // Round total seconds first; doing minutes + (seconds % 60 rounded)
  // separately can overflow to ":60" at exact half-second pace boundaries.
  const totalSec = Math.round(1000 / speedMs);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

// Smooth speed using a simple moving average over last N points
function smoothedSpeedMs(points: GPSPoint[], current: GPSPoint): number {
  const window = [...points.slice(-4), current];
  if (window.length < 2) return 0;

  // If GPS provides speed, average the last few
  const gpsSpeeds = window
    .map(p => p.speedMs)
    .filter((s): s is number => s != null && s >= 0);
  if (gpsSpeeds.length >= 2) {
    return gpsSpeeds.reduce((a, b) => a + b, 0) / gpsSpeeds.length;
  }

  // Fallback: calculate from distance/time between first and last window points
  const first = window[0];
  const last = window[window.length - 1];
  const timeDiffSec = (last.timestamp - first.timestamp) / 1000;
  if (timeDiffSec <= 0) return 0;
  const distKm = haversineKm(first.lat, first.lng, last.lat, last.lng);
  return (distKm * 1000) / timeDiffSec;
}

export function useGPSTracking(enabled: boolean): GPSTrackingData {
  const [data, setData] = useState<GPSTrackingData>({
    status: "idle",
    accuracyM: null,
    distanceKm: 0,
    speedKmh: 0,
    paceMinPerKm: null,
    trackPoints: [],
    error: null,
  });

  const watchIdRef = useRef<string | number | null>(null);
  const lastGoodPointRef = useRef<GPSPoint | null>(null);
  const distanceKmRef = useRef(0);
  const trackPointsRef = useRef<GPSPoint[]>([]);
  const isNative = Capacitor.isNativePlatform();

  const stop = useCallback(() => {
    if (watchIdRef.current != null) {
      if (isNative) {
        import("@capacitor/geolocation").then(({ Geolocation }) => {
          Geolocation.clearWatch({ id: watchIdRef.current as string });
        }).catch(() => {});
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current as number);
      }
      watchIdRef.current = null;
    }
  }, [isNative]);

  const handlePosition = useCallback((coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
    altitude: number | null;
    timestamp: number;
  }) => {
    const point: GPSPoint = {
      lat: coords.latitude,
      lng: coords.longitude,
      timestamp: coords.timestamp,
      accuracyM: coords.accuracy,
      speedMs: coords.speed,
      altitudeM: coords.altitude,
    };

    // While signal is poor (> 30m accuracy), show "searching" but don't accumulate
    if (coords.accuracy > 30) {
      setData(s => ({ ...s, status: "searching", accuracyM: coords.accuracy }));
      return;
    }

    let addedKm = 0;
    if (lastGoodPointRef.current) {
      const d = haversineKm(
        lastGoodPointRef.current.lat, lastGoodPointRef.current.lng,
        point.lat, point.lng,
      );
      // Filter GPS jumps: > 150m between updates is a bad reading for running/cycling
      if (d <= 0.15) {
        addedKm = d;
        distanceKmRef.current += d;
      }
    }
    lastGoodPointRef.current = point;

    // Downsample track storage: keep a point every ~5 seconds or ~10m
    const lastStored = trackPointsRef.current[trackPointsRef.current.length - 1];
    const timeSinceLast = lastStored ? point.timestamp - lastStored.timestamp : Infinity;
    const distSinceLast = lastStored
      ? haversineKm(lastStored.lat, lastStored.lng, point.lat, point.lng) * 1000
      : Infinity;
    if (timeSinceLast >= 5000 || distSinceLast >= 10) {
      trackPointsRef.current = [...trackPointsRef.current, point];
    }

    const speedMs = smoothedSpeedMs(trackPointsRef.current, point);
    const speedKmh = speedMs * 3.6;
    const paceMinPerKm = formatPace(speedMs);

    setData({
      status: "active",
      accuracyM: coords.accuracy,
      distanceKm: distanceKmRef.current,
      speedKmh,
      paceMinPerKm,
      trackPoints: trackPointsRef.current,
      error: null,
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      setData({
        status: "idle",
        accuracyM: null,
        distanceKm: 0,
        speedKmh: 0,
        paceMinPerKm: null,
        trackPoints: [],
        error: null,
      });
      distanceKmRef.current = 0;
      lastGoodPointRef.current = null;
      trackPointsRef.current = [];
      return;
    }

    // Reset on start
    distanceKmRef.current = 0;
    lastGoodPointRef.current = null;
    trackPointsRef.current = [];

    setData({
      status: "requesting",
      accuracyM: null,
      distanceKm: 0,
      speedKmh: 0,
      paceMinPerKm: null,
      trackPoints: [],
      error: null,
    });

    // Per-effect-run cancellation. Needed because Geolocation.watchPosition is
    // async — without this flag, the watch can be started AFTER the cleanup
    // already ran (StrictMode double-mount, fast prop changes), leaving an
    // orphaned native watcher that never gets cleared.
    let cancelled = false;
    let localWatchId: string | number | null = null;

    if (isNative) {
      import("@capacitor/geolocation").then(async ({ Geolocation }) => {
        if (cancelled) return;

        let perm: Awaited<ReturnType<typeof Geolocation.requestPermissions>>;
        try {
          perm = await Geolocation.requestPermissions({ permissions: ["location"] });
        } catch {
          if (!cancelled) setData(s => ({ ...s, status: "error", error: "GPS-Berechtigung konnte nicht angefragt werden." }));
          return;
        }
        if (cancelled) return;

        if (perm.location === "denied") {
          setData(s => ({
            ...s,
            status: "denied",
            error: "GPS verweigert. Bitte unter Einstellungen → TrainQ → Standort aktivieren.",
          }));
          return;
        }

        setData(s => ({ ...s, status: "searching" }));

        try {
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 15000 },
            (pos, err) => {
              if (cancelled) return;
              if (err) {
                console.warn("[GPS] watchPosition error", err);
                return;
              }
              if (pos) {
                handlePosition({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy ?? 999,
                  speed: pos.coords.speed ?? null,
                  altitude: pos.coords.altitude ?? null,
                  timestamp: pos.timestamp,
                });
              }
            },
          );
          if (cancelled) {
            // Cleanup already ran; clear the watch we just registered.
            try { Geolocation.clearWatch({ id }); } catch {}
            return;
          }
          localWatchId = id;
          watchIdRef.current = id;
        } catch (e: any) {
          if (!cancelled) setData(s => ({ ...s, status: "error", error: "GPS konnte nicht gestartet werden." }));
        }
      }).catch(() => {
        if (!cancelled) setData(s => ({ ...s, status: "error", error: "GPS-Plugin nicht verfügbar." }));
      });
    } else {
      // Web / browser fallback (synchronous — no race possible)
      if (!("geolocation" in navigator)) {
        setData(s => ({ ...s, status: "error", error: "GPS nicht verfügbar in diesem Browser." }));
        return;
      }

      setData(s => ({ ...s, status: "searching" }));

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (cancelled) return;
          handlePosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 999,
            speed: pos.coords.speed ?? null,
            altitude: pos.coords.altitude ?? null,
            timestamp: pos.timestamp,
          });
        },
        (err) => {
          if (cancelled) return;
          if (err.code === 1 /* PERMISSION_DENIED */) {
            setData(s => ({ ...s, status: "denied", error: "GPS verweigert. Bitte im Browser aktivieren." }));
          } else {
            setData(s => ({ ...s, status: "error", error: "GPS-Fehler. Bitte erneut versuchen." }));
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      );
      localWatchId = id;
      watchIdRef.current = id;
    }

    return () => {
      cancelled = true;
      // Prefer the local id (always set synchronously where available), fall
      // back to the ref. This handles the case where the watch was registered
      // from this effect-run but not yet committed to the ref.
      if (localWatchId != null) {
        if (isNative) {
          import("@capacitor/geolocation").then(({ Geolocation }) => {
            Geolocation.clearWatch({ id: localWatchId as string });
          }).catch(() => {});
        } else {
          navigator.geolocation.clearWatch(localWatchId as number);
        }
        if (watchIdRef.current === localWatchId) watchIdRef.current = null;
      } else {
        stop();
      }
    };
  }, [enabled, isNative, handlePosition, stop]);

  return data;
}
