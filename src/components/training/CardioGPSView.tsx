import React from "react";
import type { GPSTrackingData } from "../../hooks/useGPSTracking";
import RouteSVG from "./RouteSVG";

// ─── Signal indicator ────────────────────────────────────────────────────────

function SignalBadge({ status, accuracyM }: { status: GPSTrackingData["status"]; accuracyM: number | null }) {
  if (status === "requesting" || status === "searching") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-yellow-400">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        {status === "requesting" ? "GPS startet…" : "Signal suchen…"}
      </span>
    );
  }
  if (status === "denied" || status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        {status === "denied" ? "GPS verweigert" : "GPS-Fehler"}
      </span>
    );
  }
  if (status === "active") {
    const color = accuracyM == null ? "bg-gray-400" : accuracyM <= 10 ? "bg-green-400" : accuracyM <= 25 ? "bg-yellow-400" : "bg-orange-400";
    return (
      <span className="flex items-center gap-1.5 text-xs text-white/50">
        <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
        {accuracyM != null ? `GPS ±${Math.round(accuracyM)} m` : "GPS aktiv"}
      </span>
    );
  }
  return null;
}

// ─── Metric tile ─────────────────────────────────────────────────────────────

function MetricTile({
  value,
  label,
  sub,
  large,
}: {
  value: string;
  label: string;
  sub?: string;
  large?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center">
      <span
        className={`tabular-nums font-bold text-white leading-none tracking-tight ${large ? "text-[72px]" : "text-[38px]"}`}
      >
        {value}
      </span>
      {sub && <span className="text-sm text-white/40 mt-0.5">{sub}</span>}
      <span className="text-xs text-white/35 mt-1 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─── Main full-screen component ───────────────────────────────────────────────

type Props = {
  gps: GPSTrackingData;
  elapsedText: string;
  sport: "Laufen" | "Radfahren";
  workoutTitle?: string;
  onFinish: () => void;
  onMinimize: () => void;
  onAbort: () => void;
};

export default function CardioGPSView({
  gps,
  elapsedText,
  sport,
  workoutTitle,
  onFinish,
  onMinimize,
  onAbort,
}: Props) {
  const isRunning = sport === "Laufen";
  const isSearching = gps.status === "requesting" || gps.status === "searching";
  const hasRoute = gps.trackPoints.length >= 2;

  const paceOrSpeed = isRunning
    ? gps.paceMinPerKm ?? (isSearching ? "–:––" : "–:––")
    : gps.status === "active" && gps.speedKmh > 0
    ? gps.speedKmh.toFixed(1)
    : "–";
  const paceOrSpeedSub = isRunning ? "min/km" : "km/h";
  const paceOrSpeedLabel = isRunning ? "Pace" : "Speed";

  const distanceStr = isSearching ? "–.––" : gps.distanceKm.toFixed(2);

  return (
    <div
      className="flex flex-col h-full w-full"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <div className="flex flex-col">
          <span className="text-xs text-white/40 uppercase tracking-widest">
            {isRunning ? "Laufen" : "Radfahren"}
          </span>
          {workoutTitle && (
            <span className="text-sm font-semibold text-white/70 mt-0.5 leading-none">
              {workoutTitle}
            </span>
          )}
        </div>
        <SignalBadge status={gps.status} accuracyM={gps.accuracyM} />
      </div>

      {/* ── GPS searching state ─────────────────────────────────────── */}
      {isSearching && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <span className="text-base text-white/60">Warte auf GPS-Signal…</span>
          <span className="text-sm text-white/30">Geh ins Freie für bestes Signal</span>
        </div>
      )}

      {/* ── GPS error/denied state ──────────────────────────────────── */}
      {(gps.status === "denied" || gps.status === "error") && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-4xl">📍</span>
          <span className="text-sm text-red-400">{gps.error ?? "GPS nicht verfügbar"}</span>
          <span className="text-xs text-white/30">
            Zeit läuft weiter. Distanz kann nicht erfasst werden.
          </span>
          {/* Still show timer so the workout isn't stuck */}
          <div className="mt-6 tabular-nums text-6xl font-bold text-white">{elapsedText}</div>
          <span className="text-xs text-white/30 uppercase tracking-widest">Zeit</span>
        </div>
      )}

      {/* ── Active / idle tracking ──────────────────────────────────── */}
      {!isSearching && gps.status !== "denied" && gps.status !== "error" && (
        <div className="flex flex-1 flex-col">
          {/* Distance — hero number */}
          <div className="flex flex-col items-center justify-center flex-1 pt-4 pb-2">
            <MetricTile value={distanceStr} sub="km" label="Strecke" large />
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-b border-white/8 mx-0">
            <div className="bg-[#061226] py-4 flex flex-col items-center border-r border-white/8">
              <MetricTile value={elapsedText} label="Zeit" />
            </div>
            <div className="bg-[#061226] py-4 flex flex-col items-center">
              <MetricTile value={paceOrSpeed} sub={paceOrSpeedSub} label={paceOrSpeedLabel} />
            </div>
          </div>

          {/* Route trace */}
          <div className="px-4 py-3">
            {hasRoute ? (
              <div className="rounded-2xl overflow-hidden border border-white/8 bg-white/3 p-2">
                <RouteSVG points={gps.trackPoints} height={140} showLiveDot />
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/3 h-[100px] flex items-center justify-center">
                <span className="text-xs text-white/20">Route erscheint sobald du dich bewegst</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="px-4 pb-3 pt-2">
        {/* Stop button — primary action, full width */}
        <button
          type="button"
          onClick={onFinish}
          className="w-full h-14 rounded-2xl bg-[#2563EB] text-white text-base font-bold shadow-[0_0_24px_theme(colors.blue.600/40%)] hover:bg-blue-500 active:scale-[0.98] transition-transform mb-3"
        >
          Training beenden
        </button>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onMinimize}
            className="h-11 rounded-xl border border-white/10 bg-white/8 text-sm font-semibold text-white hover:bg-white/15 active:scale-[0.97] transition-transform"
          >
            Minimieren
          </button>
          <button
            type="button"
            onClick={onAbort}
            className="h-11 rounded-xl border border-white/10 bg-white/8 text-sm text-white/60 hover:bg-white/15 active:scale-[0.97] transition-transform"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
