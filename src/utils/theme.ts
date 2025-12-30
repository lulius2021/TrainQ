// src/utils/theme.ts
export type ThemeMode = "light" | "dark" | "system";

const LS_THEME = "trainq_theme_v1";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;

  const resolved = mode === "system" ? getSystemTheme() : mode;
  document.documentElement.setAttribute("data-theme", resolved);
}

export function loadTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(LS_THEME) as ThemeMode | null;
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function saveTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_THEME, mode);
}