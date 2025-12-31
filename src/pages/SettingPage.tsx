// src/pages/SettingPage.tsx
import { useCallback, useMemo, useState } from "react";

import {
  readOnboardingDataFromStorage,
  writeOnboardingDataToStorage,
  resetOnboardingInStorage,
} from "../context/OnboardingContext";

import { clearWorkoutHistory } from "../utils/workoutHistory";
import { useAuth } from "../hooks/useAuth";

type SettingsSection = "account" | "notifications" | "legal" | "language" | "theme";
type LegalTab = "privacy" | "imprint" | "terms";

interface SettingPageProps {
  onBack: () => void;
  onClearCalendar?: () => void;
  onOpenPaywall?: () => void;
}

function parseCsvList(s: string): string[] {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// Onboarding-Typen in deinem Projekt scheinen `number | null` zu erwarten.
// Deshalb speichern wir IMMER `number | null` (nie `undefined`), um TS-Errors zu vermeiden.
function toNumberOrNull(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function SettingPage({ onBack, onClearCalendar, onOpenPaywall }: SettingPageProps) {
  const { user, logout } = useAuth();
  const isPro = user?.isPro === true;

  const [section, setSection] = useState<SettingsSection>("account");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");

  const initialOnboarding = readOnboardingDataFromStorage();

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

  // ---- Editable fields (Onboarding) ----
  const [age, setAge] = useState<string>(() =>
    typeof initialOnboarding.personal?.age === "number" ? String(initialOnboarding.personal?.age) : ""
  );
  const [height, setHeight] = useState<string>(() =>
    typeof initialOnboarding.personal?.height === "number" ? String(initialOnboarding.personal?.height) : ""
  );
  const [weight, setWeight] = useState<string>(() =>
    typeof initialOnboarding.personal?.weight === "number" ? String(initialOnboarding.personal?.weight) : ""
  );

  const [hoursPerWeek, setHoursPerWeek] = useState<string>(() =>
    typeof initialOnboarding.training?.hoursPerWeek === "number" ? String(initialOnboarding.training?.hoursPerWeek) : ""
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState<string>(() =>
    typeof initialOnboarding.training?.sessionsPerWeek === "number"
      ? String(initialOnboarding.training?.sessionsPerWeek)
      : ""
  );

  const [sportsCsv, setSportsCsv] = useState<string>(() =>
    Array.isArray(initialOnboarding.goals?.sports) ? initialOnboarding.goals!.sports.join(", ") : ""
  );
  const [goalsCsv, setGoalsCsv] = useState<string>(() =>
    Array.isArray(initialOnboarding.goals?.selectedGoals) ? initialOnboarding.goals!.selectedGoals.join(", ") : ""
  );

  const saveAccountData = useCallback(() => {
    const current = readOnboardingDataFromStorage();

    const nextSports = parseCsvList(sportsCsv);
    const nextGoals = parseCsvList(goalsCsv);

    // WICHTIG:
    // Wenn deine Types `sports` und `selectedGoals` NICHT als string[] definieren,
    // musst du hier später auf echte Enums/Union-Types mappen.
    const next = {
      ...current,
      personal: {
        ...(current.personal ?? {}),
        age: toNumberOrNull(age),
        height: toNumberOrNull(height),
        weight: toNumberOrNull(weight),
      },
      training: {
        ...(current.training ?? {}),
        hoursPerWeek: toNumberOrNull(hoursPerWeek),
        sessionsPerWeek: toNumberOrNull(sessionsPerWeek),
      },
      goals: {
        ...(current.goals ?? {}),
        sports: nextSports as unknown as typeof current.goals extends { sports: infer T } ? T : unknown,
        selectedGoals: nextGoals as unknown as typeof current.goals extends { selectedGoals: infer T } ? T : unknown,
      },
    };

    writeOnboardingDataToStorage(next);
    alert("Gespeichert.");
  }, [age, height, weight, hoursPerWeek, sessionsPerWeek, sportsCsv, goalsCsv]);

  const handleLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("Willst du dich wirklich abmelden?");
    if (!ok) return;
    logout();
    onBack();
  }, [logout, onBack]);

  const handleRestartOnboarding = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("Onboarding wirklich erneut starten?\n\nDeine Onboarding-Daten werden zurückgesetzt.");
    if (!ok) return;
    resetOnboardingInStorage();
    alert("Onboarding wurde zurückgesetzt.");
  }, []);

  const menuItems = useMemo(
    () => [
      { key: "account", label: "Konto & Daten" },
      { key: "notifications", label: "Benachrichtigungen" },
      { key: "legal", label: "Rechtliches" },
      { key: "language", label: "Sprache" },
      { key: "theme", label: "Theme" },
      { key: "subscription", label: "Abonnement verwalten" },
      { key: "faq", label: "Häufig gestellte Fragen" },
      { key: "rate", label: "Bewerte TrainQ" },
      { key: "contact", label: "Kontaktiere uns" },
      { key: "about", label: "Über uns" },
      { key: "help", label: "Hilfe" },
      { key: "delete", label: "Profil löschen", danger: true },
    ],
    []
  );

  const onMenuClick = useCallback(
    (k: string) => {
      if (k === "account" || k === "notifications" || k === "legal" || k === "language" || k === "theme") {
        setSection(k as SettingsSection);
        return;
      }

      if (k === "subscription") {
        if (!isPro) return openPaywall();
        alert("Abonnement verwalten kommt später (App Store Subscriptions).");
        return;
      }

      if (k === "faq") return alert("FAQ kommt später.");
      if (k === "rate") return alert("Bewerten kommt später (App Store Link).");
      if (k === "contact") return alert("Kontakt kommt später (Support-Mail / Formular).");
      if (k === "about") return alert("Über uns kommt später.");
      if (k === "help") return alert("Hilfe kommt später.");
      if (k === "delete") return alert("Profil löschen kommt später (Server-Deletion).");
    },
    [isPro, openPaywall]
  );

  return (
    <div className="h-full w-full overflow-y-auto px-1 py-5 sm:px-2">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-black/40 border border-white/15 text-white/80 hover:bg-white/10"
              title="Zurück"
            >
              {"<"}
            </button>
            <h1 className="text-xl font-semibold">Einstellungen</h1>
          </div>

          {!isPro && (
            <button
              type="button"
              onClick={openPaywall}
              className="rounded-full bg-brand-primary text-black px-4 py-2 text-xs font-semibold hover:bg-brand-primary/90"
            >
              Pro kaufen
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          <div className="rounded-2xl bg-brand-card border border-white/5 p-2">
            <div className="space-y-1">
              {menuItems.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={() => onMenuClick(it.key)}
                  className={
                    "w-full text-left px-3 py-2 rounded-xl border " +
                    (it.danger
                      ? "border-red-500/30 bg-red-500/5 text-red-100 hover:bg-red-500/10"
                      : "border-white/10 bg-black/30 text-white/80 hover:bg-white/5")
                  }
                >
                  {it.label}
                </button>
              ))}
            </div>

            <div className="mt-3 px-3 pb-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/80 hover:bg-white/5"
              >
                Abmelden
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-brand-card border border-white/5 p-4 space-y-3">
            {section === "account" && (
              <>
                <div className="text-sm font-semibold">Konto & Daten</div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] text-white/55">E-Mail</div>
                  <div className="mt-1 text-[12px] text-white/85 break-all">{user?.email || "—"}</div>
                  <div className="mt-2 text-[10px] text-white/50">
                    Account-Status:{" "}
                    <span className={isPro ? "text-amber-200" : "text-emerald-200"}>{isPro ? "Pro" : "Free"}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3">
                  <div className="text-[11px] font-semibold text-white/85">Onboarding-Daten</div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-white/60">Alter</label>
                      <input
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] text-white/60">Größe (cm)</label>
                      <input
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] text-white/60">Gewicht (kg)</label>
                      <input
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-white/60">Ziel Stunden / Woche</label>
                      <input
                        value={hoursPerWeek}
                        onChange={(e) => setHoursPerWeek(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                        inputMode="numeric"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] text-white/60">Sessions / Woche</label>
                      <input
                        value={sessionsPerWeek}
                        onChange={(e) => setSessionsPerWeek(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-white/60">Sportarten (kommagetrennt)</label>
                    <input
                      value={sportsCsv}
                      onChange={(e) => setSportsCsv(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                      placeholder="Gym, Laufen, Radfahren"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-white/60">Ziele (kommagetrennt)</label>
                    <input
                      value={goalsCsv}
                      onChange={(e) => setGoalsCsv(e.target.value)}
                      className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                      placeholder="Muskelaufbau, Ausdauer, ..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={saveAccountData}
                      className="rounded-xl bg-brand-primary text-black px-4 py-2 text-xs font-semibold hover:bg-brand-primary/90"
                    >
                      Speichern
                    </button>
                  </div>
                </div>

                <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-red-200/90">Kritische Aktionen</div>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window === "undefined") return;
                      const ok = window.confirm(
                        "Trainingsverlauf wirklich löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden."
                      );
                      if (!ok) return;
                      clearWorkoutHistory();
                      alert("Trainingsverlauf wurde gelöscht.");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-[11px] text-red-50 hover:bg-red-500/20"
                  >
                    Trainingsverlauf löschen
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!onClearCalendar) return alert("Kalender leeren ist noch nicht verbunden.");
                      if (typeof window === "undefined") return;
                      const ok = window.confirm("Kalender wirklich leeren?");
                      if (!ok) return;
                      onClearCalendar();
                      alert("Kalender wurde geleert.");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 text-[11px] text-amber-50 hover:bg-amber-500/20"
                  >
                    Kalender leeren
                  </button>

                  <button
                    type="button"
                    onClick={handleRestartOnboarding}
                    className="w-full text-left px-3 py-2 rounded-xl border border-blue-500/40 bg-blue-500/10 text-[11px] text-blue-50 hover:bg-blue-500/20"
                  >
                    Onboarding erneut starten
                  </button>
                </div>
              </>
            )}

            {section === "notifications" && (
              <>
                <div className="text-sm font-semibold">Benachrichtigungen</div>
                <div className="text-[11px] text-white/60">Kommt später (Push/Local Notifications).</div>
              </>
            )}

            {section === "legal" && (
              <>
                <div className="text-sm font-semibold">Rechtliches</div>

                <div className="inline-flex rounded-full bg-black/40 border border-white/15 p-1 text-[11px]">
                  {[
                    ["privacy", "Datenschutz"],
                    ["imprint", "Impressum"],
                    ["terms", "AGB"],
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLegalTab(k as LegalTab)}
                      className={
                        "px-3 py-1 rounded-full " +
                        (legalTab === k ? "bg-brand-primary text-black" : "text-white/70 hover:bg-white/5")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                  {legalTab === "privacy" && "Datenschutz-Text kommt später."}
                  {legalTab === "imprint" && "Impressum kommt später."}
                  {legalTab === "terms" && "AGB kommt später."}
                </div>
              </>
            )}

            {section === "language" && (
              <>
                <div className="text-sm font-semibold">Sprache</div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                  Kommt später (i18n).
                </div>
              </>
            )}

            {section === "theme" && (
              <>
                <div className="text-sm font-semibold">Theme</div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                  Kommt später (Light/Dark/Accent).
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}