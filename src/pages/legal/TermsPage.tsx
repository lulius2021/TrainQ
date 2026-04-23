// src/pages/legal/TermsPage.tsx
import React from "react";

export default function TermsPage({ onBack }: { onBack?: () => void }) {
    const safeTop = "env(safe-area-inset-top, 0px)";

    const goBack = () => {
        if (onBack) onBack();
        else window.history.back();
    };

    const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
        <div>
            <h2 className="font-bold text-base mt-4 mb-2">{title}</h2>
            <div className="space-y-2 text-sm">{children}</div>
        </div>
    );

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
                <h1 className="text-3xl font-bold pr-12">Nutzungsbedingungen</h1>

                <div className="space-y-5 opacity-90 leading-relaxed bg-[var(--card-bg)] p-6 rounded-3xl border border-[var(--border-color)]">

                    <Section title="1. Geltungsbereich">
                        <p>
                            Diese Nutzungsbedingungen gelten für die Nutzung der mobilen App "TrainQ" (nachfolgend "App"),
                            betrieben von Julius Deusch, In den Grüben 140, 84489 Burghausen, Deutschland (nachfolgend "Anbieter").
                        </p>
                        <p>
                            Mit der Registrierung oder Nutzung der App erklärst du dich mit diesen Nutzungsbedingungen einverstanden.
                        </p>
                    </Section>

                    <Section title="2. Leistungsbeschreibung">
                        <p>TrainQ ist eine Fitness-App, die folgende Funktionen bietet:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Erstellung und Verwaltung von Trainingsplänen</li>
                            <li>Adaptive Trainingsvorschläge basierend auf deinem Fortschritt</li>
                            <li>Live-Training mit Satz-Tracking und Pausentimer</li>
                            <li>Ernährungstagebuch mit Makronährstoff-Tracking</li>
                            <li>Kalender mit Trainingsplanung</li>
                            <li>Cardio-Tracking mit GPS (Laufen, Radfahren)</li>
                            <li>Gamification (XP, Level-System)</li>
                            <li>Statistiken und Fortschrittsanalyse</li>
                        </ul>
                        <p>
                            Der Anbieter behält sich vor, den Funktionsumfang der App jederzeit zu erweitern, einzuschränken oder zu ändern.
                        </p>
                    </Section>

                    <Section title="3. Registrierung und Konto">
                        <p>
                            Für die Nutzung der App ist eine Registrierung erforderlich. Du kannst dich per E-Mail/Passwort,
                            Apple Sign-In oder Google Sign-In registrieren.
                        </p>
                        <p>
                            Du bist für die Sicherheit deiner Zugangsdaten selbst verantwortlich. Teile dein Passwort nicht mit Dritten.
                            Bei Verdacht auf unbefugten Zugriff informiere uns umgehend unter julius.deusch@trainq.app.
                        </p>
                    </Section>

                    <Section title="4. Kostenlose und kostenpflichtige Funktionen">
                        <p>
                            TrainQ bietet eine kostenlose Basisversion ("Free") und ein kostenpflichtiges Abonnement ("Pro").
                        </p>
                        <p>
                            <strong>Pro-Abonnement:</strong> Die Abrechnung erfolgt über Apple In-App Purchase.
                            Es gelten die Zahlungs- und Kündigungsbedingungen von Apple. Du kannst dein Abonnement jederzeit
                            über die iOS-Einstellungen oder den App Store kündigen.
                        </p>
                        <p>
                            Nach Kündigung bleibt der Pro-Zugang bis zum Ende des bezahlten Zeitraums bestehen.
                            Danach wird dein Konto auf die kostenlose Version zurückgestuft. Deine Daten bleiben erhalten.
                        </p>
                    </Section>

                    <Section title="5. Nutzungspflichten">
                        <p>Du verpflichtest dich, die App nur für den bestimmungsgemäßen Zweck zu nutzen. Insbesondere ist es untersagt:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Die App für rechtswidrige Zwecke zu nutzen</li>
                            <li>Sicherheitsmechanismen der App zu umgehen oder zu manipulieren</li>
                            <li>Automatisierte Zugriffe (Bots, Scraper) auf die App auszuführen</li>
                            <li>Falsche oder irreführende Angaben bei der Registrierung zu machen</li>
                            <li>Die App oder Teile davon zu kopieren, zu dekompilieren oder zurückzuentwickeln</li>
                        </ul>
                    </Section>

                    <Section title="6. Gesundheitshinweis">
                        <p>
                            <strong>TrainQ ist kein medizinisches Produkt.</strong> Die App ersetzt keine ärztliche Beratung,
                            Diagnose oder Behandlung. Trainingsvorschläge, Ernährungsdaten und sonstige Empfehlungen
                            dienen ausschließlich zu Informationszwecken.
                        </p>
                        <p>
                            Konsultiere vor Beginn eines neuen Trainingsprogramms einen Arzt, insbesondere bei
                            bestehenden gesundheitlichen Einschränkungen. Die Nutzung der App und die Ausführung der
                            Übungen erfolgen auf eigene Verantwortung.
                        </p>
                        <p>
                            Der Anbieter übernimmt keine Haftung für Verletzungen, gesundheitliche Schäden oder sonstige
                            Nachteile, die aus der Nutzung der App oder der Umsetzung der Trainings- und Ernährungsvorschläge resultieren.
                        </p>
                    </Section>

                    <Section title="7. Geistiges Eigentum">
                        <p>
                            Alle Inhalte der App (Texte, Grafiken, Icons, Logos, Software) sind urheberrechtlich geschützt
                            und Eigentum des Anbieters. Eine Vervielfältigung, Verbreitung oder sonstige Nutzung bedarf
                            der vorherigen schriftlichen Zustimmung.
                        </p>
                        <p>
                            Nutzergenerierte Inhalte (z.B. eigene Trainingspläne, Ernährungseinträge) verbleiben im Eigentum
                            des jeweiligen Nutzers.
                        </p>
                    </Section>

                    <Section title="8. Verfügbarkeit">
                        <p>
                            Der Anbieter bemüht sich um eine möglichst unterbrechungsfreie Verfügbarkeit der App.
                            Ein Anspruch auf ständige Verfügbarkeit besteht nicht. Wartungsarbeiten, technische Störungen
                            oder höhere Gewalt können zu vorübergehenden Einschränkungen führen.
                        </p>
                    </Section>

                    <Section title="9. Haftungsbeschränkung">
                        <p>
                            Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit.
                            Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten
                            (Kardinalpflichten), und zwar beschränkt auf den vorhersehbaren, vertragstypischen Schaden.
                        </p>
                        <p>
                            Die Haftung für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit
                            bleibt hiervon unberührt.
                        </p>
                    </Section>

                    <Section title="10. Datenschutz">
                        <p>
                            Der Schutz deiner personenbezogenen Daten ist uns wichtig. Einzelheiten zur Datenverarbeitung
                            findest du in unserer{" "}
                            <span className="underline font-medium" style={{ color: 'var(--accent-color)' }}
                                onClick={() => window.open("/privacy", "_self")}>Datenschutzerklärung</span>.
                        </p>
                    </Section>

                    <Section title="11. Kontolöschung">
                        <p>
                            Du kannst dein Konto jederzeit in den App-Einstellungen löschen. Bei der Löschung werden
                            alle deine personenbezogenen Daten innerhalb von 30 Tagen unwiderruflich von unseren Servern entfernt.
                        </p>
                        <p>
                            Der Anbieter behält sich das Recht vor, Konten bei Verstoß gegen diese Nutzungsbedingungen
                            zu sperren oder zu löschen.
                        </p>
                    </Section>

                    <Section title="12. Änderungen der Nutzungsbedingungen">
                        <p>
                            Der Anbieter behält sich vor, diese Nutzungsbedingungen jederzeit zu ändern.
                            Über wesentliche Änderungen wirst du innerhalb der App informiert.
                            Bei Weiterbenutzung der App nach Änderung der Bedingungen gelten diese als akzeptiert.
                        </p>
                    </Section>

                    <Section title="13. Anwendbares Recht und Gerichtsstand">
                        <p>
                            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
                        </p>
                        <p>
                            Ist der Nutzer Verbraucher, gelten die zwingenden Verbraucherschutzbestimmungen des Staates,
                            in dem der Nutzer seinen gewöhnlichen Aufenthalt hat, sofern diese günstiger sind.
                        </p>
                    </Section>

                    <Section title="14. Salvatorische Klausel">
                        <p>
                            Sollten einzelne Bestimmungen dieser Nutzungsbedingungen unwirksam sein oder werden,
                            bleibt die Wirksamkeit der übrigen Bestimmungen hiervon unberührt.
                        </p>
                    </Section>

                    <Section title="15. Kontakt">
                        <p>
                            Bei Fragen zu diesen Nutzungsbedingungen erreichst du uns unter:<br />
                            E-Mail: julius.deusch@trainq.app
                        </p>
                    </Section>
                </div>

                <p className="text-xs text-center pb-8" style={{ color: 'var(--text-secondary)' }}>
                    Stand: April 2026
                </p>
            </div>
        </div>
    );
}
