import React, { useMemo } from "react";
import {
    subDays,
    eachDayOfInterval,
    isSameDay,
    format,
    parseISO,
    startOfWeek
} from "date-fns";
import { de } from "date-fns/locale";
import type { WorkoutHistoryEntry } from "../../utils/workoutHistory";

interface ConsistencyHeatmapProps {
    workouts: WorkoutHistoryEntry[];
}

export const ConsistencyHeatmap: React.FC<ConsistencyHeatmapProps> = ({ workouts }) => {
    const today = new Date();

    const startDate = useMemo(() => {
        if (workouts.length === 0) {
            return subDays(today, 90);
        }
        const sorted = [...workouts].sort((a, b) => {
            return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        });
        const firstWorkout = sorted[0];
        return startOfWeek(parseISO(firstWorkout.startedAt), { weekStartsOn: 1 });
    }, [workouts]);

    const days = useMemo(() => {
        if (startDate > today) return [today];
        return eachDayOfInterval({ start: startDate, end: today });
    }, [startDate, today]);

    const activityMap = useMemo(() => {
        const map = new Map<string, number>();
        workouts.forEach(w => {
            const dateStr = format(parseISO(w.endedAt || w.startedAt), "yyyy-MM-dd");
            map.set(dateStr, (map.get(dateStr) || 0) + 1);
        });
        return map;
    }, [workouts]);

    const totalWorkouts = workouts.length;

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
                        {totalWorkouts} Workouts{" "}
                        <span className="text-sm font-normal" style={{ color: "var(--text-secondary)" }}>seit Beginn</span>
                    </p>
                </div>
            </div>

            <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-[3px] min-w-fit flex-col flex-wrap h-[100px] content-start">
                    <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                        {days.map((day) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const count = activityMap.get(dateStr) || 0;
                            const title = `${format(day, "dd. MMM", { locale: de })}: ${count} Workout${count !== 1 ? 's' : ''}`;

                            let bg: string;
                            let shadow: string | undefined;
                            if (count >= 2) {
                                bg = "#007AFF";
                                shadow = "0 0 8px rgba(0,122,255,0.5)";
                            } else if (count === 1) {
                                bg = "rgba(0,122,255,0.4)";
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

            <div className="flex items-center gap-4 text-[10px] justify-end" style={{ color: "var(--text-secondary)" }}>
                <span>Weniger</span>
                <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "var(--button-bg)" }} />
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "rgba(0,122,255,0.4)" }} />
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#007AFF" }} />
                </div>
                <span>Mehr</span>
            </div>
        </div>
    );
};
