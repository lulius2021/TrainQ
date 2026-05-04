// src/utils/__tests__/workoutHistory.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock Capacitor-dependent imports
vi.mock("../../services/widgetDataSync", () => ({ syncWidgetData: vi.fn() }));

import {
  addWorkoutEntry,
  loadWorkoutHistory,
  computeTotalVolume,
  saveWorkoutHistory,
  clearWorkoutHistory,
  __debugGetStorageKey,
  type WorkoutHistoryEntry,
  type WorkoutHistoryExercise,
} from "../workoutHistory";
import { setActiveSession } from "../session";

// --------------- helpers ---------------

const TEST_USER_ID = "test-user-abc-123";

function setupSession(): void {
  setActiveSession({ userId: TEST_USER_ID, isPro: false });
}

function makeGymEntry(
  overrides: Partial<WorkoutHistoryEntry> & { id?: string } = {},
): Omit<WorkoutHistoryEntry, "id" | "totalVolume"> & { id?: string } {
  return {
    id: overrides.id ?? `gym-${Date.now()}-${Math.random()}`,
    title: "Push Day",
    sport: "Gym",
    startedAt: "2025-12-01T10:00:00Z",
    endedAt: "2025-12-01T11:00:00Z",
    durationSec: 3600,
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { reps: 10, weight: 80 },
          { reps: 8, weight: 85 },
        ],
      },
    ],
    ...overrides,
  };
}

function makeCardioEntry(
  overrides: Partial<WorkoutHistoryEntry> & { id?: string } = {},
): Omit<WorkoutHistoryEntry, "id" | "totalVolume"> & { id?: string } {
  return {
    id: overrides.id ?? `run-${Date.now()}-${Math.random()}`,
    title: "Morning Run",
    sport: "Laufen",
    startedAt: "2025-12-02T07:00:00Z",
    endedAt: "2025-12-02T07:30:00Z",
    durationSec: 1800,
    exercises: [],
    distanceKm: 5,
    ...overrides,
  };
}

// --------------- setup ---------------

beforeEach(() => {
  localStorage.clear();
  setupSession();
});

// --------------- computeTotalVolume ---------------

describe("computeTotalVolume", () => {
  it("sums reps * weight across all exercises and sets", () => {
    const exercises: WorkoutHistoryExercise[] = [
      {
        name: "Squat",
        sets: [
          { reps: 5, weight: 100 },
          { reps: 5, weight: 100 },
        ],
      },
      {
        name: "Leg Press",
        sets: [{ reps: 10, weight: 200 }],
      },
    ];
    // 5*100 + 5*100 + 10*200 = 3000
    expect(computeTotalVolume(exercises)).toBe(3000);
  });

  it("returns 0 for empty exercises", () => {
    expect(computeTotalVolume([])).toBe(0);
  });

  it("handles NaN / Infinity gracefully", () => {
    const exercises: WorkoutHistoryExercise[] = [
      {
        name: "Bad data",
        sets: [
          { reps: NaN, weight: 100 },
          { reps: 5, weight: Infinity },
        ],
      },
    ];
    // NaN reps -> 0, Infinity weight -> 0
    expect(computeTotalVolume(exercises)).toBe(0);
  });

  it("handles null/undefined input without throwing", () => {
    expect(computeTotalVolume(null as any)).toBe(0);
    expect(computeTotalVolume(undefined as any)).toBe(0);
  });
});

// --------------- addWorkoutEntry + loadWorkoutHistory (round-trip) ---------------

describe("addWorkoutEntry + loadWorkoutHistory (round-trip)", () => {
  it("saves and loads a gym workout", () => {
    const entry = makeGymEntry({ id: "gym-1" });
    addWorkoutEntry(entry);

    const history = loadWorkoutHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("gym-1");
    expect(history[0].sport).toBe("Gym");
    expect(history[0].totalVolume).toBe(
      computeTotalVolume(entry.exercises),
    );
  });

  it("saves and loads a cardio workout with distanceKm and paceSecPerKm", () => {
    const entry = makeCardioEntry({ id: "run-1", distanceKm: 10, durationSec: 3000 });
    addWorkoutEntry(entry);

    const history = loadWorkoutHistory();
    expect(history).toHaveLength(1);
    expect(history[0].distanceKm).toBe(10);
    // pace = 3000 / 10 = 300 sec/km
    expect(history[0].paceSecPerKm).toBe(300);
    // Cardio totalVolume is always 0
    expect(history[0].totalVolume).toBe(0);
  });

  it("generates an id when none is provided", () => {
    const entry = makeGymEntry();
    delete (entry as any).id;
    const result = addWorkoutEntry(entry);
    expect(result.id).toBeTruthy();
    expect(typeof result.id).toBe("string");
  });
});

// --------------- sanitization ---------------

