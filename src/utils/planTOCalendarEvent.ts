// src/utils/planToCalendarEvent.ts
import type { CalendarEvent, PlanDayRule, SportType, TrainingType } from "../types/training";

function sportToTrainingType(s: SportType): TrainingType {
  if (s === "Laufen") return "laufen";
  if (s === "Radfahren") return "radfahren";
  if (s === "Custom") return "custom";
  return "gym";
}

function defaultTitleForRule(rule: PlanDayRule): string {
  if (rule.sport === "Gym") return rule.workoutType ? `${rule.workoutType}` : "Gym";
  if (rule.sport === "Laufen") return "Laufen";
  if (rule.sport === "Radfahren") return "Radfahren";
  return "Training"; // Custom
}

export function buildCalendarEventFromPlanRule(input: {
  id: string;
  dateISO: string;
  startTime: string;
  endTime: string;
  rule: PlanDayRule;
  templateId?: string;
}): CalendarEvent {
  const { id, dateISO, startTime, endTime, rule, templateId } = input;

  const title = defaultTitleForRule(rule);

  return {
    id,
    title,
    date: dateISO,
    startTime,
    endTime,
    type: "training",

    // wichtig für UI-Farben & LiveTraining fallback
    trainingType: sportToTrainingType(rule.sport),
    sport: rule.sport,

    // optional
    templateId,
    trainingStatus: "open",
  };
}