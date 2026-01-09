// src/pages/SettingPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../hooks/useAuth";
import { useEntitlements } from "../hooks/useEntitlements";
import { isBillingSupported, restorePurchases, syncProToSession } from "../services/purchases";

import { loadTheme, setTheme as setThemeGlobal, type ThemeMode } from "../utils/theme";
import { clearUserScopedData, getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { resetOnboardingInStorage } from "../context/OnboardingContext";
import { clearWorkoutHistory } from "../utils/workoutHistory";
import { clearCalendarWorkouts } from "../utils/trainqStorage";
import {
  ensureCommunityProfile,
  loadCommunityProfile,
  updateCommunitySettings,
  type CommunityPrivacyLevel,
  type CommunityProfileRecord,
} from "../services/communityBackend";

type SettingsSection =
  | "profile"
  | "account"
  | "notifications"
  | "units"
  | "legal"
  | "language"
  | "theme"
  | "pro"
  | "community"
  | "data"
  | "help";
type LegalTab = "privacy" | "imprint" | "terms";

interface SettingPageProps {
  onBack: () => void;
  onClearCalendar?: () => void;
  onOpenPaywall?: () => void;
  onOpenGoals?: () => void; // Für "Meine Ziele" Button
}

export default function SettingPage({
  onBack,
  onClearCalendar,
  onOpenPaywall,
  onOpenGoals,
}: SettingPageProps) {
  const safeTop = "env(safe-area-inset-top, 0px)";
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  const { user, logout } = useAuth();
  const { isPro, adaptiveBCRemaining, planShiftRemaining, calendar7DaysRemaining } = useEntitlements(user?.id);

  const [section, setSection] = useState<SettingsSection>("theme");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");
  const [language, setLanguage] = useState<"de" | "en">(() => {
    if (typeof window === "undefined") return "de";
    const stored = getScopedItem("trainq_language");
    return (stored === "en" ? "en" : "de") as "de" | "en";
  });
  const [units, setUnits] = useState<"metric" | "imperial">(() => {
    if (typeof window === "undefined") return "metric";
    const stored = getScopedItem("trainq_units");
    return (stored === "imperial" ? "imperial" : "metric") as "metric" | "imperial";
  });

  // ✅ Theme State nur für UI-Anzeige; DOM/Storage macht utils/theme.ts zentral
  const [theme, setThemeState] = useState<ThemeMode>(() => loadTheme("dark"));
  const [communityProfile, setCommunityProfile] = useState<CommunityProfileRecord | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

  const MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

  const openExternalUrl = useCallback((url: string) => {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) {
      window.open(url, "_blank");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, [user?.id]);

  const handleRestorePurchases = useCallback(async () => {
    if (!user) return;
    try {
      const supported = await isBillingSupported();
      if (!supported) {
        alert("In-App-Käufe sind auf diesem Gerät nicht verfügbar.");
        return;
      }

      const nextIsPro = await restorePurchases();
      await syncProToSession({ id: user.id, email: user.email });

      if (!nextIsPro) {
        alert("Kein aktives Abo gefunden.");
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "Wiederherstellung fehlgeschlagen.");
      alert(msg);
    }
  }, [user]);

  const handleLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("Willst du dich wirklich abmelden?");
    if (!ok) return;
    logout();
    onBack();
  }, [logout, onBack]);

  // ✅ Onboarding erneut starten (Reset + Reload, damit Gate sauber greift)
  const handleRestartOnboarding = useCallback(() => {
    if (typeof window === "undefined") return;

    const ok = window.confirm(
      "Onboarding wirklich erneut starten?\n\nDeine Onboarding-Angaben werden zurückgesetzt."
    );
    if (!ok) return;

    resetOnboardingInStorage();

    // optional: falls du irgendwo Listener nutzt
    window.dispatchEvent(new CustomEvent("trainq:restart_onboarding"));

    // safest: App neu laden -> Onboarding-Gate greift sicher
    window.location.reload();
  }, []);

  const menuItems = useMemo(
    () => [
      { key: "profile", label: "Profil", kind: "section" as const },
      { key: "account", label: "Konto", kind: "section" as const },
      { key: "notifications", label: "Benachrichtigungen", kind: "section" as const },
      { key: "units", label: "Einheiten", kind: "section" as const },
      { key: "language", label: "Sprache", kind: "section" as const },
      { key: "theme", label: "Theme", kind: "section" as const },
      { key: "pro", label: "PRO / Abo", kind: "section" as const },
      { key: "community", label: "Community / Datenschutz", kind: "section" as const },
      { key: "data", label: "Datenverwaltung", kind: "section" as const },
      { key: "legal", label: "Rechtliches", kind: "section" as const },
      { key: "help", label: "Hilfe & Support", kind: "section" as const },
    ],
    []
  );

  useEffect(() => {
    let active = true;
    if (!user?.supabaseId) {
      setCommunityProfile(null);
      setCommunityLoading(false);
      return;
    }
    setCommunityLoading(true);
    (async () => {
      const loaded = await loadCommunityProfile(user.supabaseId);
      const ensured =
        loaded ||
        (await ensureCommunityProfile({
          supabaseUserId: user.supabaseId,
          displayName: user.displayName,
          email: user.email,
        }));
      if (!active) return;
      setCommunityProfile(ensured);
      setCommunityLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.supabaseId, user?.displayName, user?.email]);

  const handleDeleteAccount = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Willst du dein Profil wirklich löschen?\n\nAlle deine Daten werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!ok) return;
    
    if (typeof window !== "undefined") {
      try {
        if (user?.id) {
          clearUserScopedData(user.id);
        }
        alert("Profil gelöscht. Die App wird neu geladen.");
        window.location.reload();
      } catch {
        alert("Fehler beim Löschen des Profils.");
      }
    }
  }, []);

  const handleClearCalendar = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("Willst du wirklich alle Kalendereinträge löschen? Diese Aktion kann nicht rückgängig gemacht werden.");
    if (!ok) return;
    
    clearCalendarWorkouts();
    if (onClearCalendar) onClearCalendar();
    alert("Kalender wurde geleert.");
  }, [onClearCalendar]);

  const handleClearHistory = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("Willst du wirklich die gesamte Trainingshistorie löschen? Diese Aktion kann nicht rückgängig gemacht werden.");
    if (!ok) return;
    
    clearWorkoutHistory();
    alert("Trainingshistorie wurde geleert.");
  }, []);

  const onMenuClick = useCallback(
    (k: string, kind: "section" | "action") => {
      if (kind === "section") {
        setSection((prev) => (prev === (k as SettingsSection) ? prev : (k as SettingsSection)));
        return;
      }
    },
    []
  );

  // ---------- Theme-safe style helpers ----------
  const surfaceBox: CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)" };
  const surfaceSoft: CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };
  const muted: CSSProperties = { color: "var(--muted)" };

  // -------- Section Renderers --------
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
      {title}
    </div>
  );

  const ProfilePanel = () => (
    <>
      <SectionHeader title="Profil" />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          Verwalte dein Profil und deine Ziele.
        </div>
        {onOpenGoals && (
          <button
            type="button"
            onClick={onOpenGoals}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-95"
            style={{ background: "var(--primary)", color: "#061226" }}
          >
            Meine Ziele
          </button>
        )}
        <div className="text-[11px] pt-2" style={muted}>
          Name: {user?.name || user?.email || "Nicht gesetzt"}
        </div>
      </div>
    </>
  );

  const AccountPanel = () => (
    <>
      <SectionHeader title="Konto" />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          E-Mail: {user?.email || "Nicht gesetzt"}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
          style={surfaceBox}
        >
          <span style={{ color: "var(--text)" }}>Abmelden</span>
        </button>
        <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "rgba(239,68,68,0.95)",
            }}
          >
            Profil löschen
          </button>
        </div>
      </div>
    </>
  );

  const NotificationsPanel = () => (
    <>
      <SectionHeader title="Benachrichtigungen" />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          Trainingserinnerungen und Benachrichtigungen verwalten.
        </div>
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text)" }}>Trainingserinnerungen</span>
            <input type="checkbox" defaultChecked className="rounded" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text)" }}>Wöchentliche Zusammenfassung</span>
            <input type="checkbox" defaultChecked className="rounded" />
          </label>
        </div>
        <div className="text-[10px] pt-2" style={muted}>
          Hinweis: Push-Benachrichtigungen werden in einer zukünftigen Version verfügbar sein.
        </div>
      </div>
    </>
  );

  const UnitsPanel = () => (
    <>
      <SectionHeader title="Einheiten" />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          Wähle dein bevorzugtes Einheitensystem.
        </div>
        <div className="inline-flex rounded-full p-1 text-[11px]" style={surfaceBox}>
          <button
            type="button"
            onClick={() => {
              setUnits("metric");
              if (typeof window !== "undefined") setScopedItem("trainq_units", "metric");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={units === "metric" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            Metrisch (kg, km)
          </button>
          <button
            type="button"
            onClick={() => {
              setUnits("imperial");
              if (typeof window !== "undefined") setScopedItem("trainq_units", "imperial");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={units === "imperial" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            Imperial (lbs, mi)
          </button>
        </div>
        <div className="text-[10px]" style={muted}>
          Hinweis: Die Umstellung auf Imperial-Einheiten wird in einer zukünftigen Version vollständig unterstützt.
        </div>
      </div>
    </>
  );

  const LegalPanel = () => (
    <>
      <SectionHeader title="Rechtliches" />

      <div className="inline-flex rounded-full p-1 text-[11px]" style={surfaceSoft}>
        {[
          ["privacy", "Datenschutz"],
          ["imprint", "Impressum"],
          ["terms", "AGB"],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setLegalTab(k as LegalTab)}
            className="px-3 py-1 rounded-full transition"
            style={
              legalTab === k
                ? { background: "var(--primary)", color: "#061226" }
                : { color: "var(--text)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl p-3 space-y-3 text-[11px]" style={surfaceSoft}>
        {legalTab === "privacy" && (
          <div style={{ color: "var(--text)" }} className="space-y-2">
            <div className="font-semibold">Datenschutzerklärung</div>
            <div style={muted}>
              <p className="mb-2">
                TrainQ respektiert deine Privatsphäre. Alle Daten werden lokal auf deinem Gerät gespeichert.
              </p>
              <p className="mb-2">
                Wir erheben und speichern keine persönlichen Daten ohne deine ausdrückliche Zustimmung.
              </p>
              <p>
                Für Fragen zum Datenschutz kontaktiere uns bitte über die Support-Funktion in den Einstellungen.
              </p>
            </div>
          </div>
        )}
        {legalTab === "imprint" && (
          <div style={{ color: "var(--text)" }} className="space-y-2">
            <div className="font-semibold">Impressum</div>
            <div style={muted}>
              <p className="mb-2">TrainQ</p>
              <p className="mb-2">Eine Trainings-App für deine Fitness-Ziele.</p>
              <p>
                Für rechtliche Anfragen nutze bitte die Kontaktfunktion in den Einstellungen.
              </p>
            </div>
          </div>
        )}
        {legalTab === "terms" && (
          <div style={{ color: "var(--text)" }} className="space-y-2">
            <div className="font-semibold">Allgemeine Geschäftsbedingungen</div>
            <div style={muted}>
              <p className="mb-2">
                Durch die Nutzung von TrainQ akzeptierst du unsere Nutzungsbedingungen.
              </p>
              <p className="mb-2">
                Die App wird "wie besehen" bereitgestellt. Wir übernehmen keine Haftung für Schäden, die durch die Nutzung entstehen.
              </p>
              <p>
                Für Fragen zu den AGB kontaktiere uns bitte über die Support-Funktion.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const LanguagePanel = () => (
    <>
      <SectionHeader title="Sprache" />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          Wähle deine bevorzugte Sprache.
        </div>
        <div className="inline-flex rounded-full p-1 text-[11px]" style={surfaceBox}>
          <button
            type="button"
            onClick={() => {
              setLanguage("de");
              if (typeof window !== "undefined") setScopedItem("trainq_language", "de");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={language === "de" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            Deutsch
          </button>
          <button
            type="button"
            onClick={() => {
              setLanguage("en");
              if (typeof window !== "undefined") setScopedItem("trainq_language", "en");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={language === "en" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            English
          </button>
        </div>
        <div className="text-[10px]" style={muted}>
          Hinweis: Die vollständige Übersetzung wird in einer zukünftigen Version verfügbar sein.
        </div>
      </div>
    </>
  );

  const ThemePanel = () => (
    <>
      <SectionHeader title="Theme" />

      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          Wähle Hell oder Dunkel (wird gespeichert).
        </div>

        <div className="inline-flex rounded-full p-1 text-[11px]" style={surfaceBox}>
          <button
            type="button"
            onClick={() => {
              setThemeGlobal("light");
              setThemeState("light");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={theme === "light" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            Hell
          </button>

          <button
            type="button"
            onClick={() => {
              setThemeGlobal("dark");
              setThemeState("dark");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={theme === "dark" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            Dunkel
          </button>
        </div>

        <div className="text-[10px]" style={muted}>
          Technisch: Theme wird global über <span style={{ color: "var(--text)" }}>html[data-theme]</span> und{" "}
          <span style={{ color: "var(--text)" }}>html.dark</span> gesteuert.
        </div>
      </div>
    </>
  );

  const CommunityPanel = () => {
    const optIn = communityProfile?.community_opt_in ?? false;
    const privacy = (communityProfile?.privacy_level ?? "private") as CommunityPrivacyLevel;

    return (
      <>
        <SectionHeader title="Community / Datenschutz" />
        <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
          <div className="text-[11px]" style={muted}>
            Steuere, ob dein Profil im Community‑Bereich sichtbar ist.
          </div>

          {!user?.supabaseId && (
            <div className="text-[11px]" style={muted}>
              Community‑Profile sind nur nach Login mit E‑Mail aktiv.
            </div>
          )}

          {user?.supabaseId && (
            <>
              <label className="flex items-center justify-between text-[12px]" style={{ color: "var(--text)" }}>
                <span>Community aktivieren</span>
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={async (e) => {
                    if (!user.supabaseId) return;
                    const next = await updateCommunitySettings({
                      supabaseUserId: user.supabaseId,
                      communityOptIn: e.target.checked,
                      privacyLevel: privacy,
                    });
                    if (next) setCommunityProfile(next);
                  }}
                />
              </label>

              <div className="space-y-1">
                <div className="text-[11px]" style={muted}>
                  Sichtbarkeit
                </div>
                <select
                  value={privacy}
                  onChange={async (e) => {
                    if (!user.supabaseId) return;
                    const value = e.target.value as CommunityPrivacyLevel;
                    const next = await updateCommunitySettings({
                      supabaseUserId: user.supabaseId,
                      communityOptIn: optIn,
                      privacyLevel: value,
                    });
                    if (next) setCommunityProfile(next);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-xs"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
                >
                  <option value="private">Privat</option>
                  <option value="followers">Nur Follower</option>
                  <option value="public">Öffentlich</option>
                </select>
              </div>

              {communityLoading && (
                <div className="text-[10px]" style={muted}>
                  Lade Community‑Profil…
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  };

  const ProPanel = () => {
    return (
      <>
        <SectionHeader title="PRO / Abo" />
        <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
          {isPro ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                ✅ Pro aktiv
              </div>
              <div className="text-[11px]" style={muted}>
                Du hast Zugriff auf alle Pro-Features.
              </div>
              <button
                type="button"
                onClick={() => {
                  openExternalUrl(MANAGE_SUBSCRIPTIONS_URL);
                }}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
                style={surfaceBox}
              >
                <span style={{ color: "var(--text)" }}>Abo verwalten / kündigen</span>
              </button>
              <button
                type="button"
                onClick={handleRestorePurchases}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
                style={surfaceBox}
              >
                <span style={{ color: "var(--text)" }}>Käufe wiederherstellen</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                TrainQ Pro
              </div>
              <div className="text-[11px] space-y-1" style={muted}>
                <div>• Unbegrenztes adaptives Training (B/C)</div>
                <div>• Unbegrenztes Plan verschieben</div>
                <div>• Erweiterte Statistiken</div>
                <div>• Frühzugang zu neuen Features</div>
              </div>
              <div className="text-[11px] space-y-1 pt-2" style={muted}>
                <div>Verbleibend diesen Monat:</div>
                <div>• Adaptives Training (B/C): {Math.max(0, Math.floor(adaptiveBCRemaining || 0))} / 5</div>
                <div>• Plan verschieben: {Math.max(0, Math.floor(planShiftRemaining || 0))} / 5</div>
                <div>• Kalender &gt;7 Tage: {Math.max(0, Math.floor(calendar7DaysRemaining || 0))} / 3</div>
              </div>
              <button
                type="button"
                onClick={openPaywall}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-95"
                style={{ background: "var(--primary)", color: "#061226" }}
              >
                Pro kaufen
              </button>
              <button
                type="button"
                onClick={handleRestorePurchases}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
                style={surfaceBox}
              >
                <span style={{ color: "var(--text)" }}>Käufe wiederherstellen</span>
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  const DataPanel = () => (
    <>
      <SectionHeader title="Datenverwaltung" />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          Verwalte deine gespeicherten Daten.
        </div>
        <button
          type="button"
          onClick={handleClearCalendar}
          className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
          style={{ ...surfaceBox, color: "var(--text)" }}
        >
          Kalender leeren
        </button>
        <button
          type="button"
          onClick={handleClearHistory}
          className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
          style={{ ...surfaceBox, color: "var(--text)" }}
        >
          Trainingshistorie leeren
        </button>
        <div className="text-[10px] pt-2" style={muted}>
          Warnung: Diese Aktionen können nicht rückgängig gemacht werden.
        </div>
      </div>
    </>
  );

  const HelpPanel = () => (
    <>
      <SectionHeader title="Hilfe & Support" />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          Hilfe und Support für TrainQ.
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              const faq = "Häufig gestellte Fragen:\n\n" +
                "• Wie erstelle ich ein Training? → Gehe zum Kalender und klicke auf das Plus-Symbol.\n" +
                "• Wie starte ich ein Live-Training? → Klicke auf ein Training im Kalender oder Dashboard.\n" +
                "• Was ist adaptives Training? → Das System passt dein Training an deine aktuelle Situation an.\n" +
                "• Wie funktioniert Pro? → Pro gibt dir unbegrenzten Zugriff auf alle Features.\n\n" +
                "Für weitere Fragen kontaktiere uns über die Support-Funktion.";
              alert(faq);
            }}
            className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
            style={{ ...surfaceBox, color: "var(--text)" }}
          >
            Häufig gestellte Fragen (FAQ)
          </button>
          <button
            type="button"
            onClick={() => {
              window.open("mailto:support@trainq.app?subject=Support-Anfrage", "_blank");
            }}
            className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
            style={{ ...surfaceBox, color: "var(--text)" }}
          >
            Kontaktiere uns
          </button>
          <button
            type="button"
            onClick={() => {
              // In einer echten App würde dies zum App Store führen
              alert("Bewertung: In der finalen Version führt dies zum App Store.");
            }}
            className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
            style={{ ...surfaceBox, color: "var(--text)" }}
          >
            App bewerten
          </button>
          <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text)" }}>Über TrainQ</div>
            <div className="text-[10px]" style={muted}>
              TrainQ v1.0.0
              <br />
              Eine moderne Trainings-App für deine Fitness-Ziele.
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderSectionContent = (k: SettingsSection) => {
    if (k === "profile") return <ProfilePanel />;
    if (k === "account") return <AccountPanel />;
    if (k === "notifications") return <NotificationsPanel />;
    if (k === "units") return <UnitsPanel />;
    if (k === "legal") return <LegalPanel />;
    if (k === "language") return <LanguagePanel />;
    if (k === "theme") return <ThemePanel />;
    if (k === "pro") return <ProPanel />;
    if (k === "community") return <CommunityPanel />;
    if (k === "data") return <DataPanel />;
    if (k === "help") return <HelpPanel />;
    return null;
  };

  // -------- Layout --------
  return (
    <div
      className="h-full w-full overflow-y-auto px-1 sm:px-2"
      style={{
        paddingTop: `calc(12px + ${safeTop})`,
        paddingBottom: `calc(160px + ${safeBottom})`,
      }}
    >
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="h-9 w-9 flex items-center justify-center rounded-full hover:opacity-95"
              title="Zurück"
              style={surfaceSoft}
            >
              <span style={{ color: "var(--text)" }}>{"<"}</span>
            </button>

            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
              Einstellungen
            </h1>
          </div>

          {!isPro && (
            <button
              type="button"
              onClick={openPaywall}
              className="rounded-full px-4 py-2 text-xs font-semibold hover:opacity-95"
              style={{ background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" }}
            >
              Pro kaufen
            </button>
          )}
        </div>

        {/* MOBILE: Accordion */}
        <div className="md:hidden space-y-3">
          <div className="tq-surface p-2">
            <div className="space-y-1">
              {menuItems.map((it) => {
                const isSection = it.kind === "section";
                const isActive = isSection && section === (it.key as SettingsSection);

                const rowStyle: CSSProperties = it.danger
                  ? {
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "rgba(239,68,68,0.95)",
                    }
                  : surfaceSoft;

                return (
                  <div key={it.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onMenuClick(it.key, it.kind)}
                      className="w-full text-left px-3 py-2 rounded-xl hover:opacity-95"
                      style={rowStyle}
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: it.danger ? "rgba(239,68,68,0.95)" : "var(--text)" }}>{it.label}</span>
                        {isSection && (
                          <span className="text-[12px]" style={muted}>
                            {isActive ? "–" : "+"}
                          </span>
                        )}
                      </div>
                    </button>

                    {isSection && isActive && (
                      <div className="rounded-2xl p-3 space-y-3" style={surfaceBox}>
                        {renderSectionContent(it.key as SettingsSection)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* DESKTOP: Sidebar + Content */}
        <div className="hidden md:grid grid-cols-[280px_1fr] gap-4">
          <div className="tq-surface p-2">
            <div className="space-y-1">
              {menuItems.map((it) => {
                const rowStyle: CSSProperties = it.danger
                  ? {
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "rgba(239,68,68,0.95)",
                    }
                  : surfaceSoft;

                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onMenuClick(it.key, it.kind)}
                    className="w-full text-left px-3 py-2 rounded-xl hover:opacity-95"
                    style={rowStyle}
                  >
                    <span style={{ color: it.danger ? "rgba(239,68,68,0.95)" : "var(--text)" }}>{it.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 px-3 pb-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
                style={surfaceSoft}
              >
                <span style={{ color: "var(--text)" }}>Abmelden</span>
              </button>
            </div>
          </div>

          <div className="tq-surface p-4 space-y-3">{renderSectionContent(section)}</div>
        </div>
      </div>
    </div>
  );
}
