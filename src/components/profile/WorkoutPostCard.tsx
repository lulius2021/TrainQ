// src/components/profile/WorkoutPostCard.tsx
//
// Strava-style workout post card. Loads the saved post image from IndexedDB;
// if missing (e.g. older workouts created before this feature), generates it
// on the fly and saves it back. Works for all sports.

import React, { useEffect, useRef, useState } from "react";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { getWorkoutImageObjectURL, saveWorkoutImage } from "../../utils/workoutImageStore";
import { getOrGenerateWorkoutImage } from "../../utils/routeExport";
import { formatPaceMmSs } from "../../utils/timeFormat";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const formatPace = formatPaceMmSs;

function formatRelativeTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "";
  const diffMs = Date.now() - d;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  const days = Math.floor(h / 24);
  if (days < 7) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

function formatKg(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}t`;
  return `${Math.round(v)}kg`;
}

function safeInitials(name: string): string {
  const parts = (name || "").trim().split(" ").filter(Boolean).slice(0, 2);
  const ini = parts.map((p) => p[0]).join("");
  return (ini || "TQ").slice(0, 2).toUpperCase();
}

function sportIcon(sport?: string): string {
  const s = (sport ?? "").toLowerCase();
  if (s === "laufen") return "🏃";
  if (s === "radfahren") return "🚴";
  if (s === "gym") return "💪";
  return "🎯";
}

function sportLabel(sport?: string): string {
  const s = (sport ?? "").toLowerCase();
  if (s === "laufen") return "Laufen";
  if (s === "radfahren") return "Radfahren";
  if (s === "gym") return "Gym";
  return sport ?? "Training";
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center text-center">
      <span className="text-lg sm:text-xl font-bold tabular-nums text-white leading-none">
        {value}
      </span>
      <span className="text-[10px] sm:text-xs text-white/45 mt-1 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  entry: WorkoutHistoryEntry;
  userName?: string;
  avatarDataUrl?: string;
  onExport: (entry: WorkoutHistoryEntry) => void;
};

export default function WorkoutPostCard({ entry, userName, avatarDataUrl, onExport }: Props) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImgError(false);

    (async () => {
      // 1) Try to load existing image from IndexedDB
      const existing = await getWorkoutImageObjectURL(entry.id);
      if (cancelled) {
        if (existing) URL.revokeObjectURL(existing);
        return;
      }
      if (existing) {
        objectUrlRef.current = existing;
        setImgUrl(existing);
        return;
      }

      // 2) Not found → generate on-the-fly with the default dark theme.
      //    Uses a deduped + serialized queue so we don't freeze the UI when
      //    many cards request at once, and we don't double-generate when the
      //    background auto-save is already in flight for this id.
      try {
        const blob = await getOrGenerateWorkoutImage(entry, "dark", userName);
        if (cancelled) return;
        await saveWorkoutImage(entry.id, blob);
        const url = URL.createObjectURL(blob);
        // Check cancelled AFTER creating the URL so we can revoke it if needed.
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrlRef.current = url;
        setImgUrl(url);
      } catch (e) {
        console.warn("[WorkoutPostCard] image generation failed", e);
        if (!cancelled) setImgError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [entry.id, userName]);

  // ── Stats per sport ────────────────────────────────────────────────────────
  const sport = (entry.sport ?? "").toLowerCase();
  const isCardio = sport === "laufen" || sport === "radfahren";
  const isGym = sport === "gym";

  const stats: Array<{ value: string; label: string }> = [];
  if (isCardio) {
    if (entry.distanceKm != null && entry.distanceKm > 0) {
      stats.push({ value: entry.distanceKm.toFixed(2), label: "km" });
    }
    if (entry.durationSec > 0) stats.push({ value: formatDuration(entry.durationSec), label: "Zeit" });
    if (entry.paceSecPerKm != null && entry.paceSecPerKm > 0) {
      stats.push({ value: formatPace(entry.paceSecPerKm), label: "min/km" });
    }
  } else if (isGym) {
    if (entry.totalVolume > 0) stats.push({ value: formatKg(entry.totalVolume), label: "Volumen" });
    const setCount = (entry.exercises ?? []).reduce((a, ex) => a + (ex.sets?.length ?? 0), 0);
    if (setCount > 0) stats.push({ value: String(setCount), label: setCount === 1 ? "Satz" : "Sätze" });
    if (entry.durationSec > 0) stats.push({ value: formatDuration(entry.durationSec), label: "Zeit" });
  } else {
    if (entry.durationSec > 0) stats.push({ value: formatDuration(entry.durationSec), label: "Zeit" });
    const exCount = (entry.exercises ?? []).length;
    if (exCount > 0) stats.push({ value: String(exCount), label: exCount === 1 ? "Übung" : "Übungen" });
  }

  return (
    <article className="rounded-2xl overflow-hidden bg-white/5 border border-white/10">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-3 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-br from-sky-500 to-sky-700">
            {avatarDataUrl ? (
              <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-white">{safeInitials(userName ?? "")}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userName || "Du"}</p>
            <p className="text-xs text-white/45 truncate">
              {sportIcon(entry.sport)} {sportLabel(entry.sport)} · {formatRelativeTime(entry.endedAt ?? entry.startedAt)}
            </p>
          </div>
        </div>
      </header>

      {/* Title */}
      {entry.title && (
        <h3 className="px-4 pb-2 text-base font-semibold text-white truncate">
          {entry.title}
        </h3>
      )}

      {/* Image (1:1) */}
      <div className="relative w-full aspect-square bg-[#061226] border-y border-white/5">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={entry.title || sportLabel(entry.sport)}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : imgError ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm">
            Bild konnte nicht geladen werden
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        )}
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="flex px-4 py-3 border-b border-white/5">
          {stats.map((s) => (
            <Stat key={s.label} value={s.value} label={s.label} />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => onExport(entry)}
          className="rounded-full px-3 py-1.5 text-sm font-medium bg-white/10 border border-white/10 text-white hover:bg-white/20 inline-flex items-center gap-1.5"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M12 3v10m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Exportieren
        </button>
      </div>
    </article>
  );
}
