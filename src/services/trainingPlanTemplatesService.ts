// src/services/trainingPlanTemplatesService.ts
import type { TrainingPlanTemplate } from "../types/trainingTemplates";

const STORAGE_KEY_BASE = "training_plan_templates_v1";

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

function newId(prefix = "plan"): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = typeof crypto !== "undefined" ? crypto : undefined;
    if (c?.randomUUID) return `${prefix}_${c.randomUUID()}`;
  } catch {
    // ignore
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function loadTrainingPlanTemplates(userId: string): TrainingPlanTemplate[] {
  if (!userId) return [];
  const raw = window.localStorage.getItem(storageKey(userId));
  return ensureArray<TrainingPlanTemplate>(safeParseJSON(raw, []));
}

export function upsertTrainingPlanTemplate(userId: string, plan: TrainingPlanTemplate): TrainingPlanTemplate {
  if (!userId) return plan;
  const now = nowISO();
  const existing = loadTrainingPlanTemplates(userId);
  const normalized: TrainingPlanTemplate = {
    ...plan,
    id: plan.id || newId(),
    userId,
    name: String(plan.name || "Trainingsplan"),
    days: ensureArray(plan.days),
    createdAt: plan.createdAt || now,
    updatedAt: now,
  };
  const idx = existing.findIndex((p) => p.id === normalized.id);
  const next = idx >= 0 ? [...existing.slice(0, idx), normalized, ...existing.slice(idx + 1)] : [normalized, ...existing];
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return normalized;
}
