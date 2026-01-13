import type { TrainingType } from "../types/training";
import type { TodaySession } from "../hooks/useTodaysSessions";
import type { TrainingTemplateLite } from "./trainingTemplatesStore";
import {
  navigateToLiveTraining,
  resolveLiveSeed,
  writeGlobalLiveSeed,
  writeLiveSeedForEventOrKey,
  writeLiveSeedForKey,
  type LiveTrainingSeed,
} from "./liveTrainingSeed";

function normalizeTitle(input: string): string {
  return String(input || "").trim().replace(/\s+/g, " ");
}

function mapTrainingTypeToSport(type: TrainingType): LiveTrainingSeed["sport"] {
  if (type === "laufen") return "Laufen";
  if (type === "radfahren") return "Radfahren";
  if (type === "custom") return "Custom";
  return "Gym";
}

function makeSeedFromSession(title: string, type: TrainingType): LiveTrainingSeed {
  const sport = mapTrainingTypeToSport(type);
  const isCardio = type === "laufen" || type === "radfahren";
  return {
    title: normalizeTitle(title) || "Training",
    sport,
    isCardio,
    exercises: [],
  };
}

export function createQuickStartSessionKey(dateISO: string, type: TrainingType): string {
  return `quickstart:${dateISO}:${type}`;
}

export function startSession(session: TodaySession): void {
  if (session.source === "calendar" && session.event) {
    const event = session.event;
    const seed =
      resolveLiveSeed({ eventId: event.id, dateISO: event.date, title: event.title }) ||
      makeSeedFromSession(event.title, session.sportType);

    writeLiveSeedForEventOrKey({ eventId: event.id, dateISO: event.date, title: event.title, seed });
    writeGlobalLiveSeed(seed);
    navigateToLiveTraining(event.id);
    return;
  }

  if (session.source === "quickstart") {
    const seed = makeSeedFromSession(session.title, session.sportType);
    const key = createQuickStartSessionKey(session.dateISO, session.sportType);
    writeLiveSeedForKey(key, seed);
    writeGlobalLiveSeed(seed);
    navigateToLiveTraining();
  }
}

function mapTemplateSportToSeedSport(sportType: TrainingTemplateLite["sportType"]): LiveTrainingSeed["sport"] {
  if (sportType === "laufen") return "Laufen";
  if (sportType === "radfahren") return "Radfahren";
  if (sportType === "custom") return "Custom";
  return "Gym";
}

function templateToSeed(template: TrainingTemplateLite): LiveTrainingSeed {
  const sport = mapTemplateSportToSeedSport(template.sportType);
  const isCardio = sport === "Laufen" || sport === "Radfahren";
  const exercises =
    template.exercises?.map((ex) => ({
      name: normalizeTitle(ex.name) || "Uebung",
      sets: (ex.sets ?? []).map((s) => ({
        reps: typeof s.reps === "number" ? s.reps : undefined,
        weight: typeof s.weight === "number" ? s.weight : undefined,
      })),
    })) ?? [];

  return {
    title: normalizeTitle(template.title) || "Training",
    sport,
    isCardio,
    exercises,
  };
}

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startTrainingTemplate(template: TrainingTemplateLite): void {
  const seed = templateToSeed(template);
  const dateISO = toLocalISODate(new Date());
  const key = `template:${template.id}:${dateISO}`;
  writeLiveSeedForKey(key, seed);
  writeGlobalLiveSeed(seed);
  navigateToLiveTraining();
}
