import React, { useMemo } from "react";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import { captureAndShare } from "../../utils/shareUtils";
import { useI18n } from "../../i18n/useI18n";
import { BottomSheet } from "../common/BottomSheet";

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

function formatDuration(totalSec: number): { value: string; unit: string } {
    if (totalSec < 3600) {
        return { value: String(Math.round(totalSec / 60)), unit: "min" };
    }
    const h = totalSec / 3600;
    return { value: h >= 10 ? Math.round(h).toString() : h.toFixed(1), unit: "std" };
}

function formatVolume(kg: number): { value: string; unit: string } {
    if (kg >= 1000) {
        return { value: (kg / 1000).toFixed(1), unit: "t" };
    }
    return { value: Math.round(kg).toLocaleString("de-DE"), unit: "kg" };
}

export default function MonthlyRecapModal({ isOpen, year, month, workouts, onClose }: Props) {
    const { t } = useI18n();

    const monthName = useMemo(() => {
        return new Date(year, month).toLocaleString("de-DE", { month: "long" });
    }, [year, month]);

    const monthlyWorkouts = useMemo(() => {
        return workouts.filter((w) => {
            const d = new Date(w.startedAt);
            return d.getFullYear() === year && d.getMonth() === month;
        });
    }, [workouts, year, month]);

    const stats = useMemo(() => {
        let totalSec = 0;
        let totalVolume = 0;
        let totalDistance = 0;

        monthlyWorkouts.forEach((w) => {
            totalSec += w.durationSec ?? 0;
            totalVolume += w.totalVolume ?? 0;
            totalDistance += w.distanceKm ?? 0;
        });

        const dur = formatDuration(totalSec);
        const vol = formatVolume(totalVolume);

        return {
            count: monthlyWorkouts.length,
            durationValue: dur.value,
            durationUnit: dur.unit,
            volumeValue: vol.value,
            volumeUnit: vol.unit,
            distanceKm: totalDistance,
        };
    }, [monthlyWorkouts]);

    const calendarGrid = useMemo(() => {
        const daysInMonth = getDaysInMonth(year, month);
        const firstDayOfWeek = new Date(year, month, 1).getDay();
        const startOffset = (firstDayOfWeek + 6) % 7;

        const days: Array<{ day: number; hasWorkout: boolean } | null> = [];
        for (let i = 0; i < startOffset; i++) days.push(null);

        for (let d = 1; d <= daysInMonth; d++) {
            const hasWorkout = monthlyWorkouts.some(w => new Date(w.startedAt).getDate() === d);
            days.push({ day: d, hasWorkout });
        }
        return days;
    }, [year, month, monthlyWorkouts]);

    const weeklyDistribution = useMemo(() => {
        const daysInMonth = getDaysInMonth(year, month);
        const weekCount = Math.ceil(daysInMonth / 7);
        const buckets = Array(weekCount).fill(0);
        monthlyWorkouts.forEach(w => {
            const date = new Date(w.startedAt).getDate();
            const idx = Math.min(Math.floor((date - 1) / 7), weekCount - 1);
            buckets[idx]++;
        });
        const max = Math.max(...buckets, 1);
        return buckets.map((val, idx) => ({ val, height: (val / max) * 100, label: `W${idx + 1}` }));
    }, [year, month, monthlyWorkouts]);

    const sportBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        monthlyWorkouts.forEach((w) => {
            const s = (w.sport || "Gym").trim();
            const label = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
            map.set(label, (map.get(label) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [monthlyWorkouts]);

    const handleShare = async () => {
        try {
            await captureAndShare("monthly-recap-capture", `recap-${year}-${month + 1}.png`);
        } catch {
            // ignore
        }
    };

    return (
        <BottomSheet
            open={isOpen}
            onClose={onClose}
            height="88dvh"
            showHandle
            header={
                <div className="flex items-center justify-between px-5 pb-1">
                    <div>
                        <div className="text-[#007AFF] font-bold tracking-widest uppercase text-[10px]">{t("recap.title")}</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black tracking-tight" style={{ color: "var(--text-color)" }}>{monthName}</span>
                            <span className="text-2xl font-thin tracking-tight" style={{ color: "var(--text-secondary)" }}>{year}</span>
                        </div>
                    </div>
                    <button
                        onClick={handleShare}
                        className="bg-[#007AFF]/10 text-[#007AFF] px-4 h-9 rounded-full text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
                        {t("recap.share")}
                    </button>
                </div>
            }
            contentClassName="flex-1 min-h-0 overflow-y-auto px-5 pb-8"
        >
            <div id="monthly-recap-capture" className="space-y-6" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl p-4 border flex flex-col justify-between h-24" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("recap.workouts")}</span>
                        <span className="text-3xl font-bold" style={{ color: "var(--text-color)" }}>{stats.count}</span>
                    </div>
                    <div className="rounded-2xl p-4 border flex flex-col justify-between h-24" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("recap.time")}</span>
                        <span className="text-3xl font-bold" style={{ color: "var(--text-color)" }}>
                            {stats.durationValue}<span className="text-sm font-normal ml-1" style={{ color: "var(--text-secondary)" }}>{stats.durationUnit}</span>
                        </span>
                    </div>
                    <div className="rounded-2xl p-4 border flex flex-col justify-between h-24" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("recap.volume")}</span>
                        <span className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
                            {stats.volumeValue}<span className="text-xs font-normal ml-1" style={{ color: "var(--text-secondary)" }}>{stats.volumeUnit}</span>
                        </span>
                    </div>
                </div>

                {/* Distance row */}
                {stats.distanceKm > 0 && (
                    <div className="rounded-2xl p-4 border flex items-center justify-between" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}>
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{t("recap.distance")}</span>
                        <span className="text-2xl font-bold" style={{ color: "var(--text-color)" }}>
                            {stats.distanceKm.toFixed(1)}<span className="text-xs font-normal ml-1" style={{ color: "var(--text-secondary)" }}>km</span>
                        </span>
                    </div>
                )}

                {/* Sport breakdown */}
                {sportBreakdown.length > 1 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold" style={{ color: "var(--text-color)" }}>{t("recap.sports")}</h3>
                        <div className="flex flex-wrap gap-2">
                            {sportBreakdown.map((s) => (
                                <span key={s.name} className="px-3 py-1.5 rounded-full text-xs font-semibold border" style={{ borderColor: "var(--border-color)", color: "var(--text-color)", backgroundColor: "var(--card-bg)" }}>
                                    {s.name} &middot; {s.count}x
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Weekly Distribution */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold" style={{ color: "var(--text-color)" }}>{t("recap.weeklyDistribution")}</h3>
                    <div className="h-28 flex items-end justify-between gap-2">
                        {weeklyDistribution.map((item, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full rounded-t-lg relative flex flex-col justify-end" style={{ height: 80, backgroundColor: "var(--card-bg)" }}>
                                    <div
                                        className="w-full rounded-t-lg"
                                        style={{ height: `${Math.max(item.height, 6)}%`, backgroundColor: "#007AFF" }}
                                    />
                                </div>
                                <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                                <span className="text-[10px] font-bold tabular-nums" style={{ color: "var(--text-color)" }}>{item.val}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Calendar Heatmap */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold" style={{ color: "var(--text-color)" }}>{t("recap.calendar")}</h3>
                    <div className="grid grid-cols-7 gap-1.5">
                        {[t("recap.mo"), t("recap.tu"), t("recap.we"), t("recap.th"), t("recap.fr"), t("recap.sa"), t("recap.su")].map(d => (
                            <div key={d} className="text-center text-[10px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{d}</div>
                        ))}
                        {calendarGrid.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} />;
                            return (
                                <div key={day.day} className="aspect-square flex items-center justify-center rounded-lg" style={{ backgroundColor: "var(--card-bg)" }}>
                                    {day.hasWorkout ? (
                                        <div className="w-7 h-7 rounded-full bg-[#007AFF] shadow-[0_0_12px_rgba(0,122,255,0.35)] flex items-center justify-center text-[10px] font-bold text-white">
                                            {day.day}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{day.day}</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Encouragement */}
                <div className="bg-gradient-to-r from-[#007AFF]/15 to-transparent rounded-2xl p-5 border border-[#007AFF]/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-15">
                        <svg width="50" height="50" viewBox="0 0 24 24" fill="currentColor" className="text-[#007AFF]"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </div>
                    <div className="text-lg font-bold text-[#007AFF] mb-1">{t("recap.encourageTitle")}</div>
                    <p className="text-xs font-medium leading-relaxed max-w-[80%]" style={{ color: "var(--text-secondary)" }}>{t("recap.encourageBody")}</p>
                </div>

                {/* Branding */}
                <div className="flex items-center justify-center pt-2 pb-4 opacity-40">
                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "var(--text-secondary)" }}>TrainQ</span>
                </div>
            </div>
        </BottomSheet>
    );
}
