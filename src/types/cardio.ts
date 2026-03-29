// src/types/cardio.ts

export interface GpsPoint {
  lat: number;
  lng: number;
  altitude?: number;
  accuracy?: number;
  timestamp: number; // epoch ms
}

export interface LapEntry {
  number: number;
  distanceM: number; // cumulative total distance at lap end
  elapsedMs: number; // cumulative elapsed (excl. paused) at lap end
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
  laps: LapEntry[];
}
