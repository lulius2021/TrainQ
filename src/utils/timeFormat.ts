export function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Formats a pace given in seconds-per-km to "M:SS".
 *
 * Rounds the TOTAL seconds first, then splits — this avoids the classic
 * off-by-one where rounding `% 60` could yield 60 (e.g. 359.6 sec → 5:60
 * instead of 6:00).
 */
export function formatPaceMmSs(paceSecPerKm: number): string {
  if (!Number.isFinite(paceSecPerKm) || paceSecPerKm <= 0) return "0:00";
  const totalSec = Math.round(paceSecPerKm);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Formats a pace given in MINUTES-per-km (decimal, e.g. 5.5) to "M:SS".
 * Same off-by-one safeguard as formatPaceMmSs.
 */
export function formatPaceFromMinutes(minPerKm: number): string {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return "0:00";
  return formatPaceMmSs(minPerKm * 60);
}

