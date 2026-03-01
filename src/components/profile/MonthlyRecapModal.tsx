import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { AppButton } from "../ui/AppButton";
import { captureAndShare } from "../../utils/shareUtils";
import { useSafeAreaInsets } from "../../hooks/useSafeAreaInsets";

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

    const insets = useSafeAreaInsets();

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
                    className="w-full max-w-lg h-full max-h-screen overflow-y-auto bg-[var(--bg-color)] text-[var(--text-color)] flex flex-col relative"
                    style={{ paddingBottom: 140 }}
                >
                    {/* Close Button + Share */}
                    <div
                        className="sticky top-0 z-50 flex justify-between items-center bg-gradient-to-b from-[var(--bg-color)] to-transparent/5 mb-4 backdrop-blur-sm"
                        style={{
                            paddingTop: insets.top + 20,
                            paddingLeft: 20,
                            paddingRight: 20,
                            paddingBottom: 10
                        }}
                    >
                        <button onClick={handleShare} className="bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] px-5 h-[44px] rounded-full text-base font-bold transition-colors flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                            Teilen
                        </button>
                        <button onClick={onClose} className="bg-[var(--button-bg)] hover:bg-[var(--button-bg)] text-[var(--text-color)] rounded-full w-[44px] h-[44px] flex items-center justify-center backdrop-blur-md transition-colors">
                            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div id="monthly-recap-capture" className="px-6 flex-1 space-y-10 bg-[var(--bg-color)] text-[var(--text-color)]">
                        {/* Header */}
                        <div className="space-y-1 mt-4">
                            <div className="text-[#007AFF] font-bold tracking-widest uppercase text-sm">Monatsrückblick</div>
                            <div className="flex flex-col leading-none">
                                <span className="text-5xl font-black text-[var(--text-color)] tracking-tight">{monthName}</span>
                                <span className="text-5xl font-thin text-[var(--text-secondary)] tracking-tight">{year}</span>
                            </div>
                        </div>

                        {/* Main Stats Grid */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-[var(--card-bg)] rounded-2xl p-4 border border-[var(--border-color)] flex flex-col justify-between h-32">
                                <span className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-wider">Trainings</span>
                                <span className="text-3xl font-bold text-[var(--text-color)] mb-1">{stats.count}</span>
                            </div>
                            <div className="bg-[var(--card-bg)] rounded-2xl p-4 border border-[var(--border-color)] flex flex-col justify-between h-32">
                                <span className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-wider">Zeit</span>
                                <span className="text-3xl font-bold text-[var(--text-color)] mb-1">{stats.hours}<span className="text-base font-normal text-[var(--text-secondary)] ml-1">std</span></span>
                            </div>
                            <div className="bg-[var(--card-bg)] rounded-2xl p-4 border border-[var(--border-color)] flex flex-col justify-between h-32">
                                <span className="text-[var(--text-secondary)] text-xs font-bold uppercase tracking-wider">Volumen</span>
                                <span className="text-2xl font-bold text-[var(--text-color)] mb-1">{(stats.volume / 1000).toFixed(1)}<span className="text-xs font-normal text-[var(--text-secondary)] ml-1">t</span></span>
                            </div>
                        </div>

                        {/* Weekly Distribution Chart */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold">Verteilung (Wochen)</h3>
                            <div className="h-40 flex items-end justify-between gap-2 px-2 border-b border-[var(--border-color)] pb-2">
                                {weeklyDistribution.map((item, idx) => (
                                    <div key={idx} className="w-full bg-[var(--card-bg)] rounded-t-lg relative group flex flex-col justify-end" style={{ height: '100%' }}>
                                        <div
                                            className="w-full bg-[var(--text-color)] rounded-t-lg transition-all group-hover:bg-[#007AFF]"
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
                                    <div key={d} className="text-center text-xs text-[var(--text-secondary)] font-medium mb-2">{d}</div>
                                ))}
                                {calendarGrid.map((day, idx) => {
                                    if (!day) return <div key={`empty-${idx}`} />;
                                    return (
                                        <div key={day.day} className="aspect-square flex items-center justify-center relative bg-[var(--button-bg)] rounded-lg">
                                            {day.hasWorkout ? (
                                                <div className="w-8 h-8 rounded-full bg-[#007AFF] shadow-[0_0_15px_rgba(0,122,255,0.4)] flex items-center justify-center text-xs font-bold text-white scale-110">
                                                    {day.day}
                                                </div>
                                            ) : (
                                                <span className="text-[var(--text-secondary)] text-xs font-medium">{day.day}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Encouragement */}
                        <div className="bg-gradient-to-r from-[#007AFF]/20 to-transparent rounded-2xl p-6 border border-[#007AFF]/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-20">
                                <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" className="text-[#007AFF]"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                            </div>
                            <div className="text-xl font-bold text-[#007AFF] mb-1">Starker Monat!</div>
                            <p className="text-[var(--text-secondary)] text-sm font-medium leading-relaxed max-w-[80%]">Du hast deine Routine gehalten. Mach weiter so im nächsten Monat!</p>
                        </div>
                    </div>

                    <div className="p-6 fixed bottom-[110px] left-0 right-0 z-[60] bg-gradient-to-t from-transparent via-transparent to-transparent pointer-events-none">
                        {/* Spacer to simulate bottom position, but the button should be fixed/absolute or just in flow with padding */}
                    </div>
                    {/* Floating Action Button - Positioned absolutely/fixed above the navbar zone */}
                    <div className="fixed bottom-[130px] left-0 right-0 px-6 z-[100]">
                        <button onClick={onClose} className="w-full h-[60px] rounded-[20px] bg-white text-black font-black text-xl hover:bg-gray-200 transition-colors shadow-2xl active:scale-[0.98]">
                            Schließen
                        </button>
                    </div>
                </MotionDiv>
            </div>
        </AnimatePresence>
    );

}
