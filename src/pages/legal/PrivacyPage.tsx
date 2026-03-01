// src/pages/legal/PrivacyPage.tsx
import React from "react";

export default function PrivacyPage() {
    const safeTop = "env(safe-area-inset-top, 0px)";

    const goBack = () => {
        window.history.back();
    };

    return (
        <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text)] px-4 py-8" style={{ paddingTop: `calc(2rem + ${safeTop})` }}>
            <div className="max-w-2xl mx-auto space-y-6">
                <button
                    onClick={goBack}
                    className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
                >
                    &larr; Zurück
                </button>

                <h1 className="text-3xl font-bold">Datenschutzerklärung</h1>

                <div className="space-y-4 opacity-90 leading-relaxed bg-[var(--card-bg)] p-6 rounded-3xl border border-[var(--border-color)]">
                    <p>
                        Der Schutz deiner Daten ist uns wichtig. In dieser Datenschutzerklärung erfährst du,
                        welche Daten wir erfassen und wie wir sie nutzen.
                    </p>
                    <p>
                        Wir speichern deine Trainingsdaten (z.B. Übungen, Gewichte, Sätze) lokal auf deinem Gerät
                        oder synchronisiert in unserer sicheren Datenbank, um dir Funktionen wie Fortschrittsanalysen
                        und adaptive Trainingspläne anzubieten.
                    </p>

                    <h2 className="text-xl font-bold mt-6">Garmin Connect</h2>
                    <p>
                        TrainQ bietet eine Integration mit Garmin Connect an.
                        Wenn du dein Garmin-Konto verbindest, empfangen wir Daten zu deinen Aktivitäten
                        (Workouts, Dauer, Herzfrequenz, GPS-Daten usw.) gemäß deinen Garmin-Berechtigungen.
                    </p>
                    <p>
                        Wir speichern diese Daten, um deine Erholung (Body Battery) und Trainingsbelastung zu berechnen.
                        Wir verkaufen deine persönlichen Daten niemals an Dritte.
                    </p>
                </div>
            </div>
        </div>
    );
}
