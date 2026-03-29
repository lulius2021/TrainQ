// src/utils/gpsUtils.ts
// GPS math utilities for cardio tracking

import type { GpsPoint } from "../types/cardio";

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistance(a: GpsPoint, b: GpsPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function computeTotalDistance(points: GpsPoint[]): number {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i - 1] && points[i]) {
      total += haversineDistance(points[i - 1], points[i]);
    }
  }
  return total;
}

export function computeElevationGain(points: GpsPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].altitude;
    const curr = points[i].altitude;
    if (typeof prev === "number" && typeof curr === "number") {
      const diff = curr - prev;
      if (diff > 0) gain += diff;
    }
  }
  return gain;
}

export function computePace(distanceM: number, durationMs: number): number | undefined {
  if (distanceM <= 0 || durationMs <= 0) return undefined;
  const distanceKm = distanceM / 1000;
  const durationSec = durationMs / 1000;
  const pace = durationSec / distanceKm; // sec per km
  return Number.isFinite(pace) ? pace : undefined;
}

export function formatPace(secPerKm: number | undefined): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "--:--";
  const min = Math.floor(secPerKm / 60);
  const sec = Math.round(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function formatDistanceKm(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "0.00";
  return (meters / 1000).toFixed(2);
}

export function formatElevation(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return "0";
  return Math.round(meters).toString();
}

export function smoothPoints(points: GpsPoint[], windowSize = 3): GpsPoint[] {
  if (points.length < windowSize) return points;
  const result: GpsPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, start + windowSize);
    const window = points.slice(start, end);
    const avgLat = window.reduce((sum, p) => sum + p.lat, 0) / window.length;
    const avgLng = window.reduce((sum, p) => sum + p.lng, 0) / window.length;
    result.push({ ...points[i], lat: avgLat, lng: avgLng });
  }
  return result;
}

export function filterByAccuracy(points: GpsPoint[], maxAccuracy = 30): GpsPoint[] {
  return points.filter((p) => !p.accuracy || p.accuracy <= maxAccuracy);
}

/** Convert pace (sec/km) to speed (km/h). */
export function paceToSpeed(secPerKm: number | undefined): number | undefined {
  if (!secPerKm || secPerKm <= 0) return undefined;
  return 3600 / secPerKm;
}

/** Format speed as "X.X km/h". */
export function formatSpeed(secPerKm: number | undefined): string {
  const kmh = paceToSpeed(secPerKm);
  if (!kmh || !Number.isFinite(kmh)) return "--.-";
  return kmh.toFixed(1);
}

/** Estimate calories burned.
 *  Running: ~1 kcal / kg / km
 *  Cycling: ~0.5 kcal / kg / km
 */
export function computeCalories(
  distanceM: number,
  weightKg: number,
  sport: "Laufen" | "Radfahren"
): number {
  const km = distanceM / 1000;
  const factor = sport === "Laufen" ? 1.0 : 0.5;
  return Math.round(km * weightKg * factor);
}
