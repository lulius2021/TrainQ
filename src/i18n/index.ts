import de from "./locales/de.json";
import en from "./locales/en.json";

export type Lang = "de" | "en";
export type TranslationKey = keyof typeof en;


export const defaultLang: Lang = "de";


export function assertTranslationsMatch(): void {
  if (process.env.NODE_ENV === "production") return;
  const enKeys = Object.keys(en);
  const deKeys = Object.keys(de);
  const missingInDe = enKeys.filter((k) => !(k in de));
  const missingInEn = deKeys.filter((k) => !(k in en));
  if (missingInDe.length || missingInEn.length) {

    console.warn("[i18n] Missing translation keys", { missingInDe, missingInEn });
  }
}
