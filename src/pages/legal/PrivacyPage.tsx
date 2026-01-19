import { useTranslation } from "react-i18next";

export default function PrivacyPage() {
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

                <h1 className="text-3xl font-bold">{t("settings.legal.privacy.title")}</h1>

                <div className="space-y-4 opacity-90 leading-relaxed bg-[var(--surface)] p-6 rounded-xl border border-[var(--border)]">
                    <p>{t("settings.legal.privacy.p1")}</p>
                    <p>{t("settings.legal.privacy.p2")}</p>
                    <p>{t("settings.legal.privacy.p3")}</p>

                    <h2 className="text-xl font-bold mt-6">Garmin Connect</h2>
                    <p>
                        TrainQ offers integration with Garmin Connect.
                        If you choose to connect your Garmin account, we will receive data about your activities
                        (workouts, duration, heart rate, GPS traces, etc.) according to your Garmin permissions.
                    </p>
                    <p>
                        We store this data locally on your device or securely in our database solely for the purpose of
                        providing training analysis. We do not sell your personal data.
                    </p>
                </div>
            </div>
        </div>
    );
}
