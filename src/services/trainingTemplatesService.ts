// src/services/trainingTemplatesService.ts
import type { TrainingTemplate, TrainingTemplateExercise } from "../types/trainingTemplates";

const STORAGE_KEY_BASE = "training_templates_v1";

function storageKey(userId: string): string {
  return `trainq:${userId}:${STORAGE_KEY_BASE}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function safeParseJSON<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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

function normalizeExercises(input: unknown): TrainingTemplateExercise[] {
  const exercises = ensureArray<TrainingTemplateExercise>(input);
  return exercises.map((ex) => ({
    id: ex?.id ? String(ex.id) : undefined,
    exerciseId: typeof ex?.exerciseId === "string" ? ex.exerciseId : undefined,
    name: String(ex?.name ?? "Übung"),
    sets: ensureArray<any>(ex?.sets).map((s) => ({
      id: s?.id ? String(s.id) : undefined,
      reps: typeof s?.reps === "number" ? s.reps : undefined,
      weight: typeof s?.weight === "number" ? s.weight : undefined,
      setType: typeof s?.setType === "string" ? s.setType : undefined,
      rpe: typeof s?.rpe === "number" ? s.rpe : undefined,
      notes: typeof s?.notes === "string" ? s.notes : undefined,
    })),
  }));
}

export function buildTrainingTemplateSignature(
  templateOrExercises: TrainingTemplate | TrainingTemplateExercise[] | unknown
): string {
  const exercises = Array.isArray(templateOrExercises)
    ? templateOrExercises
    : (templateOrExercises as TrainingTemplate)?.exercises;

  const normalized = normalizeExercises(exercises).map((ex) => ({
    exerciseId: ex.exerciseId ?? "",
    name: ex.name ?? "",
    sets: (ex.sets ?? []).map((s) => ({
      reps: typeof s.reps === "number" ? s.reps : null,
      weight: typeof s.weight === "number" ? s.weight : null,
      setType: typeof s.setType === "string" ? s.setType : "",
      rpe: typeof s.rpe === "number" ? s.rpe : null,
      notes: typeof s.notes === "string" ? s.notes : "",
    })),
  }));

  return JSON.stringify(normalized);
}

export function loadTrainingTemplates(userId: string): TrainingTemplate[] {
  if (!userId) return [];
  const raw = window.localStorage.getItem(storageKey(userId));
  return ensureArray<TrainingTemplate>(safeParseJSON(raw, []));
}

export function getTrainingTemplateById(userId: string, id: string): TrainingTemplate | null {
  if (!userId || !id) return null;
  return loadTrainingTemplates(userId).find((tpl) => tpl.id === id) ?? null;
}

export function saveTrainingTemplates(userId: string, items: TrainingTemplate[]): void {
  if (!userId) return;
  const safeItems = ensureArray<TrainingTemplate>(items);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(safeItems));
}

export function upsertTrainingTemplate(userId: string, item: TrainingTemplate): TrainingTemplate {
  if (!userId) return item;
  const now = nowISO();
  const existing = loadTrainingTemplates(userId);
  const normalized: TrainingTemplate = {
    ...item,
    id: item.id || newId(),
    userId,
    name: String(item.name || "Training"),
    exercises: normalizeExercises(item.exercises),
    signature: item.signature || buildTrainingTemplateSignature(item),
    createdAt: item.createdAt || now,
    updatedAt: now,
  };
  const idx = existing.findIndex((t) => t.id === normalized.id);
  const next = idx >= 0 ? [...existing.slice(0, idx), normalized, ...existing.slice(idx + 1)] : [normalized, ...existing];
  saveTrainingTemplates(userId, next);
  return normalized;
}

export function deleteTrainingTemplate(userId: string, id: string): void {
  if (!userId || !id) return;
  const existing = loadTrainingTemplates(userId);
  saveTrainingTemplates(userId, existing.filter((t) => t.id !== id));
}
