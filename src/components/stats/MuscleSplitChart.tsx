import React, { useMemo } from "react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip
} from "recharts";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { EXERCISES } from "../../data/exerciseLibrary";

interface MuscleSplitChartProps {
    workouts: WorkoutHistoryEntry[];
}

// Mapping to German Axes
// 6 Fixed Axes: Brust, Rücken, Beine, Arme, Bauch, Cardio
const MUSCLE_TARGETS: Record<string, string> = {
    // Brust
    "chest": "Brust",

    // Rücken
    "back": "Rücken",
    "lats": "Rücken",
    "traps": "Rücken",
    "lower_back": "Rücken",

    // Beine
    "legs": "Beine",
    "quads": "Beine",
    "hamstrings": "Beine",
    "glutes": "Beine",
    "calves": "Beine",
    "hip_flexors": "Beine",

    // Arme (+ Schultern)
    "biceps": "Arme",
    "triceps": "Arme",
    "forearms": "Arme",
    "shoulders": "Arme",
    "front_delts": "Arme",
    "side_delts": "Arme",
    "rear_delts": "Arme",

    // Bauch
    "core": "Bauch",
    "obliques": "Bauch",
    "abs": "Bauch"
};

export const MuscleSplitChart: React.FC<MuscleSplitChartProps> = ({ workouts }) => {

    const data = useMemo(() => {
        // 1. Initialize count per specific group
        const counts: Record<string, number> = {
            "Brust": 0,
            "Rücken": 0,
            "Beine": 0,
            "Arme": 0,
            "Bauch": 0,
            "Cardio": 0
        };

        // 2. Iterate workouts
        workouts.forEach(w => {
            const sport = (w.sport || "").toLowerCase().trim();

            // Rule: Cardio Workouts give points to Cardio immediately
            // 3 points per workout to make it visible against sets
            if (sport === 'laufen' || sport === 'running' || sport === 'radfahren' || sport === 'cycling' || sport === 'cardio') {
                counts["Cardio"] = (counts["Cardio"] || 0) + 3;
            }

            // Count exercises
            w.exercises.forEach(exHistory => {
                let exDef = exHistory.exerciseId ? EXERCISES.find(e => e.id === exHistory.exerciseId) : undefined;

                // Fallback: If no ID or not found, try to find by name (unsafe but better than nothing for legacy)
                if (!exDef && exHistory.name) {
                    // Simple name match? skip for now to avoid false positives
                }

                if (exDef) {
                    const primaries = exDef.primaryMuscles || [];
                    const setAmount = exHistory.sets.length;

                    // Distribute set count to mapped groups
                    primaries.forEach(m => {
                        const target = MUSCLE_TARGETS[m];
                        if (target) {
                            counts[target] = (counts[target] || 0) + setAmount;
                        }
                    });
                }
            });
        });

        // 3. Format for Recharts
        // Order is critical for the visual shape
        const orderedKeys = ["Brust", "Rücken", "Beine", "Arme", "Bauch", "Cardio"];

        // Find rough max for scaling "fullMark"
        // But for radar chart, fullMark isn't strictly needed for scaling if we use domain, 
        // but helpful for visual reference logic if we calculate percentages.
        // We just pass raw set counts.
        return orderedKeys.map(key => ({
            subject: key,
            A: counts[key],
            fullMark: 100,
        }));

    }, [workouts]);

    // Determine max value for dynamic scaling of the chart
    const maxVal = Math.max(...data.map(d => d.A), 5); // at least 5 to avoid flat charts

    return (
        <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col items-center justify-center relative shadow-sm h-[320px]">
            <h3 className="absolute top-5 left-5 text-sm font-medium text-[var(--muted)]">Muscle Balance</h3>

            <div className="w-full h-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: "var(--text)", fontSize: 13, fontWeight: 500 }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, maxVal]} tick={false} axisLine={false} />
                        <Radar
                            name="Score"
                            dataKey="A"
                            stroke="#007AFF"
                            strokeWidth={3}
                            fill="#007AFF"
                            fillOpacity={0.3}
                        />
                        <Tooltip
                            cursor={false}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-[#1c1c1e] border border-white/10 rounded-xl px-3 py-2 shadow-xl">
                                            <p className="text-white font-semibold text-sm">{d.subject}</p>
                                            <p className="text-white/60 text-xs">
                                                {d.subject === 'Cardio' ? `${d.A} Points` : `${d.A} Sets`}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
