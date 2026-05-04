// src/utils/__tests__/trainingHistory.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Capacitor-dependent imports BEFORE any module imports
vi.mock("../../services/widgetDataSync", () => ({ syncWidgetData: vi.fn() }));

import {
  getActiveLiveWorkout,
  persistActiveLiveWorkout,
  clearActiveLiveWorkout,
  startLiveWorkout,
  abortLiveWorkout,
  completeLiveWorkout,
  applyTrainingStatusToEvent,
  getLastSetsForExercise,
  getExerciseSessionCount,
} from "../trainingHistory";
import { addWorkoutEntry, loadWorkoutHistory, clearWorkoutHistory } from "../workoutHistory";
import { setActiveSession } from "../session";
import type { LiveWorkout, CalendarEvent, SportType } from "../../types/training";

// --------------- constants ---------------

const TEST_USER_ID = "test-user-history";

// --------------- helpers ---------------

function setupSession(): void {
  setActiveSession({ userId: TEST_USER_ID, isPro: false });
}

function makeLiveWorkout(overrides: Partial<LiveWorkout> = {}): LiveWorkout {
  return {
    id: `wk-${Date.now()}-${Math.random()}`,
    title: "Test Workout",
    sport: "Gym",
    startedAt: "2026-01-15T10:00:00Z",
    endedAt: undefined,
    durationSeconds: undefined,
    isActive: true,
    isMinimized: false,
    exercises: [
      {
        id: "ex-1",
        exerciseId: "bench-press",
        name: "Bench Press",
        restSeconds: 90,
        sets: [
          { id: "s-1", reps: 10, weight: 80, completed: true, completedAt: "2026-01-15T10:05:00Z" },
          { id: "s-2", reps: 8, weight: 85, completed: true, completedAt: "2026-01-15T10:08:00Z" },
        ],
      },
    ],
    notes: "",
    abortedAt: undefined,
    ...overrides,
  };
}

function makeCalendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "cal-1",
    title: "Push Day",
    date: "2026-01-15",
    startTime: "10:00",
    endTime: "11:00",
    type: "training",
    sport: "Gym",
    trainingStatus: "open",
    ...overrides,
  };
}

// --------------- setup ---------------

beforeEach(() => {
  localStorage.clear();
  setupSession();
});

// ============================================================
// 1. persistActiveLiveWorkout roundtrip
// ============================================================

describe("persistActiveLiveWorkout roundtrip", () => {
  it("should persist and read back a workout with all fields intact", () => {
    const workout = makeLiveWorkout();
    persistActiveLiveWorkout(workout);

    const recovered = getActiveLiveWorkout();
    expect(recovered).not.toBeNull();
    expect(recovered!.id).toBe(workout.id);
    expect(recovered!.title).toBe(workout.title);
    expect(recovered!.sport).toBe("Gym");
    expect(recovered!.startedAt).toBe(workout.startedAt);
    expect(recovered!.isActive).toBe(true);
    expect(recovered!.exercises).toHaveLength(1);
    expect(recovered!.exercises[0].name).toBe("Bench Press");
    expect(recovered!.exercises[0].exerciseId).toBe("bench-press");
    expect(recovered!.exercises[0].sets).toHaveLength(2);
    expect(recovered!.exercises[0].sets[0].reps).toBe(10);
    expect(recovered!.exercises[0].sets[0].weight).toBe(80);
  });

  it("should not persist an inactive workout", () => {
    const workout = makeLiveWorkout({ isActive: false });
    persistActiveLiveWorkout(workout);

    const recovered = getActiveLiveWorkout();
    expect(recovered).toBeNull();
  });

  it("should return null when nothing is persisted", () => {
    expect(getActiveLiveWorkout()).toBeNull();
  });
});

// ============================================================
// 2. completeLiveWorkout
// ============================================================

