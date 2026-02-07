import React from "react";
import { History, X } from "lucide-react";
import { AppButton } from "../ui/AppButton";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { useSafeAreaInsets } from "../../hooks/useSafeAreaInsets";

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

    return (
        <div className="fixed inset-0 z-[50] bg-zinc-950 flex flex-col animate-in fade-in duration-200">
            {/* Header */}
            <div
                style={{ paddingTop: Math.max(insets.top, 20) }}
                className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pb-4 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl rounded-full">
                        <History className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Deine Historie</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
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
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-3xl">
                            📅
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-white font-medium">Keine Trainings gefunden</h3>
                            <p className="text-sm text-white/50 max-w-xs">Sobald du ein Training absolvierst, erscheint es hier in deiner Historie.</p>
                        </div>
                    </div>
                )}

                {workouts.map((w) => {
                    const sport = normalizeSport(w.sport);
                    const exCount = (w.exercises ?? []).length;
                    const date = toLocalDateLabel(w.endedAt ?? w.startedAt);
                    const mins = durationMinutes(w);

                    return (
                        <div key={w.id} className="rounded-3xl p-4 bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl border border-white/10 hover:border-white/20 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="text-xs text-white/50 uppercase font-semibold tracking-wider mb-1">{date}</div>
                                    <h4 className="text-base font-bold text-white">{w.title ?? "Training"}</h4>
                                </div>
                                <div className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-white/70">
                                    {sport}
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-white/60 mb-3">
                                <span className="flex items-center gap-1.5">
                                    ⏱ {mins} min
                                </span>
                                <span className="flex items-center gap-1.5">
                                    🏋️ {exCount > 0 ? `${exCount} Übung${exCount === 1 ? "" : "en"}` : "—"}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                                <AppButton
                                    onClick={() => onShare(w)}
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-2xl h-8 text-xs bg-white/5 hover:bg-white/10 border border-white/10 w-full justify-center"
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
