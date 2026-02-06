import { EXERCISES } from "../data/exerciseLibrary";
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
function generateSets(count: number, reps: number, rpe: number): LiveSet[] {
    return Array.from({ length: count }).map((_, i) => ({
        id: crypto.randomUUID(),
        completed: false,
        reps: reps,
        weight: 0, // Placeholder, user sets weight
        notes: i === 0 ? `Target RPE: ${rpe}` : undefined,
        setType: "normal"
    }));
}

/**
 * Helper to find exercises by muscle/type
 */
function findExercises(criteria: (ex: typeof EXERCISES[0]) => boolean, count: number): typeof EXERCISES[0][] {
    const shuffled = [...EXERCISES].filter(criteria).sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

export function generateAdaptiveOptions(
    timeAvailable: number, // 15, 30, 45, 60
    focus: "Strength" | "Cardio" | "Full Body" | "Upper" | "Lower",
    energyLevel: 1 | 2 | 3 // 1=Low, 2=Med, 3=High
): AdaptiveOption[] {

    // Determine base exercise count based on time (approx 4 mins per exercise incl rest)
    // 15min -> 3 exercises
    // 30min -> 5 exercises
    // 45min -> 7 exercises
    // 60min -> 9 exercises
    const baseCount = Math.floor(timeAvailable / 5) + 1; // Simplified logic

    // --- OPTION 1: QUICK (Minimal Time/Sets) ---
    // Uses 70% of base count, fewer sets
    const quickExCount = Math.max(2, Math.floor(baseCount * 0.7));
    const quickOption = createOption(
        "quick",
        "Quick & Dirty",
        "Effizientes Training in minimaler Zeit.",
        timeAvailable, // Actually might be less, but fits the slot
        "High",
        focus,
        quickExCount,
        2 // 2 sets per exercise
    );

    // --- OPTION 2: FOCUS (Standard) ---
    // Uses normal base count, standard sets
    const focusOption = createOption(
        "focus",
        `${focus} Flow`,
        `Fokus auf ${focus} mit kontrolliertem Volumen.`,
        timeAvailable,
        energyLevel === 1 ? "Low" : "Medium",
        focus,
        baseCount,
        3 // 3 sets per exercise
    );

    // --- OPTION 3: POWER (High Volume/Intensity) ---
    // Slightly more exercises or sets if energy permits
    const powerOption = createOption(
        "power",
        "Power Session",
        "Hohes Volumen für maximalen Reiz.",
        timeAvailable,
        "High",
        focus,
        baseCount,
        energyLevel === 3 ? 4 : 3 // 4 sets if high energy
    );

    return [quickOption, focusOption, powerOption];
}

function createOption(
    idSuffix: string,
    title: string,
    description: string,
    duration: number,
    intensity: "Low" | "Medium" | "High",
    focus: string,
    exerciseCount: number,
    setsPerExercise: number
): AdaptiveOption {
    let selectedExercises: typeof EXERCISES[0][] = [];

    // Select exercises based on focus
    if (focus === "Strength" || focus === "Full Body") {
        // Mix of Push, Pull, Legs
        const push = findExercises(e => e.primaryMuscles.includes("chest") || e.primaryMuscles.includes("triceps") || e.primaryMuscles.includes("front_delts"), 10);
        const pull = findExercises(e => e.primaryMuscles.includes("back") || e.primaryMuscles.includes("biceps") || e.primaryMuscles.includes("rear_delts"), 10);
        const legs = findExercises(e => e.primaryMuscles.includes("quads") || e.primaryMuscles.includes("hamstrings") || e.primaryMuscles.includes("glutes"), 10);

        // Round robin pick
        while (selectedExercises.length < exerciseCount) {
            if (legs.length) selectedExercises.push(legs.shift()!);
            if (selectedExercises.length >= exerciseCount) break;
            if (push.length) selectedExercises.push(push.shift()!);
            if (selectedExercises.length >= exerciseCount) break;
            if (pull.length) selectedExercises.push(pull.shift()!);
        }
    } else if (focus === "Upper") {
        selectedExercises = findExercises(e =>
            e.primaryMuscles.some(m => ["chest", "back", "front_delts", "side_delts", "rear_delts", "biceps", "triceps"].includes(m)),
            exerciseCount
        );
    } else if (focus === "Lower") {
        selectedExercises = findExercises(e =>
            e.primaryMuscles.some(m => ["quads", "hamstrings", "glutes", "calves"].includes(m)),
            exerciseCount
        );
    } else if (focus === "Cardio") {
        // Fallback to high rep compounds or core if no cardio specific
        selectedExercises = findExercises(e =>
            e.primaryMuscles.includes("core") || e.type === "conditioning" || e.primaryMuscles.includes("quads"), // High energy muscles
            exerciseCount
        );
    }

    // Convert to LiveExercise
    const liveExercises: LiveExercise[] = selectedExercises.map(ex => ({
        id: crypto.randomUUID(), // unique instance id
        exerciseId: ex.id,
        name: ex.name,
        sets: generateSets(setsPerExercise, focus === "Strength" ? 5 : 12, 8), // 8 RPE default
        restSeconds: focus === "Strength" ? 120 : 60
    }));

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