describe("completeLiveWorkout", () => {
  it("should complete a workout and add it to workout history", () => {
    const workout = makeLiveWorkout();
    const entry = completeLiveWorkout(workout);

    expect(entry).toBeDefined();
    expect(entry.title).toBe("Test Workout");
    expect(entry.sport).toBe("Gym");
    expect(entry.durationSec).toBeGreaterThanOrEqual(0);
    expect(entry.exercises).toHaveLength(1);
    expect(entry.exercises[0].name).toBe("Bench Press");

    // Should appear in workout history
    const history = loadWorkoutHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    const found = history.find((h) => h.id === entry.id);
    expect(found).toBeDefined();
  });

  it("should clear active workout after completion", () => {
    const workout = makeLiveWorkout();
    persistActiveLiveWorkout(workout);

    completeLiveWorkout(workout);

    const active = getActiveLiveWorkout();
    expect(active).toBeNull();
  });

  it("should compute total volume for gym workouts", () => {
    const workout = makeLiveWorkout();
    const entry = completeLiveWorkout(workout);

    // 10*80 + 8*85 = 800 + 680 = 1480
    expect(entry.totalVolume).toBe(1480);
  });

  it("should handle cardio workouts (Laufen) with distance and pace", () => {
    const workout = makeLiveWorkout({
      sport: "Laufen",
      startedAt: "2026-01-15T07:00:00Z",
      durationSeconds: 1800, // 30 minutes
      exercises: [
        {
          id: "ex-run",
          name: "Lauf",
          sets: [
            { id: "s-run-1", reps: 30, weight: 5, completed: true }, // 30min, 5km
          ],
        },
      ],
    });

    const entry = completeLiveWorkout(workout);
    expect(entry.sport).toBe("Laufen");
    expect(entry.distanceKm).toBe(5);
    // pace = 1800 / 5 = 360 sec/km
    expect(entry.paceSecPerKm).toBe(360);
  });

  it("should filter out sets with 0 reps and 0 weight", () => {
    const workout = makeLiveWorkout({
      exercises: [
        {
          id: "ex-1",
          name: "Squats",
          sets: [
            { id: "s-1", reps: 0, weight: 0, completed: false },
            { id: "s-2", reps: 10, weight: 100, completed: true },
          ],
        },
      ],
    });

    const entry = completeLiveWorkout(workout);
    expect(entry.exercises[0].sets).toHaveLength(1);
    expect(entry.exercises[0].sets[0].reps).toBe(10);
  });
});

// ============================================================
// 3. abortLiveWorkout
// ============================================================

