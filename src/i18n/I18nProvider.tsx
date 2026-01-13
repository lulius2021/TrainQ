import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { assertTranslationsMatch, defaultLang, getTranslation, type Lang, type TranslationKey } from "./index";
import { formatDate, formatNumber, formatTime, formatDurationMinutes, formatDurationSeconds } from "./format";

const STORAGE_KEY = "trainq_lang_v1";

type Vars = Record<string, string | number>;

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, vars?: Vars) => string;
  tp: (singular: TranslationKey, plural: TranslationKey, count: number, vars?: Vars) => string;
  formatDate: (date: Date, opts?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date, opts?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatDurationMinutes: (minutes: number) => string;
  formatDurationSeconds: (seconds: number) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return defaultLang;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") return stored;
    const legacy = window.localStorage.getItem("trainq_language");
    if (legacy === "de" || legacy === "en") return legacy;
    return defaultLang;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  useEffect(() => {
    assertTranslationsMatch();
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) => {
      const raw = getTranslation(lang, key);
      return interpolate(raw, vars);
    },
    [lang]
  );

  const tp = useCallback(
    (singular: TranslationKey, plural: TranslationKey, count: number, vars?: Vars) => {
      const key = count === 1 ? singular : plural;
      return t(key, { count, ...vars });
    },
    [t]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang: setLangState,
      t,
      tp,
      formatDate: (date, opts) => formatDate(lang, date, opts),
      formatTime: (date, opts) => formatTime(lang, date, opts),
      formatNumber: (value, opts) => formatNumber(lang, value, opts),
      formatDurationMinutes: (minutes) => formatDurationMinutes(lang, minutes),
      formatDurationSeconds: (seconds) => formatDurationSeconds(lang, seconds),
    }),
    [lang, t, tp]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
