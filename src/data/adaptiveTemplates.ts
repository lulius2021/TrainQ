
import type { Persona } from "../types/onboarding";

// Basic exercise structure matching our seed/template needs
export interface AdaptiveTemplateExercise {
    name: string;
    defaultSets: { reps: number; weight: number }[];
}

export type WorkoutFocus = "push" | "pull" | "legs" | "upper" | "lower" | "fullbody" | "cardio";

// Helper to infer focus from string (title/description)
export function inferWorkoutFocus(text: string): WorkoutFocus {
    const t = text.toLowerCase();

    if (t.includes("push") || t.includes("drück")) return "push";
    if (t.includes("pull") || t.includes("zug") || t.includes("zieh")) return "pull";
    if (t.includes("leg") || t.includes("bein") || t.includes("unterkörper")) return "legs";
    if (t.includes("upper") || t.includes("oberkörper")) {
        // If it's specifically Oberkörper but not Push/Pull, treat as Upper (mix)
        return "upper";
    }
    if (t.includes("lower") || t.includes("unterkörper")) return "lower";
    if (t.includes("run") || t.includes("lauf") || t.includes("cardio")) return "cardio";

    // Default to Full Body for generic "Training" or "Ganzkörper"
    return "fullbody";
}

// ------------------------------------------------------------------
// TEMPLATE DEFINITIONS
// ------------------------------------------------------------------

const BEGINNER_TEMPLATES: Record<WorkoutFocus, AdaptiveTemplateExercise[]> = {
    push: [
        { name: "Liegestütze", defaultSets: [{ reps: 10, weight: 0 }, { reps: 8, weight: 0 }] },
        { name: "Schulterdrücken (Kurzhantel)", defaultSets: [{ reps: 10, weight: 5 }, { reps: 10, weight: 5 }] },
        { name: "Trizepsdrücken (Kabel)", defaultSets: [{ reps: 12, weight: 15 }] },
    ],
    pull: [
        { name: "Rudern (Maschine)", defaultSets: [{ reps: 10, weight: 20 }, { reps: 10, weight: 20 }] },
        { name: "Latzug", defaultSets: [{ reps: 10, weight: 25 }, { reps: 10, weight: 25 }] },
        { name: "Bizepscurls", defaultSets: [{ reps: 12, weight: 7 }] },
    ],
    legs: [
        { name: "Kniebeuge (Eigengewicht)", defaultSets: [{ reps: 12, weight: 0 }, { reps: 12, weight: 0 }] },
        { name: "Ausfallschritte", defaultSets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }] },
        { name: "Wadenheben", defaultSets: [{ reps: 15, weight: 0 }] },
    ],
    upper: [
        { name: "Liegestütze", defaultSets: [{ reps: 10, weight: 0 }] },
        { name: "Rudern (Maschine)", defaultSets: [{ reps: 10, weight: 20 }] },
        { name: "Schulterdrücken (Kurzhantel)", defaultSets: [{ reps: 10, weight: 5 }] },
        { name: "Latzug", defaultSets: [{ reps: 10, weight: 25 }] },
    ],
    lower: [
        { name: "Kniebeuge (Goblet)", defaultSets: [{ reps: 10, weight: 8 }, { reps: 10, weight: 8 }] },
        { name: "Beinpresse", defaultSets: [{ reps: 12, weight: 40 }] },
        { name: "Plank", defaultSets: [{ reps: 45, weight: 0 }] }, // sec as reps usage in some contexts? or just placeholder
    ],
    fullbody: [
        { name: "Kniebeuge (Goblet)", defaultSets: [{ reps: 10, weight: 8 }, { reps: 10, weight: 8 }] },
        { name: "Liegestütze", defaultSets: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }] },
        { name: "Rudern (Ring/TRX)", defaultSets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }] },
        { name: "Plank", defaultSets: [{ reps: 30, weight: 0 }] },
    ],
    cardio: [
        { name: "Lockerer Lauf", defaultSets: [{ reps: 20, weight: 0 }] }, // 20 mins?
    ],
};

