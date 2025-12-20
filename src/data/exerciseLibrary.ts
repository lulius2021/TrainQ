// src/data/exerciseLibrary.ts

export type MuscleGroup =
  | "Brust"
  | "Rücken"
  | "Schultern"
  | "Beine"
  | "Po"
  | "Bauch"
  | "Bizeps"
  | "Trizeps"
  | "Unterer Rücken"
  | "Ganzkörper";

export type Equipment =
  | "Langhantel"
  | "Kurzhantel"
  | "Kabelzug"
  | "Maschine"
  | "Körpergewicht"
  | "Kettlebell"
  | "Sonstiges";

export type Difficulty = "Leicht" | "Mittel" | "Schwer";

export type ExerciseType = "Kraft" | "Ausdauer" | "Beweglichkeit";

export interface Exercise {
  id: string;
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  equipment: Equipment[];
  difficulty: Difficulty;
  type: ExerciseType;
}

export interface ExerciseFilters {
  search: string;
  muscle: MuscleGroup | "alle";
  equipment: Equipment | "alle";
  difficulty: Difficulty | "alle";
  type: ExerciseType | "alle";
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Brust",
  "Rücken",
  "Schultern",
  "Beine",
  "Po",
  "Bauch",
  "Bizeps",
  "Trizeps",
  "Unterer Rücken",
  "Ganzkörper",
];

export const EQUIPMENTS: Equipment[] = [
  "Langhantel",
  "Kurzhantel",
  "Kabelzug",
  "Maschine",
  "Körpergewicht",
  "Kettlebell",
  "Sonstiges",
];

export const DIFFICULTIES: Difficulty[] = ["Leicht", "Mittel", "Schwer"];

export const EXERCISE_TYPES: ExerciseType[] = [
  "Kraft",
  "Ausdauer",
  "Beweglichkeit",
];

