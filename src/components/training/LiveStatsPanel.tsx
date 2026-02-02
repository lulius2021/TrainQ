import React, { useMemo } from "react";
import { ChevronRight, Dumbbell, Zap } from "lucide-react";
import type { LiveWorkout } from "../../types/training"; // Adjust import path if needed
import { EXERCISES } from "../../data/exerciseLibrary";

interface Props {
    workout: LiveWorkout;
    onOpenOverlay: () => void;
}

export const LiveStatsPanel: React.FC<Props> = ({ workout, onOpenOverlay }) => {
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
        <div className="w-full border-t border-white/5 transition-all duration-300">
            {/* HUD BAR -> Opens Overlay */}
            <button
                onClick={onOpenOverlay}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-400 active:bg-white/5"
            >
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-blue-400">
                        <Zap size={14} className="fill-blue-400/20" />
                        <span className="tabular-nums">{stats.completedSets} Sätze</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-400">
                        <Dumbbell size={14} className="fill-emerald-400/20" />
                        <span className="tabular-nums">{(stats.totalVolume / 1000).toFixed(3)}t</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    Statistik
                    <ChevronRight size={14} />
                </div>
            </button>
        </div>
    );
};
