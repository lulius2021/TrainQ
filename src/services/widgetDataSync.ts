// src/services/widgetDataSync.ts
//
// Bridges localStorage data to the iOS Widget via WidgetSyncPlugin.
// Call syncWidgetData() after any relevant state change:
//   - App focus / resume
//   - Workout completed
//   - Calendar updated
//
// The plugin writes to the App Group UserDefaults (group.com.trainq.app)
// which the TrainQWidget extension reads directly.

import { registerPlugin } from "@capacitor/core";
import { loadCalendarWorkouts, loadWorkoutHistory } from "../utils/trainqStorage";
import type { CalendarWorkout, WorkoutHistoryEntry } from "../types";

// ── Plugin Registration ──────────────────────────────────────────────────────

interface WidgetSyncPlugin {
  syncData(options: { data: string }): Promise<void>;
}

const WidgetSync = registerPlugin<WidgetSyncPlugin>("WidgetSync", {
  // No-op web implementation so the app doesn't throw on desktop/web
  web: {
    async syncData() {
      // intentionally empty
    },
  } as WidgetSyncPlugin,
});

// ── Widget Data Shapes (must match TrainQWidget.swift structs) ───────────────

interface WidgetTodayWorkout {
  workoutType: string;
  status: string;
  exercises: string[];
  estimatedMinutes: number;
  completedSets: number;
  totalSets: number;
}

interface WidgetDayStatus {
  weekday: string; // "Mo" | "Di" | ... | "So"
  status: string;  // "completed" | "planned" | "rest" | "none"
}

interface WidgetWeekProgress {
  days: WidgetDayStatus[];
  completedCount: number;
  totalCount: number;
  streak: number;
}

interface WidgetLastWorkout {
  workoutType: string;
  durationMinutes: number;
  exerciseCount: number;
  daysAgo: number;
}

interface WidgetData {
  todayWorkout: WidgetTodayWorkout | null;
  weekProgress: WidgetWeekProgress;
  lastWorkout: WidgetLastWorkout | null;
  totalWorkouts: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateToISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Returns the Monday of the week containing `date`. */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Simple streak: count consecutive completed workout days going backwards.
 * Rest days (no planned workout) don't break the streak.
 */
function calculateStreak(
  history: WorkoutHistoryEntry[],
  calendarWorkouts: CalendarWorkout[]
): number {
  const completedDates = new Set([
    ...history.map((h) => h.date),
    ...calendarWorkouts.filter((w) => w.status === "completed").map((w) => w.date),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  const cursor = new Date(today);

  for (let i = 0; i < 365; i++) {
    const iso = dateToISO(cursor);

    if (completedDates.has(iso)) {
      streak++;
    } else {
      // Check if this was a rest day (no workout scheduled)
      const hadPlanned = calendarWorkouts.some(
        (w) => w.date === iso && w.status !== "skipped"
      );
      if (!hadPlanned && i > 0) {
        // Rest day — continue without incrementing
      } else {
        break; // Missed workout breaks streak
      }
    }

    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// ── Main sync function ───────────────────────────────────────────────────────

export async function syncWidgetData(): Promise<void> {
  try {
    const today = todayISO();
    const calendarWorkouts = loadCalendarWorkouts();
    const history = loadWorkoutHistory();

    // ── Today ────────────────────────────────────────────────────────────────
    const todayCalWorkout = calendarWorkouts.find((w) => w.date === today);

    let widgetTodayWorkout: WidgetTodayWorkout | null = null;

    if (todayCalWorkout && todayCalWorkout.status !== "skipped") {
      let exercises: string[] = [];
      let completedSets = 0;
      let totalSets = 0;

      // If completed, pull real exercises from history entry
      if (todayCalWorkout.historyEntryId) {
        const histEntry = history.find((h) => h.id === todayCalWorkout.historyEntryId);
        if (histEntry) {
          exercises = histEntry.exercises.map((e) => e.name);
          completedSets = histEntry.exercises.reduce(
            (sum, e) => sum + e.sets.filter((s) => s.completed).length,
            0
          );
          totalSets = histEntry.exercises.reduce((sum, e) => sum + e.sets.length, 0);
        }
      }

      widgetTodayWorkout = {
        workoutType: todayCalWorkout.workoutType,
        status: todayCalWorkout.status,
        exercises,
        estimatedMinutes: todayCalWorkout.estimatedMinutes ?? 60,
        completedSets,
        totalSets,
      };
    }

    // ── Week ─────────────────────────────────────────────────────────────────
    const monday = getMondayOfWeek(new Date());
    const todayMidnight = new Date(today + "T00:00:00").getTime();

    const weekDays: WidgetDayStatus[] = WEEKDAY_LABELS.map((label, i) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const iso = dateToISO(dayDate);
      const isPast = dayDate.getTime() < todayMidnight;

      const workout = calendarWorkouts.find((w) => w.date === iso);
      let status = "none";

      if (workout) {
        if (workout.status === "completed") {
          status = "completed";
        } else if (workout.status === "skipped") {
          status = isPast ? "rest" : "none";
        } else {
          status = "planned";
        }
      } else if (isPast) {
        status = "rest"; // past day with no workout = rest
      }

      return { weekday: label, status };
    });

    const completedCount = weekDays.filter((d) => d.status === "completed").length;
    const totalCount = weekDays.filter(
      (d) => d.status === "completed" || d.status === "planned"
    ).length;

    const streak = calculateStreak(history, calendarWorkouts);

    // ── Last workout ─────────────────────────────────────────────────────────
    const sortedHistory = [...history].sort((a, b) => b.date.localeCompare(a.date));
    const lastEntry = sortedHistory[0] ?? null;
    let lastWorkout: WidgetLastWorkout | null = null;

    if (lastEntry) {
      const lastDate = new Date(lastEntry.date + "T00:00:00").getTime();
      const daysAgo = Math.round((todayMidnight - lastDate) / (1000 * 60 * 60 * 24));
      lastWorkout = {
        workoutType: lastEntry.workoutType,
        durationMinutes: Math.round(lastEntry.durationSeconds / 60),
        exerciseCount: lastEntry.exercises.length,
        daysAgo,
      };
    }

    // ── Assemble & send ──────────────────────────────────────────────────────
    const widgetData: WidgetData = {
      todayWorkout: widgetTodayWorkout,
      weekProgress: { days: weekDays, completedCount, totalCount, streak },
      lastWorkout,
      totalWorkouts: history.length,
    };

    await WidgetSync.syncData({ data: JSON.stringify(widgetData) });
  } catch {
    // Silent — widget falls back to cached data
  }
}