const ATHLETE_TEMPLATES: Record<WorkoutFocus, AdaptiveTemplateExercise[]> = {
    push: [
        { name: "Bankdrücken (Langhantel)", defaultSets: [{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }, { reps: 8, weight: 60 }] },
        { name: "Schulterdrücken (Military)", defaultSets: [{ reps: 10, weight: 30 }, { reps: 10, weight: 30 }] },
        { name: "Dips", defaultSets: [{ reps: 10, weight: 0 }, { reps: 10, weight: 0 }] },
        { name: "Seitheben", defaultSets: [{ reps: 12, weight: 10 }, { reps: 12, weight: 10 }] },
    ],
    pull: [
        { name: "Klimmzüge", defaultSets: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }, { reps: 6, weight: 0 }] },
        { name: "Langhantel-Rudern", defaultSets: [{ reps: 10, weight: 50 }, { reps: 10, weight: 50 }] },
        { name: "Face Pulls", defaultSets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 20 }] },
        { name: "Bizepscurls (SZ)", defaultSets: [{ reps: 10, weight: 25 }, { reps: 10, weight: 25 }] },
    ],
    legs: [
        { name: "Kniebeuge (Back Squat)", defaultSets: [{ reps: 6, weight: 80 }, { reps: 6, weight: 80 }, { reps: 6, weight: 80 }] },
        { name: "Rumänisches Kreuzheben", defaultSets: [{ reps: 10, weight: 70 }, { reps: 10, weight: 70 }] },
        { name: "Beinstrecker", defaultSets: [{ reps: 12, weight: 45 }, { reps: 12, weight: 45 }] },
        { name: "Wadenheben (Stehend)", defaultSets: [{ reps: 15, weight: 60 }, { reps: 15, weight: 60 }] },
    ],
    upper: [
        { name: "Bankdrücken", defaultSets: [{ reps: 8, weight: 70 }, { reps: 8, weight: 70 }] },
        { name: "Klimmzüge", defaultSets: [{ reps: 8, weight: 0 }, { reps: 8, weight: 0 }] },
        { name: "Schulterdrücken", defaultSets: [{ reps: 10, weight: 35 }] },
        { name: "Rudern (Kabel)", defaultSets: [{ reps: 10, weight: 55 }] },
    ],
    lower: [
        { name: "Kniebeuge", defaultSets: [{ reps: 8, weight: 80 }, { reps: 8, weight: 80 }] },
        { name: "Beinpresse", defaultSets: [{ reps: 10, weight: 120 }, { reps: 10, weight: 120 }] },
        { name: "Beinbeuger", defaultSets: [{ reps: 12, weight: 40 }] },
        { name: "Plank", defaultSets: [{ reps: 60, weight: 0 }] },
    ],
    fullbody: [
        { name: "Kniebeuge", defaultSets: [{ reps: 6, weight: 80 }, { reps: 6, weight: 80 }] },
        { name: "Bankdrücken", defaultSets: [{ reps: 8, weight: 70 }, { reps: 8, weight: 70 }] },
        { name: "Kreuzheben", defaultSets: [{ reps: 5, weight: 100 }] },
        { name: "Klimmzüge", defaultSets: [{ reps: 8, weight: 0 }] },
        { name: "Schulterdrücken", defaultSets: [{ reps: 10, weight: 35 }] },
    ],
    cardio: [
        { name: "Tempolauf", defaultSets: [{ reps: 30, weight: 0 }] },
    ],
};

// Manager/Intermediate fallback (mix of beginner/athlete or strict intermediate)
// For MVP, map Manager -> Athlete (or Beginner depending on business logic).
// Let's map Manager -> Beginner (safety) or create a middle ground.
// I will just use Beginner for Manager to be safe/efficient for now, or clone Beginner with slightly higher weights.
const MANAGER_TEMPLATES: Record<WorkoutFocus, AdaptiveTemplateExercise[]> = { ...BEGINNER_TEMPLATES };

export function getAdaptiveTemplate(
    textIdentifier: string, // title or description
    persona: Persona = "beginner"
): AdaptiveTemplateExercise[] {
    const focus = inferWorkoutFocus(textIdentifier);

    // Select Source based on Persona
    let source = BEGINNER_TEMPLATES;
    if (persona === "athlete") {
        source = ATHLETE_TEMPLATES;
    } else if (persona === "manager") {
        source = MANAGER_TEMPLATES; // or custom
    }

    return source[focus] ?? source.fullbody;
}
