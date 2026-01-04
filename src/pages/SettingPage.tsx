// src/pages/SettingPage.tsx
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useAuth } from "../hooks/useAuth";

import { loadTheme, setTheme as setThemeGlobal, type ThemeMode } from "../utils/theme";
import { resetOnboardingInStorage } from "../context/OnboardingContext";

type SettingsSection = "notifications" | "legal" | "language" | "theme";
type LegalTab = "privacy" | "imprint" | "terms";

interface SettingPageProps {
  onBack: () => void;
  onClearCalendar?: () => void; // aktuell nicht genutzt (liegt bei dir im Profil / Critical Actions)
  onOpenPaywall?: () => void;
}

export default function SettingPage({
  onBack,
  onClearCalendar: _onClearCalendar, // bewusst ungenutzt
  onOpenPaywall,
}: SettingPageProps) {
  const safeTop = "env(safe-area-inset-top, 0px)";
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  const { user, logout } = useAuth();
  const isPro = user?.isPro === true;

  const [section, setSection] = useState<SettingsSection>("theme");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");

  // ✅ Theme State nur für UI-Anzeige; DOM/Storage macht utils/theme.ts zentral
  const [theme, setThemeState] = useState<ThemeMode>(() => loadTheme("dark"));

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

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
      { key: "notifications", label: "Benachrichtigungen", kind: "section" as const },
      { key: "legal", label: "Rechtliches", kind: "section" as const },
      { key: "language", label: "Sprache", kind: "section" as const },
      { key: "theme", label: "Theme", kind: "section" as const },

      { key: "subscription", label: "Abonnement verwalten", kind: "action" as const },
      { key: "faq", label: "Häufig gestellte Fragen", kind: "action" as const },
      { key: "rate", label: "Bewerte TrainQ", kind: "action" as const },
      { key: "contact", label: "Kontaktiere uns", kind: "action" as const },
      { key: "about", label: "Über uns", kind: "action" as const },
      { key: "help", label: "Hilfe", kind: "action" as const },

      // ✅ NEU
      { key: "restart_onboarding", label: "Onboarding erneut starten", kind: "action" as const },

      { key: "delete", label: "Profil löschen", kind: "action" as const, danger: true },
    ],
    []
  );

  const onMenuClick = useCallback(
    (k: string, kind: "section" | "action") => {
      if (kind === "section") {
        setSection((prev) => (prev === (k as SettingsSection) ? prev : (k as SettingsSection)));
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
      if (k === "restart_onboarding") return handleRestartOnboarding();

      if (k === "delete") return alert("Profil löschen kommt später (Server-Deletion).");
    },
    [isPro, openPaywall, handleRestartOnboarding]
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

  const NotificationsPanel = () => (
    <>
      <SectionHeader title="Benachrichtigungen" />
      <div className="rounded-xl p-3 text-[11px]" style={surfaceSoft}>
        <div style={muted}>Kommt später (Push/Local Notifications).</div>
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

      <div className="rounded-xl p-3 text-[11px]" style={surfaceSoft}>
        <div style={muted}>
          {legalTab === "privacy" && "Datenschutz-Text kommt später."}
          {legalTab === "imprint" && "Impressum kommt später."}
          {legalTab === "terms" && "AGB kommt später."}
        </div>
      </div>
    </>
  );

  const LanguagePanel = () => (
    <>
      <SectionHeader title="Sprache" />
      <div className="rounded-xl p-3 text-[11px]" style={surfaceSoft}>
        <div style={muted}>Kommt später (i18n).</div>
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

  const renderSectionContent = (k: SettingsSection) => {
    if (k === "notifications") return <NotificationsPanel />;
    if (k === "legal") return <LegalPanel />;
    if (k === "language") return <LanguagePanel />;
    return <ThemePanel />;
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