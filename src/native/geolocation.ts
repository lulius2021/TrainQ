// src/native/geolocation.ts
// Capacitor Geolocation wrapper for GPS tracking

import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { GpsPoint } from "../types/cardio";

const isNative = Capacitor.isNativePlatform();

/** Check-only — never shows a dialog. Returns true if already granted. */
export async function checkLocationPermission(): Promise<boolean> {
  try {
    const status = await Geolocation.checkPermissions();
    return status.location === "granted" || status.coarseLocation === "granted";
  } catch {
    return false;
  }
}

/** Request permission if needed — may show a system dialog. */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted" || status.coarseLocation === "granted") return true;

    const result = await Geolocation.requestPermissions();
    return result.location === "granted" || result.coarseLocation === "granted";
  } catch {
    return false;
  }
}

export async function getCurrentPosition(): Promise<GpsPoint | null> {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      altitude: pos.coords.altitude ?? undefined,
      accuracy: pos.coords.accuracy ?? undefined,
      timestamp: pos.timestamp,
    };
  } catch {
    return null;
  }
}

export type WatchCallbackId = string;

export async function watchPosition(
  onPoint: (point: GpsPoint) => void,
  onError?: (err: unknown) => void,
): Promise<WatchCallbackId> {
  let coarseId: string | null = null;
  let gotHighAccuracy = false;

  const toPoint = (p: GeolocationPosition): GpsPoint => ({
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    altitude: p.coords.altitude ?? undefined,
    accuracy: p.coords.accuracy ?? undefined,
    timestamp: p.timestamp,
  });

  // Phase 1: Coarse watch (WiFi/Cell — instant first fix)
  if (isNative) {
    Geolocation.watchPosition(
      { enableHighAccuracy: false },
      (position) => {
        if (gotHighAccuracy || !position) return;
        onPoint(toPoint(position));
      },
    ).then((id) => { coarseId = id; }).catch(() => {});
  }

  // Phase 2: High-accuracy watch (real GPS tracking)
  const id = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      ...(isNative
        ? {
            backgroundMessage: "TrainQ zeichnet deine Route auf",
            backgroundTitle: "GPS-Tracking aktiv",
          }
        : { timeout: 10000, maximumAge: 0 }),
    },
    (position, err) => {
      if (err) { onError?.(err); return; }
      if (!position) return;

      // Stop coarse watch once high-accuracy arrives
      if (!gotHighAccuracy && coarseId) {
        gotHighAccuracy = true;
        Geolocation.clearWatch({ id: coarseId }).catch(() => {});
        coarseId = null;
      }
      onPoint(toPoint(position));
    },
  );
  return id;
}

export async function clearWatch(id: WatchCallbackId): Promise<void> {
  try {
    await Geolocation.clearWatch({ id });
  } catch {
    // ignore
  }
}

/**
 * Warm up the GPS receiver with two phases:
 * 1. Instant coarse fix (WiFi/Cell) — ~1-2s
 * 2. Background high-accuracy request — wakes GPS chip for later
 * Call at app launch (main.tsx), not just when cardio opens.
 */
let _warmupDone = false;
export async function warmupGps(): Promise<void> {
  if (_warmupDone) return;
  _warmupDone = true;
  // Phase 1: Fast coarse position (near-instant via WiFi/Cell)
  try {
    await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 3000,
      maximumAge: 120000,
    });
  } catch { /* ignore */ }
  // Phase 2: High-accuracy in background (wakes GPS chip)
  Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
  }).catch(() => {});
}

/** Reset warmup (e.g. after long idle) */
export function resetWarmup(): void { _warmupDone = false; }