// Ausgewählte Standardübungen – angelehnt an typische ModusX-Übungen.
// Du kannst diese Liste jederzeit erweitern.
export const EXERCISES: Exercise[] = [
  // Brust
  {
    id: "bench_press_bb",
    name: "Bankdrücken Langhantel",
    primaryMuscles: ["Brust"],
    secondaryMuscles: ["Trizeps", "Schultern"],
    equipment: ["Langhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "bench_press_db",
    name: "Bankdrücken Kurzhantel",
    primaryMuscles: ["Brust"],
    secondaryMuscles: ["Trizeps", "Schultern"],
    equipment: ["Kurzhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "incline_db_press",
    name: "Schrägbankdrücken Kurzhantel",
    primaryMuscles: ["Brust"],
    secondaryMuscles: ["Schultern", "Trizeps"],
    equipment: ["Kurzhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "pushups",
    name: "Liegestütze",
    primaryMuscles: ["Brust"],
    secondaryMuscles: ["Schultern", "Trizeps"],
    equipment: ["Körpergewicht"],
    difficulty: "Leicht",
    type: "Kraft",
  },

  // Rücken / Pull
  {
    id: "pullups",
    name: "Klimmzüge",
    primaryMuscles: ["Rücken"],
    secondaryMuscles: ["Bizeps", "Unterer Rücken"],
    equipment: ["Körpergewicht"],
    difficulty: "Schwer",
    type: "Kraft",
  },
  {
    id: "lat_pulldown",
    name: "Latzug breit",
    primaryMuscles: ["Rücken"],
    secondaryMuscles: ["Bizeps"],
    equipment: ["Maschine"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "row_bb",
    name: "Rudern vorgebeugt Langhantel",
    primaryMuscles: ["Rücken"],
    secondaryMuscles: ["Bizeps"],
    equipment: ["Langhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "row_cable",
    name: "Rudern sitzend Kabelzug",
    primaryMuscles: ["Rücken"],
    secondaryMuscles: ["Bizeps"],
    equipment: ["Kabelzug"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "face_pull",
    name: "Face Pulls Kabelzug",
    primaryMuscles: ["Rücken"],
    secondaryMuscles: ["Schultern"],
    equipment: ["Kabelzug"],
    difficulty: "Leicht",
    type: "Kraft",
  },

  // Schultern
  {
    id: "ohp_bb",
    name: "Schulterdrücken Langhantel",
    primaryMuscles: ["Schultern"],
    secondaryMuscles: ["Trizeps"],
    equipment: ["Langhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "ohp_db",
    name: "Schulterdrücken Kurzhantel",
    primaryMuscles: ["Schultern"],
    secondaryMuscles: ["Trizeps"],
    equipment: ["Kurzhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "lateral_raise",
    name: "Seitheben Kurzhantel",
    primaryMuscles: ["Schultern"],
    secondaryMuscles: [],
    equipment: ["Kurzhantel"],
    difficulty: "Leicht",
    type: "Kraft",
  },

  // Beine / Po / Unterer Rücken
  {
    id: "squat_bb",
    name: "Kniebeugen Langhantel",
    primaryMuscles: ["Beine", "Po"],
    secondaryMuscles: ["Unterer Rücken"],
    equipment: ["Langhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "front_squat_bb",
    name: "Front Squats Langhantel",
    primaryMuscles: ["Beine"],
    secondaryMuscles: ["Po"],
    equipment: ["Langhantel"],
    difficulty: "Schwer",
    type: "Kraft",
  },
  {
    id: "leg_press",
    name: "Beinpresse",
    primaryMuscles: ["Beine", "Po"],
    secondaryMuscles: [],
    equipment: ["Maschine"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "rdl_bb",
    name: "Rumänisches Kreuzheben",
    primaryMuscles: ["Beine", "Po"],
    secondaryMuscles: ["Unterer Rücken"],
    equipment: ["Langhantel"],
    difficulty: "Schwer",
    type: "Kraft",
  },
  {
    id: "deadlift_bb",
    name: "Klassisches Kreuzheben",
    primaryMuscles: ["Beine", "Unterer Rücken"],
    secondaryMuscles: ["Po"],
    equipment: ["Langhantel"],
    difficulty: "Schwer",
    type: "Kraft",
  },
  {
    id: "hip_thrust_bb",
    name: "Hip Thrust Langhantel",
    primaryMuscles: ["Po"],
    secondaryMuscles: ["Beine"],
    equipment: ["Langhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "lunges_db",
    name: "Ausfallschritte Kurzhantel",
    primaryMuscles: ["Beine", "Po"],
    secondaryMuscles: [],
    equipment: ["Kurzhantel"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "leg_curl_machine",
    name: "Beincurl Maschine",
    primaryMuscles: ["Beine"],
    secondaryMuscles: [],
    equipment: ["Maschine"],
    difficulty: "Leicht",
    type: "Kraft",
  },
  {
    id: "calf_raise",
    name: "Wadenheben stehend",
    primaryMuscles: ["Beine"],
    secondaryMuscles: [],
    equipment: ["Maschine"],
    difficulty: "Leicht",
    type: "Kraft",
  },

  // Bauch / Core
  {
    id: "plank",
    name: "Plank",
    primaryMuscles: ["Bauch"],
    secondaryMuscles: ["Ganzkörper"],
    equipment: ["Körpergewicht"],
    difficulty: "Leicht",
    type: "Kraft",
  },
  {
    id: "crunch",
    name: "Crunches",
    primaryMuscles: ["Bauch"],
    secondaryMuscles: [],
    equipment: ["Körpergewicht"],
    difficulty: "Leicht",
    type: "Kraft",
  },
  {
    id: "hanging_leg_raises",
    name: "Hanging Leg Raises",
    primaryMuscles: ["Bauch"],
    secondaryMuscles: [],
    equipment: ["Sonstiges"],
    difficulty: "Mittel",
    type: "Kraft",
  },

  // Ganzkörper / Ausdauer
  {
    id: "burpees",
    name: "Burpees",
    primaryMuscles: ["Ganzkörper"],
    secondaryMuscles: ["Bauch"],
    equipment: ["Körpergewicht"],
    difficulty: "Mittel",
    type: "Kraft",
  },
  {
    id: "jump_rope",
    name: "Seilspringen",
    primaryMuscles: ["Ganzkörper"],
    secondaryMuscles: [],
    equipment: ["Sonstiges"],
    difficulty: "Mittel",
    type: "Ausdauer",
  },
];

export function filterExercises(
  exercises: Exercise[],
  filters: ExerciseFilters
): Exercise[] {
  return exercises.filter((ex) => {
    if (
      filters.muscle !== "alle" &&
      !ex.primaryMuscles.includes(filters.muscle)
    ) {
      return false;
    }
    if (
      filters.equipment !== "alle" &&
      !ex.equipment.includes(filters.equipment)
    ) {
      return false;
    }
    if (filters.difficulty !== "alle" && ex.difficulty !== filters.difficulty) {
      return false;
    }
    if (filters.type !== "alle" && ex.type !== filters.type) {
      return false;
    }
    if (filters.search.trim().length > 0) {
      const term = filters.search.toLowerCase();
      if (!ex.name.toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  });
}
