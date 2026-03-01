// src/types/cardio.ts
// Feature 5: GPS-Tracking types

export interface GpsPoint {
  lat: number;
  lng: number;
  altitude?: number;
  accuracy?: number;
  timestamp: number; // epoch ms
}

export interface CardioSessionState {
  status: "idle" | "tracking" | "paused" | "stopped";
  points: GpsPoint[];
  startedAt: number; // epoch ms
  pausedAt?: number;
  totalPausedMs: number;
  distanceM: number;
  elevationGainM: number;
  currentPaceSecPerKm?: number;
}
