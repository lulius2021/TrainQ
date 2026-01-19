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
      // Apple Blue #007AFF
      return {
        bg: "rgba(0, 122, 255, 0.08)",
        border: "rgba(0, 122, 255, 0.4)",
        badgeBg: "rgba(0, 122, 255, 0.15)"
      };
    case "kompakt":
      // Apple Red #FF3B30
      return {
        bg: "rgba(255, 59, 48, 0.08)",
        border: "rgba(255, 59, 48, 0.4)",
        badgeBg: "rgba(255, 59, 48, 0.15)"
      };
    case "fokus":
      // Apple Green #34C759
      return {
        bg: "rgba(52, 199, 89, 0.08)",
        border: "rgba(52, 199, 89, 0.4)",
        badgeBg: "rgba(52, 199, 89, 0.15)"
      };
    default:
      return {
        bg: "rgba(255, 255, 255, 0.05)",
        border: "rgba(255, 255, 255, 0.1)",
        badgeBg: "rgba(255, 255, 255, 0.1)"
      };
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

export function buildAdaptiveSuggestions(answers: AdaptiveAnswers): AdaptiveSuggestion[] {
  const lowRecovery = hasLowRecovery(answers);
  const timeLimited = hasTimeConstraint(answers);

  const baseMinutes = approxMinutesFromBucket(answers.timeToday);
  const baseReasons = reasonsFromAnswers(answers);

  const stabil: AdaptiveSuggestion = {
    profile: "stabil",
    title: "Stabil · Plan-nah",
    subtitle: "Sauber trainieren, im Rhythmus bleiben",
    estimatedMinutes: timeLimited ? Math.min(35, baseMinutes) : Math.max(45, baseMinutes),
    exercisesCount: timeLimited ? 4 : 5,
    setsPerExercise: lowRecovery ? 2 : 3,
    intensityHint: lowRecovery ? "Leicht bis moderat, Fokus Technik & Gefühl" : "Moderat, RPE 7–8",
    reasons: dedupeReasons([
      ...baseReasons,
      ...(lowRecovery ? (["recovery_low"] as const) : ([] as const)),
    ]),
  };

  const kompakt: AdaptiveSuggestion = {
    profile: "kompakt",
    title: "Kompakt · Kurz & Effizient",
    subtitle: "Alles Wichtige, wenig Zeit",
    estimatedMinutes: answers.timeToday === "lt20" ? 20 : 30,
    exercisesCount: 3,
    setsPerExercise: 2,
    intensityHint: "Zügig, sauber, keine Maximalversuche",
    reasons: dedupeReasons(["time_low", ...baseReasons]),
  };

  const fokus: AdaptiveSuggestion = {
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