describe("sanitization", () => {
  it("assigns a generated id when entry has no id", () => {
    const entry = makeGymEntry();
    delete (entry as any).id;
    const result = addWorkoutEntry(entry);
    expect(result.id).toBeTruthy();
  });

  it("normalizes sport casing (gym -> Gym, laufen -> Laufen)", () => {
    const entry1 = makeGymEntry({ id: "s1", sport: "gym" });
    const entry2 = makeCardioEntry({ id: "s2", sport: "laufen" });
    const entry3 = makeCardioEntry({ id: "s3", sport: "RADFAHREN" });

    addWorkoutEntry(entry1);
    addWorkoutEntry(entry2);
    addWorkoutEntry(entry3);

    const history = loadWorkoutHistory();
    const byId = Object.fromEntries(history.map((h) => [h.id, h]));

    expect(byId["s1"].sport).toBe("Gym");
    expect(byId["s2"].sport).toBe("Laufen");
    expect(byId["s3"].sport).toBe("Radfahren");
  });

  it("converts invalid dates to a valid ISO string", () => {
    const entry = makeGymEntry({
      id: "bad-date",
      startedAt: "not-a-date" as any,
      endedAt: "also-invalid" as any,
    });
    const result = addWorkoutEntry(entry);
    // Should not throw and should produce valid ISO
    expect(() => new Date(result.startedAt)).not.toThrow();
    expect(new Date(result.startedAt).getTime()).not.toBeNaN();
  });

  it("defaults title to 'Training' when missing", () => {
    const entry = makeGymEntry({ id: "no-title", title: "" });
    const result = addWorkoutEntry(entry);
    expect(result.title).toBe("Training");
  });

  it("clamps durationSec to non-negative integer", () => {
    const entry = makeGymEntry({ id: "neg-dur", durationSec: -500 });
    const result = addWorkoutEntry(entry);
    expect(result.durationSec).toBeGreaterThanOrEqual(0);
  });

  it("clamps sessionRpe between 0 and 10", () => {
    const entry = makeGymEntry({ id: "rpe-high", sessionRpe: 15 });
    const result = addWorkoutEntry(entry);
    expect(result.sessionRpe).toBeLessThanOrEqual(10);
  });
});

// --------------- dedup by id ---------------

describe("dedup by id", () => {
  it("keeps only the latest version when adding duplicate id", () => {
    addWorkoutEntry(makeGymEntry({ id: "dup-1", title: "Version 1" }));
    addWorkoutEntry(makeGymEntry({ id: "dup-1", title: "Version 2" }));

    const history = loadWorkoutHistory();
    const matches = history.filter((h) => h.id === "dup-1");
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe("Version 2");
  });

  it("deduplicates on load when raw storage contains duplicates", () => {
    // Manually write duplicates into storage
    const raw = [
      { ...makeGymEntry({ id: "dup-raw" }), totalVolume: 0 },
      { ...makeGymEntry({ id: "dup-raw" }), totalVolume: 0 },
      { ...makeGymEntry({ id: "unique" }), totalVolume: 0 },
    ];
    const key = __debugGetStorageKey();
    const scopedKey = `${key}::${TEST_USER_ID}`;
    localStorage.setItem(scopedKey, JSON.stringify(raw));

    const history = loadWorkoutHistory();
    expect(history).toHaveLength(2);
  });
});

// --------------- sort order ---------------

describe("sort order (most recent first)", () => {
  it("sorts entries by endedAt descending", () => {
    addWorkoutEntry(
      makeGymEntry({
        id: "old",
        endedAt: "2025-01-01T10:00:00Z",
        startedAt: "2025-01-01T09:00:00Z",
      }),
    );
    addWorkoutEntry(
      makeGymEntry({
        id: "new",
        endedAt: "2025-06-01T10:00:00Z",
        startedAt: "2025-06-01T09:00:00Z",
      }),
    );
    addWorkoutEntry(
      makeGymEntry({
        id: "mid",
        endedAt: "2025-03-01T10:00:00Z",
        startedAt: "2025-03-01T09:00:00Z",
      }),
    );

    const history = loadWorkoutHistory();
    expect(history[0].id).toBe("new");
    expect(history[1].id).toBe("mid");
    expect(history[2].id).toBe("old");
  });
});

// --------------- MAX_ENTRIES cap ---------------

describe("MAX_ENTRIES cap (300)", () => {
  it("caps history at 300 entries", () => {
    const entries = Array.from({ length: 310 }, (_, i) =>
      makeGymEntry({
        id: `cap-${i}`,
        startedAt: new Date(2025, 0, 1, 0, i).toISOString(),
        endedAt: new Date(2025, 0, 1, 1, i).toISOString(),
      }),
    );

    // Use saveWorkoutHistory directly to batch-write all at once
    saveWorkoutHistory(entries as any);

    const history = loadWorkoutHistory();
    expect(history.length).toBeLessThanOrEqual(300);
  });
});

// --------------- cardio-specific fields ---------------

