import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { AppButton } from "../ui/AppButton";
import { captureAndShare } from "../../utils/shareUtils";

type Props = {
    isOpen: boolean;
    year: number;
    month: number; // 0-11
    workouts: WorkoutHistoryEntry[];
    onClose: () => void;
};

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

export default function MonthlyRecapModal({ isOpen, year, month, workouts, onClose }: Props) {
    const monthName = useMemo(() => {
        return new Date(year, month).toLocaleString("de-DE", { month: "long" });
    }, [year, month]);

    // Filter workouts for this specific month
    const monthlyWorkouts = useMemo(() => {
        return workouts.filter((w) => {
            const d = new Date(w.startedAt); // or endedAt
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }, [workouts, year, month]);

    // Stats
    const stats = useMemo(() => {
        let totalCount = monthlyWorkouts.length;
        let totalSec = 0;
        let totalVolume = 0;

        monthlyWorkouts.forEach((w) => {
            totalSec += w.durationSec ?? 0;
            // Volume calculation if exercises exist
            if (w.exercises) {
                w.exercises.forEach((ex) => {
                    if (ex.sets) {
                        ex.sets.forEach((s) => {
                            const reps = s.reps || 0;
                            const weight = s.weight || 0;
                            totalVolume += reps * weight;
                        });
                    }
                });
            }
        });

        const hours = Math.round(totalSec / 3600);
        return {
            count: totalCount,
            hours,
            volume: totalVolume,
        };
    }, [monthlyWorkouts]);

    // Calendar Grid Generation
    const calendarGrid = useMemo(() => {
        const daysInMonth = getDaysInMonth(year, month);
        const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
        // Adjust to Monday start (0 = Mon, 6 = Sun)
        const startOffset = (firstDayOfWeek + 6) % 7;

        const days: Array<{ day: number; hasWorkout: boolean; sport?: string } | null> = [];

        // Empty slots
        for (let i = 0; i < startOffset; i++) {
            days.push(null);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const dayWorkouts = monthlyWorkouts.filter(w => new Date(w.startedAt).getDate() === d);
            const hasWorkout = dayWorkouts.length > 0;
            // Simple heuristic for icon: take first workout's sport
            const sport = hasWorkout ? dayWorkouts[0].sport : undefined;
            days.push({ day: d, hasWorkout, sport });
        }
        return days;
    }, [year, month, monthlyWorkouts]);

    // Weekly Distribution (Calculated)
    const weeklyDistribution = useMemo(() => {
        const buckets = [0, 0, 0, 0, 0];
        monthlyWorkouts.forEach(w => {
            const date = new Date(w.startedAt).getDate();
            const bucketIdx = Math.min(Math.floor((date - 1) / 7), 4);
            buckets[bucketIdx]++;
        });
        const max = Math.max(...buckets, 1);
        return buckets.map(val => ({ val, height: (val / max) * 100 }));
    }, [monthlyWorkouts]);

    const handleShare = async () => {
        await captureAndShare('monthly-recap-capture', `recap-${year}-${month + 1}.png`);
    };

    if (!isOpen) return null;

    const MotionDiv = motion.div as any;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl">
                {/* @ts-ignore: Framer Motion types conflict with React 18/19 in this setup */}
                <MotionDiv
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="w-full max-w-lg h-full max-h-screen overflow-y-auto bg-[#121212] text-white flex flex-col"
                >
                    {/* Close Button + Share */}
                    <div className="sticky top-0 z-10 flex justify-between p-4 bg-gradient-to-b from-[#121212] to-transparent items-center">
                        <button onClick={handleShare} className="bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] px-4 py-2 rounded-full text-sm font-bold transition-colors flex items-center gap-2">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                            Teilen
                        </button>
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md transition-colors">
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div id="monthly-recap-capture" className="px-6 pb-40 flex-1 space-y-10 bg-[#121212] text-white">
                        {/* Header */}
                        <div className="space-y-1">
                            <div className="text-[#007AFF] font-bold tracking-widest uppercase text-sm">Monatsrückblick</div>
                            <div className="flex flex-col leading-none">
                                <span className="text-5xl font-black text-white">{monthName}</span>
                                <span className="text-5xl font-thin text-white/40">{year}</span>
                            </div>
                        </div>

                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 flex flex-col justify-between h-32">
                                <span className="text-white/40 text-xs font-bold uppercase tracking-wider">Trainings</span>
                                <span className="text-3xl font-bold text-white mb-1">{stats.count}</span>
                            </div>
                            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 flex flex-col justify-between h-32">
                                <span className="text-white/40 text-xs font-bold uppercase tracking-wider">Zeit</span>
                                <span className="text-3xl font-bold text-white mb-1">{stats.hours}<span className="text-base font-normal text-white/40 ml-1">std</span></span>
                            </div>
                            <div className="bg-[#1c1c1e] rounded-2xl p-4 border border-white/5 flex flex-col justify-between h-32">
                                <span className="text-white/40 text-xs font-bold uppercase tracking-wider">Volumen</span>
                                <span className="text-2xl font-bold text-white mb-1">{(stats.volume / 1000).toFixed(1)}<span className="text-xs font-normal text-white/40 ml-1">t</span></span>
                            </div>
                        </div>

                        {/* Weekly Distribution Chart */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold">Verteilung (Wochen)</h3>
                            <div className="h-40 flex items-end justify-between gap-2 px-2">
                                {weeklyDistribution.map((item, idx) => (
                                    <div key={idx} className="w-full bg-[#1c1c1e] rounded-t-lg relative group flex flex-col justify-end" style={{ height: '100%' }}>
                                        <div
                                            className="w-full bg-white rounded-t-lg transition-all group-hover:bg-[#007AFF]"
                                            style={{ height: `${Math.max(item.height, 4)}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Calendar Heatmap */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold">Aktivitäts-Kalender</h3>
                            <div className="grid grid-cols-7 gap-2">
                                {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => (
                                    <div key={d} className="text-center text-xs text-white/30 font-medium mb-2">{d}</div>
                                ))}
                                {calendarGrid.map((day, idx) => {
                                    if (!day) return <div key={`empty-${idx}`} />;
                                    return (
                                        <div key={day.day} className="aspect-square flex items-center justify-center relative">
                                            {day.hasWorkout ? (
                                                <div className="w-8 h-8 rounded-full bg-[#007AFF] shadow-[0_0_15px_rgba(0,122,255,0.5)] flex items-center justify-center text-xs font-bold text-white">
                                                    {day.day}
                                                </div>
                                            ) : (
                                                <div className="w-1 h-1 rounded-full bg-white/20" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Encouragement */}
                        <div className="bg-gradient-to-r from-[#007AFF]/20 to-transparent rounded-2xl p-6 border border-[#007AFF]/20">
                            <div className="text-lg font-bold text-[#007AFF] mb-1">Starker Monat!</div>
                            <p className="text-white/70 text-sm">Du hast deine Routine gehalten. Mach weiter so im nächsten Monat!</p>
                        </div>
                    </div>

                    <div className="p-6 sticky bottom-0 bg-gradient-to-t from-[#121212] via-[#121212] to-transparent">
                        <button onClick={onClose} className="w-full py-4 rounded-2xl bg-white text-black font-bold text-lg hover:bg-gray-200 transition-colors">
                            Schließen
                        </button>
                    </div>
                </MotionDiv>
            </div>
        </AnimatePresence>
    );
}
