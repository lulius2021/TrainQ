import { useTranslation } from "react-i18next";

export default function TermsPage() {
    const { t } = useTranslation();
    const safeTop = "env(safe-area-inset-top, 0px)";

    const goBack = () => {
        window.history.back();
    };

    return (
        <div className="min-h-screen bg-brand-bg text-[var(--text)] px-4 py-8" style={{ paddingTop: `calc(2rem + ${safeTop})` }}>
            <div className="max-w-2xl mx-auto space-y-6">
                <button
                    onClick={goBack}
                    className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
                >
                    &larr; {t("common.back")}
                </button>

                <h1 className="text-3xl font-bold">{t("settings.legal.terms.title")}</h1>

                <div className="space-y-4 opacity-90 leading-relaxed bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)]">
                    <p>{t("settings.legal.terms.p1")}</p>
                    <p>{t("settings.legal.terms.p2")}</p>
                    <p>{t("settings.legal.terms.p3")}</p>
                </div>
            </div>
        </div>
    );
}
