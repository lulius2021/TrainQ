import { useI18n } from "../../i18n/useI18n";

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setLang("de")}
        className={`rounded-full px-3 py-1 text-sm ${
          lang === "de" ? "bg-[var(--primary)] text-white" : "bg-[var(--surface2)] text-[var(--text)]"
        }`}
      >
        {t("language.de")}
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`rounded-full px-3 py-1 text-sm ${
          lang === "en" ? "bg-[var(--primary)] text-white" : "bg-[var(--surface2)] text-[var(--text)]"
        }`}
      >
        {t("language.en")}
      </button>
    </div>
  );
}
