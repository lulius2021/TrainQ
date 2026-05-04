// src/utils/__tests__/adaptiveScoring.test.ts
// Comprehensive tests for TrainQ adaptive scoring — the core USP logic.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock i18n before importing the module under test
vi.mock("../../i18n/config", () => ({
  default: {
    t: (key: string, _opts?: Record<string, unknown>) => key,
  },
}));

import {
  buildAdaptiveSuggestions,
  buildAdaptiveSuggestion,
  profileAccent,
} from "../adaptiveScoring";
import type {
  AdaptiveAnswers,
  AdaptiveSuggestion,
  PostWorkoutFeedback,
  WeeklyVolumeContext,
} from "../../types/adaptive";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default "neutral" answers — mid everything, gym, 20-40 min */
function neutralAnswers(overrides: Partial<AdaptiveAnswers> = {}): AdaptiveAnswers {
  return {
    sport: "gym",
    timeToday: "20to40",
    dayForm: "mid",
    stress: "mid",
    yesterdayEffort: "mid",
    ...overrides,
  };
}

function findProfile(suggestions: AdaptiveSuggestion[], profile: string) {
  return suggestions.find((s) => s.profile === profile);
}

// ---------------------------------------------------------------------------
// 1. profileAccent
// ---------------------------------------------------------------------------

describe("profileAccent", () => {
  it("returns blue palette for stabil", () => {
    const c = profileAccent("stabil");
    expect(c.solid).toBe("#007AFF");
    expect(c.bg).toContain("0,122,255");
  });

  it("returns red palette for kompakt", () => {
    const c = profileAccent("kompakt");
    expect(c.solid).toBe("#FF3B30");
  });

  it("returns green palette for fokus", () => {
    const c = profileAccent("fokus");
    expect(c.solid).toBe("#34C759");
  });

  it("returns gray fallback for unknown profile", () => {
    const c = profileAccent("unknown_profile");
    expect(c.solid).toBe("#8E8E93");
  });

  it("returns gray fallback for empty string", () => {
    const c = profileAccent("");
    expect(c.solid).toBe("#8E8E93");
  });
});

// ---------------------------------------------------------------------------
// 2. buildAdaptiveSuggestions — basic structure
// ---------------------------------------------------------------------------

describe("buildAdaptiveSuggestions — basic structure", () => {
  it("always returns exactly 3 suggestions", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers());
    expect(result).toHaveLength(3);
  });

  it("contains stabil, kompakt, and fokus profiles", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers());
    const profiles = result.map((s) => s.profile);
    expect(profiles).toContain("stabil");
    expect(profiles).toContain("kompakt");
    expect(profiles).toContain("fokus");
  });

  it("each suggestion has required fields", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers());
    for (const s of result) {
      expect(s.profile).toBeDefined();
      expect(s.title).toBeDefined();
      expect(s.subtitle).toBeDefined();
      expect(typeof s.estimatedMinutes).toBe("number");
      expect(typeof s.exercisesCount).toBe("number");
      expect(typeof s.setsPerExercise).toBe("number");
      expect(s.intensityHint).toBeDefined();
      expect(Array.isArray(s.reasons)).toBe(true);
    }
  });

  it("backwards-compat alias buildAdaptiveSuggestion works identically", () => {
    const a = neutralAnswers();
    const r1 = buildAdaptiveSuggestions(a);
    const r2 = buildAdaptiveSuggestion(a);
    expect(r1).toEqual(r2);
  });
});

// ---------------------------------------------------------------------------
// 3. First workout (no history)
// ---------------------------------------------------------------------------

