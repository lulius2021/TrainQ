// src/utils/exerciseAliasesStore.ts

import type { ExerciseAliases } from "../data/exerciseLibrary";

const STORAGE_KEY = "trainq_exercise_alias_overrides_v1";

type AliasOverrides = Record<string, ExerciseAliases>;

function normalizeAlias(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeParse(raw: string | null): AliasOverrides {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getAliasOverrides(): AliasOverrides {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function addAliasOverride(exerciseId: string, lang: "en" | "de", alias: string): AliasOverrides {
  if (typeof window === "undefined") return {};
  const trimmed = String(alias || "").trim();
  if (!trimmed) return getAliasOverrides();

  const overrides = getAliasOverrides();
  const entry = overrides[exerciseId] || { en: [], de: [] };
  const nextList = [...(entry[lang] || [])];
  const normalized = normalizeAlias(trimmed);
  if (!nextList.some((item) => normalizeAlias(item) === normalized)) {
    nextList.push(trimmed);
  }
  overrides[exerciseId] = { ...entry, [lang]: nextList };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  return overrides;
}
