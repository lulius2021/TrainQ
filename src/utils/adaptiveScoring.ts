// src/utils/adaptiveScoring.ts
// TrainQ Launch: Adaptive Scoring (regelbasiert, erklärbar)
//
// Wichtig:
// - Diese Datei MUSS den named export "buildAdaptiveSuggestions" liefern,
//   weil AdaptiveTrainingModal.tsx ihn so importiert.

import type {
  AdaptiveAnswers,
  AdaptiveReason,
  AdaptiveSuggestion,
} from "../types/adaptive";

// Apple HIG Color Palette
// Plan A (stabil): Apple Blue #007AFF - rgb(0, 122, 255)
// Plan B (kompakt): Apple Red #FF3B30 - rgb(255, 59, 48)
// Plan C (fokus): Apple Green #34C759 - rgb(52, 199, 89)

export function profileAccent(profile: string) {
  switch (profile) {
    case "stabil":
      return { solid: "#007AFF", bg: "rgba(0,122,255,0.12)", border: "#007AFF", badgeBg: "rgba(0,122,255,0.2)" };
    case "kompakt":
      return { solid: "#FF3B30", bg: "rgba(255,59,48,0.12)",  border: "#FF3B30", badgeBg: "rgba(255,59,48,0.2)" };
    case "fokus":
      return { solid: "#34C759", bg: "rgba(52,199,89,0.12)",  border: "#34C759", badgeBg: "rgba(52,199,89,0.2)" };
    default:
      return { solid: "#8E8E93", bg: "rgba(142,142,147,0.1)", border: "#8E8E93", badgeBg: "rgba(142,142,147,0.15)" };
  }
}

// ------------------------------
// Helper
// ------------------------------

function approxMinutesFromBucket(b: AdaptiveAnswers["timeToday"]): number {
  switch (b) {
    case "lt20":
      return 15;
    case "20to40":
      return 30;
    case "40to60":
      return 50;
    case "gt60":
      return 70;
    default:
      return 30;
  }
}

function hasTimeConstraint(a: AdaptiveAnswers): boolean {
  return a.timeToday === "lt20";
}

function hasLowRecovery(a: AdaptiveAnswers): boolean {
  return a.dayForm === "low" || a.stress === "high" || a.yesterdayEffort === "high";
}

function dedupeReasons(arr: readonly AdaptiveReason[]): AdaptiveReason[] {
  return Array.from(new Set(arr));
}

function reasonsFromAnswers(a: AdaptiveAnswers): AdaptiveReason[] {
  const reasons: AdaptiveReason[] = [];

  if (a.timeToday === "lt20") reasons.push("time_low");
  if (a.timeToday === "gt60") reasons.push("time_high");

  if (a.dayForm === "low") reasons.push("form_low");
  if (a.dayForm === "high") reasons.push("form_high");

  if (a.stress === "high") reasons.push("stress_high");
  if (a.stress === "low") reasons.push("stress_low");

  if (a.yesterdayEffort === "high") reasons.push("effort_high");
  if (a.yesterdayEffort === "low") reasons.push("effort_low");

  reasons.push(hasLowRecovery(a) ? "recovery_low" : "recovery_good");

  return dedupeReasons(reasons);
}

// ------------------------------
// Hauptfunktion (NAMED EXPORT)
// ------------------------------

