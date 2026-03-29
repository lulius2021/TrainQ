import React, { useMemo } from "react";
import {
    subDays,
    eachDayOfInterval,
    format,
    parseISO,
    startOfWeek
} from "date-fns";
import { de } from "date-fns/locale";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";
import type { GarminActivity } from "../../services/garmin/types";

interface ConsistencyHeatmapProps {
    workouts: WorkoutHistoryEntry[];
    garminActivities?: GarminActivity[];
}

export const ConsistencyHeatmap: React.FC<ConsistencyHeatmapProps> = ({ workouts, garminActivities = [] }) => {
    const today = new Date();

    const startDate = useMemo(() => {
        if (workouts.length === 0 && garminActivities.length === 0) {
            return subDays(today, 90);
        }
        const dates: Date[] = [];
        if (workouts.length > 0) {
            const sorted = [...workouts].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
            dates.push(parseISO(sorted[0].startedAt));
        }
        if (garminActivities.length > 0) {
            const sorted = [...garminActivities].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
            dates.push(parseISO(sorted[0].startTime));
        }
        const earliest = dates.reduce((a, b) => a < b ? a : b);
        return startOfWeek(earliest, { weekStartsOn: 1 });
    }, [workouts, garminActivities]);

    const days = useMemo(() => {
        if (startDate > today) return [today];
        return eachDayOfInterval({ start: startDate, end: today });
    }, [startDate, today]);

    const activityMap = useMemo(() => {
        const map = new Map<string, { trainq: number; garmin: number }>();
        workouts.forEach(w => {
            const dateStr = format(parseISO(w.endedAt || w.startedAt), "yyyy-MM-dd");
            const entry = map.get(dateStr) || { trainq: 0, garmin: 0 };
            entry.trainq++;
            map.set(dateStr, entry);
        });
        garminActivities.forEach(a => {
            const dateStr = a.startTime.slice(0, 10);
            const entry = map.get(dateStr) || { trainq: 0, garmin: 0 };
            entry.garmin++;
            map.set(dateStr, entry);
        });
        return map;
    }, [workouts, garminActivities]);

    const totalWorkouts = workouts.length;
    const totalGarmin = garminActivities.length;

    return (
        <div
            className="w-full rounded-[24px] p-5 flex flex-col gap-4 border"
            style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--border-color)",
            }}
        >
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Consistency is Key</h3>
                    <p className="text-2xl font-bold mt-1" style={{ color: "var(--text-color)" }}>
                        {totalWorkouts + totalGarmin} Aktivitäten{" "}
                        <span className="text-sm font-normal" style={{ color: "var(--text-secondary)" }}>seit Beginn</span>
                    </p>
                    {totalGarmin > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {totalWorkouts} Workouts · {totalGarmin} Garmin
                        </p>
                    )}
                </div>
            </div>

            <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-[3px] min-w-fit flex-col flex-wrap h-[100px] content-start">
                    <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                        {days.map((day) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const entry = activityMap.get(dateStr) || { trainq: 0, garmin: 0 };
                            const total = entry.trainq + entry.garmin;
                            const hasGarminOnly = entry.garmin > 0 && entry.trainq === 0;
                            const hasBoth = entry.garmin > 0 && entry.trainq > 0;
                            const title = `${format(day, "dd. MMM", { locale: de })}: ${entry.trainq} Workout${entry.trainq !== 1 ? "s" : ""}${entry.garmin > 0 ? ` + ${entry.garmin} Garmin` : ""}`;

                            let bg: string;
                            let shadow: string | undefined;
                            if (hasBoth) {
                                // Gold for combined training days
                                bg = "#FFB300";
                                shadow = "0 0 8px rgba(255,179,0,0.5)";
                            } else if (total >= 2) {
                                bg = "#007AFF";
                                shadow = "0 0 8px rgba(0,122,255,0.5)";
                            } else if (entry.trainq === 1) {
                                bg = "rgba(0,122,255,0.4)";
                            } else if (hasGarminOnly) {
                                bg = "rgba(0,200,83,0.5)";
                            } else {
                                bg = "var(--button-bg)";
                            }

                            return (
                                <div
                                    key={dateStr}
                                    title={title}
                                    className="w-2.5 h-2.5 rounded-sm"
                                    style={{
                                        backgroundColor: bg,
                                        boxShadow: shadow,
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] justify-end flex-wrap" style={{ color: "var(--text-secondary)" }}>
                <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "rgba(0,122,255,0.4)" }} />
                    <span>Workout</span>
                </div>
                {totalGarmin > 0 && (
                    <>
                        <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "rgba(0,200,83,0.5)" }} />
                            <span>Garmin</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#FFB300" }} />
                            <span>Beides</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
