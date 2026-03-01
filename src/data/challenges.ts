// src/data/challenges.ts
import type { ChallengeDefinition } from "../types/challenge";

export const ADMIN_CHALLENGES: ChallengeDefinition[] = [
  {
    id: "ch_10_workouts_30d",
    title: "10 Workouts in 30 Tagen",
    description: "Absolviere 10 Trainingseinheiten in 30 Tagen.",
    goal: { type: "workout_count", target: 10 },
    durationDays: 30,
    emoji: "\u{1F4AA}",
    reward: { type: "pro_days", days: 30 },
    isAdmin: true,
  },
  {
    id: "ch_50km_run_30d",
    title: "50km Laufen",
    description: "Laufe insgesamt 50km in 30 Tagen.",
    goal: { type: "distance_km", target: 50, sportFilter: "Laufen" },
    durationDays: 30,
    emoji: "\u{1F3C3}",
    reward: { type: "pro_days", days: 30 },
    isAdmin: true,
  },
  {
    id: "ch_100000kg_vol_30d",
    title: "100.000kg Gesamtvolumen",
    description: "Bewege insgesamt 100.000kg in 30 Tagen.",
    goal: { type: "volume_kg", target: 100000 },
    durationDays: 30,
    emoji: "\u{1F3CB}\uFE0F",
    reward: { type: "pro_days", days: 30 },
    isAdmin: true,
  },
  {
    id: "ch_20_workouts_60d",
    title: "20 Workouts in 60 Tagen",
    description: "Zeige Konsistenz: 20 Einheiten in 2 Monaten.",
    goal: { type: "workout_count", target: 20 },
    durationDays: 60,
    emoji: "\u{1F525}",
    isAdmin: true,
  },
];
