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
    // Determine the start date dynamically
    const today = new Date();

    const startDate = useMemo(() => {
        if (workouts.length === 0) {
            return subDays(today, 90); // Fallback: ~3 months if no data
        }

        // Find the earliest workout
        // Sort effectively to find min date
        const sorted = [...workouts].sort((a, b) => {
            return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
        });
        const firstWorkout = sorted[0];

        // Start of the week of the first workout (Monday start)
        return startOfWeek(parseISO(firstWorkout.startedAt), { weekStartsOn: 1 });
    }, [workouts]);

    const days = useMemo(() => {
        // Ensure we don't crash if startDate > today (unlikely but possible with weird data)
        if (startDate > today) return [today];
        return eachDayOfInterval({ start: startDate, end: today });
    }, [startDate, today]);

    // Aggregate workout counts
    const activityMap = useMemo(() => {
        const map = new Map<string, number>();
        workouts.forEach(w => {
            const dateStr = format(parseISO(w.endedAt || w.startedAt), "yyyy-MM-dd");
            map.set(dateStr, (map.get(dateStr) || 0) + 1);
        });
        return map;
    }, [workouts]);

    // Determine streaks/stats
    const totalWorkouts = workouts.length;
    // Simple streak calculation could go here, but omitted for brevity to focus on the Heatmap visual.

    return (
        <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-[var(--muted)]">Consistency is Key</h3>
                    <p className="text-2xl font-bold text-[var(--text)] mt-1">{totalWorkouts} Workouts <span className="text-sm font-normal text-[var(--muted)]">seit Beginn</span></p>
                </div>
            </div>

            {/* Scrollable Container for Mobile */}
            <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
                <div className="flex gap-[3px] min-w-fit flex-col flex-wrap h-[100px] content-start">
                    {/* 
              GitHub Style: Columns are Weeks, Rows are Weekdays (0=Sun, 6=Sat) or Mon-Sun.
              Since we just have a list of days, we can map them. 
              We want to arrange them so they flow top-to-bottom, then left-to-right.
              Flex-col + Flex-wrap with fixed height can achieve this if we align correct number of items.
              But standard Heatmap is usually CSS Grid or SVG.
              
              Let's do a simple flex-wrap with a mapped "Week" structure for perfect alignment.
            */}
                    {/* Actually, grid-flow-col is better. */}

                    <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                        {days.map((day) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const count = activityMap.get(dateStr) || 0;

                            let bgClass = "bg-[#27272A]"; // Default (zinc-800 equivalent)
                            if (count === 1) bgClass = "bg-[#1E3A8A]"; // Dark blue
                            if (count >= 2) bgClass = "bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.6)]"; // Glowing Blue

                            // Tooltip helper
                            const title = `${format(day, "dd. MMM", { locale: de })}: ${count} Workout${count !== 1 ? 's' : ''}`;

                            return (
                                <div
                                    key={dateStr}
                                    title={title}
                                    className={`w-2.5 h-2.5 rounded-sm ${bgClass}`}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-[var(--muted)] justify-end">
                <span>Weniger</span>
                <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-sm bg-[#27272A]" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-[#1E3A8A]" />
                    <div className="w-2.5 h-2.5 rounded-sm bg-[#3B82F6]" />
                </div>
                <span>Mehr</span>
            </div>
        </div>
    );
};
