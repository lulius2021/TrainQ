
import React from "react";
import type { WorkoutShareModel } from "../../utils/share/mapWorkoutToShareModel";

type Props = {
    model: WorkoutShareModel;
    userName: string;
};

export const WorkoutExportCard = ({ model, userName }: Props) => {
    const exercises = model.exercises || [];
    const exerciseLimit = 8;
    const showMoreCount = exercises.length > exerciseLimit ? exercises.length - exerciseLimit : 0;
    const visibleExercises = exercises.slice(0, exerciseLimit);

    // Helper for formatting
    const formatVolume = (kg?: number | null) => {
        if (!kg) return "0";
        if (kg >= 1000) return (kg / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " t";
        return Math.round(kg).toLocaleString("de-DE");
    };

    const formatDuration = (sec?: number | null) => {
        if (!sec) return "0";
        return Math.round(sec / 60);
    };

    // Stats Data
    const stats = [
        { label: "MINUTEN", value: formatDuration(model.durationSec) },
        { label: "VOLUMEN", value: formatVolume(model.totalVolumeKg) },
        { label: "REKORDE", value: model.highlights?.prsCount || 0 }, // Removed "PRs" suffix from value, kept label context
    ];

    return (
        <div
            id="trainq-share-card"
            className="relative w-[375px] h-[469px] bg-zinc-950 p-8 flex flex-col justify-between overflow-hidden shadow-2xl"
            // aspect-[4/5] approximated by fixed dimensions or utility: 
            // Tailwind 'aspect-[4/5]' works but for html2canvas specific pixel sizes are often safer.
            // 375 * 1.25 = 468.75 -> 469.
            style={{
                aspectRatio: "4/5",
                fontFamily: "'Inter', sans-serif" // Ensure custom font if loaded, or fallback
            }}
        >
            {/* Glow Effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-900/20 to-transparent pointer-events-none" />

            {/* 1. Header */}
            <div className="relative z-10 mb-6">
                <h2 className="text-3xl font-black text-white uppercase tracking-tight leading-none mb-2 break-words">
                    {model.title}
                </h2>
                <div className="text-zinc-500 text-sm font-medium tracking-wide uppercase">
                    {model.dateLabel}
                </div>
            </div>

            {/* 2. Hero Stats */}
            <div className="relative z-10 grid grid-cols-3 gap-4 mb-8">
                {stats.map((stat, i) => (
                    <div key={i} className="flex flex-col">
                        <span className="text-3xl font-bold text-white leading-tight">
                            {stat.value}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold mt-1">
                            {stat.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* 3. The Core List */}
            <div className="relative z-10 flex-1 flex flex-col gap-3">
                {visibleExercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-4">
                        {/* Sets Badge */}
                        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 text-blue-400 text-xs font-bold shadow-sm">
                            {ex.sets?.length || 0}
                        </div>
                        {/* Exercise Name */}
                        <span className="text-zinc-100 font-medium text-sm truncate leading-none pt-0.5">
                            {ex.name}
                        </span>
                    </div>
                ))}
                {showMoreCount > 0 && (
                    <div className="text-zinc-500 text-xs pl-12 font-medium">
                        + {showMoreCount} weitere Übungen
                    </div>
                )}
            </div>

            {/* 4. Footer */}
            <div className="relative z-10 mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Simple text logo if image not passed, or use TRAINQ text directly as requested */}
                    <span className="text-white font-black tracking-[0.2em] text-xs uppercase">TRAINQ AI</span>
                </div>
                <div className="text-zinc-500 text-xs font-medium tracking-wide">
                    @{userName}
                </div>
            </div>
        </div>
    );
};