describe("first workout — no history, no feedback, no volume context", () => {
  it("does not crash with minimal arguments", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers());
    expect(result).toHaveLength(3);
  });

  it("returns sensible default minutes for stabil (gym)", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers());
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.estimatedMinutes).toBeGreaterThanOrEqual(30);
    expect(stabil.estimatedMinutes).toBeLessThanOrEqual(60);
  });

  it("returns sensible default sets for stabil (gym)", () => {
    const stabil = findProfile(buildAdaptiveSuggestions(neutralAnswers()), "stabil")!;
    expect(stabil.setsPerExercise).toBeGreaterThanOrEqual(2);
    expect(stabil.setsPerExercise).toBeLessThanOrEqual(4);
  });

  it("does not crash with null feedback and null volume context", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, null, null);
    expect(result).toHaveLength(3);
  });

  it("does not crash with undefined feedback and undefined volume context", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, undefined, undefined);
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// 4. After 1-3 workouts — conservative
// ---------------------------------------------------------------------------

describe("after 1-3 workouts — conservative recommendations", () => {
  it("with short avg duration, stabil minutes stay reasonable", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 25);
    const stabil = findProfile(result, "stabil")!;
    // Blended: 25*0.6 + 30*0.4 = 27, max(45,27)=45
    expect(stabil.estimatedMinutes).toBe(45);
  });

  it("kompakt stays short even with avg history", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 30);
    const kompakt = findProfile(result, "kompakt")!;
    expect(kompakt.estimatedMinutes).toBeLessThanOrEqual(30);
  });
});

// ---------------------------------------------------------------------------
// 5. After 20+ workouts — avgDuration blends in
// ---------------------------------------------------------------------------

describe("after 20+ workouts — adaptive to trends", () => {
  it("avgDuration of 60 min raises stabil estimate above default", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ timeToday: "40to60" }), 60);
    const stabil = findProfile(result, "stabil")!;
    // Blended: 60*0.6 + 50*0.4 = 56, max(45,56)=56
    expect(stabil.estimatedMinutes).toBe(56);
  });

  it("avgDuration below 5 is ignored (treated as no data)", () => {
    const r1 = buildAdaptiveSuggestions(neutralAnswers(), 0);
    const r2 = buildAdaptiveSuggestions(neutralAnswers(), 4);
    expect(findProfile(r1, "stabil")!.estimatedMinutes).toBe(
      findProfile(r2, "stabil")!.estimatedMinutes,
    );
  });
});

// ---------------------------------------------------------------------------
// 6. "Easy" feedback — boost
// ---------------------------------------------------------------------------

