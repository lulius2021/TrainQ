import { useMemo } from "react";
import {
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    subMonths,
    eachDayOfInterval,
    eachMonthOfInterval,
    format,
    isSameDay,
    isSameMonth,
    parseISO,
    startOfDay,
    subDays,
} from "date-fns";
import { de } from "date-fns/locale";
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";

export type TimeRange = "1W" | "1M" | "6M" | "1Y";

interface ChartDataPoint {
    label: string;
    date: Date;
    value: number;
}

interface SportSplitPoint {
    name: string;
    value: number; // Count or Duration? User asked for "Sportarten-Verteilung", count is usually best for "Diversity", but duration is also good. I'll use Count for now as it's simpler and robust.
    color?: string;
}

interface StatisticsResult {
    volumeData: ChartDataPoint[];
    distanceData: ChartDataPoint[];
    durationData: ChartDataPoint[];
    sportSplitData: SportSplitPoint[];
    totals: {
        volume: number;
        distance: number;
        duration: number;
        workouts: number;
    };
}

export function useStatistics(
    history: WorkoutHistoryEntry[],
    timeRange: TimeRange
): StatisticsResult {
    return useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;
        let grouping: "day" | "month";

        // 1. Determine Date Range & Grouping
        switch (timeRange) {
            case "1W":
                startDate = startOfWeek(now, { weekStartsOn: 1 }); // Monday
                endDate = endOfWeek(now, { weekStartsOn: 1 });
                grouping = "day";
                break;
            case "1M":
                startDate = startOfMonth(now);
                endDate = endOfMonth(now);
                grouping = "day";
                break;
            case "6M":
                startDate = subMonths(startOfMonth(now), 5); // Current + 5 prev = 6
                endDate = endOfMonth(now);
                grouping = "month";
                break;
            case "1Y":
                startDate = subMonths(startOfMonth(now), 11); // Current + 11 prev = 12
                endDate = endOfMonth(now);
                grouping = "month";
                break;
        }

        // 2. Filter relevant workouts
        const filtered = history.filter((w) => {
            const d = parseISO(w.endedAt || w.startedAt);
            return d >= startDate && d <= endDate;
        });

        // 3. Generate Skeleton (Empty Data Points)
        const dataPoints: ChartDataPoint[] = [];

        if (grouping === "day") {
            const days = eachDayOfInterval({ start: startDate, end: endDate });
            days.forEach((d) => {
                dataPoints.push({
                    label: format(d, "dd.MM", { locale: de }), // e.g. 01.05
                    date: d,
                    value: 0,
                });
            });
        } else {
            const months = eachMonthOfInterval({ start: startDate, end: endDate });
            months.forEach((d) => {
                dataPoints.push({
                    label: format(d, "MMM", { locale: de }), // e.g. Jan
                    date: d,
                    value: 0,
                });
            });
        }

        // 4. Fill Data
        // We need 3 separate arrays because they are different metrics
        const volumePoints = dataPoints.map((p) => ({ ...p, value: 0 }));
        const distancePoints = dataPoints.map((p) => ({ ...p, value: 0 }));
        const durationPoints = dataPoints.map((p) => ({ ...p, value: 0 }));

        let totalVolume = 0;
        let totalDistance = 0;
        let totalDuration = 0;

        filtered.forEach((w) => {
            const d = parseISO(w.endedAt || w.startedAt);
            const vol = w.totalVolume || 0;
            const dist = w.distanceKm || 0;
            const dur = (w.durationSec || 0) / 60; // Minutes

            totalVolume += vol;
            totalDistance += dist;
            totalDuration += dur;

            // Find matching point
            const index =
                grouping === "day"
                    ? volumePoints.findIndex((p) => isSameDay(p.date, d))
                    : volumePoints.findIndex((p) => isSameMonth(p.date, d));

            if (index !== -1) {
                volumePoints[index].value += vol;
                distancePoints[index].value += dist;
                durationPoints[index].value += dur;
            }
        });

        // 5. Sport Split (Pie Chart)
        const sportMap = new Map<string, number>();
        filtered.forEach((w) => {
            let label = "Unbekannt";
            const rawSport = (w.sport || "").trim();
            const lowerSport = rawSport.toLowerCase();

            if (lowerSport === "gym") label = "Gym";
            else if (lowerSport === "laufen") label = "Laufen";
            else if (lowerSport === "radfahren") label = "Radfahren";
            else if (lowerSport === "custom" || lowerSport === "other") {
                // Use title if custom
                label = w.title || "Custom";
            } else if (rawSport) {
                // Fallback to raw sport name if it exists (e.g. "Boxen")
                label = rawSport.charAt(0).toUpperCase() + rawSport.slice(1);
            }

            const current = sportMap.get(label) || 0;
            sportMap.set(label, current + 1);
        });

        const sportSplitData: SportSplitPoint[] = Array.from(sportMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Most frequent first

        return {
            volumeData: volumePoints,
            distanceData: distancePoints,
            durationData: durationPoints,
            sportSplitData,
            totals: {
                volume: totalVolume,
                distance: totalDistance,
                duration: totalDuration,
                workouts: filtered.length,
            },
        };
    }, [history, timeRange]);
}
