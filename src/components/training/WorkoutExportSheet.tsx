// src/components/training/WorkoutExportSheet.tsx
// Bottom sheet for exporting a workout card image in various styles.

import React, { useCallback, useRef, useState } from "react";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import RouteSVG from "./RouteSVG";
import {
  EXPORT_THEMES,
  type ExportTheme,
  type ThemeDef,
  generateWorkoutImage,
  shareOrDownloadImage,
} from "../../utils/routeExport";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationLabel(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPaceLabel(paceSecPerKm: number): string {
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function formatDateLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Live preview card ────────────────────────────────────────────────────────

function PreviewCard({
  entry,
  theme,
  userName,
}: {
  entry: WorkoutHistoryEntry;
  theme: ThemeDef;
  userName?: string;
}) {
  const hasRoute = Array.isArray(entry.gpsTrack) && entry.gpsTrack.length >= 2;
  const sport = (entry.sport ?? "").toLowerCase();
  const sportIcon = sport === "laufen" ? "🏃" : sport === "radfahren" ? "🚴" : "💪";
  const sportLabel = sport === "laufen" ? "Laufen" : sport === "radfahren" ? "Radfahren" : (entry.sport ?? "Training");
  const dateStr = formatDateLabel(entry.endedAt ?? entry.startedAt);

  const isTransparent = theme.id === "transparent";

  return (
    <div
      className="w-full aspect-square rounded-2xl overflow-hidden relative flex flex-col select-none"
      style={{
        background: isTransparent
          ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0/16px 16px"
          : theme.previewBg,
      }}
    >
      {/* Actual card layer (transparent bg is supported via CSS mix-blend) */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{ background: isTransparent ? "transparent" : undefined }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1 shrink-0">
          <span className="text-sm font-bold" style={{ color: theme.textPrimary }}>
            {sportIcon} {sportLabel}
          </span>
          <span className="text-xs" style={{ color: theme.textMuted }}>
            {dateStr}
          </span>
        </div>

        {/* Route area */}
        <div className="flex-1 px-3 py-2">
          {hasRoute ? (
            <div
              className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center"
              style={{ background: isTransparent ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.15)" }}
            >
              <RouteSVG points={entry.gpsTrack!} height={180} showLiveDot={false} />
            </div>
          ) : (
            <div
              className="w-full h-full rounded-xl flex items-center justify-center"
              style={{ background: "rgba(59,130,246,0.08)", border: "1px dashed rgba(59,130,246,0.2)" }}
            >
              <span className="text-xs" style={{ color: theme.textMuted }}>
                Keine GPS-Route
              </span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-4 shrink-0" style={{ height: 1, background: theme.divider }} />

        {/* Stats row */}
        <div className="flex px-4 py-3 shrink-0">
          {entry.distanceKm != null && entry.distanceKm > 0 && (
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xl font-bold tabular-nums" style={{ color: theme.textPrimary }}>
                {entry.distanceKm.toFixed(2)}
              </span>
              <span className="text-[10px]" style={{ color: theme.textMuted }}>km</span>
            </div>
          )}
          {entry.durationSec > 0 && (
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xl font-bold tabular-nums" style={{ color: theme.textPrimary }}>
                {formatDurationLabel(entry.durationSec)}
              </span>
              <span className="text-[10px]" style={{ color: theme.textMuted }}>Zeit</span>
            </div>
          )}
          {entry.paceSecPerKm != null && entry.paceSecPerKm > 0 && (
            <div className="flex-1 flex flex-col items-center">
              <span className="text-xl font-bold tabular-nums" style={{ color: theme.textPrimary }}>
                {formatPaceLabel(entry.paceSecPerKm)}
              </span>
              <span className="text-[10px]" style={{ color: theme.textMuted }}>Pace</span>
            </div>
          )}
        </div>

        {/* Watermark */}
        <div className="pb-2 flex justify-center shrink-0">
          <span className="text-[9px]" style={{ color: theme.textMuted }}>
            {entry.title ? `${entry.title}  •  ` : ""}TrainQ{userName ? `  •  ${userName}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Theme picker chip ────────────────────────────────────────────────────────

function ThemeChip({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemeDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 shrink-0 ${selected ? "opacity-100" : "opacity-55"}`}
    >
      {/* Swatch */}
      <div
        className={`w-14 h-14 rounded-xl border-2 transition-all ${selected ? "border-blue-400 scale-105" : "border-white/10"}`}
        style={{
          background: theme.id === "transparent"
            ? "repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0/8px 8px"
            : theme.previewBg,
        }}
      />
      <span className={`text-xs font-medium ${selected ? "text-white" : "text-white/50"}`}>
        {theme.label}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  entry: WorkoutHistoryEntry;
  userName?: string;
  onClose: () => void;
};

export default function WorkoutExportSheet({ entry, userName, onClose }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<ExportTheme>("dark");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const activeTheme = EXPORT_THEMES.find((t) => t.id === selectedTheme) ?? EXPORT_THEMES[0];

  const handleExport = useCallback(async () => {
    setStatus("generating");
    setFeedback(null);
    try {
      const blob = await generateWorkoutImage(entry, selectedTheme, userName);
      const sport = (entry.sport ?? "training").toLowerCase().replace(/\s+/g, "-");
      const date = (entry.endedAt ?? entry.startedAt ?? "").slice(0, 10);
      const filename = `trainq-${sport}-${date}.png`;
      const result = await shareOrDownloadImage(blob, filename);
      setStatus("done");
      setFeedback(result === "shared" ? "Geteilt ✓" : "Bild gespeichert ✓");
    } catch (e) {
      console.error("[WorkoutExport] failed", e);
      setStatus("error");
      setFeedback("Export fehlgeschlagen. Bitte erneut versuchen.");
    }
  }, [entry, selectedTheme, userName]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-lg mx-auto rounded-t-3xl bg-[#0d1b2e] border-t border-x border-white/10 flex flex-col overflow-hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)", maxHeight: "92dvh" }}
      >
        {/* Handle + header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20 absolute top-3 left-1/2 -translate-x-1/2" />
          <h2 className="text-base font-semibold text-white mt-1">Workout exportieren</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Live preview */}
          <div className="w-full max-w-[320px] mx-auto">
            <PreviewCard entry={entry} theme={activeTheme} userName={userName} />
          </div>

          {/* Theme selector */}
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Stil</p>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {EXPORT_THEMES.map((t) => (
                <ThemeChip
                  key={t.id}
                  theme={t}
                  selected={selectedTheme === t.id}
                  onSelect={() => { setSelectedTheme(t.id); setStatus("idle"); setFeedback(null); }}
                />
              ))}
            </div>
          </div>

          {/* Format info */}
          <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🖼️</span>
            <div>
              <p className="text-sm font-medium text-white">PNG · 1080×1080</p>
              <p className="text-xs text-white/40">Optimal für Instagram, Stories & WhatsApp</p>
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium text-center ${
                status === "error"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-green-500/10 border border-green-500/20 text-green-400"
              }`}
            >
              {feedback}
            </div>
          )}
        </div>

        {/* Export button */}
        <div className="px-4 pt-2 shrink-0">
          <button
            type="button"
            onClick={handleExport}
            disabled={status === "generating"}
            className="w-full h-14 rounded-2xl bg-[#2563EB] text-white text-base font-bold shadow-[0_0_20px_theme(colors.blue.600/30%)] hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {status === "generating" ? (
              <>
                <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Wird erstellt…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path d="M12 3v10m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Exportieren &amp; teilen
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
