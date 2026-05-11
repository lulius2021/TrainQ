// src/native/geolocation.ts
// Capacitor Geolocation wrapper — robust GPS tracking with auto-reconnect

import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import type { GpsPoint } from "../types/cardio";

const isNative = Capacitor.isNativePlatform();

// --------------- Permission helpers ---------------

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

// --------------- One-shot position ---------------

export async function getCurrentPosition(): Promise<GpsPoint | null> {
  try {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
    return toPoint(pos);
  } catch {
    return null;
  }
}

// --------------- Robust GPS Watch ---------------

export type WatchCallbackId = string;

/** Internal: convert Capacitor position to our GpsPoint */
function toPoint(p: GeolocationPosition): GpsPoint {
  return {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    altitude: p.coords.altitude ?? undefined,
    accuracy: p.coords.accuracy ?? undefined,
    speed: p.coords.speed ?? undefined,
    timestamp: p.timestamp,
  };
}

/** Options for creating a robust GPS watch */
export interface RobustWatchOptions {
  onPoint: (point: GpsPoint) => void;
  onError?: (err: unknown) => void;
  onSignalLost?: () => void;
  onReconnected?: () => void;
}

/**
 * Manages a GPS watch with:
 * - Auto-reconnect on failure (exponential backoff, max 30s)
 * - Watchdog timer detecting stale watches (no points for 20s)
 * - Coarse → high-accuracy phase transition
 * - Proper cleanup of all resources
 */
export class GpsWatcher {
  private highAccuracyId: string | null = null;
  private coarseId: string | null = null;
  private gotHighAccuracy = false;
  private destroyed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastPointTime = 0;
  private reconnectAttempts = 0;
  private readonly opts: RobustWatchOptions;

  // Watchdog: if no point received for this long, restart the watch
  private static readonly WATCHDOG_INTERVAL_MS = 5000;
  private static readonly WATCHDOG_STALE_MS = 20000;
  private static readonly MAX_RECONNECT_DELAY_MS = 30000;

  constructor(opts: RobustWatchOptions) {
    this.opts = opts;
  }

  /** Start watching. Call once after construction. */
  async start(): Promise<void> {
    if (this.destroyed) return;
    await this.startWatch();
    this.startWatchdog();
  }

  /** Stop watching and clean up all resources. Idempotent. */
  async destroy(): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopWatchdog();
    this.clearReconnectTimer();
    await this.clearAllWatches();
  }

  /** Whether this watcher is still active (not destroyed). */
  get isActive(): boolean {
    return !this.destroyed;
  }

  // --------------- Internal ---------------

  private async startWatch(): Promise<void> {
    if (this.destroyed) return;

    this.gotHighAccuracy = false;

    // Phase 1: Coarse watch for instant first fix (native only)
    if (isNative) {
      try {
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: false },
          (position) => {
            if (this.gotHighAccuracy || !position || this.destroyed) return;
            this.handlePoint(toPoint(position));
          },
        );
        if (!this.destroyed) {
          this.coarseId = id;
        } else {
          Geolocation.clearWatch({ id }).catch(() => {});
        }
      } catch {
        // Coarse watch failed — not critical, high-accuracy will handle it
      }
    }

    // Phase 2: High-accuracy watch (the real GPS tracking)
    try {
      const id = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          ...(isNative
            ? {
                backgroundMessage: "TrainQ zeichnet deine Route auf",
                backgroundTitle: "GPS-Tracking aktiv",
              }
            : { timeout: 15000, maximumAge: 0 }),
        },
        (position, err) => {
          if (this.destroyed) return;

          if (err) {
            this.handleWatchError(err);
            return;
          }
          if (!position) return;

          // Transition: stop coarse watch once high-accuracy arrives
          if (!this.gotHighAccuracy) {
            this.gotHighAccuracy = true;
            this.clearCoarseWatch();
          }

          this.handlePoint(toPoint(position));
        },
      );

      if (!this.destroyed) {
        this.highAccuracyId = id;
        this.reconnectAttempts = 0; // Success — reset backoff
      } else {
        Geolocation.clearWatch({ id }).catch(() => {});
      }
    } catch (err) {
      this.handleWatchError(err);
    }
  }

  private handlePoint(point: GpsPoint): void {
    this.lastPointTime = Date.now();
    this.reconnectAttempts = 0;
    this.opts.onPoint(point);
  }

  private handleWatchError(err: unknown): void {
    if (this.destroyed) return;
    this.opts.onError?.(err);
    this.scheduleReconnect();
  }

  /** Watchdog: detects if the watch stopped delivering points silently */
  private startWatchdog(): void {
    this.watchdogTimer = setInterval(() => {
      if (this.destroyed) return;

      // Don't check before first point arrives
      if (this.lastPointTime === 0) return;

      const elapsed = Date.now() - this.lastPointTime;
      if (elapsed > GpsWatcher.WATCHDOG_STALE_MS) {
        if (import.meta.env.DEV) console.warn(`[GPS] Watchdog: no point for ${Math.round(elapsed / 1000)}s — reconnecting`);
        this.opts.onSignalLost?.();
        this.reconnect();
      }
    }, GpsWatcher.WATCHDOG_INTERVAL_MS);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /** Schedule a reconnect with exponential backoff */
  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      GpsWatcher.MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectAttempts++;

    if (import.meta.env.DEV) console.log(`[GPS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Tear down existing watches and start fresh */
  private async reconnect(): Promise<void> {
    if (this.destroyed) return;
    this.clearReconnectTimer();
    await this.clearAllWatches();
    await this.startWatch();

    // Notify that we reconnected (UI can update signal indicator)
    this.opts.onReconnected?.();
  }

  private async clearAllWatches(): Promise<void> {
    await this.clearCoarseWatch();
    if (this.highAccuracyId) {
      const id = this.highAccuracyId;
      this.highAccuracyId = null;
      await Geolocation.clearWatch({ id }).catch(() => {});
    }
  }

  private async clearCoarseWatch(): Promise<void> {
    if (this.coarseId) {
      const id = this.coarseId;
      this.coarseId = null;
      await Geolocation.clearWatch({ id }).catch(() => {});
    }
  }
}

// --------------- Legacy API (backwards compatible) ---------------

/** @deprecated Use GpsWatcher class instead for robust tracking */
export async function watchPosition(
  onPoint: (point: GpsPoint) => void,
  onError?: (err: unknown) => void,
): Promise<WatchCallbackId> {
  const id = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      ...(isNative
        ? {
            backgroundMessage: "TrainQ zeichnet deine Route auf",
            backgroundTitle: "GPS-Tracking aktiv",
          }
        : { timeout: 15000, maximumAge: 0 }),
    },
    (position, err) => {
      if (err) { onError?.(err); return; }
      if (!position) return;
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

// --------------- GPS Warmup ---------------

let _warmupDone = false;

/**
 * Warm up the GPS receiver with two phases:
 * 1. Instant coarse fix (WiFi/Cell)
 * 2. Background high-accuracy request — wakes GPS chip
 * Call at app launch (main.tsx).
 */
export async function warmupGps(): Promise<void> {
  if (_warmupDone) return;
  _warmupDone = true;

  // Only warm up if permission is already granted — never trigger the system dialog
  const granted = await checkLocationPermission();
  if (!granted) return;

  try {
    await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 3000,
      maximumAge: 120000,
    });
  } catch { /* ignore */ }
  Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 15000,
  }).catch(() => {});
}

export function resetWarmup(): void { _warmupDone = false; }
