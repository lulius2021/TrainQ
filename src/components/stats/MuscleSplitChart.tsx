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

// --- ROBUST MUSCLE MAPPING LOGIC ---

// 1. Define the 5 Target Axes
const RADAR_CATEGORIES = {
    CHEST: 'Brust',
    BACK: 'Rücken',
    LEGS: 'Beine',
    ARMS: 'Arme',
    SHOULDERS: 'Schultern',
};

// 2. The Mapping Function
const getCategoryForMuscle = (muscleName: string): string | null => {
    const m = muscleName.toLowerCase().trim();

    // BRUST (Chest)
    if (m.includes('chest') || m.includes('brust') || m.includes('pectoralis') || m.includes('pecs')) {
        return RADAR_CATEGORIES.CHEST;
    }

    // RÜCKEN (Back)
    if (m.includes('back') || m.includes('rücken') || m.includes('lat') || m.includes('trapezius') || m.includes('rhomboid') || m.includes('lower back') || m.includes('erector')) {
        return RADAR_CATEGORIES.BACK;
    }

    // SCHULTERN (Shoulders)
    if (m.includes('shoulder') || m.includes('schulter') || m.includes('deltoid') || m.includes('delt')) {
        return RADAR_CATEGORIES.SHOULDERS;
    }

    // ARME (Arms - Biceps/Triceps/Forearms)
    if (m.includes('arm') || m.includes('biceps') || m.includes('triceps') || m.includes('bizeps') || m.includes('trizeps') || m.includes('forearm') || m.includes('unterarm')) {
        return RADAR_CATEGORIES.ARMS;
    }

    // BEINE (Legs)
    if (m.includes('leg') || m.includes('bein') || m.includes('quad') || m.includes('hamstring') || m.includes('glute') || m.includes('calf') || m.includes('wade') || m.includes('schenkel')) {
        return RADAR_CATEGORIES.LEGS;
    }

    return null; // Ignore unknown or 'Core'/'Abs' if not on chart
};

export const MuscleSplitChart: React.FC<MuscleSplitChartProps> = ({ workouts }) => {

    const data = useMemo(() => {
        // Init scores
        const scores: Record<string, number> = {
            [RADAR_CATEGORIES.CHEST]: 0,
            [RADAR_CATEGORIES.BACK]: 0,
            [RADAR_CATEGORIES.SHOULDERS]: 0,
            [RADAR_CATEGORIES.ARMS]: 0,
            [RADAR_CATEGORIES.LEGS]: 0,
        };

        workouts.forEach(w => {
            w.exercises.forEach(exHistory => {
                const exDef = exHistory.exerciseId ? EXERCISES.find(e => e.id === exHistory.exerciseId) : undefined;

                if (exDef) {
                    // Check both 'targetMuscle' (primary) and 'secondaryMuscles' arrays if available
                    // We map from exDef which has primaryMuscles and secondaryMuscles arrays
                    const musclesToCheck = [...(exDef.primaryMuscles || []), ...(exDef.secondaryMuscles || [])];

                    musclesToCheck.forEach(muscle => {
                        if (!muscle) return;
                        const category = getCategoryForMuscle(muscle);
                        if (category) {
                            // Add sets. Using Sets (default 1)
                            scores[category] = (scores[category] || 0) + (exHistory.sets?.length || 1);
                        }
                    });
                }
            });
        });

        // Convert to Chart Format
        // Order: Chest -> Shoulders -> Arms -> Back -> Legs
        const order = [
            RADAR_CATEGORIES.CHEST,
            RADAR_CATEGORIES.SHOULDERS,
            RADAR_CATEGORIES.ARMS,
            RADAR_CATEGORIES.BACK,
            RADAR_CATEGORIES.LEGS
        ];

        const maxScore = Math.max(...Object.values(scores)) || 10;

        return order.map(key => ({
            subject: key,
            A: scores[key],
            fullMark: Math.max(maxScore * 1.2, 10),
        }));

    }, [workouts]);

    // Determine max value for dynamic scaling of the chart
    const maxVal = Math.max(...data.map(d => d.A), 5); // at least 5 to avoid flat charts

    return (
        <div className="w-full bg-[#18181b] border border-[#27272a] rounded-2xl p-5 flex flex-col items-center justify-center relative shadow-sm h-[320px]">
            <h3 className="absolute top-5 left-5 text-sm font-medium text-zinc-500">Muscle Balance</h3>

            <div className="w-full h-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="#3f3f46" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: "#ffffff", fontSize: 12, fontWeight: 500 }}
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
                                        <div className="bg-[#1c1c1e] border border-white/10 rounded-3xl px-3 py-2 shadow-xl">
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
