
import React, { useState, useEffect, useMemo } from "react";
import { Info, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Exercise } from "../../data/exerciseLibrary";
import { useExerciseImage } from "../../hooks/useExerciseImage";
import { resolveExerciseGifSrc } from "../../utils/exerciseImage";
import { loadWorkoutHistory, type WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { useLiveTrainingStore } from "../../store/useLiveTrainingStore";
import { getInstructionsForExercise } from "../../data/exerciseInstructions";
import { BottomSheet } from "../common/BottomSheet";
import MuscleBodyMap from "./MuscleBodyMap";

// --- Augment Exercise type for instructions if needed (or correct usage below)
interface ExtendedExercise extends Exercise {
    instructions?: string[];
    cues?: string[];
}

interface ExerciseDetailViewProps {
    isOpen: boolean;
    onClose: () => void;
    exercise: ExtendedExercise | null;
}

// --- Icons ---
const MuscleBadge = ({ muscle }: { muscle: string }) => {
    const formatMuscle = (m: string) => m.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    return (
        <span className="px-3 py-1 rounded-full bg-blue-500/20 text-xs font-bold text-blue-400 border border-blue-500/20 uppercase tracking-wide">
            {formatMuscle(muscle)}
        </span>
    );
};

// --- DATA LOGIC ---
type ExerciseLog = {
    date: string; // ISO
    maxWeight: number;
    totalVolume: number; // sets * reps * weight
    estimated1RM: number; // Brzycki: w * (36 / (37 - r)) - max for the session
    repsAtMaxWeight: number;
    isLive?: boolean; // New flag for live data point
};

// --- CHART COMPONENT (SVG) ---
const SimpleLineChart = ({ data, dataKey, color = "#007AFF", label, suffix = "" }: { data: ExerciseLog[], dataKey: keyof ExerciseLog, color?: string, label: string, suffix?: string }) => {
    // Show chart if we have at least 1 point (visualize dot) or more
    if (data.length === 0) {
        return (
            <div className="h-32 rounded-2xl border flex items-center justify-center text-xs italic" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
                Noch keine Daten vorhanden
            </div>
        );
    }

    // Limit to last 10
    const chartData = data.slice(0, 10).reverse();

    const values = chartData.map(d => Number(d[dataKey]) || 0);
    const max = Math.max(...values, 1) * 1.1; // +10% padding
    let min = Math.max(0, Math.min(...values) * 0.9);

    // If variability is very low, stretch Y axis slightly to show line
    if (max - min < 5) min = Math.max(0, min - 5);

    const width = 100; // viewBox units
    const height = 50;

    // Points
    const points = values.map((v, i) => {
        // If single point, center it? No, keep left/right logic or just one dot
        const x = values.length > 1 ? (i / (values.length - 1)) * width : width / 2;
        const normalizedVal = (v - min) / (max - min || 1);
        const y = height - (normalizedVal * height);
        return `${x},${y}`;
    }).join(" ");

    // Last point emphasis
    const lastIdx = values.length - 1;
    const lastVal = values[lastIdx];
    const lastX = values.length > 1 ? width : width / 2;
    const lastY = height - (((lastVal - min) / (max - min || 1)) * height);
    const isLive = chartData[lastIdx].isLive;

    return (
        <div className="rounded-2xl border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
            <div className="flex justify-between items-end mb-4">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="text-lg font-black" style={{ color: "var(--text-color)" }}>
                    {values[values.length - 1].toFixed(1)}{suffix}
                    {isLive && <span className="ml-2 text-[10px] text-blue-400 font-bold uppercase tracking-wider align-middle bg-blue-500/20 px-1.5 py-0.5 rounded">Live</span>}
                </span>
            </div>
            <div className="relative w-full aspect-[2/1]">
                <svg viewBox={`0 0 ${width} ${height + 10}`} className="w-full h-full overflow-visible">
                    {values.length > 1 && (
                        <>
                            <polyline
                                fill="none"
                                stroke={color}
                                strokeWidth="2"
                                points={points}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                            />
                            <path
                                d={`M 0,${height} ${points} V ${height} Z`}
                                fill={color}
                                fillOpacity="0.1"
                            />
                        </>
                    )}

                    {/* Last Point Dot */}
                    <circle
                        cx={lastX}
                        cy={lastY}
                        r={isLive ? "4" : "3"}
                        fill={isLive ? "#fff" : "#fff"}
                        stroke={isLive ? "#007AFF" : color}
                        strokeWidth={isLive ? "3" : "2"}
                    >
                        {isLive && (
                            <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
                        )}
                    </circle>
                </svg>
            </div>
            <div className="mt-2 text-[10px] font-medium text-center" style={{ color: "var(--text-secondary)" }}>
                Letzte {chartData.length} Einheiten {isLive && "(inkl. Heute)"}
            </div>
        </div>
    );
};

export default function ExerciseDetailView({ isOpen, onClose, exercise }: ExerciseDetailViewProps) {
    const imageUrl = useExerciseImage(exercise);
    const gifSrc = useMemo(() => resolveExerciseGifSrc(exercise), [exercise?.id]);
    const [gifFailed, setGifFailed] = useState(false);

    // Reset gif error state when exercise changes
    useEffect(() => { setGifFailed(false); }, [exercise?.id]);

    // Live Workout Store Hook
    const activeWorkout = useLiveTrainingStore(state => state.activeWorkout);

    // --- STATE ---
    const [history, setHistory] = useState<ExerciseLog[]>([]);
    const [records, setRecords] = useState<{ maxWeight: number; maxVolume: number }>({ maxWeight: 0, maxVolume: 0 });
    const [instructionsOpen, setInstructionsOpen] = useState(false);

    // --- LOAD DATA + LIVE MERGE ---
    useEffect(() => {
        if (!isOpen || !exercise) return;

        const allWorkouts = loadWorkoutHistory(); // newest first
        const logs: ExerciseLog[] = [];
        let rWeight = 0;
        let rVolume = 0;

        // 1. Process History
        for (const w of allWorkouts) {
            const relevantEx = w.exercises.find(e =>
                (e.exerciseId === exercise.id) ||
                (e.name === exercise.name)
            );

            if (!relevantEx) continue;

            let sessionMaxWeight = 0;
            let sessionVol = 0;
            let sessionBest1RM = 0;
            let repsAtMax = 0;

            for (const s of relevantEx.sets) {
                const w = s.weight || 0;
                const r = s.reps || 0;

                if (w > 0 && r > 0) {
                    sessionVol += w * r;
                    if (w > sessionMaxWeight) {
                        sessionMaxWeight = w;
                        repsAtMax = r;
                    }
                    else if (w === sessionMaxWeight) {
                        repsAtMax = Math.max(repsAtMax, r);
                    }
                    const est1RM = w * (36 / (37 - r));
                    if (est1RM > sessionBest1RM) sessionBest1RM = est1RM;
                }
            }

            if (sessionVol > 0 || sessionMaxWeight > 0) {
                logs.push({
                    date: w.startedAt,
                    maxWeight: sessionMaxWeight,
                    totalVolume: sessionVol,
                    estimated1RM: sessionBest1RM,
                    repsAtMaxWeight: repsAtMax
                });

                if (sessionMaxWeight > rWeight) rWeight = sessionMaxWeight;
                if (sessionVol > rVolume) rVolume = sessionVol;
            }
        }

        // 2. CHECK ACTIVE LIVE WORKOUT (Real-Time Update)
        if (activeWorkout) {
            // FIX: Safely access exercise ID logic from previous turn
            const foundLiveEx = activeWorkout.exercises.find(e =>
                (e.exerciseId === exercise.id) || (e.name === exercise.name)
            );

            if (foundLiveEx) {
                let liveMaxWeight = 0;
                let liveVol = 0;
                let liveBest1RM = 0;
                let liveRepsMax = 0;
                let hasValidSet = false;

                for (const s of foundLiveEx.sets) {
                    const w = s.weight || 0;
                    const r = s.reps || 0;

                    if (s.completed && w > 0 && r > 0) {
                        hasValidSet = true;
                        liveVol += w * r;
                        if (w > liveMaxWeight) {
                            liveMaxWeight = w;
                            liveRepsMax = r;
                        } else if (w === liveMaxWeight) {
                            liveRepsMax = Math.max(liveRepsMax, r);
                        }
                        const est1RM = w * (36 / (37 - r));
                        if (est1RM > liveBest1RM) liveBest1RM = est1RM;
                    }
                }

                if (hasValidSet) {
                    // Prepend live log (newest)
                    logs.unshift({
                        date: new Date().toISOString(),
                        maxWeight: liveMaxWeight,
                        totalVolume: liveVol,
                        estimated1RM: liveBest1RM,
                        repsAtMaxWeight: liveRepsMax,
                        isLive: true
                    });

                    // Update records if live is better
                    if (liveMaxWeight > rWeight) rWeight = liveMaxWeight;
                    if (liveVol > rVolume) rVolume = liveVol;
                }
            }
        }

        setHistory(logs);
        setRecords({ maxWeight: rWeight, maxVolume: rVolume });

    }, [isOpen, exercise, activeWorkout]);

    // --- INSTRUCTIONS ---
    const instructionSet = useMemo(() => {
        if (!exercise) return null;
        // Use mapped data from our enhanced utility
        const mapped = getInstructionsForExercise(exercise.name);
        return mapped;
    }, [exercise]);


    // Helper for animations
    const MotionContent = motion.div as any;

    if (!isOpen || !exercise) return null;

    return (
        <BottomSheet
            open={isOpen}
            onClose={onClose}
            height="auto"
            maxHeight="92dvh"
            zIndex={10020}
        >
            <div className="px-5 pb-8 space-y-6">
                {/* 1. HEADER & IMAGE */}
                <div>
                    <h1 className="text-2xl font-black leading-tight mb-3" style={{ color: "var(--text-color)" }}>
                        {exercise.name}
                    </h1>

                    {(gifSrc || imageUrl) && (
                        <div className="flex justify-center py-3">
                            {gifSrc && !gifFailed ? (
                                <img
                                    src={gifSrc}
                                    alt={exercise.name}
                                    onError={() => setGifFailed(true)}
                                    className="w-full max-w-[300px] rounded-2xl object-contain"
                                    style={{ backgroundColor: "#111" }}
                                />
                            ) : imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={exercise.name}
                                    className="w-full max-w-[280px] rounded-2xl object-cover"
                                    style={{ aspectRatio: "3/2" }}
                                />
                            ) : null}
                        </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                        {(exercise.primaryMuscles || []).map(m => (
                            <MuscleBadge key={m} muscle={m} />
                        ))}
                    </div>
                </div>

                {/* 2. RECORDS */}
                <div>
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Trophy size={16} className="text-yellow-500" />
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">All-Time Bestleistungen</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl p-4 border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Max Gewicht</div>
                            <div className="text-2xl font-black tracking-tight" style={{ color: "var(--text-color)" }}>
                                {records.maxWeight} <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>kg</span>
                            </div>
                        </div>
                        <div className="rounded-2xl p-4 border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                            <div className="text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>Max Volumen</div>
                            <div className="text-2xl font-black tracking-tight" style={{ color: "var(--text-color)" }}>
                                {records.maxVolume} <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>kg</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. CHARTS */}
                <div className="space-y-4">
                    <SimpleLineChart
                        label="1RM Trend (geschätzt)"
                        data={history}
                        dataKey="estimated1RM"
                        color="#32ADE6"
                        suffix=" kg"
                    />
                    <SimpleLineChart
                        label="Gewichtsentwicklung (Top Sets)"
                        data={history}
                        dataKey="maxWeight"
                        suffix=" kg"
                    />
                </div>

                {/* 4. INSTRUCTIONS */}
                <div className="rounded-2xl border overflow-hidden shadow-lg" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                    <button
                        onClick={() => setInstructionsOpen(!instructionsOpen)}
                        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:opacity-80"
                        style={{ backgroundColor: "var(--input-bg)" }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Info size={16} strokeWidth={2.5} />
                            </div>
                            <span className="font-bold text-base" style={{ color: "var(--text-color)" }}>Anleitung & Form</span>
                        </div>
                        {instructionsOpen ? <ChevronUp size={20} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={20} style={{ color: "var(--text-muted)" }} />}
                    </button>
                    <AnimatePresence>
                        {instructionsOpen && instructionSet && (
                            <MotionContent
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="px-5 pb-5 pt-2 space-y-4">
                                    <ul className="space-y-3">
                                        {instructionSet.steps.map((step, idx) => (
                                            <li key={idx} className="flex gap-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{ backgroundColor: "var(--input-bg)", color: "var(--text-muted)" }}>{idx + 1}</span>
                                                <span>{step}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="mt-4 bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                                        <span className="text-blue-400 text-xs font-black uppercase tracking-wider block mb-1">Pro Tipp</span>
                                        <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                                            {instructionSet.proTip}
                                        </p>
                                    </div>
                                </div>
                            </MotionContent>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </BottomSheet>
    );
}