describe("easy feedback — increase recommendation", () => {
  const easyFeedback: PostWorkoutFeedback = {
    perceivedIntensity: "too_easy",
    postFeeling: "energized",
  };

  it("fokus exercises increase when last was too easy", () => {
    const base = buildAdaptiveSuggestions(neutralAnswers());
    const boosted = buildAdaptiveSuggestions(neutralAnswers(), 0, easyFeedback);
    const baseFokus = findProfile(base, "fokus")!;
    const boostedFokus = findProfile(boosted, "fokus")!;
    expect(boostedFokus.exercisesCount).toBeGreaterThan(baseFokus.exercisesCount);
  });

  it("fokus sets increase when last was too easy", () => {
    const base = buildAdaptiveSuggestions(neutralAnswers());
    const boosted = buildAdaptiveSuggestions(neutralAnswers(), 0, easyFeedback);
    expect(findProfile(boosted, "fokus")!.setsPerExercise).toBeGreaterThan(
      findProfile(base, "fokus")!.setsPerExercise,
    );
  });

  it("reasons include last_too_easy", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, easyFeedback);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("last_too_easy");
  });

  it("fokus boost does not apply when low recovery", () => {
    const lowRecoveryAnswers = neutralAnswers({ dayForm: "low" });
    const base = buildAdaptiveSuggestions(lowRecoveryAnswers);
    const boosted = buildAdaptiveSuggestions(lowRecoveryAnswers, 0, easyFeedback);
    // fokus is blocked when lowRecovery, so exercises should not increase
    expect(findProfile(boosted, "fokus")!.exercisesCount).toBe(
      findProfile(base, "fokus")!.exercisesCount,
    );
  });

  it("fokus boost does not apply for cardio", () => {
    const cardioAnswers = neutralAnswers({ sport: "laufen" });
    const base = buildAdaptiveSuggestions(cardioAnswers);
    const boosted = buildAdaptiveSuggestions(cardioAnswers, 0, easyFeedback);
    expect(findProfile(boosted, "fokus")!.exercisesCount).toBe(
      findProfile(base, "fokus")!.exercisesCount,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. "Hard" feedback — reduce
// ---------------------------------------------------------------------------

describe("hard feedback — decrease recommendation", () => {
  const hardFeedback: PostWorkoutFeedback = {
    perceivedIntensity: "too_hard",
    postFeeling: "exhausted",
  };

  it("stabil sets decrease when last was too hard", () => {
    const base = buildAdaptiveSuggestions(neutralAnswers());
    const reduced = buildAdaptiveSuggestions(neutralAnswers(), 0, hardFeedback);
    expect(findProfile(reduced, "stabil")!.setsPerExercise).toBeLessThan(
      findProfile(base, "stabil")!.setsPerExercise,
    );
  });

  it("stabil intensity hint changes to low variant", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, hardFeedback);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.intensityHint).toContain("intensityLow");
  });

  it("reasons include last_too_hard", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, hardFeedback);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("last_too_hard");
  });

  it("stabil sets never go below 2", () => {
    // Start with low recovery (sets=2), then apply hard feedback
    const answers = neutralAnswers({ dayForm: "low" });
    const result = buildAdaptiveSuggestions(answers, 0, hardFeedback);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.setsPerExercise).toBeGreaterThanOrEqual(2);
  });

  it("exhausted feeling alone triggers reduction", () => {
    const exhaustedFeedback: PostWorkoutFeedback = {
      perceivedIntensity: "right",
      postFeeling: "exhausted",
    };
    const base = buildAdaptiveSuggestions(neutralAnswers());
    const reduced = buildAdaptiveSuggestions(neutralAnswers(), 0, exhaustedFeedback);
    expect(findProfile(reduced, "stabil")!.setsPerExercise).toBeLessThan(
      findProfile(base, "stabil")!.setsPerExercise,
    );
  });
});

// ---------------------------------------------------------------------------
// 8. Long training break (>14 days) via WeeklyVolumeContext
// ---------------------------------------------------------------------------

describe("long training break — conservative (deload-like)", () => {
  const breakContext: WeeklyVolumeContext = {
    currentWeekVolume: 0,
    previousWeekVolume: 15000,
    volumeChangePercent: -100,
    currentWeekSessions: 0,
    daysSinceLastSession: 21,
    needsVolumeReduction: false,
    needsExtendedWarmup: true,
  };

  it("extended warmup hint is appended to stabil", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 40, null, breakContext);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.intensityHint).toContain("Aufwärmen");
  });

  it("extended warmup hint is appended to kompakt", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 40, null, breakContext);
    const kompakt = findProfile(result, "kompakt")!;
    expect(kompakt.intensityHint).toContain("Aufwärmen");
  });

  it("reasons include rest_gap", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 40, null, breakContext);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("rest_gap");
  });
});

// ---------------------------------------------------------------------------
// 9. Volume reduction
// ---------------------------------------------------------------------------

describe("volume reduction context", () => {
  const highVolumeContext: WeeklyVolumeContext = {
    currentWeekVolume: 25000,
    previousWeekVolume: 20000,
    volumeChangePercent: 25,
    currentWeekSessions: 5,
    daysSinceLastSession: 1,
    needsVolumeReduction: true,
    needsExtendedWarmup: false,
  };

  it("stabil sets reduced when volume too high", () => {
    const base = buildAdaptiveSuggestions(neutralAnswers());
    const reduced = buildAdaptiveSuggestions(neutralAnswers(), 0, null, highVolumeContext);
    expect(findProfile(reduced, "stabil")!.setsPerExercise).toBeLessThan(
      findProfile(base, "stabil")!.setsPerExercise,
    );
  });

  it("kompakt sets reduced when volume too high", () => {
    const base = buildAdaptiveSuggestions(neutralAnswers());
    const reduced = buildAdaptiveSuggestions(neutralAnswers(), 0, null, highVolumeContext);
    expect(findProfile(reduced, "kompakt")!.setsPerExercise).toBeLessThan(
      findProfile(base, "kompakt")!.setsPerExercise,
    );
  });

  it("kompakt sets never go below 1", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, null, highVolumeContext);
    expect(findProfile(result, "kompakt")!.setsPerExercise).toBeGreaterThanOrEqual(1);
  });

  it("reasons include volume_high", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, null, highVolumeContext);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("volume_high");
  });
});

