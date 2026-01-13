import type { Lang } from "./index";

export function formatDate(locale: Lang, date: Date, opts?: Intl.DateTimeFormatOptions): string {
  const options: Intl.DateTimeFormatOptions = opts ?? { year: "numeric", month: "2-digit", day: "2-digit" };
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", options).format(date);
}

export function formatTime(locale: Lang, date: Date, opts?: Intl.DateTimeFormatOptions): string {
  const options: Intl.DateTimeFormatOptions = opts ?? { hour: "2-digit", minute: "2-digit", hour12: false };
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", options).format(date);
}

export function formatNumber(locale: Lang, value: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", opts).format(value);
}

export function formatDurationMinutes(locale: Lang, minutes: number): string {
  const clamped = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const label = locale === "de" ? "min" : "min";
  return `${clamped} ${label}`;
}

export function formatDurationSeconds(locale: Lang, seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}
