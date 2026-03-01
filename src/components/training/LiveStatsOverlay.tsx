import React, { useMemo } from "react";
import { X, Trophy, TrendingUp, Dumbbell, Activity, Calendar } from "lucide-react";
import type { LiveWorkout, ExerciseHistoryEntry } from "../../types/training";
import { EXERCISES, type Muscle } from "../../data/exerciseLibrary";
import { RadarChart } from "../stats/RadarChart";
import { AppCard } from "../ui/AppCard";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workout: LiveWorkout;
    historyMap: Map<string, ExerciseHistoryEntry | null>;
}

export const LiveStatsOverlay: React.FC<Props> = ({ isOpen, onClose, workout, historyMap }) => {
    // --- STATS CALCULATION ---
    const stats = useMemo(() => {
        let currentVolume = 0;
        let completedSets = 0;
        const muscleCounts: Record<string, number> = {};
        let progressionScore = 0; // Simple "points" logic
        let personalRecords = 0;

        // Iterate over active exercises
        workout.exercises.forEach((ex) => {
            // Basic info
            const def = EXERCISES.find((e) => e.id === ex.exerciseId);
            const muscle = def?.primaryMuscles?.[0] || "Ganzkörper";

            const history = historyMap.get(ex.id) || null;
            let maxWeightPrev = 0;
            if (history?.sets) {
                maxWeightPrev = Math.max(...history.sets.map(s => s.weight || 0));
            }

            ex.sets.forEach((set) => {
                if (set.completed) {
                    completedSets++;
                    const w = set.weight || 0;
                    const r = set.reps || 0;

                    // Volume
                    currentVolume += w * r;

                    // Muscle Focus (weighted by Sets)
                    muscleCounts[muscle] = (muscleCounts[muscle] || 0) + 1;

                    // Progression Points (Example: Volume / 100)
                    progressionScore += (w * r) / 100;

                    // Valid PR Check? (If weight > maxPrev)
                    if (w > maxWeightPrev && maxWeightPrev > 0) {
                        personalRecords++;
                    }
                }
            });
        });

        // Format for Radar Chart
        // 1. Find max sets for any muscle to normalize
        const muscleCountValues = Object.values(muscleCounts);
        const maxMuscleSets = muscleCountValues.length > 0 ? Math.max(...muscleCountValues, 1) : 1;

        // 2. Map to RadarDataPoint
        // Preferred order for Radar: Chest -> Shoulders -> Arms -> Core -> Legs -> Back (Circular flow)
        // or just sort by count. Radar looks best with fixed axes usually.
        const radarAxes: Muscle[] = ["chest", "front_delts", "triceps", "biceps", "back", "lats", "quads", "hamstrings"];
        const radarData = radarAxes.map(m => {
            const count = (muscleCounts[m] || 0) + (muscleCounts[translateMuscleToEn(m)] || 0);
            // Note: muscleCounts keys come from `def.primaryMuscles` which are English keys in `exerciseLibrary.ts`
            // But `LiveStatsPanel` logic might have localized them? No, here I use raw logic.
            return {
                label: formatMuscleShort(m),
                value: count,
                fullMark: maxMuscleSets,
            };
        });

        // Clean up empty axes if we want a dynamic chart, 
        // OR keep fixed axes for consistency. Let's filter to active ones if too sparse, 
        // but Radar needs at least 3 points.
        // Let's use the explicit calculated counts from the current workout.

        // Better Approach: Get top 5-6 active muscles
        const activeMuscles = Object.entries(muscleCounts)
            .map(([m, count]) => ({ label: formatMuscle(m), value: count, fullMark: maxMuscleSets }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        // If less than 3, fill with placeholders to allow polygon rendering
        while (activeMuscles.length < 3) {
            activeMuscles.push({ label: "", value: 0, fullMark: maxMuscleSets });
        }

        return {
            currentVolume,
            completedSets,
            progressionScore,
            personalRecords,
            radarData: activeMuscles
        };
    }, [workout, historyMap]);

    if (!isOpen) return null;

    return (

        <div
            className="fixed inset-0 z-[80] flex flex-col animate-in fade-in duration-200"
            style={{ backgroundColor: "var(--bg-color)" }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >

            {/* HEADER */}
            <div className="flex items-center justify-between px-4 pt-safe pb-3" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
                <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-color)" }}>Workout Statistik</h2>
                <button
                    onClick={(e) => { e.stopPropagation(); onClose(); }}
                    className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ backgroundColor: "var(--button-bg)", color: "var(--text-secondary)" }}
                >
                    <X size={18} />
                </button>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="overflow-y-auto flex-1 px-4 pb-safe" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}>

                {/* HERO RADAR */}
                <div className="flex flex-col items-center justify-center py-4">
                    <RadarChart data={stats.radarData} size={280} color="#3b82f6" />
                    <p className="mt-[-10px] text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Muskel Fokus</p>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-2 gap-3">
                    <StatBox
                        label="Volumen"
                        value={`${(stats.currentVolume / 1000).toFixed(3)}t`}
                        icon={<Dumbbell size={16} className="text-blue-400" />}
                        subtext="Total Load"
                    />
                    <StatBox
                        label="Sätze"
                        value={stats.completedSets}
                        icon={<Activity size={16} className="text-emerald-400" />}
                        subtext="Completed"
                    />
                    <StatBox
                        label="Beast Score"
                        value={Math.round(stats.progressionScore)}
                        icon={<TrendingUp size={16} className="text-amber-400" />}
                        subtext="Intensity Points"
                    />
                    <StatBox
                        label="Records"
                        value={stats.personalRecords}
                        icon={<Trophy size={16} className="text-purple-400" />}
                        subtext="New Bests"
                        highlight={stats.personalRecords > 0}
                    />
                </div>

                {/* PROGRESSION INSIGHT */}
                <AppCard variant="glass" className="p-4 relative overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Calendar size={80} style={{ color: "var(--text-color)" }} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-color)" }}>Session Progress</h3>
                        <p className="text-xs leading-relaxed max-w-[85%]" style={{ color: "var(--text-muted)" }}>
                            {stats.currentVolume > 5000
                                ? "Starke Leistung! Du bewegst heute ordentlich Gewicht."
                                : "Guter Start. Bleib dran und steigere dich Satz für Satz."}
                        </p>

                        <div className="mt-4 flex items-center gap-2">
                            <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--input-bg)" }}>
                                <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 w-[60%]" />
                            </div>
                            <span className="text-[10px] font-mono text-emerald-400">ON TRACK</span>
                        </div>
                    </div>
                </AppCard>

            </div>
        </div>
    );
};

