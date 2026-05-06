import React from "react";
import type { GPSTrackingData } from "../../hooks/useGPSTracking";

type Props = {
  gps: GPSTrackingData;
  elapsedText: string;
  sport: "Laufen" | "Radfahren";
};

function SignalDot({ accuracyM }: { accuracyM: number | null }) {
  if (accuracyM == null) return <span className="inline-block w-2 h-2 rounded-full bg-gray-500" />;
  if (accuracyM <= 10) return <span className="inline-block w-2 h-2 rounded-full bg-green-400" />;
  if (accuracyM <= 25) return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />;
  return <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />;
}

function SignalLabel({ status, accuracyM }: { status: GPSTrackingData["status"]; accuracyM: number | null }) {
  if (status === "requesting") return <span className="text-xs text-white/50">Berechtigung wird angefragt…</span>;
  if (status === "searching") return <span className="text-xs text-yellow-400">Suche GPS-Signal…</span>;
  if (status === "denied") return <span className="text-xs text-red-400">GPS verweigert</span>;
  if (status === "error") return <span className="text-xs text-red-400">GPS-Fehler</span>;
  if (status === "active" && accuracyM != null) {
    return <span className="text-xs text-white/50">±{Math.round(accuracyM)} m</span>;
  }
  return null;
}

export default function CardioGPSView({ gps, elapsedText, sport }: Props) {
  const isRunning = sport === "Laufen";
  const isSearching = gps.status === "requesting" || gps.status === "searching";

  // For cycling, show speed as primary secondary metric; for running, show pace
  const secondaryLabel = isRunning ? "Pace" : "Geschwindigkeit";
  const secondaryValue = isRunning
    ? gps.paceMinPerKm ?? (isSearching ? "–:––" : "–:––")
    : gps.status === "active"
    ? `${gps.speedKmh.toFixed(1)} km/h`
    : "–";
  const secondaryUnit = isRunning ? "min/km" : "";

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
      {/* Signal bar */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <SignalDot accuracyM={gps.accuracyM} />
        <SignalLabel status={gps.status} accuracyM={gps.accuracyM} />
        {gps.status === "active" && (
          <span className="ml-auto text-xs text-white/30">GPS aktiv</span>
        )}
      </div>

      {/* Main metrics */}
      <div className="px-4 pb-4">
        {/* Distance — big number like Strava */}
        <div className="flex flex-col items-center py-4">
          {isSearching ? (
            <div className="flex flex-col items-center gap-2">
              {/* Pulsing animation while searching */}
              <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              <span className="text-sm text-white/50 mt-1">
                {gps.status === "requesting" ? "GPS wird gestartet…" : "Warte auf GPS-Signal…"}
              </span>
              <span className="text-xs text-white/30 mt-0.5">
                Stelle sicher, dass du dich im Freien befindest
              </span>
            </div>
          ) : gps.status === "denied" || gps.status === "error" ? (
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl">📍</span>
              <span className="text-sm text-red-400 text-center px-4">
                {gps.error ?? "GPS nicht verfügbar"}
              </span>
              <span className="text-xs text-white/40 text-center mt-1">
                Distanz wird nicht automatisch erfasst
              </span>
            </div>
          ) : (
            <>
              <div className="tabular-nums text-6xl font-bold text-white leading-none tracking-tight">
                {gps.distanceKm.toFixed(2)}
              </div>
              <div className="text-base text-white/50 mt-1">km</div>
            </>
          )}
        </div>

        {/* Secondary metrics row */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Elapsed time */}
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 flex flex-col items-center">
            <span className="tabular-nums text-2xl font-semibold text-white">{elapsedText}</span>
            <span className="text-xs text-white/40 mt-0.5">Zeit</span>
          </div>

          {/* Pace / Speed */}
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 flex flex-col items-center">
            <span className="tabular-nums text-2xl font-semibold text-white">
              {secondaryValue}
            </span>
            <span className="text-xs text-white/40 mt-0.5">{secondaryLabel}</span>
            {secondaryUnit && (
              <span className="text-[10px] text-white/25">{secondaryUnit}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
