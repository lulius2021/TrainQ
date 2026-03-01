import React, { useMemo, useState, useRef, useEffect } from "react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
} from "recharts";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { EXERCISES } from "../../data/exerciseLibrary";
import type { Muscle } from "../../data/exerciseLibrary";
import {
    type MuscleDetailMode,
    SIMPLE_GROUP_MAP,
    SIMPLE_GROUP_ORDER,
    COMPLEX_MUSCLE_LABELS,
    getMuscleDetailMode,
    setMuscleDetailMode,
    groupBySimple,
} from "../../utils/muscleGrouping";

interface MuscleSplitChartProps {
    workouts: WorkoutHistoryEntry[];
}

export const MuscleSplitChart: React.FC<MuscleSplitChartProps> = ({ workouts }) => {
    const [mode, setMode] = useState<MuscleDetailMode>(() => getMuscleDetailMode());
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) setSize({ w, h });
    }, []);

    const handleModeChange = (newMode: MuscleDetailMode) => {
        setMode(newMode);
        setMuscleDetailMode(newMode);
    };

    const perMuscleVolume = useMemo(() => {
        const volume: Partial<Record<Muscle, number>> = {};
        workouts.forEach(w => {
            w.exercises.forEach(exHistory => {
                const exDef = exHistory.exerciseId
                    ? EXERCISES.find(e => e.id === exHistory.exerciseId)
                    : undefined;
                if (!exDef) return;
                const setCount = exHistory.sets?.length || 1;
                const muscles: Muscle[] = [
                    ...(exDef.primaryMuscles || []),
                    ...(exDef.secondaryMuscles || []),
                ];
                muscles.forEach(m => {
                    volume[m] = (volume[m] || 0) + setCount;
                });
            });
        });
        return volume as Record<string, number>;
    }, [workouts]);

    const data = useMemo(() => {
        if (mode === "einfach") {
            const grouped = groupBySimple(perMuscleVolume);
            const groupedValues = Object.values(grouped);
            const maxScore = groupedValues.length > 0 ? Math.max(...groupedValues, 10) : 10;
            return SIMPLE_GROUP_ORDER.map(group => ({
                subject: group,
                A: grouped[group],
                fullMark: Math.max(maxScore * 1.2, 10),
            }));
        }
        const entries = (Object.keys(SIMPLE_GROUP_MAP) as Muscle[])
            .map(muscle => ({
                muscle,
                label: COMPLEX_MUSCLE_LABELS[muscle],
                value: (perMuscleVolume[muscle] || 0) as number,
            }))
            .filter(e => e.value > 0);
        if (entries.length < 3) {
            const remaining = (Object.keys(SIMPLE_GROUP_MAP) as Muscle[])
                .filter(m => !entries.some(e => e.muscle === m));
            for (const m of remaining) {
                if (entries.length >= 3) break;
                entries.push({ muscle: m, label: COMPLEX_MUSCLE_LABELS[m], value: 0 });
            }
        }
        const entryValues = entries.map(e => e.value);
        const maxScore = entryValues.length > 0 ? Math.max(...entryValues, 10) : 10;
        return entries.map(e => ({
            subject: e.label,
            A: e.value,
            fullMark: Math.max(maxScore * 1.2, 10),
        }));
    }, [mode, perMuscleVolume]);

    const maxVal = useMemo(() => {
        const vals = data.map(d => d.A);
        return vals.length > 0 ? Math.max(...vals, 5) : 5;
    }, [data]);

    const tickFontSize = mode === "komplex" ? 10 : 12;

    return (
        <div className="w-full bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-5 flex flex-col items-center justify-center relative shadow-sm h-[320px]">
            <h3 className="absolute top-5 left-5 text-sm font-medium text-[var(--text-secondary)]">
                Muscle Balance
            </h3>
            <div className="absolute top-4 right-4 flex bg-[var(--button-bg)] p-0.5 rounded-lg z-10">
                <button
                    onClick={() => handleModeChange("einfach")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        mode === "einfach" ? "bg-blue-500 text-white shadow-sm" : "text-[var(--text-secondary)]"
                    }`}
                >
                    Einfach
                </button>
                <button
                    onClick={() => handleModeChange("komplex")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        mode === "komplex" ? "bg-blue-500 text-white shadow-sm" : "text-[var(--text-secondary)]"
                    }`}
                >
                    Komplex
                </button>
            </div>
            <div ref={containerRef} className="w-full h-full mt-4">
                {size.w > 0 && size.h > 0 && (
                    <RadarChart width={size.w} height={size.h} cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="var(--chart-grid)" />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{ fill: "var(--text-color)", fontSize: tickFontSize, fontWeight: 500 }}
                        />
                        <PolarRadiusAxis angle={30} domain={[0, maxVal]} tick={false} axisLine={false} />
                        <Radar
                            name="Score"
                            dataKey="A"
                            stroke="#007AFF"
                            strokeWidth={3}
                            fill="#007AFF"
                            fillOpacity={0.3}
                            isAnimationActive={false}
                        />
                    </RadarChart>
                )}
            </div>
        </div>
    );
};
