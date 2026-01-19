// src/pages/SettingPage.tsx
import { useCallback, useMemo, useState, useEffect } from "react";
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

// ✅ NEW: Import icons or use text if no icon lib
// import { ... } from "lucide-react"; 

type SettingsSection =
  | "profile"
  | "account"
  | "notifications"
  | "integrations"
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
  onOpenGoals?: () => void;
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
  const { isPro } = useEntitlements(user?.id);

  const [section, setSection] = useState<SettingsSection>("theme");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");
  const [units, setUnits] = useState<"metric" | "imperial">(() => {
    if (typeof window === "undefined") return "metric";
    const stored = getScopedItem("trainq_units");
    return (stored === "imperial" ? "imperial" : "metric") as "metric" | "imperial";
  });

  // Notifications state (localStorage persistence)
  const [notifTraining, setNotifTraining] = useState(() => getScopedItem("trainq_notif_training") !== "false");
  const [notifWeekly, setNotifWeekly] = useState(() => getScopedItem("trainq_notif_weekly") !== "false");

  // Integrations state (Garmin)
  const [garminConnected, setGarminConnected] = useState(false);

  // Status Check Effect
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Dynamic import to avoid circular dependencies if any, though likely fine to import static
        const { getSupabaseClient } = await import("../lib/supabaseClient");
        const client = getSupabaseClient();
        const { data } = await client?.auth.getSession() || {};
        const token = data?.session?.access_token;

        if (!token) return;

        const res = await fetch("/api/garmin/status", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setGarminConnected(json.connected);
        }
      } catch (e) {
        console.warn("Failed to check garmin status", e);
      }
    })();
  }, [user]);

  const [theme, setThemeState] = useState<ThemeMode>(() => loadTheme("dark"));

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

  const openExternalUrl = useCallback((url: string) => {
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform()) {
      window.open(url, "_blank");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

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
    } catch (e: unknown) {
      const msg = String((e as any)?.message ?? t("settings.alert.restoreFailed"));
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

  const menuItems = useMemo<{ key: string; label: string; kind: "section" }[]>(
    () => [
      { key: "profile", label: t("settings.section.profile"), kind: "section" },
      { key: "account", label: t("settings.section.account"), kind: "section" },
      { key: "notifications", label: t("settings.section.notifications"), kind: "section" },
      { key: "integrations", label: t("settings.section.integrations"), kind: "section" }, // New
      { key: "units", label: t("settings.section.units"), kind: "section" },
      { key: "language", label: t("settings.section.language"), kind: "section" },
      { key: "theme", label: t("settings.section.theme"), kind: "section" },
      { key: "pro", label: t("settings.section.pro"), kind: "section" },
      { key: "data", label: t("settings.section.data"), kind: "section" },
      { key: "legal", label: t("settings.section.legal"), kind: "section" },
      { key: "help", label: t("settings.section.help"), kind: "section" },
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

  const onMenuClick = useCallback((k: string) => {
    setSection((prev) => (prev === (k as SettingsSection) ? prev : (k as SettingsSection)));
  }, []);

  const toggleNotifTraining = () => {
    const newVal = !notifTraining;
    setNotifTraining(newVal);
    setScopedItem("trainq_notif_training", String(newVal));
  }

  const toggleNotifWeekly = () => {
    const newVal = !notifWeekly;
    setNotifWeekly(newVal);
    setScopedItem("trainq_notif_weekly", String(newVal));
  }

  // Handle Garmin Connect
  const handleGarminConnect = () => {
    // Redirect to backend auth endpoint
    const redirectUrl = "/api/garmin/auth";
    window.location.href = redirectUrl;
  };

  const handleGarminDisconnect = async () => {
    // Call disconnect API
    const ok = window.confirm(t("settings.confirm.disconnectGarmin"));
    if (ok) {
      try {
        const { getSupabaseClient } = await import("../lib/supabaseClient");
        const client = getSupabaseClient();
        const { data } = await client?.auth.getSession() || {};
        const token = data?.session?.access_token;

        if (!token) return;

        const res = await fetch("/api/garmin/disconnect", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          setGarminConnected(false);
        } else {
          alert(t("settings.alert.disconnectFailed"));
        }
      } catch (e) {
        console.error(e);
        alert(t("settings.alert.disconnectError"));
      }
    }
  };


  // -------- Renderers --------

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
  );

  // Helper classes for consistent styling
  const cardClass = "rounded-xl p-4 space-y-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]";
  const btnClass = "w-full rounded-xl px-4 py-2 text-sm bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] hover:brightness-110 active:scale-[0.98] transition-all";
  const btnPrimaryClass = "rounded-full px-4 py-2 text-sm font-semibold bg-[#2563EB] text-white hover:bg-sky-500 transition-colors";

  const ProfilePanel = () => (
    <>
      <SectionHeader title={t("settings.section.profile")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.profile.subtitle")}</p>
        {onOpenGoals && (
          <button type="button" onClick={onOpenGoals} className={btnPrimaryClass + " w-full rounded-xl py-3"}>
            {t("settings.profile.goals")}
          </button>
        )}
        <p className="text-sm pt-2 opacity-60">
          {t("settings.profile.name", { value: user?.displayName || user?.email || t("settings.value.unset") })}
        </p>
      </div>
    </>
  );

  const AccountPanel = () => (
    <>
      <SectionHeader title={t("settings.section.account")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.account.email", { value: user?.email || t("settings.value.unset") })}</p>
        <button type="button" onClick={handleLogout} className={btnClass}>
          {t("settings.account.logout")}
        </button>
        <div className="pt-2 border-t border-[var(--border)]">
          <button type="button" onClick={handleDeleteAccount} className="w-full rounded-xl px-4 py-2 text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20">
            {t("settings.account.deleteProfile")}
          </button>
        </div>
      </div>
    </>
  );

  const NotificationsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.notifications")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.notifications.subtitle")}</p>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface2)] cursor-pointer">
            <span className="text-base">{t("settings.notifications.trainingReminders")}</span>
            <input type="checkbox" checked={notifTraining} onChange={toggleNotifTraining} className="rounded h-5 w-5 accent-blue-600" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface2)] cursor-pointer">
            <span className="text-base">{t("settings.notifications.weeklySummary")}</span>
            <input type="checkbox" checked={notifWeekly} onChange={toggleNotifWeekly} className="rounded h-5 w-5 accent-blue-600" />
          </label>
        </div>
        <p className="text-sm pt-2 opacity-60">{t("settings.notifications.note")}</p>
      </div>
    </>
  );

  const IntegrationsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.integrations")} />
      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Garmin Icon Placeholder */}
            <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white font-bold text-xs">G</div>
            <span className="font-medium">{t("settings.integrations.garmin")}</span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${garminConnected ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"}`}>
            {garminConnected ? t("settings.integrations.connected") : t("settings.integrations.notConnected")}
          </span>
        </div>

        {garminConnected ? (
          <button onClick={handleGarminDisconnect} className={btnClass}>{t("settings.integrations.disconnect")}</button>
        ) : (
          <button onClick={handleGarminConnect} className={btnClass}>{t("settings.integrations.connect")}</button>
        )}
        <p className="text-xs opacity-50">{t("settings.integrations.syncNote")}</p>
      </div>
    </>
  )

  const UnitsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.units")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.units.subtitle")}</p>
        <div className="inline-flex rounded-full p-1 text-base bg-[var(--surface2)] border border-[var(--border)]">
          <button type="button" onClick={() => { setUnits("metric"); setScopedItem("trainq_units", "metric"); }} className={`px-4 py-1.5 rounded-full transition ${units === "metric" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}>
            {t("settings.units.metric")}
          </button>
          <button type="button" onClick={() => { setUnits("imperial"); setScopedItem("trainq_units", "imperial"); }} className={`px-4 py-1.5 rounded-full transition ${units === "imperial" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}>
            {t("settings.units.imperial")}
          </button>
        </div>
        <p className="text-sm opacity-60">{t("settings.units.note")}</p>
      </div>
    </>
  );

  const LegalPanel = () => (
    <>
      <SectionHeader title={t("settings.section.legal")} />

      <div className={cardClass}>
        {/* Quick Links to dedicated pages */}
        <button onClick={() => { window.history.pushState({}, "", "/privacy"); window.dispatchEvent(new PopStateEvent("popstate")); }} className={btnClass + " text-left justify-between flex items-center"}>
          <span>{t("settings.legal.tab.privacy")}</span>
          <span className="opacity-50">→</span>
        </button>
        <button onClick={() => { window.history.pushState({}, "", "/impressum"); window.dispatchEvent(new PopStateEvent("popstate")); }} className={btnClass + " text-left justify-between flex items-center"}>
          <span>{t("settings.legal.tab.imprint")}</span>
          <span className="opacity-50">→</span>
        </button>
        <button onClick={() => { window.history.pushState({}, "", "/terms"); window.dispatchEvent(new PopStateEvent("popstate")); }} className={btnClass + " text-left justify-between flex items-center"}>
          <span>{t("settings.legal.tab.terms")}</span>
          <span className="opacity-50">→</span>
        </button>
      </div>
    </>
  );

  const LanguagePanel = () => (
    <>
      <SectionHeader title={t("settings.section.language")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.language.subtitle")}</p>
        <div className="inline-flex rounded-full p-1 text-base bg-[var(--surface2)] border border-[var(--border)]">
          <button type="button" onClick={() => setLang("de")} className={`px-4 py-1.5 rounded-full transition ${lang === "de" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}>
            {t("language.de")}
          </button>
          <button type="button" onClick={() => setLang("en")} className={`px-4 py-1.5 rounded-full transition ${lang === "en" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}>
            {t("language.en")}
          </button>
        </div>
      </div>
    </>
  );

  const ThemePanel = () => (
    <>
      <SectionHeader title={t("settings.section.theme")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.theme.subtitle")}</p>
        <div className="inline-flex rounded-full p-1 text-base bg-[var(--surface2)] border border-[var(--border)]">
          <button type="button" onClick={() => { setThemeGlobal("light"); setThemeState("light"); }} className={`px-4 py-1.5 rounded-full transition ${theme === "light" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}>
            {t("settings.theme.light")}
          </button>
          <button type="button" onClick={() => { setThemeGlobal("dark"); setThemeState("dark"); }} className={`px-4 py-1.5 rounded-full transition ${theme === "dark" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}>
            {t("settings.theme.dark")}
          </button>
        </div>
      </div>
    </>
  );

  const ProPanel = () => (
    <>
      <SectionHeader title={t("settings.section.pro")} />
      <div className={cardClass}>
        {isPro ? (
          <div className="flex items-center gap-2 text-green-400 font-semibold">
            <span>✅</span>
            <span>{t("settings.pro.active")}</span>
          </div>
        ) : (
          <div className="text-gray-400">{t("settings.alert.noActiveSubscription")}</div>
        )}

        {!isPro && (
          <button onClick={openPaywall} className={btnPrimaryClass + " w-full mt-2"}>{t("settings.pro.buy")}</button>
        )}
        <button onClick={handleRestorePurchases} className={btnClass + " mt-2"}>{t("settings.pro.restorePurchases")}</button>
      </div>
    </>
  );

  const DataPanel = () => (
    <>
      <SectionHeader title={t("settings.section.data")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.data.subtitle")}</p>
        <div className="space-y-2 pt-2">
          <button onClick={handleClearCalendar} className="w-full text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 hover:bg-red-500/20">{t("settings.data.clearCalendar")}</button>
          <button onClick={handleClearHistory} className="w-full text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 hover:bg-red-500/20">{t("settings.data.clearHistory")}</button>
        </div>
      </div>
    </>
  );

  const HelpPanel = () => (
    <>
      <SectionHeader title={t("settings.section.help")} />
      <div className={cardClass}>
        <p className="text-sm opacity-70">{t("settings.help.version")}</p>
        <p className="text-xs opacity-50">TrainQ Inc.</p>
        <button className={btnClass} onClick={() => window.open("mailto:support@trainq.app")}>{t("settings.help.contact")}</button>
      </div>
    </>
  );

  const renderSectionContent = (k: SettingsSection) => {
    switch (k) {
      case "profile": return <ProfilePanel />;
      case "account": return <AccountPanel />;
      case "notifications": return <NotificationsPanel />;
      case "integrations": return <IntegrationsPanel />;
      case "units": return <UnitsPanel />;
      case "legal": return <LegalPanel />;
      case "language": return <LanguagePanel />;
      case "theme": return <ThemePanel />;
      case "pro": return <ProPanel />;
      case "data": return <DataPanel />;
      case "help": return <HelpPanel />;
      default: return null;
    }
  };

  // -------- Layout --------
  // bg-brand-bg corresponds to var(--bg) now in tailwind config
  return (
    <div className="h-full w-full overflow-y-auto bg-brand-bg text-[var(--text)] px-4 py-5" style={{ paddingTop: `calc(1.25rem + ${safeTop})`, paddingBottom: `calc(5rem + ${safeBottom})` }}>
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-gray-400 hover:brightness-110"
              title={t("common.back")}
            >
              {"<"}
            </button>
            <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
          </div>
          {!isPro && (
            <button
              type="button"
              onClick={openPaywall}
              className={btnPrimaryClass}
            >
              {t("settings.pro.buy")}
            </button>
          )}
        </div>

        {/* MOBILE: Accordion */}
        <div className="md:hidden space-y-3">
          <div className={`${cardClass} p-2`}>
            <div className="space-y-1">
              {menuItems.map((it) => {
                const isActive = section === it.key;
                return (
                  <div key={it.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onMenuClick(it.key)}
                      className="w-full text-left px-3 py-3 rounded-xl hover:bg-[var(--surface2)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-medium opacity-90">{it.label}</span>
                        <span className="text-lg opacity-50">{isActive ? "–" : "+"}</span>
                      </div>
                    </button>
                    {isActive && (
                      <div className="rounded-xl p-3 space-y-3 bg-[var(--bg)]/30 border border-[var(--border)]">
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
          <div className={`${cardClass} p-2`}>
            <div className="space-y-1">
              {menuItems.map((it) => {
                const isActive = section === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onMenuClick(it.key)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition ${isActive ? "bg-[var(--surface2)] font-semibold" : "hover:bg-[var(--surface2)] opacity-80"}`}
                  >
                    <span className="text-base">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">
            {renderSectionContent(section)}
          </div>
        </div>
      </div>
    </div>
  );
}