// ---------------------------------------------------------------------------
// 10. Time constraint
// ---------------------------------------------------------------------------

describe("time constraint (lt20)", () => {
  const timeLimitedAnswers = neutralAnswers({ timeToday: "lt20" });

  it("kompakt is first in the returned array", () => {
    const result = buildAdaptiveSuggestions(timeLimitedAnswers);
    expect(result[0].profile).toBe("kompakt");
  });

  it("stabil exercises reduced to 4", () => {
    const result = buildAdaptiveSuggestions(timeLimitedAnswers);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.exercisesCount).toBe(4);
  });

  it("fokus is blocked (estimatedMinutes = 0)", () => {
    const result = buildAdaptiveSuggestions(timeLimitedAnswers);
    const fokus = findProfile(result, "fokus")!;
    expect(fokus.estimatedMinutes).toBe(0);
  });

  it("reasons include time_low", () => {
    const result = buildAdaptiveSuggestions(timeLimitedAnswers);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("time_low");
  });
});

// ---------------------------------------------------------------------------
// 11. No time constraint — stabil first
// ---------------------------------------------------------------------------

describe("no time constraint", () => {
  it("stabil is first in the returned array for 20to40", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ timeToday: "20to40" }));
    expect(result[0].profile).toBe("stabil");
  });

  it("stabil is first for gt60", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ timeToday: "gt60" }));
    expect(result[0].profile).toBe("stabil");
  });
});

// ---------------------------------------------------------------------------
// 12. Low recovery
// ---------------------------------------------------------------------------

describe("low recovery scenarios", () => {
  it("dayForm low triggers low recovery", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ dayForm: "low" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.setsPerExercise).toBe(2);
    expect(stabil.reasons).toContain("recovery_low");
    expect(stabil.reasons).toContain("form_low");
  });

  it("stress high triggers low recovery", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ stress: "high" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.setsPerExercise).toBe(2);
    expect(stabil.reasons).toContain("recovery_low");
    expect(stabil.reasons).toContain("stress_high");
  });

  it("yesterdayEffort high triggers low recovery", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ yesterdayEffort: "high" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.setsPerExercise).toBe(2);
    expect(stabil.reasons).toContain("recovery_low");
  });

  it("fokus blocked when low recovery", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ dayForm: "low" }));
    const fokus = findProfile(result, "fokus")!;
    expect(fokus.estimatedMinutes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 13. reasonsFromAnswers (tested indirectly)
// ---------------------------------------------------------------------------

describe("reasons generation", () => {
  it("high form adds form_high reason", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ dayForm: "high" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("form_high");
  });

  it("low stress adds stress_low reason", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ stress: "low" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("stress_low");
  });

  it("low effort adds effort_low reason", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ yesterdayEffort: "low" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("effort_low");
  });

  it("high effort adds effort_high reason", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ yesterdayEffort: "high" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("effort_high");
  });

  it("gt60 time adds time_high reason", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ timeToday: "gt60" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("time_high");
  });

  it("neutral answers get recovery_good", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers());
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.reasons).toContain("recovery_good");
  });

  it("reasons are deduplicated", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ dayForm: "low" }));
    const stabil = findProfile(result, "stabil")!;
    const recoveryLowCount = stabil.reasons!.filter((r) => r === "recovery_low").length;
    expect(recoveryLowCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 14. Sport-specific — cardio
// ---------------------------------------------------------------------------

describe("cardio sport (laufen / radfahren)", () => {
  it("laufen produces 1 exercise per suggestion", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ sport: "laufen" }));
    for (const s of result) {
      expect(s.exercisesCount).toBe(1);
    }
  });

  it("radfahren produces 1 exercise per suggestion", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ sport: "radfahren" }));
    for (const s of result) {
      expect(s.exercisesCount).toBe(1);
    }
  });

  it("stabil cardio title uses cardio i18n key", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ sport: "laufen" }));
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.title).toContain("stabil_cardio");
  });

  it("kompakt cardio subtitle differs for laufen vs radfahren", () => {
    const laufen = buildAdaptiveSuggestions(neutralAnswers({ sport: "laufen" }));
    const rad = buildAdaptiveSuggestions(neutralAnswers({ sport: "radfahren" }));
    const laufenKompakt = findProfile(laufen, "kompakt")!;
    const radKompakt = findProfile(rad, "kompakt")!;
    expect(laufenKompakt.subtitle).toContain("Laufen");
    expect(radKompakt.subtitle).toContain("Radfahren");
  });
});

