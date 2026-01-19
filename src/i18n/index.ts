import { translationsDe } from "./translations.de";
import { translationsEn } from "./translations.en";

export type Lang = "de" | "en";
export type TranslationKey = keyof typeof translationsEn;

export const dictionaries: Record<Lang, Record<TranslationKey, string>> = {
  de: translationsDe,
  en: translationsEn,
};

export const defaultLang: Lang = "de";

export function getTranslation(lang: Lang, key: TranslationKey): string {
  return dictionaries[lang][key];
}

export function assertTranslationsMatch(): void {
  if (process.env.NODE_ENV === "production") return;
  const enKeys = Object.keys(translationsEn);
  const deKeys = Object.keys(translationsDe);
  const missingInDe = enKeys.filter((k) => !(k in translationsDe));
  const missingInEn = deKeys.filter((k) => !(k in translationsEn));
  if (missingInDe.length || missingInEn.length) {
     
    console.warn("[i18n] Missing translation keys", { missingInDe, missingInEn });
  }
}
