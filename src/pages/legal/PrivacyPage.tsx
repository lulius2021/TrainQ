// src/pages/legal/PrivacyPage.tsx
import React from "react";

export default function PrivacyPage({ onBack }: { onBack?: () => void }) {
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
                <h1 className="text-3xl font-bold pr-12">Datenschutzerklärung</h1>

                <div className="space-y-5 opacity-90 leading-relaxed bg-[var(--card-bg)] p-6 rounded-3xl border border-[var(--border-color)]">

                    <Section title="1. Verantwortlicher">
                        <p>
                            Verantwortlicher im Sinne der DSGVO ist:<br />
                            Julius Deusch<br />
                            In den Grüben 140, 84489 Burghausen, Deutschland<br />
                            E-Mail: julius.deusch@trainq.app
                        </p>
                    </Section>

                    <Section title="2. Überblick der Verarbeitungen">
                        <p>
                            TrainQ ist eine Fitness-App für iOS. Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung
                            einer funktionsfähigen App sowie unserer Inhalte und Leistungen erforderlich ist.
                        </p>
                        <p><strong>Arten der verarbeiteten Daten:</strong></p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Bestandsdaten (Name, E-Mail-Adresse)</li>
                            <li>Nutzungsdaten (Trainingseinträge, Übungen, Gewichte, Sätze, Wiederholungen)</li>
                            <li>Gesundheitsbezogene Daten (Fitness-Level, Körpergewicht, Körpergröße — nur wenn vom Nutzer eingegeben)</li>
                            <li>Ernährungsdaten (Mahlzeiten, Makronährstoffe — nur wenn vom Nutzer eingegeben)</li>
                            <li>Standortdaten (GPS bei Cardio-Tracking — nur bei aktiver Nutzung und Erlaubnis)</li>
                            <li>Geräteinformationen (Gerätetyp, Betriebssystem — für technischen Support)</li>
                        </ul>
                    </Section>

                    <Section title="3. Rechtsgrundlagen">
                        <p>Die Verarbeitung erfolgt auf folgenden Rechtsgrundlagen:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO):</strong> Verarbeitung zur Bereitstellung der App-Funktionen (Training, Ernährung, Kalender, Gamification).</li>
                            <li><strong>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO):</strong> Zugriff auf Standort (GPS), Kamera (Barcode-Scanner), Push-Benachrichtigungen. Die Einwilligung kann jederzeit in den Geräteeinstellungen widerrufen werden.</li>
                            <li><strong>Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO):</strong> Fehleranalyse und Verbesserung der App.</li>
                            <li><strong>Ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO):</strong> Verarbeitung gesundheitsbezogener Daten (Fitness-Level, Körperdaten) erfolgt nur bei ausdrücklicher Eingabe durch den Nutzer.</li>
                        </ul>
                    </Section>

                    <Section title="4. Datenspeicherung und Hosting">
                        <p>
                            Deine Daten werden über <strong>Supabase</strong> (Supabase Inc., 970 Toa Payoh North #07-04, Singapore 318992)
                            verarbeitet und gespeichert. Supabase hosten die Datenbank in der EU-Region (Frankfurt am Main, Deutschland).
                        </p>
                        <p>
                            Mit Supabase besteht ein Auftragsverarbeitungsvertrag (AVV/DPA) gemäß Art. 28 DSGVO.
                            Für Datentransfers in Drittländer gelten die EU-Standardvertragsklauseln (SCCs).
                        </p>
                        <p>
                            Mehr Informationen: <span className="underline" style={{ color: 'var(--accent-color)' }}
                            onClick={() => window.open("https://supabase.com/privacy", "_system")}>supabase.com/privacy</span>
                        </p>
                    </Section>

                    <Section title="5. Lokale Datenspeicherung">
                        <p>
                            Viele Daten werden direkt auf deinem Gerät gespeichert (localStorage / Capacitor Preferences):
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Trainingseinstellungen und Präferenzen</li>
                            <li>Ernährungstagebuch-Einträge</li>
                            <li>GPS-Tracking-Sessions (temporär)</li>
                            <li>App-Einstellungen (Theme, Sprache, Haptic-Präferenz)</li>
                        </ul>
                        <p>Diese Daten verlassen dein Gerät nicht, solange du keine Cloud-Synchronisierung aktivierst.</p>
                    </Section>

                    <Section title="6. Authentifizierung">
                        <p>
                            Zur Registrierung und Anmeldung nutzen wir Supabase Auth. Folgende Anmeldemethoden stehen zur Verfügung:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>E-Mail & Passwort:</strong> Dein Passwort wird gehasht gespeichert. Wir haben keinen Zugriff auf dein Klartext-Passwort.</li>
                            <li><strong>Apple Sign-In:</strong> Wir erhalten nur die von Apple freigegebenen Daten (Name, E-Mail oder anonymisierte Apple-ID).</li>
                            <li><strong>Google Sign-In:</strong> Wir erhalten nur die von Google freigegebenen Basis-Profildaten.</li>
                        </ul>
                    </Section>

                    <Section title="7. Gerätezugriffe (Berechtigungen)">
                        <p>TrainQ fragt folgende Geräteberechtigungen an — jede einzeln und nur bei Bedarf:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Standort (GPS):</strong> Nur während aktiver Cardio-Aufzeichnung (Laufen, Radfahren). Wird nicht im Hintergrund getrackt.</li>
                            <li><strong>Kamera:</strong> Nur für den Barcode-Scanner bei der Lebensmittelsuche.</li>
                            <li><strong>Push-Benachrichtigungen:</strong> Für Trainingserinnerungen und Pausentimer.</li>
                        </ul>
                        <p>Du kannst jede Berechtigung jederzeit in den iOS-Einstellungen widerrufen.</p>
                    </Section>

                    <Section title="8. Garmin Connect Integration">
                        <p>
                            TrainQ bietet eine optionale Integration mit Garmin Connect an.
                            Wenn du dein Garmin-Konto verbindest, empfangen wir folgende Daten gemäß deinen Garmin-Berechtigungen:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Aktivitäten (Workouts, Dauer, Herzfrequenz)</li>
                            <li>Tägliche Metriken (Schritte, Stresslevel, Body Battery)</li>
                            <li>Schlafdaten (Schlafdauer, Schlafphasen)</li>
                        </ul>
                        <p>
                            Die Verbindung kann jederzeit in den TrainQ-Einstellungen oder über Garmin Connect getrennt werden.
                            Nach dem Trennen werden keine weiteren Daten mehr abgerufen.
                        </p>
                    </Section>

                    <Section title="9. In-App-Käufe">
                        <p>
                            TrainQ bietet ein optionales Pro-Abonnement. Die Zahlungsabwicklung erfolgt ausschließlich über
                            Apple (In-App Purchase / App Store). Wir erhalten keine Zahlungsdaten (Kreditkartennummer, Bankdaten).
                            Apple übermittelt uns lediglich den Kauf-Status (aktiv/abgelaufen) zur Freischaltung der Pro-Funktionen.
                        </p>
                    </Section>

                    <Section title="10. Datenübermittlung an Dritte">
                        <p>Wir verkaufen deine Daten niemals an Dritte. Eine Übermittlung erfolgt nur an:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Supabase</strong> — Datenbankhosting und Authentifizierung (AVV vorhanden)</li>
                            <li><strong>Apple</strong> — In-App-Käufe und App-Distribution</li>
                            <li><strong>Garmin</strong> — Nur bei aktiver Garmin-Verbindung durch den Nutzer</li>
                        </ul>
                        <p>Es werden keine Tracking-SDKs, Analyse-Tools oder Werbenetzwerke eingesetzt.</p>
                    </Section>

                    <Section title="11. Speicherdauer">
                        <p>
                            Deine Daten werden gespeichert, solange dein Konto besteht. Bei Kontolöschung werden alle
                            personenbezogenen Daten innerhalb von 30 Tagen unwiderruflich gelöscht — einschließlich
                            Trainingsdaten, Profildaten und Ernährungsdaten.
                        </p>
                        <p>
                            Lokale Daten auf deinem Gerät kannst du jederzeit durch Deinstallation der App oder
                            über die Einstellungen löschen.
                        </p>
                    </Section>

                    <Section title="12. Deine Rechte (Art. 15–21 DSGVO)">
                        <p>Du hast jederzeit das Recht auf:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Auskunft</strong> (Art. 15) — welche Daten wir über dich speichern</li>
                            <li><strong>Berichtigung</strong> (Art. 16) — Korrektur unrichtiger Daten</li>
                            <li><strong>Löschung</strong> (Art. 17) — Löschung deiner Daten ("Recht auf Vergessenwerden")</li>
                            <li><strong>Einschränkung</strong> (Art. 18) — Einschränkung der Verarbeitung</li>
                            <li><strong>Datenübertragbarkeit</strong> (Art. 20) — Export deiner Daten in einem gängigen Format</li>
                            <li><strong>Widerspruch</strong> (Art. 21) — Widerspruch gegen die Verarbeitung</li>
                            <li><strong>Widerruf der Einwilligung</strong> — jederzeit mit Wirkung für die Zukunft</li>
                        </ul>
                        <p>
                            Kontaktiere uns unter <strong>julius.deusch@trainq.app</strong> zur Ausübung deiner Rechte.
                        </p>
                    </Section>

                    <Section title="13. Beschwerderecht">
                        <p>
                            Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
                            Zuständige Aufsichtsbehörde:
                        </p>
                        <p>
                            Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)<br />
                            Promenade 18, 91522 Ansbach<br />
                            <span className="underline" style={{ color: 'var(--accent-color)' }}
                                onClick={() => window.open("https://www.lda.bayern.de", "_system")}>www.lda.bayern.de</span>
                        </p>
                    </Section>

                    <Section title="14. Datensicherheit">
                        <p>
                            Wir setzen technische und organisatorische Maßnahmen ein, um deine Daten zu schützen:
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Verschlüsselte Datenübertragung (TLS/HTTPS)</li>
                            <li>Gehashte Passwörter (bcrypt)</li>
                            <li>Row-Level-Security in der Datenbank (Supabase RLS)</li>
                            <li>Datenhosting in der EU (Frankfurt am Main)</li>
                        </ul>
                    </Section>

                    <Section title="15. Änderungen dieser Datenschutzerklärung">
                        <p>
                            Wir behalten uns vor, diese Datenschutzerklärung bei Bedarf anzupassen — z.B. bei Änderungen der
                            App-Funktionen oder rechtlicher Anforderungen. Die aktuelle Version ist jederzeit in der App abrufbar.
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