describe("cardio-specific fields", () => {
  it("auto-calculates pace from duration and distance", () => {
    const entry = makeCardioEntry({
      id: "pace-calc",
      durationSec: 1500, // 25 min
      distanceKm: 5,
    });
    const result = addWorkoutEntry(entry);
    // 1500 / 5 = 300 sec/km
    expect(result.paceSecPerKm).toBe(300);
  });

  it("keeps explicit paceSecPerKm if provided", () => {
    const entry = makeCardioEntry({
      id: "pace-explicit",
      durationSec: 1500,
      distanceKm: 5,
      paceSecPerKm: 350,
    });
    const result = addWorkoutEntry(entry);
    expect(result.paceSecPerKm).toBe(350);
  });

  it("clamps distanceKm to 0..1000", () => {
    const entry = makeCardioEntry({
      id: "dist-clamp",
      distanceKm: 5000,
    });
    const result = addWorkoutEntry(entry);
    expect(result.distanceKm).toBeLessThanOrEqual(1000);
  });

  it("clamps paceSecPerKm to 60..3600", () => {
    const entry = makeCardioEntry({
      id: "pace-clamp",
      paceSecPerKm: 10, // too fast
      distanceKm: 5,
    });
    const result = addWorkoutEntry(entry);
    expect(result.paceSecPerKm).toBeGreaterThanOrEqual(60);
  });

  it("derives distanceKm from cardio sets when not explicitly set", () => {
    // Convention: reps = minutes, weight = kilometers
    const entry = makeCardioEntry({
      id: "derive-sets",
      distanceKm: undefined,
      durationSec: 0,
      exercises: [
        {
          name: "Running",
          sets: [
            { reps: 30, weight: 5 }, // 30 min, 5 km
          ],
        },
      ],
    });
    const result = addWorkoutEntry(entry);
    expect(result.distanceKm).toBe(5);
    // duration derived: 30 min = 1800 sec
    expect(result.durationSec).toBe(1800);
  });

  it("sets totalVolume to 0 for cardio workouts", () => {
    const entry = makeCardioEntry({
      id: "vol-zero",
      exercises: [
        {
          name: "Intervals",
          sets: [{ reps: 10, weight: 2 }],
        },
      ],
    });
    const result = addWorkoutEntry(entry);
    expect(result.totalVolume).toBe(0);
  });
});

// --------------- gym-specific: empty exercises guard ---------------

describe("gym empty-exercises guard", () => {
  it("does NOT persist a gym workout with empty exercises (default)", () => {
    addWorkoutEntry(
      makeGymEntry({ id: "empty-gym", exercises: [] }),
    );
    const history = loadWorkoutHistory();
    // Should not be saved
    expect(history.find((h) => h.id === "empty-gym")).toBeUndefined();
  });

  it("persists a gym workout with empty exercises when allowEmptyExercises=true", () => {
    addWorkoutEntry(
      makeGymEntry({ id: "empty-gym-ok", exercises: [] }),
      { allowEmptyExercises: true },
    );
    const history = loadWorkoutHistory();
    expect(history.find((h) => h.id === "empty-gym-ok")).toBeDefined();
  });

  it("persists a cardio workout with empty exercises by default", () => {
    addWorkoutEntry(
      makeCardioEntry({ id: "empty-cardio", exercises: [] }),
    );
    const history = loadWorkoutHistory();
    expect(history.find((h) => h.id === "empty-cardio")).toBeDefined();
  });
});

// --------------- clearWorkoutHistory ---------------

describe("clearWorkoutHistory", () => {
  it("removes all entries", () => {
    addWorkoutEntry(makeGymEntry({ id: "to-clear" }));
    expect(loadWorkoutHistory()).toHaveLength(1);

    clearWorkoutHistory();
    expect(loadWorkoutHistory()).toHaveLength(0);
  });
});

// --------------- edge cases ---------------

describe("edge cases", () => {
  it("handles completely invalid raw data without crashing", () => {
    const key = __debugGetStorageKey();
    const scopedKey = `${key}::${TEST_USER_ID}`;
    localStorage.setItem(scopedKey, "not-json-at-all");
    expect(loadWorkoutHistory()).toEqual([]);
  });

  it("handles null exercises array gracefully", () => {
    const entry = makeGymEntry({ id: "null-ex", exercises: null as any });
    // allowEmpty so it actually saves
    const result = addWorkoutEntry(entry, { allowEmptyExercises: true });
    expect(Array.isArray(result.exercises)).toBe(true);
  });

  it("filters out sets with 0 reps and 0 weight", () => {
    const entry = makeGymEntry({
      id: "zero-sets",
      exercises: [
        {
          name: "Test",
          sets: [
            { reps: 0, weight: 0 },
            { reps: 5, weight: 50 },
          ],
        },
      ],
    });
    const result = addWorkoutEntry(entry);
    expect(result.exercises[0].sets).toHaveLength(1);
    expect(result.exercises[0].sets[0].reps).toBe(5);
  });

  it("validates rating is between 1 and 5", () => {
    const entry1 = makeGymEntry({ id: "rate-ok", rating: 4 });
    const entry2 = makeGymEntry({ id: "rate-bad", rating: 0 });
    const entry3 = makeGymEntry({ id: "rate-high", rating: 10 });

    const r1 = addWorkoutEntry(entry1);
    const r2 = addWorkoutEntry(entry2);
    const r3 = addWorkoutEntry(entry3);

    expect(r1.rating).toBe(4);
    expect(r2.rating).toBeUndefined(); // 0 is < 1
    expect(r3.rating).toBeUndefined(); // 10 > 5
  });
});
