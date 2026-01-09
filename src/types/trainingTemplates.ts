// src/types/trainingTemplates.ts
import type { SportType } from "./training";

export type TrainingTemplateSet = {
  id?: string;
  reps?: number;
  weight?: number;
  setType?: string;
  rpe?: number;
  notes?: string;
};

export type TrainingTemplateExercise = {
  id?: string;
  exerciseId?: string;
  name: string;
  sets: TrainingTemplateSet[];
};

export type TrainingTemplateSnapshot = {
  name: string;
  sportType: SportType;
  exercises: TrainingTemplateExercise[];
};

export type TrainingTemplate = {
  id: string;
  userId: string;
  name: string;
  sportType: SportType;
  exercises: TrainingTemplateExercise[];
  sourcePlanId?: string;
  sourceDayIndex?: number;
  signature?: string;
  createdAt: string;
  updatedAt: string;
};

export type TrainingPlanTemplateDay = {
  dayIndex: number;
  title: string;
  trainingTemplateId?: string;
  trainingSnapshot: TrainingTemplateSnapshot;
};

export type TrainingPlanTemplate = {
  id: string;
  userId: string;
  name: string;
  kind?: "weekly" | "routine";
  startDate?: string;
  durationWeeks?: number;
  days: TrainingPlanTemplateDay[];
  createdAt: string;
  updatedAt: string;
};
