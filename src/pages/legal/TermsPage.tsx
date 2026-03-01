// src/pages/legal/TermsPage.tsx
import React from "react";

export default function TermsPage() {
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

                <h1 className="text-3xl font-bold">Nutzungsbedingungen</h1>

                <div className="space-y-4 opacity-90 leading-relaxed bg-[var(--card-bg)] p-6 rounded-3xl border border-[var(--border-color)]">
                    <p>Willkommen bei TrainQ! Durch die Nutzung unserer App stimmst du den folgenden Bedingungen zu.</p>
                    <p>
                        Diese App dient der Unterstützung deines Trainings. Wir übernehmen keine Haftung für Verletzungen
                        oder Schäden, die durch unsachgemäße Ausführung der Übungen entstehen.
                    </p>
                    <p>
                        TrainQ behält sich das Recht vor, Dienste jederzeit zu ändern oder einzustellen.
                        Deine Daten werden gemäß unserer Datenschutzerklärung behandelt.
                    </p>
                </div>
            </div>
        </div>
    );
}
