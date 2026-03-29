// src/native/geolocation.ts
// Capacitor Geolocation wrapper for GPS tracking

import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { GpsPoint } from "../types/cardio";

const isNative = Capacitor.isNativePlatform();

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
      enableHighAccuracy: false, // fast coarse fix first (GPS cold start)
      timeout: 10000,
      maximumAge: 60000,        // accept cached position up to 1 min old
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
  const id = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      // On native, background tracking works automatically
      ...(isNative ? {} : { timeout: 10000, maximumAge: 0 }),
    },
    (position, err) => {
      if (err) {
        onError?.(err);
        return;
      }
      if (!position) return;
      const point: GpsPoint = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        altitude: position.coords.altitude ?? undefined,
        accuracy: position.coords.accuracy ?? undefined,
        timestamp: position.timestamp,
      };
      onPoint(point);
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
