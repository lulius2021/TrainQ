import React from "react";
import { History, X, Footprints, Bike, Dumbbell, MapPin, Timer } from "lucide-react";
import { AppButton } from "../ui/AppButton";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { useSafeAreaInsets } from "../../hooks/useSafeAreaInsets";
import { formatPace, formatDistanceKm } from "../../utils/gpsUtils";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface WorkoutHistoryOverlayProps {
    onClose: () => void;
    workouts: WorkoutHistoryEntry[];
    onShare: (w: WorkoutHistoryEntry) => void;
}

// Helpers
function normalizeSport(s?: string): "Gym" | "Laufen" | "Radfahren" | "Custom" | "Unknown" {
    const t = (s || "").trim().toLowerCase();
    if (t === "gym") return "Gym";
    if (t === "laufen") return "Laufen";
    if (t === "radfahren") return "Radfahren";
    if (t === "custom") return "Custom";
    return "Unknown";
}

function toLocalDateLabel(iso?: string): string {
    if (!iso) return "–";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function durationMinutes(w: WorkoutHistoryEntry): number {
    return Math.max(0, Math.round((w.durationSec ?? 0) / 60));
}

export const WorkoutHistoryOverlay: React.FC<WorkoutHistoryOverlayProps> = ({ onClose, workouts, onShare }) => {
    const insets = useSafeAreaInsets();
    useBodyScrollLock(true);

    return (
        <div className="fixed inset-0 z-[50] flex flex-col animate-in fade-in duration-200" style={{ backgroundColor: "var(--card-bg)" }}>
            {/* Header */}
            <div
                style={{ paddingTop: Math.max(insets.top, 20), backgroundColor: "var(--modal-header)", borderColor: "var(--border-color)" }}
                className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pb-4 border-b backdrop-blur-xl"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-2xl rounded-full" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}>
                        <History className="w-5 h-5" style={{ color: "var(--text-color)" }} />
                    </div>
                    <h2 className="text-xl font-bold" style={{ color: "var(--text-color)" }}>Deine Historie</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl transition-colors" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-secondary)" }}>
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div
                style={{ paddingTop: Math.max(insets.top, 20) + 80 }}
                className="flex-1 overflow-y-auto p-4 pb-32 space-y-3 custom-scrollbar"
            >
                {workouts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={{ backgroundColor: "var(--input-bg)" }}>
                            📅
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-medium" style={{ color: "var(--text-color)" }}>Keine Trainings gefunden</h3>
                            <p className="text-sm max-w-xs" style={{ color: "var(--text-muted)" }}>Sobald du ein Training absolvierst, erscheint es hier in deiner Historie.</p>
                        </div>
                    </div>
                )}

                {workouts.map((w) => {
                    const sport = normalizeSport(w.sport);
                    const isCardio = sport === "Laufen" || sport === "Radfahren";
                    const exCount = (w.exercises ?? []).length;
                    const date = toLocalDateLabel(w.endedAt ?? w.startedAt);
                    const mins = durationMinutes(w);

                    const sportConfig = sport === "Laufen"
                        ? { icon: <Footprints size={16} />, color: "#34C759", bg: "rgba(52,199,89,0.1)" }
                        : sport === "Radfahren"
                        ? { icon: <Bike size={16} />, color: "#FF9500", bg: "rgba(255,149,0,0.1)" }
                        : { icon: <Dumbbell size={16} />, color: "#007AFF", bg: "rgba(0,122,255,0.1)" };

                    return (
                        <div key={w.id} className="rounded-2xl p-4 border transition-all" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: sportConfig.bg, color: sportConfig.color }}
                                    >
                                        {sportConfig.icon}
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold" style={{ color: "var(--text-color)" }}>{w.title ?? "Training"}</h4>
                                        <div className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--text-muted)" }}>{date}</div>
                                    </div>
                                </div>
                                <div className="px-2 py-1 rounded-lg text-[11px] font-bold" style={{ backgroundColor: sportConfig.bg, color: sportConfig.color }}>
                                    {sport}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm mb-3 flex-wrap" style={{ color: "var(--text-secondary)" }}>
                                <span className="flex items-center gap-1.5">
                                    <Timer size={14} /> {mins} min
                                </span>

                                {isCardio && w.distanceKm != null && w.distanceKm > 0 ? (
                                    <>
                                        <span className="flex items-center gap-1.5" style={{ color: sportConfig.color }}>
                                            <MapPin size={14} /> {formatDistanceKm(w.distanceKm * 1000)}
                                        </span>
                                        {w.paceSecPerKm != null && w.paceSecPerKm > 0 && (
                                            <span className="flex items-center gap-1.5">
                                                ⚡ {formatPace(w.paceSecPerKm)}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="flex items-center gap-1.5">
                                        <Dumbbell size={14} /> {exCount > 0 ? `${exCount} Übung${exCount === 1 ? "" : "en"}` : "—"}
                                    </span>
                                )}

                                {!isCardio && w.totalVolume > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        {Math.round(w.totalVolume).toLocaleString("de-DE")} kg
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-3 border-t" style={{ borderColor: "var(--border-color)" }}>
                                <AppButton
                                    onClick={() => onShare(w)}
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-2xl h-8 text-xs border w-full justify-center"
                                    style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                                >
                                    Teilen / Exportieren
                                </AppButton>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
