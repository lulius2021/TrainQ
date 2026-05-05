// Onboarding Step: Connect Strava/Garmin + Export Preferences
import React, { useState, useEffect } from "react";

interface StepConnectionsProps {
  onNext: () => void;
  onBack: () => void;
}

export const StepConnections: React.FC<StepConnectionsProps> = ({ onNext, onBack }) => {
  const [stravaConnected, setStravaConnected] = useState(false);
  const [stravaLoading, setStravaLoading] = useState(false);
  const [stravaAthlete, setStravaAthlete] = useState<string | null>(null);
  const [exportSports, setExportSports] = useState<string[]>(["gym", "laufen", "radfahren"]);

  useEffect(() => {
    import("../../../services/stravaService").then(({ stravaService }) => {
      setStravaConnected(stravaService.isConnected());
      setStravaAthlete(stravaService.getAthleteName());
      setExportSports(stravaService.getExportSports());
    }).catch(() => {});
  }, []);

  const handleStravaConnect = async () => {
    setStravaLoading(true);
    try {
      const { stravaService } = await import("../../../services/stravaService");
      await stravaService.connect();
      setStravaConnected(true);
      setStravaAthlete(stravaService.getAthleteName());
    } catch {} finally { setStravaLoading(false); }
  };

  const toggleSport = (sport: string) => {
    const next = exportSports.includes(sport) ? exportSports.filter((s) => s !== sport) : [...exportSports, sport];
    setExportSports(next);
    import("../../../services/stravaService").then(({ stravaService }) => stravaService.setExportSports(next));
  };

  const sportLabels = [
    { id: "gym", label: "Gym", icon: "🏋️" },
    { id: "laufen", label: "Laufen", icon: "🏃" },
    { id: "radfahren", label: "Radfahren", icon: "🚴" },
  ];

  return (
    <div className="flex flex-col h-full px-6 pt-16 pb-10">
      {/* Progress */}
      <div className="flex gap-1.5 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ backgroundColor: i <= 4 ? "#007AFF" : "rgba(255,255,255,0.15)" }} />
        ))}
      </div>

      <h1 className="text-2xl font-bold mb-2">Verbindungen</h1>
      <p className="text-[15px] text-white/60 mb-8">Verbinde deine Fitness-Apps um Workouts automatisch zu synchronisieren.</p>

      {/* Strava */}
      <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#FC4C02]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="12,2 16,14 8,14" /><polygon points="8,14 6,20 12,14" opacity="0.6"/><polygon points="16,14 18,20 12,14" opacity="0.6"/></svg>
            </div>
            <div>
              <p className="font-semibold text-[15px]">Strava</p>
              {stravaConnected && stravaAthlete && <p className="text-[12px] text-white/50">{stravaAthlete}</p>}
            </div>
          </div>
          <button
            onClick={stravaConnected ? undefined : handleStravaConnect}
            disabled={stravaLoading}
            className="px-4 py-1.5 rounded-full text-[13px] font-semibold"
            style={{
              backgroundColor: stravaConnected ? "rgba(52,199,89,0.15)" : "rgba(252,76,2,0.15)",
              color: stravaConnected ? "#34C759" : "#FC4C02",
            }}
          >
            {stravaLoading ? "..." : stravaConnected ? "Verbunden ✓" : "Verbinden"}
          </button>
        </div>

        {/* Export sports */}
        {stravaConnected && (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">Welche Sportarten exportieren?</p>
            <div className="flex gap-2">
              {sportLabels.map(({ id, label, icon }) => {
                const active = exportSports.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleSport(id)}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.97]"
                    style={{
                      backgroundColor: active ? "rgba(252,76,2,0.15)" : "rgba(255,255,255,0.05)",
                      color: active ? "#FC4C02" : "rgba(255,255,255,0.4)",
                      border: active ? "1.5px solid #FC4C02" : "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    {icon} {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Garmin placeholder */}
      <div className="rounded-2xl p-4 mb-4 opacity-50" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div>
            <p className="font-semibold text-[15px]">Garmin Connect</p>
            <p className="text-[12px] text-white/40">Bald verfügbar</p>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Nav buttons */}
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 rounded-2xl font-semibold text-white/60" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          Zurück
        </button>
        <button onClick={onNext} className="flex-1 py-4 rounded-2xl font-bold text-white bg-[#007AFF]">
          {stravaConnected ? "Weiter" : "Überspringen"}
        </button>
      </div>
    </div>
  );
};
