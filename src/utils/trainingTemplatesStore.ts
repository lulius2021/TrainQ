import type { TrainingType } from "../types/training";
import { getScopedItem, setScopedItem } from "./scopedStorage";

export type TemplateSet = {
  reps?: number;
  weight?: number;
};

export type TemplateExercise = {
  exerciseId?: string;
  name: string;
  sets?: TemplateSet[];
};

export type TrainingTemplateLite = {
  id: string;
  title: string;
  sportType: TrainingType;
  createdAt: string;
  updatedAt: string;
  description?: string;
  exercises?: TemplateExercise[];
};

const STORAGE_KEY = "trainq_training_templates_v1";
const SEED_KEY = "trainq_training_templates_seeded_v1";
const CLEANUP_KEY = "trainq_templates_starter_cleaned_v1";

function nowISO(): string {
  return new Date().toISOString();
}

function newId(prefix = "tpl"): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = typeof crypto !== "undefined" ? crypto : undefined;
    if (c?.randomUUID) return `${prefix}_${c.randomUUID()}`;
  } catch {
    // ignore
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeSportType(raw: unknown): TrainingType {
  const v = String(raw ?? "").toLowerCase();
  if (v === "laufen" || v === "run" || v === "running") return "laufen";
  if (v === "radfahren" || v === "bike" || v === "cycling") return "radfahren";
  if (v === "custom") return "custom";
  return "gym";
}

function normalizeTemplate(input: any): TrainingTemplateLite | null {
  if (!input || typeof input !== "object") return null;
  const id = String(input.id || "").trim();
  const title = String(input.title || input.name || "").trim();
  if (!id || !title) return null;
  return {
    id,
    title,
    sportType: normalizeSportType(input.sportType),
    createdAt: String(input.createdAt || nowISO()),
    updatedAt: String(input.updatedAt || nowISO()),
    description: typeof input.description === "string" ? input.description : undefined,
    exercises: Array.isArray(input.exercises)
      ? input.exercises.map((ex: any) => ({
          exerciseId: typeof ex?.exerciseId === "string" ? ex.exerciseId : undefined,
          name: String(ex?.name || "Übung"),
          sets: Array.isArray(ex?.sets)
            ? ex.sets.map((s: any) => ({
                reps: typeof s?.reps === "number" ? s.reps : undefined,
                weight: typeof s?.weight === "number" ? s.weight : undefined,
              }))
            : undefined,
        }))
      : undefined,
  };
}

function sortByCreatedDesc(list: TrainingTemplateLite[]): TrainingTemplateLite[] {
  return [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function seedDefaultTemplatesOnce(): void {
  // No default templates — users create their own
  const seeded = getScopedItem(SEED_KEY);
  if (seeded === "1") return;

  // Clean up any old starter templates
  const raw = getScopedItem(STORAGE_KEY);
  if (raw) {
    const parsed = safeParse<any[]>(raw, []);
    const cleaned = parsed.filter((t: any) => {
      const id = String(t?.id || "");
      return !id.startsWith("starter_");
    });
    setScopedItem(STORAGE_KEY, JSON.stringify(cleaned));
  }

  setScopedItem(SEED_KEY, "1");
}

function cleanupStarterTemplates(): void {
  if (getScopedItem(CLEANUP_KEY) === "1") return;
  const raw = getScopedItem(STORAGE_KEY);
  if (raw) {
    const parsed = safeParse<any[]>(raw, []);
    const cleaned = parsed.filter((t: any) => {
      const id = String(t?.id || "");
      return !id.startsWith("starter_");
    });
    setScopedItem(STORAGE_KEY, JSON.stringify(cleaned));
  }
  setScopedItem(CLEANUP_KEY, "1");
}

export function getTemplates(): TrainingTemplateLite[] {
  seedDefaultTemplatesOnce();
  cleanupStarterTemplates();
  const raw = getScopedItem(STORAGE_KEY);
  const parsed = safeParse<any[]>(raw, []);
  const normalized = parsed.map(normalizeTemplate).filter(Boolean) as TrainingTemplateLite[];
  return sortByCreatedDesc(normalized);
}

export function saveTemplate(input: Omit<TrainingTemplateLite, "id" | "createdAt" | "updatedAt">): TrainingTemplateLite {
  const now = nowISO();
  const next: TrainingTemplateLite = {
    ...input,
    id: newId("tpl"),
    createdAt: now,
    updatedAt: now,
    title: String(input.title || "Training").trim(),
    sportType: normalizeSportType(input.sportType),
  };

  const existing = getTemplates();
  const list = [next, ...existing];
  setScopedItem(STORAGE_KEY, JSON.stringify(list));
  return next;
}

export function updateTemplate(next: TrainingTemplateLite): TrainingTemplateLite {
  const existing = getTemplates();
  const idx = existing.findIndex((t) => t.id === next.id);
  const now = nowISO();
  const normalized = {
    ...next,
    title: String(next.title || "Training").trim(),
    sportType: normalizeSportType(next.sportType),
    updatedAt: now,
  };
  const list = idx >= 0 ? [...existing.slice(0, idx), normalized, ...existing.slice(idx + 1)] : [normalized, ...existing];
  setScopedItem(STORAGE_KEY, JSON.stringify(list));
  return normalized;
}

export function deleteTemplate(id: string): void {
  const list = getTemplates().filter((t) => t.id !== id);
  setScopedItem(STORAGE_KEY, JSON.stringify(list));
}
