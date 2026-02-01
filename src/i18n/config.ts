import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import de from "./locales/de.json";
import en from "./locales/en.json";

// Define the shape of our resources
const resources = {
    de: {
        translation: de,
    },
    en: {
        translation: en,
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
