// src/pages/legal/ImpressumPage.tsx
import React from "react";

export default function ImpressumPage() {
    const safeTop = "env(safe-area-inset-top, 0px)";

    const goBack = () => {
        window.history.back();
    };

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] px-4 py-8" style={{ paddingTop: `calc(2rem + ${safeTop})` }}>
            <div className="max-w-2xl mx-auto space-y-6">
                <button
                    onClick={goBack}
                    className="text-sm font-medium opacity-60 hover:opacity-100 transition-opacity"
                >
                    &larr; Zurück
                </button>

                <h1 className="text-3xl font-bold">Impressum</h1>

                <div className="space-y-4 opacity-90 leading-relaxed bg-[var(--surface)] p-6 rounded-3xl border border-[var(--border)]">
                    <p>Angaben gemäß § 5 DDG</p>

                    <div>
                        <h2 className="font-bold mt-4">Betreiber</h2>
                        <p>Julius Deusch</p>
                        <p>In den Grüben 140</p>
                        <p>84489 Burghausen</p>
                        <p>Deutschland</p>
                    </div>

                    <div>
                        <h2 className="font-bold mt-4">Kontakt</h2>
                        <p>Telefon: 01623172876</p>
                        <p>E-Mail: julius.deusch@trainq.app</p>
                    </div>

                    <div>
                        <h2 className="font-bold mt-4">Registereintrag</h2>
                        <p>Keiner.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