// ---------------------------------------------------------------------------
// 15. Inconsistent / edge-case data — robustness
// ---------------------------------------------------------------------------

describe("inconsistent and edge-case data — robustness", () => {
  it("handles sport undefined (defaults to gym)", () => {
    const answers = { ...neutralAnswers() } as AdaptiveAnswers;
    // @ts-expect-error — testing runtime resilience with missing sport
    delete answers.sport;
    const result = buildAdaptiveSuggestions(answers);
    expect(result).toHaveLength(3);
    // Should behave like gym (5 exercises for stabil when not time limited)
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.exercisesCount).toBe(5);
  });

  it("handles avgDurationMin = NaN gracefully", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), NaN);
    expect(result).toHaveLength(3);
    // NaN > 5 is false, so it should fall back to bucket estimate
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.estimatedMinutes).toBeGreaterThan(0);
  });

  it("handles avgDurationMin = negative gracefully", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), -10);
    expect(result).toHaveLength(3);
    // -10 > 5 is false, so bucket estimate used
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.estimatedMinutes).toBeGreaterThan(0);
  });

  it("handles avgDurationMin = 0", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0);
    expect(result).toHaveLength(3);
  });

  it("handles avgDurationMin = Infinity", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers(), Infinity);
    expect(result).toHaveLength(3);
    // Blended: Infinity*0.6 + 30*0.4 = Infinity, max(45, Infinity) = Infinity
    // This is technically valid JS behavior — just verify no crash
  });

  it("handles unknown timeToday bucket gracefully", () => {
    const answers = neutralAnswers();
    // @ts-expect-error — testing with invalid bucket value
    answers.timeToday = "invalid_bucket";
    const result = buildAdaptiveSuggestions(answers);
    expect(result).toHaveLength(3);
  });

  it("handles unknown dayForm bucket gracefully", () => {
    const answers = neutralAnswers();
    // @ts-expect-error — testing with invalid bucket value
    answers.dayForm = "invalid";
    const result = buildAdaptiveSuggestions(answers);
    expect(result).toHaveLength(3);
  });

  it("volume context with zero values does not crash", () => {
    const zeroContext: WeeklyVolumeContext = {
      currentWeekVolume: 0,
      previousWeekVolume: 0,
      volumeChangePercent: 0,
      currentWeekSessions: 0,
      daysSinceLastSession: 0,
      needsVolumeReduction: false,
      needsExtendedWarmup: false,
    };
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, null, zeroContext);
    expect(result).toHaveLength(3);
  });

  it("feedback with all neutral values does not alter baseline", () => {
    const neutralFeedback: PostWorkoutFeedback = {
      perceivedIntensity: "right",
      postFeeling: "good",
    };
    const base = buildAdaptiveSuggestions(neutralAnswers());
    const withFeedback = buildAdaptiveSuggestions(neutralAnswers(), 0, neutralFeedback);
    expect(findProfile(base, "stabil")!.setsPerExercise).toBe(
      findProfile(withFeedback, "stabil")!.setsPerExercise,
    );
  });
});

// ---------------------------------------------------------------------------
// 16. Combined scenarios
// ---------------------------------------------------------------------------

