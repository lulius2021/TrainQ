import type { Muscle } from "../data/exerciseLibrary";

export type MuscleDetailMode = "einfach" | "komplex";

export type SimpleGroup =
  | "Brust"
  | "Rücken"
  | "Schultern"
  | "Arme"
  | "Beine"
  | "Core";

export const SIMPLE_GROUP_MAP: Record<Muscle, SimpleGroup> = {
  chest: "Brust",
  back: "Rücken",
  lats: "Rücken",
  traps: "Rücken",
  rear_delts: "Schultern",
  front_delts: "Schultern",
  side_delts: "Schultern",
  biceps: "Arme",
  triceps: "Arme",
  forearms: "Arme",
  quads: "Beine",
  hamstrings: "Beine",
  glutes: "Beine",
  calves: "Beine",
  core: "Core",
  obliques: "Core",
  lower_back: "Core",
  hip_flexors: "Beine",
};

export const SIMPLE_GROUP_ORDER: SimpleGroup[] = [
  "Brust",
  "Schultern",
  "Arme",
  "Rücken",
  "Beine",
  "Core",
];

export const COMPLEX_MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Brust",
  back: "Oberer Rücken",
  lats: "Latissimus",
  traps: "Trapezius",
  rear_delts: "Hintere Schulter",
  front_delts: "Vordere Schulter",
  side_delts: "Seitliche Schulter",
  biceps: "Bizeps",
  triceps: "Trizeps",
  forearms: "Unterarme",
  quads: "Quadrizeps",
  hamstrings: "Beinbeuger",
  glutes: "Gesäß",
  calves: "Waden",
  core: "Bauch",
  obliques: "Schräge Bauchm.",
  lower_back: "Unterer Rücken",
  hip_flexors: "Hüftbeuger",
};

const PREF_KEY = "trainq_pref_muscle_detail_v1";

export function getMuscleDetailMode(): MuscleDetailMode {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === "komplex") return "komplex";
  } catch {
    /* ignore */
  }
  return "einfach";
}

export function setMuscleDetailMode(mode: MuscleDetailMode): void {
  try {
    localStorage.setItem(PREF_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function groupBySimple(
  volumeMap: Record<string, number>
): Record<SimpleGroup, number> {
  const result: Record<SimpleGroup, number> = {
    Brust: 0,
    Rücken: 0,
    Schultern: 0,
    Arme: 0,
    Beine: 0,
    Core: 0,
  };
  for (const [muscle, vol] of Object.entries(volumeMap)) {
    const group = SIMPLE_GROUP_MAP[muscle as Muscle];
    if (group) result[group] += vol;
  }
  return result;
}