export function buildAdaptiveSuggestions(answers: AdaptiveAnswers, avgDurationMin = 0): AdaptiveSuggestion[] {
  const lowRecovery = hasLowRecovery(answers);
  const timeLimited = hasTimeConstraint(answers);
  const sport = answers.sport ?? "gym";

  // Calibrate base minutes: blend user's actual history (60%) with bucket estimate (40%)
  let baseMinutes = approxMinutesFromBucket(answers.timeToday);
  if (avgDurationMin > 5) {
    baseMinutes = Math.round(avgDurationMin * 0.6 + baseMinutes * 0.4);
  }

  const baseReasons = reasonsFromAnswers(answers);

  // Sport-specific titles/subtitles/intensities
  const isCardio = sport === "laufen" || sport === "radfahren";
  const sportLabel = sport === "laufen" ? "Laufen" : sport === "radfahren" ? "Radfahren" : "";

  const stabil: AdaptiveSuggestion = isCardio ? {
    profile: "stabil",
    title: `Stabil · Grundlage`,
    subtitle: `Lockeres ${sportLabel}-Tempo, Komfortzone`,
    estimatedMinutes: timeLimited ? Math.min(25, baseMinutes) : Math.max(30, baseMinutes),
    exercisesCount: 1,
    setsPerExercise: 1,
    intensityHint: lowRecovery ? "Sehr locker, Herzfrequenz niedrig halten" : "RPE 5–6, entspannte Atmung",
    reasons: dedupeReasons([...baseReasons, ...(lowRecovery ? (["recovery_low"] as const) : ([] as const))]),
  } : {
    profile: "stabil",
    title: "Stabil · Plan-nah",
    subtitle: "Sauber trainieren, im Rhythmus bleiben",
    estimatedMinutes: timeLimited ? Math.min(35, baseMinutes) : Math.max(45, baseMinutes),
    exercisesCount: timeLimited ? 4 : 5,
    setsPerExercise: lowRecovery ? 2 : 3,
    intensityHint: lowRecovery ? "Leicht bis moderat, Fokus Technik & Gefühl" : "Moderat, RPE 7–8",
    reasons: dedupeReasons([...baseReasons, ...(lowRecovery ? (["recovery_low"] as const) : ([] as const))]),
  };

  const kompakt: AdaptiveSuggestion = isCardio ? {
    profile: "kompakt",
    title: "Kompakt · Kurze Einheit",
    subtitle: `Schnell rein, schnell raus – ${sport === "laufen" ? "kurze Runde" : "kurze Ausfahrt"}`,
    estimatedMinutes: answers.timeToday === "lt20" ? 15 : 20,
    exercisesCount: 1,
    setsPerExercise: 1,
    intensityHint: "Mittleres Tempo, zügig aber kontrolliert",
    reasons: dedupeReasons(["time_low", ...baseReasons]),
  } : {
    profile: "kompakt",
    title: "Kompakt · Kurz & Effizient",
    subtitle: "Alles Wichtige, wenig Zeit",
    estimatedMinutes: answers.timeToday === "lt20" ? 20 : 30,
    exercisesCount: 3,
    setsPerExercise: 2,
    intensityHint: "Zügig, sauber, keine Maximalversuche",
    reasons: dedupeReasons(["time_low", ...baseReasons]),
  };

  const fokus: AdaptiveSuggestion = isCardio ? {
    profile: "fokus",
    title: "Fokus · Intervall",
    subtitle: `Kurze Hochintervalle, volle Konzentration`,
    estimatedMinutes: 35,
    exercisesCount: 1,
    setsPerExercise: 1,
    intensityHint: "Intervalle: 4×4 Min bei RPE 8–9, nur wenn du dich gut fühlst",
    reasons: dedupeReasons(["form_high", "recovery_good"]),
  } : {
    profile: "fokus",
    title: "Fokus · Intensiv",
    subtitle: "Wenige Übungen, klarer Leistungsreiz",
    estimatedMinutes: 45,
    exercisesCount: 2,
    setsPerExercise: 3,
    intensityHint: "Topset + Backoff, nur wenn du dich gut fühlst",
    reasons: dedupeReasons(["form_high", "recovery_good"]),
  };

  // Blockiere Fokus bei schlechter Erholung oder krasser Zeitknappheit
  if (lowRecovery || timeLimited) {
    fokus.intensityHint = "Heute nicht empfohlen (Erholung/Zeit nicht optimal)";
    fokus.estimatedMinutes = 0;
  }

  return timeLimited ? [kompakt, stabil, fokus] : [stabil, kompakt, fokus];
}

// Backwards-Compat: falls irgendwo noch der alte Name genutzt wird
export const buildAdaptiveSuggestion = buildAdaptiveSuggestions;