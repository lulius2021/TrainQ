import React, { useMemo } from "react";
import { ChevronRight, Dumbbell, Zap } from "lucide-react";
import type { LiveWorkout } from "../../types/training"; // Adjust import path if needed
import { useTheme } from "../../context/ThemeContext";

interface Props {
    workout: LiveWorkout;
    onOpenOverlay: () => void;
}

export const LiveStatsPanel: React.FC<Props> = ({ workout, onOpenOverlay }) => {
    const { theme } = useTheme();

    const stats = useMemo(() => {
        let totalVolume = 0;
        let completedSets = 0;

        if (workout && workout.exercises) {
            workout.exercises.forEach((ex) => {
                ex.sets.forEach((set) => {
                    if (set.completed) {
                        completedSets++;
                        const weight = set.weight || 0;
                        const reps = set.reps || 0;
                        totalVolume += weight * reps;
                    }
                });
            });
        }

        return { totalVolume, completedSets };
    }, [workout]);

    if (!workout) return null;

    return (
        <div
            className="w-full border-t transition-all duration-300"
            style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-color)" }}
        >
            {/* HUD BAR -> Opens Overlay */}
            <button
                onClick={onOpenOverlay}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium active:opacity-70"
                style={{ color: "var(--text-secondary)" }}
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <Zap size={14} className="text-blue-400 fill-blue-400/20" />
                        <span className="tabular-nums" style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>{stats.completedSets} Sätze</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                        <Dumbbell size={14} className="fill-emerald-400/20" />
                        <span className="tabular-nums">{(stats.totalVolume / 1000).toFixed(3)}t</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    Statistik
                    <ChevronRight size={14} />
                </div>
            </button>
        </div>
    );
};
