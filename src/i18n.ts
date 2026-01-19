import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { translationsDe } from "./i18n/translations.de";
import { translationsEn } from "./i18n/translations.en";

// Define the shape of our resources
const resources = {
    de: {
        translation: translationsDe,
    },
    en: {
        translation: translationsEn,
    },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: "en",
        debug: process.env.NODE_ENV === "development",
        interpolation: {
            escapeValue: false, // React already safe from XSS
        },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'trainq_lang'
        }
    });

export default i18n;
