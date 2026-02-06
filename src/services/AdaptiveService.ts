import { EXERCISES, RUNNING_EXERCISES, CYCLING_EXERCISES } from "../data/exerciseLibrary";
import type { LiveExercise, LiveSet } from "../types/training";

export interface AdaptiveOption {
    id: string;
    title: string;
    description: string;
    durationMinutes: number;
    intensity: "Low" | "Medium" | "High";
    exercises: LiveExercise[];
    totalSets: number;
}

/**
 * Generates regular (non-warmup) sets
 */
/**
 * Generates regular (non-warmup) sets
 */
function generateSets(count: number, reps: number, rpe: number, type: "normal" | "warmup" = "normal", description?: string): LiveSet[] {
    return Array.from({ length: count }).map((_, i) => ({
        id: crypto.randomUUID(),
        completed: false,
        reps: reps,
        weight: 0, // Placeholder, user sets weight
        notes: description || (i === 0 ? `Target RPE: ${rpe}` : undefined),
        setType: type
    }));
}

/**
 * Helper to find exercises by muscle/type
 */
function findExercises(criteria: (ex: typeof EXERCISES[0]) => boolean, count: number): typeof EXERCISES[0][] {
    const shuffled = [...EXERCISES].filter(criteria).sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export type SportType = "Gym" | "Laufen" | "Radfahren";

export function generateAdaptiveOptions(
    timeAvailable: number, // 15 - 120
    sport: SportType,
    specialization: string | string[], // Array for Gym, string for others
    energyLevel: 1 | 2 | 3 // 1=Low, 2=Med, 3=High
): AdaptiveOption[] {

    // --- OPTION 1: QUICK (Minimal Time/Sets) ---
    const quickOption = createOption(
        "quick",
        "Quick Session",
        "Effizientes Training in minimaler Zeit.",
        timeAvailable,
        "High",
        sport,
        specialization,
        "quick",
        energyLevel
    );

    // --- OPTION 2: FOCUS (Standard) ---
    const focusOption = createOption(
        "focus",
        `${sport} Flow`,
        `Fokus auf ${Array.isArray(specialization) ? "Ausgewählte" : specialization}.`,
        timeAvailable,
        energyLevel === 1 ? "Low" : "Medium",
        sport,
        specialization,
        "standard",
        energyLevel
    );

    // --- OPTION 3: POWER (High Volume/Intensity) ---
    const powerOption = createOption(
        "power",
        "Power Session",
        "Hohes Volumen für maximalen Reiz.",
        timeAvailable,
        "High",
        sport,
        specialization,
        "power",
        energyLevel
    );

    return [quickOption, focusOption, powerOption];
}

function createOption(
    idSuffix: string,
    title: string,
    description: string,
    duration: number,
    intensity: "Low" | "Medium" | "High",
    sport: SportType,
    specialization: string | string[],
    mode: "quick" | "standard" | "power",
    energyLevel: number
): AdaptiveOption {
    let liveExercises: LiveExercise[] = [];

    // Multipliers based on mode and energy
    let setMultiplier = 1;
    if (mode === "quick") setMultiplier = 0.7;
    if (mode === "power") setMultiplier = 1.3;
    if (energyLevel === 3) setMultiplier += 0.2;

    if (sport === "Gym") {
        const specs = Array.isArray(specialization) ? specialization : [specialization];
        const baseExCount = Math.floor(duration / 5) + 1;
        const targetExCount = Math.max(2, Math.floor(baseExCount * (mode === "quick" ? 0.7 : 1.0)));
        const setsPerEx = Math.max(2, Math.round(3 * (mode === "power" ? 1.2 : 1)));

        // Filter exercises matching ANY selected muscle group
        // If specialization is empty or contains "Full Body" (implied logic), pick broad range
        // But prompt says "Muscle Groups" multi-select

        let allMatching = EXERCISES.filter(e => {
            if (specs.length === 0) return true; // Fail safe
            return e.primaryMuscles.some(m => specs.includes(m) || specs.includes("Full Body"));
        });

        // Shuffle
        allMatching = allMatching.sort(() => 0.5 - Math.random());
        const selected = allMatching.slice(0, targetExCount);

        liveExercises = selected.map(ex => ({
            id: crypto.randomUUID(),
            exerciseId: ex.id,
            name: ex.name,
            sets: generateSets(setsPerEx, 10, 8),
            restSeconds: 90
        }));
    }
    else if (sport === "Laufen") {
        // Find Running Exercises
        const runEx = RUNNING_EXERCISES.find(e => {
            if (specialization === "Sprints") return e.id === "run_3" || e.name.includes("Interval");
            if (specialization === "Recovery Run") return e.id === "run_2" || e.name.includes("Recovery");
            return e.id === "run_1"; // Long Run / Default
        }) || RUNNING_EXERCISES[0];

        // Format: One big exercise block or intervals
        if (specialization === "Sprints" || mode === "power") {
            // Interval formatting
            // 45 min -> Warmup 10, Intervals 25, Cooldown 10
            const warmupTime = Math.min(10, Math.floor(duration * 0.2));
            const cooldownTime = Math.min(10, Math.floor(duration * 0.2));
            const workTime = duration - warmupTime - cooldownTime;

            const intervalCount = Math.floor(workTime / 3); // 3 min clusters

            liveExercises = [{
                id: crypto.randomUUID(),
                exerciseId: runEx.id,
                name: "Warmup Run",
                sets: generateSets(1, 0, 6, "warmup", `${warmupTime} min`),
                restSeconds: 0
            }, {
                id: crypto.randomUUID(),
                exerciseId: runEx.id,
                name: "Interval Sprints",
                sets: generateSets(intervalCount, 0, 9, "normal", "400m / 2min Hard"),
                restSeconds: 60 // Rest between intervals
            }, {
                id: crypto.randomUUID(),
                exerciseId: runEx.id,
                name: "Cooldown Run",
                sets: generateSets(1, 0, 5, "normal", `${cooldownTime} min`),
                restSeconds: 0
            }];

        } else {
            // Steady State
            liveExercises = [{
                id: crypto.randomUUID(),
                exerciseId: runEx.id,
                name: specialization as string,
                sets: generateSets(1, 0, specialization === "Recovery Run" ? 5 : 7, "normal", `${duration} min`),
                restSeconds: 0
            }];
        }
    }
    else if (sport === "Radfahren") {
        const cycleEx = CYCLING_EXERCISES.find(e => {
            if (specialization === "Intervalle") return e.id === "cycle_3" || e.name.includes("Interval");
            if (specialization === "Recovery Ride") return e.id === "cycle_2" || e.name.includes("Recovery");
            return e.id === "cycle_1";
        }) || CYCLING_EXERCISES[0];

        if (specialization === "Intervalle" || mode === "power") {
            const warmup = 10;
            const cooldown = 10;
            const main = duration - warmup - cooldown;
            const intervals = Math.max(3, Math.floor(main / 5));

            liveExercises = [{
                id: crypto.randomUUID(),
                exerciseId: cycleEx.id,
                name: "Warmup Ride",
                sets: generateSets(1, 0, 6, "warmup", `${warmup} min`),
                restSeconds: 0
            }, {
                id: crypto.randomUUID(),
                exerciseId: cycleEx.id,
                name: "Power Intervals",
                sets: generateSets(intervals, 0, 8, "normal", "4 min Threshold / 2 min Easy"),
                restSeconds: 0
            }, {
                id: crypto.randomUUID(),
                exerciseId: cycleEx.id,
                name: "Cooldown Ride",
                sets: generateSets(1, 0, 5, "normal", `${cooldown} min`),
                restSeconds: 0
            }];
        } else {
            liveExercises = [{
                id: crypto.randomUUID(),
                exerciseId: cycleEx.id,
                name: specialization as string,
                sets: generateSets(1, 0, specialization === "Recovery Ride" ? 4 : 7, "normal", `${duration} min`),
                restSeconds: 0
            }];
        }
    }


    return {
        id: `adaptive_${idSuffix}_${Date.now()}`,
        title,
        description,
        durationMinutes: duration,
        intensity,
        exercises: liveExercises,
        totalSets: liveExercises.reduce((acc, ex) => acc + ex.sets.length, 0)
    };
}

// --- PERSISTENCE ---

import { getActiveUserId } from "../utils/session";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { format } from "date-fns";
import type { CalendarEvent } from "../types/training"; // Ensure this matches Dashboard usage

export function persistAdaptiveWorkout(
    option: AdaptiveOption,
    sport: SportType,
    action: "import" | "start"
): { eventId: string; liveWorkout: any } {
    const userId = getActiveUserId() || "user";
    const eventId = crypto.randomUUID();
    const now = new Date();
    const STORAGE_KEY = "trainq_calendar_events";

    // 1. Create Calendar Event
    const calendarEvent: CalendarEvent = {
        id: eventId,
        userId,
        title: option.title,
        date: format(now, "yyyy-MM-dd"),
        startTime: format(now, "HH:mm"),
        endTime: "",
        type: "training",
        trainingType: sport.toLowerCase() as any,
        trainingStatus: "open", // Always open/planned initially
        description: option.description,
        workoutData: {
            exercises: option.exercises
        },
        adaptiveAppliedAt: now.toISOString(),
        adaptiveReasons: [option.intensity + " Intensity", sport]
    };

    // 2. Load & Save to Storage
    try {
        const raw = getScopedItem(STORAGE_KEY, userId);
        const events: CalendarEvent[] = raw ? JSON.parse(raw) : [];
        events.push(calendarEvent);
        setScopedItem(STORAGE_KEY, JSON.stringify(events), userId);
    } catch (e) {
        console.error("Failed to save adaptive event", e);
    }

    // 3. Prepare Live Workout Object (for immediate start)
    const liveWorkout = {
        id: crypto.randomUUID(),
        calendarEventId: eventId,
        title: option.title,
        sport: sport,
        startedAt: now.toISOString(),
        isActive: true,
        isMinimized: false,
        exercises: option.exercises,
        notes: `Adaptiv: ${option.description}`
    };

    return { eventId, liveWorkout };
}