// --- SUBCOMPONENTS ---

const StatBox = ({ label, value, icon, subtext, highlight }: any) => (
    <div className={`rounded-2xl p-4 border transition-colors`} style={{
        backgroundColor: highlight ? "rgba(168, 85, 247, 0.1)" : "var(--input-bg)",
        borderColor: highlight ? "rgba(168, 85, 247, 0.2)" : "var(--border-color)"
    }}>
        <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
            {icon}
        </div>
        <div className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-color)" }}>
            {value}
        </div>
        {subtext && <div className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{subtext}</div>}
    </div>
);

// --- HELPERS ---

function formatMuscle(m: string) {
    const map: Record<string, string> = {
        chest: "Brust", back: "Rücken", lats: "Lat", traps: "Nacken",
        rear_delts: "Rück. Schulter", front_delts: "Vord. Schulter", side_delts: "Seitl. Schulter",
        biceps: "Bizeps", triceps: "Trizeps", forearms: "Unterarme",
        quads: "Beine (V)", hamstrings: "Beine (H)", glutes: "Gesäß",
        calves: "Waden", core: "Rumpf", obliques: "Seitl. Bauch",
        lower_back: "Unt. Rücken", hip_flexors: "Hüftbeuger"
    };
    return map[m] || m;
}

function formatMuscleShort(m: string) {
    const map: Record<string, string> = {
        chest: "Brust", back: "Rücken", lats: "Lat", traps: "Trap",
        rear_delts: "Delts(H)", front_delts: "Delts(V)", side_delts: "Delts(S)",
        biceps: "Bizeps", triceps: "Trizeps", forearms: "U-Arme",
        quads: "Quads", hamstrings: "Hams", glutes: "Po",
        calves: "Waden", core: "Abs", obliques: "Oblq",
        lower_back: "L-Back", hip_flexors: "Hip"
    };
    return map[m] || m.substring(0, 3);
}

function translateMuscleToEn(m: string): string {
    // Basic helper if needed, but we rely on English keys from data
    return m;
}
