// src/pages/legal/ImpressumPage.tsx
import React from "react";

export default function ImpressumPage({ onBack }: { onBack?: () => void }) {
    const safeTop = "env(safe-area-inset-top, 0px)";

    const goBack = () => {
        if (onBack) onBack();
        else window.history.back();
    };

    return (
        <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] px-4 py-8" style={{ paddingTop: `calc(2rem + ${safeTop})` }}>
            {/* Fixed X button */}
            <button
                onPointerUp={(e) => { e.stopPropagation(); goBack(); }}
                className="fixed z-50 w-9 h-9 rounded-full bg-[var(--button-bg)] flex items-center justify-center active:scale-90 transition-transform"
                style={{ top: `calc(16px + ${safeTop})`, right: 20 }}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            <div className="max-w-2xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold pr-12">Impressum</h1>

                <div className="space-y-5 opacity-90 leading-relaxed bg-[var(--card-bg)] p-6 rounded-3xl border border-[var(--border-color)]">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)</p>

                    <div>
                        <h2 className="font-bold text-base mt-2">Verantwortlich für den Inhalt</h2>
                        <p>Julius Deusch</p>
                        <p>In den Grüben 140</p>
                        <p>84489 Burghausen</p>
                        <p>Deutschland</p>
                    </div>

                    <div>
                        <h2 className="font-bold text-base mt-2">Kontakt</h2>
                        <p>Telefon: +49 162 3172876</p>
                        <p>E-Mail: julius.deusch@trainq.app</p>
                    </div>

                    <div>
                        <h2 className="font-bold text-base mt-2">Umsatzsteuer-ID</h2>
                        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: Noch nicht vergeben (Kleinunternehmerregelung gemäß § 19 UStG).</p>
                    </div>

                    <div>
                        <h2 className="font-bold text-base mt-2">EU-Streitschlichtung</h2>
                        <p className="text-sm">
                            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
                            <span
                                className="underline"
                                style={{ color: 'var(--accent-color)' }}
                                onClick={() => window.open("https://ec.europa.eu/consumers/odr/", "_system")}
                            >
                                https://ec.europa.eu/consumers/odr/
                            </span>
                        </p>
                        <p className="text-sm mt-1">
                            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
                        </p>
                    </div>

                    <div>
                        <h2 className="font-bold text-base mt-2">Haftung für Inhalte</h2>
                        <p className="text-sm">
                            Als Diensteanbieter sind wir gemäß § 7 Abs.1 DDG für eigene Inhalte in dieser App nach den allgemeinen Gesetzen verantwortlich.
                            Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen
                            zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
                        </p>
                    </div>
                </div>

                <p className="text-xs text-center pb-8" style={{ color: 'var(--text-secondary)' }}>
                    Stand: April 2026
                </p>
            </div>
        </div>
    );
}