describe("combined scenarios", () => {
  it("hard feedback + volume reduction = double reduction on stabil", () => {
    const hardFeedback: PostWorkoutFeedback = {
      perceivedIntensity: "too_hard",
      postFeeling: "exhausted",
    };
    const highVolume: WeeklyVolumeContext = {
      currentWeekVolume: 25000,
      previousWeekVolume: 20000,
      volumeChangePercent: 25,
      currentWeekSessions: 5,
      daysSinceLastSession: 1,
      needsVolumeReduction: true,
      needsExtendedWarmup: false,
    };
    const result = buildAdaptiveSuggestions(neutralAnswers(), 0, hardFeedback, highVolume);
    const stabil = findProfile(result, "stabil")!;
    // Base=3, hard feedback: max(2, 3-1)=2, volume: max(2, 2-1)=2
    expect(stabil.setsPerExercise).toBe(2);
    expect(stabil.reasons).toContain("last_too_hard");
    expect(stabil.reasons).toContain("volume_high");
  });

  it("time limited + low recovery = fokus blocked, kompakt first", () => {
    const answers = neutralAnswers({ timeToday: "lt20", dayForm: "low" });
    const result = buildAdaptiveSuggestions(answers);
    expect(result[0].profile).toBe("kompakt");
    expect(findProfile(result, "fokus")!.estimatedMinutes).toBe(0);
  });

  it("easy feedback + low recovery = fokus not boosted", () => {
    const easyFeedback: PostWorkoutFeedback = {
      perceivedIntensity: "too_easy",
      postFeeling: "energized",
    };
    const answers = neutralAnswers({ stress: "high" });
    const result = buildAdaptiveSuggestions(answers, 0, easyFeedback);
    const fokus = findProfile(result, "fokus")!;
    // fokus blocked because of low recovery
    expect(fokus.estimatedMinutes).toBe(0);
  });

  it("extended warmup + hard feedback = both applied to stabil", () => {
    const hardFeedback: PostWorkoutFeedback = {
      perceivedIntensity: "too_hard",
      postFeeling: "good",
    };
    const breakContext: WeeklyVolumeContext = {
      currentWeekVolume: 0,
      previousWeekVolume: 15000,
      volumeChangePercent: -100,
      currentWeekSessions: 0,
      daysSinceLastSession: 21,
      needsVolumeReduction: false,
      needsExtendedWarmup: true,
    };
    const result = buildAdaptiveSuggestions(neutralAnswers(), 40, hardFeedback, breakContext);
    const stabil = findProfile(result, "stabil")!;
    expect(stabil.intensityHint).toContain("intensityLow");
    expect(stabil.intensityHint).toContain("Aufwärmen");
    expect(stabil.reasons).toContain("rest_gap");
    expect(stabil.reasons).toContain("last_too_hard");
  });
});

// ---------------------------------------------------------------------------
// 17. Minute estimation blending
// ---------------------------------------------------------------------------

describe("minute estimation blending", () => {
  it("lt20 bucket gives ~15 min base", () => {
    // No avgDuration → pure bucket
    const result = buildAdaptiveSuggestions(neutralAnswers({ timeToday: "lt20" }));
    const kompakt = findProfile(result, "kompakt")!;
    // kompakt for lt20 = 20 min (fixed), not blended
    expect(kompakt.estimatedMinutes).toBe(20);
  });

  it("40to60 bucket with 45 avg → blended stabil", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ timeToday: "40to60" }), 45);
    const stabil = findProfile(result, "stabil")!;
    // Blended: 45*0.6 + 50*0.4 = 47, max(45, 47)=47
    expect(stabil.estimatedMinutes).toBe(47);
  });

  it("gt60 bucket alone gives 70 min base for stabil", () => {
    const result = buildAdaptiveSuggestions(neutralAnswers({ timeToday: "gt60" }));
    const stabil = findProfile(result, "stabil")!;
    // No avg → bucket=70, max(45, 70) = 70
    expect(stabil.estimatedMinutes).toBe(70);
  });
});
