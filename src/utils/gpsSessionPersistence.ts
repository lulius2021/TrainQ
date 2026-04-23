// src/utils/gpsSessionPersistence.ts
// Persists GPS tracking session state to localStorage so it survives app kill/restart

import type { GpsPoint, LapEntry } from "../types/cardio";

const STORAGE_KEY = "trainq_gps_session_v1";

export interface PersistedGpsSession {
  status: "tracking" | "paused";
  startedAt: number;
  totalPausedMs: number;
  pausedAt?: number;
  distanceM: number;
  elevationGainM: number;
  points: GpsPoint[];
  laps: LapEntry[];
  lastSavedAt: number;
}

export function saveGpsSession(session: PersistedGpsSession): void {
  try {
    // Downsample points to max 500 for storage efficiency
    const points = session.points.length > 500
      ? downsample(session.points, 500)
      : session.points;
    const data = { ...session, points, lastSavedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full — ignore
  }
}

export function loadGpsSession(): PersistedGpsSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedGpsSession;
    // Validate
    if (!parsed.startedAt || !parsed.status) return null;
    // Discard if older than 12 hours (stale session)
    if (Date.now() - parsed.lastSavedAt > 12 * 60 * 60 * 1000) {
      clearGpsSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearGpsSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function downsample(points: GpsPoint[], max: number): GpsPoint[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const result: GpsPoint[] = [];
  for (let i = 0; i < max; i++) result.push(points[Math.round(i * step)]);
  const last = points[points.length - 1];
  if (result[result.length - 1] !== last) result.push(last);
  return result;
}
