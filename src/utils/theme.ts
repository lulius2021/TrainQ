import { getScopedItem, setScopedItem } from "./scopedStorage";

export type ThemeMode = "light" | "dark";
export const STORAGE_KEY_THEME = "trainq_theme_v1";

export function applyTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;
  root.dataset.theme = mode;

  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");

  try {
    root.style.colorScheme = mode;
  } catch {
    // ignore
  }
}

export function loadTheme(defaultMode: ThemeMode = "dark"): ThemeMode {
  if (typeof window === "undefined") return defaultMode;

  const stored = getScopedItem(STORAGE_KEY_THEME);
  const mode: ThemeMode = stored === "light" || stored === "dark" ? stored : defaultMode;

  applyTheme(mode);
  return mode;
}

export function setTheme(mode: ThemeMode) {
  if (typeof window === "undefined") return;

  try {
    setScopedItem(STORAGE_KEY_THEME, mode);
  } catch {
    // ignore
  }
  applyTheme(mode);
}
