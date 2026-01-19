import { useTranslation } from "react-i18next";
import { useCallback } from "react";

export function useI18n() {
  const { t, i18n } = useTranslation();

  const setLang = useCallback((lang: "de" | "en") => {
    i18n.changeLanguage(lang);
  }, [i18n]);

  const formatDate = useCallback((date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    const d = new Date(date);
    return new Intl.DateTimeFormat(i18n.language, options).format(d);
  }, [i18n.language]);

  return {
    t,
    lang: i18n.language as "de" | "en",
    setLang,
    formatDate,
  };
}
