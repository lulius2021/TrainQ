// src/pages/SettingPage.tsx
import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../hooks/useAuth";
import { useEntitlements } from "../hooks/useEntitlements";
import { isBillingSupported, restorePurchases, syncProToSession } from "../services/purchases";
import { useI18n } from "../i18n/useI18n";

import { loadTheme, setTheme as setThemeGlobal, type ThemeMode } from "../utils/theme";
import { clearUserScopedData, getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { resetOnboardingInStorage } from "../context/OnboardingContext";
import { clearWorkoutHistory } from "../utils/workoutHistory";
import { clearCalendarWorkouts } from "../utils/trainqStorage";
import { debugEndLiveActivity, debugStartLiveActivity } from "../native/liveActivity";

type SettingsSection =
  | "profile"
  | "account"
  | "notifications"
  | "units"
  | "legal"
  | "language"
  | "theme"
  | "pro"
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
  const { t, lang, setLang } = useI18n();
  const { isPro, adaptiveBCRemaining, planShiftRemaining, calendar7DaysRemaining } = useEntitlements(user?.id);

  const [section, setSection] = useState<SettingsSection>("theme");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");
  const [units, setUnits] = useState<"metric" | "imperial">(() => {
    if (typeof window === "undefined") return "metric";
    const stored = getScopedItem("trainq_units");
    return (stored === "imperial" ? "imperial" : "metric") as "metric" | "imperial";
  });

  // ✅ Theme State nur für UI-Anzeige; DOM/Storage macht utils/theme.ts zentral
  const [theme, setThemeState] = useState<ThemeMode>(() => loadTheme("dark"));
  const [liveActivityDebug, setLiveActivityDebug] = useState<string>("");

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
        alert(t("settings.alert.purchasesUnavailable"));
        return;
      }

      const nextIsPro = await restorePurchases();
      await syncProToSession({ id: user.id, email: user.email });

      if (!nextIsPro) {
        alert(t("settings.alert.noActiveSubscription"));
      }
    } catch (e: any) {
      const msg = String(e?.message ?? t("settings.alert.restoreFailed"));
      alert(msg);
    }
  }, [t, user]);

  const handleLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(t("settings.confirm.logout"));
    if (!ok) return;
    logout();
    onBack();
  }, [logout, onBack, t]);

  // ✅ Onboarding erneut starten (Reset + Reload, damit Gate sauber greift)
  const handleRestartOnboarding = useCallback(() => {
    if (typeof window === "undefined") return;

    const ok = window.confirm(t("settings.confirm.restartOnboarding"));
    if (!ok) return;

    resetOnboardingInStorage();

    // optional: falls du irgendwo Listener nutzt
    window.dispatchEvent(new CustomEvent("trainq:restart_onboarding"));

    // safest: App neu laden -> Onboarding-Gate greift sicher
    window.location.reload();
  }, []);

  type MenuItem = { key: string; label: string; kind: "section"; danger?: boolean };

  const menuItems = useMemo<MenuItem[]>(
    () => [
      { key: "profile", label: t("settings.section.profile"), kind: "section" as const },
      { key: "account", label: t("settings.section.account"), kind: "section" as const },
      { key: "notifications", label: t("settings.section.notifications"), kind: "section" as const },
      { key: "units", label: t("settings.section.units"), kind: "section" as const },
      { key: "language", label: t("settings.section.language"), kind: "section" as const },
      { key: "theme", label: t("settings.section.theme"), kind: "section" as const },
      { key: "pro", label: t("settings.section.pro"), kind: "section" as const },
      { key: "data", label: t("settings.section.data"), kind: "section" as const },
      { key: "legal", label: t("settings.section.legal"), kind: "section" as const },
      { key: "help", label: t("settings.section.help"), kind: "section" as const },
    ],
    [t]
  );

  const handleDeleteAccount = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(t("settings.confirm.deleteProfile"));
    if (!ok) return;
    
    if (typeof window !== "undefined") {
      try {
        if (user?.id) {
          clearUserScopedData(user.id);
        }
        alert(t("settings.alert.profileDeleted"));
        window.location.reload();
      } catch {
        alert(t("settings.alert.profileDeleteError"));
      }
    }
  }, [t, user?.id]);

  const handleClearCalendar = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(t("settings.confirm.clearCalendar"));
    if (!ok) return;
    
    clearCalendarWorkouts();
    if (onClearCalendar) onClearCalendar();
    alert(t("settings.alert.calendarCleared"));
  }, [onClearCalendar, t]);

  const handleClearHistory = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(t("settings.confirm.clearHistory"));
    if (!ok) return;
    
    clearWorkoutHistory();
    alert(t("settings.alert.historyCleared"));
  }, [t]);

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
    <h3 className="text-lg font-semibold text-white">{title}</h3>
  );

  const ProfilePanel = () => (
    <>
      <SectionHeader title={t("settings.section.profile")} />
      <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
        <p className="text-sm text-gray-300">{t("settings.profile.subtitle")}</p>
        {onOpenGoals && (
          <button type="button" onClick={onOpenGoals} className="w-full rounded-xl px-4 py-3 text-base font-semibold bg-[#2563EB] text-white hover:bg-sky-500">
            {t("settings.profile.goals")}
          </button>
        )}
        <p className="text-sm pt-2 text-gray-400">
          {t("settings.profile.name", { value: user?.displayName || user?.email || t("settings.value.unset") })}
        </p>
      </div>
    </>
  );

  const AccountPanel = () => (
    <>
      <SectionHeader title={t("settings.section.account")} />
      <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
        <p className="text-sm text-gray-300">{t("settings.account.email", { value: user?.email || t("settings.value.unset") })}</p>
        <button type="button" onClick={handleLogout} className="w-full rounded-xl px-4 py-2 text-sm bg-white/10 border border-white/10 text-white hover:bg-white/20">
          {t("settings.account.logout")}
        </button>
        <div className="pt-2 border-t border-white/10">
          <button type="button" onClick={handleDeleteAccount} className="w-full rounded-xl px-4 py-2 text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20">
            {t("settings.account.deleteProfile")}
          </button>
        </div>
      </div>
    </>
  );

  const NotificationsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.notifications")} />
      <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
        <p className="text-sm text-gray-300">{t("settings.notifications.subtitle")}</p>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <span className="text-base text-white">{t("settings.notifications.trainingReminders")}</span>
            <input type="checkbox" defaultChecked className="rounded h-5 w-5" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <span className="text-base text-white">{t("settings.notifications.weeklySummary")}</span>
            <input type="checkbox" defaultChecked className="rounded h-5 w-5" />
          </label>
        </div>
        <p className="text-sm pt-2 text-gray-400">{t("settings.notifications.note")}</p>
      </div>
    </>
  );

  const UnitsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.units")} />
      <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
        <p className="text-sm text-gray-300">{t("settings.units.subtitle")}</p>
        <div className="inline-flex rounded-full p-1 text-base bg-white/5 border border-white/10">
          <button type="button" onClick={() => { setUnits("metric"); setScopedItem("trainq_units", "metric"); }} className={`px-4 py-1.5 rounded-full transition ${units === "metric" ? "bg-[#2563EB] text-white" : "text-gray-300"}`}>
            {t("settings.units.metric")}
          </button>
          <button type="button" onClick={() => { setUnits("imperial"); setScopedItem("trainq_units", "imperial"); }} className={`px-4 py-1.5 rounded-full transition ${units === "imperial" ? "bg-[#2563EB] text-white" : "text-gray-300"}`}>
            {t("settings.units.imperial")}
          </button>
        </div>
        <p className="text-sm text-gray-400">{t("settings.units.note")}</p>
      </div>
    </>
  );

  const LegalPanel = () => (
    <>
      <SectionHeader title={t("settings.section.legal")} />
      <div className="inline-flex rounded-full p-1 text-base bg-white/5 border border-white/10">
        {[
          ["privacy", t("settings.legal.tab.privacy")],
          ["imprint", t("settings.legal.tab.imprint")],
          ["terms", t("settings.legal.tab.terms")],
        ].map(([k, label]) => (
          <button key={k} type="button" onClick={() => setLegalTab(k as LegalTab)} className={`px-3 py-1 rounded-full transition text-sm ${legalTab === k ? "bg-[#2563EB] text-white" : "text-gray-300"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="rounded-xl p-4 space-y-3 text-sm bg-white/5 border border-white/10">
        {/* ... Legal text ... */}
      </div>
    </>
  );

  const LanguagePanel = () => (
    <>
      <SectionHeader title={t("settings.section.language")} />
      <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
        <p className="text-sm text-gray-300">{t("settings.language.subtitle")}</p>
        <div className="inline-flex rounded-full p-1 text-base bg-white/5 border border-white/10">
          <button type="button" onClick={() => setLang("de")} className={`px-4 py-1.5 rounded-full transition ${lang === "de" ? "bg-[#2563EB] text-white" : "text-gray-300"}`}>
            {t("language.de")}
          </button>
          <button type="button" onClick={() => setLang("en")} className={`px-4 py-1.5 rounded-full transition ${lang === "en" ? "bg-[#2563EB] text-white" : "text-gray-300"}`}>
            {t("language.en")}
          </button>
        </div>
        <p className="text-sm text-gray-400">{t("settings.language.note")}</p>
      </div>
    </>
  );

  const ThemePanel = () => (
    <>
      <SectionHeader title={t("settings.section.theme")} />
      <div className="rounded-xl p-4 space-y-3 bg-white/5 border border-white/10">
        <p className="text-sm text-gray-300">{t("settings.theme.subtitle")}</p>
        <div className="inline-flex rounded-full p-1 text-base bg-white/5 border border-white/10">
          <button type="button" onClick={() => { setThemeGlobal("light"); setThemeState("light"); }} className={`px-4 py-1.5 rounded-full transition ${theme === "light" ? "bg-[#2563EB] text-white" : "text-gray-300"}`}>
            {t("settings.theme.light")}
          </button>
          <button type="button" onClick={() => { setThemeGlobal("dark"); setThemeState("dark"); }} className={`px-4 py-1.5 rounded-full transition ${theme === "dark" ? "bg-[#2563EB] text-white" : "text-gray-300"}`}>
            {t("settings.theme.dark")}
          </button>
        </div>
        <p className="text-sm text-gray-400">{t("settings.theme.note")}</p>
      </div>
    </>
  );

  const ProPanel = () => { /* ... */ };
  const DataPanel = () => { /* ... */ };
  const HelpPanel = () => { /* ... */ };

  const renderSectionContent = (k: SettingsSection) => {
    // ...
  };

  // -------- Layout --------
  return (
    <div className="h-full w-full overflow-y-auto bg-[#061226] text-white px-4 py-5" style={{ paddingTop: `calc(1.25rem + ${safeTop})`, paddingBottom: `calc(5rem + ${safeBottom})` }}>
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
              title={t("common.back")}
            >
              {"<"}
            </button>
            <h1 className="text-2xl font-bold text-white">{t("settings.title")}</h1>
          </div>
          {!isPro && (
            <button
              type="button"
              onClick={openPaywall}
              className="rounded-full px-4 py-2 text-sm font-semibold bg-[#2563EB] text-white hover:bg-sky-500"
            >
              {t("settings.pro.buy")}
            </button>
          )}
        </div>

        {/* MOBILE: Accordion */}
        <div className="md:hidden space-y-3">
          <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-[24px] p-2">
            <div className="space-y-1">
              {menuItems.map((it) => {
                const isActive = section === it.key;
                return (
                  <div key={it.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onMenuClick(it.key, it.kind)}
                      className="w-full text-left px-3 py-3 rounded-xl bg-white/5 hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base text-white">{it.label}</span>
                        <span className="text-lg text-gray-400">{isActive ? "–" : "+"}</span>
                      </div>
                    </button>
                    {isActive && (
                      <div className="rounded-xl p-4 space-y-3 bg-black/20">
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
        <div className="hidden md:grid grid-cols-[280px_1fr] gap-6">
          <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-[24px] p-2">
            <div className="space-y-1">
              {menuItems.map((it) => {
                const isActive = section === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onMenuClick(it.key, it.kind)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
                  >
                    <span className="text-base text-white">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-[24px] p-6 space-y-4">
            {renderSectionContent(section)}
          </div>
        </div>
      </div>
    </div>
  );
}