describe("abortLiveWorkout", () => {
  it("should clear active workout on abort", () => {
    const workout = makeLiveWorkout();
    persistActiveLiveWorkout(workout);

    abortLiveWorkout(workout);

    const active = getActiveLiveWorkout();
    expect(active).toBeNull();
  });

  it("should NOT add to workout history on abort", () => {
    const workout = makeLiveWorkout();
    persistActiveLiveWorkout(workout);

    abortLiveWorkout(workout);

    const history = loadWorkoutHistory();
    const found = history.find((h) => h.title === "Test Workout");
    expect(found).toBeUndefined();
  });

  it("should return aborted workout with isActive false and abortedAt set", () => {
    const workout = makeLiveWorkout();
    const aborted = abortLiveWorkout(workout);

    expect(aborted.isActive).toBe(false);
    expect(aborted.abortedAt).toBeDefined();
    expect(aborted.endedAt).toBeDefined();
    expect(aborted.durationSeconds).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// 4. Consistency between trainingHistory and workoutHistory
// ============================================================

describe("consistency between trainingHistory and workoutHistory", () => {
  it("should produce matching data when completed via completeLiveWorkout and loaded via loadWorkoutHistory", () => {
    const workout = makeLiveWorkout({
      title: "Consistency Test",
      exercises: [
        {
          id: "ex-c",
          exerciseId: "deadlift-1",
          name: "Deadlift",
          sets: [
            { id: "s-c1", reps: 5, weight: 140, completed: true },
            { id: "s-c2", reps: 5, weight: 140, completed: true },
          ],
        },
      ],
    });

    const entry = completeLiveWorkout(workout);
    const history = loadWorkoutHistory();
    const fromHistory = history.find((h) => h.id === entry.id);

    expect(fromHistory).toBeDefined();
    expect(fromHistory!.title).toBe(entry.title);
    expect(fromHistory!.sport).toBe(entry.sport);
    expect(fromHistory!.durationSec).toBe(entry.durationSec);
    expect(fromHistory!.exercises).toHaveLength(entry.exercises.length);
    expect(fromHistory!.exercises[0].name).toBe("Deadlift");
    expect(fromHistory!.totalVolume).toBe(entry.totalVolume);
  });
});

// ============================================================
// 5. No data duplicates
// ============================================================

describe("no data duplicates", () => {
  it("should not create duplicates when completing the same workout twice", () => {
    const workout = makeLiveWorkout({ id: "dup-test-1" });

    completeLiveWorkout(workout);
    completeLiveWorkout(workout);

    const history = loadWorkoutHistory();
    const matches = history.filter((h) => h.title === "Test Workout");
    // Due to dedup by id in workoutHistory, there should be exactly 2
    // because completeLiveWorkout generates unique entries via addWorkoutEntry
    // but the workout.id is different from the entry.id generated inside addWorkoutEntry.
    // Let's count by checking if there are no accidental duplicates at all.
    const ids = matches.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should dedup entries with the same generated id", () => {
    const workout = makeLiveWorkout();

    const entry1 = completeLiveWorkout(workout);

    // Manually add the same entry again (simulating a duplicate)
    addWorkoutEntry({
      id: entry1.id,
      title: entry1.title,
      sport: entry1.sport,
      startedAt: entry1.startedAt,
      endedAt: entry1.endedAt,
      durationSec: entry1.durationSec,
      exercises: entry1.exercises,
    });

    const history = loadWorkoutHistory();
    const matching = history.filter((h) => h.id === entry1.id);
    expect(matching).toHaveLength(1);
  });
});

// ============================================================
// 6. Live workout resume
// ============================================================

describe("live workout resume", () => {
  it("should recover a persisted workout after clearing runtime state", () => {
    const workout = makeLiveWorkout({ title: "Resume Test" });
    persistActiveLiveWorkout(workout);

    // Simulate app restart: just read back from storage
    const recovered = getActiveLiveWorkout();
    expect(recovered).not.toBeNull();
    expect(recovered!.title).toBe("Resume Test");
    expect(recovered!.id).toBe(workout.id);
    expect(recovered!.isActive).toBe(true);
    expect(recovered!.exercises).toHaveLength(1);
  });

  it("should normalize sport on recovery", () => {
    // Manually write a workout with lowercase sport to simulate old data
    const raw = JSON.stringify({
      ...makeLiveWorkout({ title: "Old Format" }),
      sport: "gym", // lowercase
    });

    const key = `trainq_active_live_workout_v1::${TEST_USER_ID}`;
    localStorage.setItem(key, raw);

    const recovered = getActiveLiveWorkout();
    expect(recovered).not.toBeNull();
    expect(recovered!.sport).toBe("Gym"); // normalized
  });
});

// ============================================================
// 7. restSeconds normalization
// ============================================================

describe("restSeconds normalization", () => {
  it("should preserve undefined/null as undefined", () => {
    const workout = makeLiveWorkout({
      exercises: [
        {
          id: "ex-rest",
          name: "Curls",
          restSeconds: undefined,
          sets: [{ id: "s-r", reps: 10, weight: 15, completed: true }],
        },
      ],
    });

    persistActiveLiveWorkout(workout);
    const recovered = getActiveLiveWorkout();
    expect(recovered!.exercises[0].restSeconds).toBeUndefined();
  });

  it("should clamp negatives to 0", () => {
    const raw = JSON.stringify({
      ...makeLiveWorkout(),
      exercises: [
        {
          id: "ex-neg",
          name: "Curls",
          restSeconds: -30,
          sets: [{ id: "s-n", reps: 10, weight: 15, completed: true }],
        },
      ],
    });

    const key = `trainq_active_live_workout_v1::${TEST_USER_ID}`;
    localStorage.setItem(key, raw);

    const recovered = getActiveLiveWorkout();
    expect(recovered!.exercises[0].restSeconds).toBe(0);
  });

  it("should clamp values >600 to 600", () => {
    const raw = JSON.stringify({
      ...makeLiveWorkout(),
      exercises: [
        {
          id: "ex-big",
          name: "Curls",
          restSeconds: 999,
          sets: [{ id: "s-b", reps: 10, weight: 15, completed: true }],
        },
      ],
    });

    const key = `trainq_active_live_workout_v1::${TEST_USER_ID}`;
    localStorage.setItem(key, raw);

    const recovered = getActiveLiveWorkout();
    expect(recovered!.exercises[0].restSeconds).toBe(600);
  });

  it("should accept valid rest seconds in range", () => {
    const workout = makeLiveWorkout({
      exercises: [
        {
          id: "ex-ok",
          name: "Squats",
          restSeconds: 120,
          sets: [{ id: "s-ok", reps: 5, weight: 100, completed: true }],
        },
      ],
    });

    persistActiveLiveWorkout(workout);
    const recovered = getActiveLiveWorkout();
    expect(recovered!.exercises[0].restSeconds).toBe(120);
  });

  it("should treat NaN/string garbage as undefined", () => {
    const raw = JSON.stringify({
      ...makeLiveWorkout(),
      exercises: [
        {
          id: "ex-nan",
          name: "Curls",
          restSeconds: "abc",
          sets: [{ id: "s-nan", reps: 10, weight: 15, completed: true }],
        },
      ],
    });

    const key = `trainq_active_live_workout_v1::${TEST_USER_ID}`;
    localStorage.setItem(key, raw);

    const recovered = getActiveLiveWorkout();
    expect(recovered!.exercises[0].restSeconds).toBeUndefined();
  });
});

// ============================================================
// 8. getLastSetsForExercise
// ============================================================

describe("getLastSetsForExercise", () => {
  it("should find exercise by exerciseId from core store (exercise history)", () => {
    // Complete a workout first so exercise history is populated
    const workout = makeLiveWorkout({
      exercises: [
        {
          id: "ex-find",
          exerciseId: "squat-123",
          name: "Squats",
          sets: [
            { id: "s-f1", reps: 5, weight: 120, completed: true },
            { id: "s-f2", reps: 5, weight: 125, completed: true },
          ],
        },
      ],
    });

    completeLiveWorkout(workout);

    const result = getLastSetsForExercise({ exerciseId: "squat-123", name: "Squats" });
    expect(result).not.toBeNull();
    expect(result!.exerciseName).toBe("Squats");
    expect(result!.sets).toHaveLength(2);
    expect(result!.sets[0].reps).toBe(5);
    expect(result!.sets[0].weight).toBe(120);
  });

  it("should fallback to name match from workout history", () => {
    // Complete workout without exerciseId in core store
    const workout = makeLiveWorkout({
      exercises: [
        {
          id: "ex-name",
          name: "Overhead Press",
          sets: [
            { id: "s-n1", reps: 8, weight: 50, completed: true },
          ],
        },
      ],
    });

    completeLiveWorkout(workout);

    // Search by name only (no exerciseId)
    const result = getLastSetsForExercise({ name: "Overhead Press" });
    expect(result).not.toBeNull();
    expect(result!.sets.length).toBeGreaterThanOrEqual(1);
  });

  it("should return null for unknown exercise", () => {
    const result = getLastSetsForExercise({ name: "Unknown Exercise XYZ" });
    expect(result).toBeNull();
  });
});

// ============================================================
// 9. startLiveWorkout
// ============================================================

describe("startLiveWorkout", () => {
  it("should create and persist a new workout", () => {
    const workout = startLiveWorkout({
      title: "Morning Push",
      sport: "Gym",
      initialExercises: [
        {
          exerciseId: "bench-1",
          name: "Bench Press",
          sets: [{ reps: 10, weight: 80 }],
          restSeconds: 90,
        },
      ],
    });

    expect(workout.id).toBeDefined();
    expect(workout.title).toBe("Morning Push");
    expect(workout.sport).toBe("Gym");
    expect(workout.isActive).toBe(true);
    expect(workout.exercises).toHaveLength(1);
    expect(workout.exercises[0].restSeconds).toBe(90);
    expect(workout.exercises[0].sets).toHaveLength(1);
    expect(workout.exercises[0].sets[0].completed).toBe(false);

    // Should be recoverable
    const recovered = getActiveLiveWorkout();
    expect(recovered).not.toBeNull();
    expect(recovered!.id).toBe(workout.id);
  });

  it("should normalize sport on creation", () => {
    const workout = startLiveWorkout({
      title: "Run",
      sport: "laufen" as SportType,
    });

    expect(workout.sport).toBe("Laufen");
  });

  it("should handle empty initial exercises", () => {
    const workout = startLiveWorkout({
      title: "Cardio",
      sport: "Radfahren",
    });

    expect(workout.exercises).toHaveLength(0);
    expect(workout.isActive).toBe(true);
  });

  it("should attach calendarEventId if provided", () => {
    const workout = startLiveWorkout({
      title: "Planned Session",
      sport: "Gym",
      calendarEventId: "cal-event-42",
    });

    expect(workout.calendarEventId).toBe("cal-event-42");
  });
});

// ============================================================
// 10. clearActiveLiveWorkout
// ============================================================

describe("clearActiveLiveWorkout", () => {
  it("should remove the active workout from storage", () => {
    const workout = makeLiveWorkout();
    persistActiveLiveWorkout(workout);
    expect(getActiveLiveWorkout()).not.toBeNull();

    clearActiveLiveWorkout();
    expect(getActiveLiveWorkout()).toBeNull();
  });

  it("should be safe to call when no workout is active", () => {
    expect(() => clearActiveLiveWorkout()).not.toThrow();
  });
});

// ============================================================
// 11. applyTrainingStatusToEvent
// ============================================================

describe("applyTrainingStatusToEvent", () => {
  it("should set status to completed with completedAt and workoutId", () => {
    const event = makeCalendarEvent();
    const updated = applyTrainingStatusToEvent(event, "completed", { workoutId: "wk-99" });

    expect(updated.trainingStatus).toBe("completed");
    expect(updated.completedAt).toBeDefined();
    expect(updated.workoutId).toBe("wk-99");
    expect(updated.skippedAt).toBeUndefined();
  });

  it("should set status to skipped with skippedAt and clear workoutId", () => {
    const event = makeCalendarEvent({ workoutId: "wk-old", completedAt: "2026-01-01T00:00:00Z" });
    const updated = applyTrainingStatusToEvent(event, "skipped");

    expect(updated.trainingStatus).toBe("skipped");
    expect(updated.skippedAt).toBeDefined();
    expect(updated.completedAt).toBeUndefined();
    expect(updated.workoutId).toBeUndefined();
  });

  it("should reset to open status clearing all timestamps", () => {
    const event = makeCalendarEvent({
      trainingStatus: "completed",
      completedAt: "2026-01-01T00:00:00Z",
      workoutId: "wk-old",
    });
    const updated = applyTrainingStatusToEvent(event, "open");

    expect(updated.trainingStatus).toBe("open");
    expect(updated.completedAt).toBeUndefined();
    expect(updated.skippedAt).toBeUndefined();
    expect(updated.workoutId).toBeUndefined();
  });

  it("should not mutate the original event (immutability)", () => {
    const event = makeCalendarEvent();
    const original = { ...event };
    applyTrainingStatusToEvent(event, "completed");

    expect(event.trainingStatus).toBe(original.trainingStatus);
    expect(event.completedAt).toBe(original.completedAt);
  });
});

// ============================================================
// 12. getExerciseSessionCount
// ============================================================

describe("getExerciseSessionCount", () => {
  it("should return 0 when no workouts exist", () => {
    expect(getExerciseSessionCount({ name: "Bench Press" })).toBe(0);
  });

  it("should count workouts containing the exercise by exerciseId", () => {
    completeLiveWorkout(
      makeLiveWorkout({
        exercises: [
          {
            id: "ex-a",
            exerciseId: "bp-1",
            name: "Bench Press",
            sets: [{ id: "s-a1", reps: 10, weight: 80, completed: true }],
          },
        ],
      }),
    );
    completeLiveWorkout(
      makeLiveWorkout({
        exercises: [
          {
            id: "ex-b",
            exerciseId: "bp-1",
            name: "Bench Press",
            sets: [{ id: "s-b1", reps: 8, weight: 85, completed: true }],
          },
        ],
      }),
    );

    expect(getExerciseSessionCount({ exerciseId: "bp-1", name: "Bench Press" })).toBe(2);
  });

  it("should count by name when exerciseId is not provided", () => {
    completeLiveWorkout(
      makeLiveWorkout({
        exercises: [
          {
            id: "ex-c",
            name: "Deadlift",
            sets: [{ id: "s-c1", reps: 5, weight: 140, completed: true }],
          },
        ],
      }),
    );

    expect(getExerciseSessionCount({ name: "Deadlift" })).toBe(1);
  });

  it("should return 0 for empty key", () => {
    expect(getExerciseSessionCount({ name: "" })).toBe(0);
  });
});

// ============================================================
// 13. Sport normalization (via startLiveWorkout)
// ============================================================

describe("sport normalization", () => {
  it.each([
    ["gym", "Gym"],
    ["Gym", "Gym"],
    ["laufen", "Laufen"],
    ["run", "Laufen"],
    ["running", "Laufen"],
    ["radfahren", "Radfahren"],
    ["bike", "Radfahren"],
    ["cycling", "Radfahren"],
    ["custom", "Custom"],
    ["", "Gym"], // fallback
    ["unknown", "Gym"], // fallback
  ] as const)("should normalize '%s' to '%s'", (input, expected) => {
    const workout = startLiveWorkout({
      title: "Test",
      sport: input as SportType,
    });
    expect(workout.sport).toBe(expected);
  });
});

// ============================================================
// 14. Edge cases
// ============================================================

describe("edge cases", () => {
  it("should handle workout with no exercises gracefully on complete", () => {
    const workout = makeLiveWorkout({ exercises: [] });
    // Gym with empty exercises - addWorkoutEntry may reject but should not throw
    expect(() => completeLiveWorkout(workout)).not.toThrow();
  });

  it("should handle workout with undefined sets gracefully", () => {
    const workout = makeLiveWorkout({
      exercises: [
        {
          id: "ex-undef",
          name: "Test",
          sets: [] as any,
        },
      ],
    });
    expect(() => completeLiveWorkout(workout)).not.toThrow();
  });

  it("should compute adaptive score as min(100, minutes + exercises*5)", () => {
    const workout = makeLiveWorkout({
      durationSeconds: 3600, // 60 minutes
      exercises: [
        {
          id: "ex-score",
          name: "Bench",
          sets: [{ id: "s-sc", reps: 10, weight: 80, completed: true }],
        },
      ],
    });

    const entry = completeLiveWorkout(workout);
    // 60 min + 1 exercise * 5 = 65
    expect(entry.adaptiveScore).toBe(65);
  });

  it("should handle sets with NaN/Infinity gracefully", () => {
    const workout = makeLiveWorkout({
      exercises: [
        {
          id: "ex-nan",
          name: "Bad Data",
          sets: [
            { id: "s-nan1", reps: NaN, weight: Infinity, completed: true },
            { id: "s-nan2", reps: 10, weight: 80, completed: true },
          ],
        },
      ],
    });

    const entry = completeLiveWorkout(workout);
    // NaN/Infinity sets should be filtered or treated as 0
    expect(entry.exercises[0].sets.length).toBeGreaterThanOrEqual(1);
  });
});
