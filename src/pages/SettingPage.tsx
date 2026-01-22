// src/pages/SettingPage.tsx
import { useCallback, useMemo, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { PageHeader } from "../components/ui/PageHeader";
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

  const { user, logout, resetOnboarding } = useAuth();
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

  const handleResetOnboarding = useCallback(async () => {
    if (typeof window === "undefined" || !user?.id) return;
    const ok = window.confirm(t("settings.confirm.resetOnboarding"));
    if (!ok) return;

    try {
      await resetOnboarding();
      // AuthGate will reactively show Onboarding component
    } catch (error) {
      console.error("[Settings] Reset onboarding failed:", error);
      alert(t("settings.alert.resetOnboardingFailed"));
    }
  }, [t, user?.id, resetOnboarding]);

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

  // -------- Renderers --------

  const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-xl font-bold tracking-tight text-[var(--text)] mb-3 px-1">{title}</h3>
  );

  const ProfilePanel = () => (
    <>
      <SectionHeader title={t("settings.section.profile")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30">
        <p className="text-sm opacity-70 mb-3">{t("settings.profile.subtitle")}</p>
        {onOpenGoals && (
          <AppButton onClick={onOpenGoals} fullWidth className="mb-3">
            {t("settings.profile.goals")}
          </AppButton>
        )}
        <p className="text-sm pt-2 opacity-60">
          {t("settings.profile.name")}: <span className="text-[var(--text)] opacity-100 font-medium">{user?.displayName || user?.email || t("settings.value.unset")}</span>
        </p>
      </AppCard>
    </>
  );

  const AccountPanel = () => (
    <>
      <SectionHeader title={t("settings.section.account")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-3">
        <p className="text-sm opacity-70">
          {t("settings.account.email")}: <span className="text-[var(--text)] opacity-100 font-medium">{user?.email || t("settings.value.unset")}</span>
        </p>
        <AppButton onClick={handleLogout} variant="secondary" fullWidth className="bg-white/25 hover:bg-white/35 text-white">
          {t("settings.account.logout")}
        </AppButton>
        <div className="pt-2 border-t border-[var(--border)]">
          <AppButton onClick={handleDeleteAccount} variant="danger" fullWidth className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
            {t("settings.account.deleteProfile")}
          </AppButton>
        </div>
      </AppCard>
    </>
  );

  const NotificationsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.notifications")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-3">
        <p className="text-sm opacity-70">{t("settings.notifications.subtitle")}</p>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-white/20 border border-white/30 cursor-pointer transition active:scale-[0.98]">
            <span className="text-base font-medium">{t("settings.notifications.trainingReminders")}</span>
            <input type="checkbox" checked={notifTraining} onChange={toggleNotifTraining} className="rounded h-5 w-5 accent-[var(--primary)]" />
          </label>
          <label className="flex items-center justify-between p-3 rounded-2xl bg-white/20 border border-white/30 cursor-pointer transition active:scale-[0.98]">
            <span className="text-base font-medium">{t("settings.notifications.weeklySummary")}</span>
            <input type="checkbox" checked={notifWeekly} onChange={toggleNotifWeekly} className="rounded h-5 w-5 accent-[var(--primary)]" />
          </label>
        </div>
        <p className="text-sm pt-2 opacity-60">{t("settings.notifications.note")}</p>
      </AppCard>
    </>
  );

  const IntegrationsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.integrations")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Garmin Icon Placeholder */}
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/10">G</div>
            <span className="font-semibold text-lg">{t("settings.integrations.garmin")}</span>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${garminConnected ? "bg-green-500/20 text-green-500" : "bg-white/10 text-[var(--muted)]"}`}>
            {garminConnected ? t("settings.integrations.connected") : t("settings.integrations.notConnected")}
          </span>
        </div>

        {garminConnected ? (
          <AppButton onClick={handleGarminDisconnect} variant="secondary" fullWidth className="bg-white/25 hover:bg-white/35 text-white">{t("settings.integrations.disconnect")}</AppButton>
        ) : (
          <AppButton onClick={handleGarminConnect} variant="primary" fullWidth>{t("settings.integrations.connect")}</AppButton>
        )}
        <p className="text-xs opacity-50 px-1">{t("settings.integrations.syncNote")}</p>
      </AppCard>
    </>
  );

  const UnitsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.units")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-3">
        <p className="text-sm opacity-70">{t("settings.units.subtitle")}</p>
        <div className="flex bg-white/20 border border-white/30 rounded-xl p-1 w-fit">
          <button type="button" onClick={() => { setUnits("metric"); setScopedItem("trainq_units", "metric"); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${units === "metric" ? "bg-white/40 shadow-sm text-[var(--text)]" : "text-[var(--text)] opacity-60 hover:opacity-100"}`}>
            {t("settings.units.metric")}
          </button>
          <button type="button" onClick={() => { setUnits("imperial"); setScopedItem("trainq_units", "imperial"); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${units === "imperial" ? "bg-white/40 shadow-sm text-[var(--text)]" : "text-[var(--text)] opacity-60 hover:opacity-100"}`}>
            {t("settings.units.imperial")}
          </button>
        </div>
        <p className="text-sm opacity-60">{t("settings.units.note")}</p>
      </AppCard>
    </>
  );

  const LegalPanel = () => (
    <>
      <SectionHeader title={t("settings.section.legal")} />

      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-2">
        <AppButton onClick={() => { window.history.pushState({}, "", "/privacy"); window.dispatchEvent(new PopStateEvent("popstate")); }} variant="secondary" fullWidth className="justify-between bg-white/25 hover:bg-white/35 text-white">
          <span>{t("settings.legal.tab.privacy")}</span>
          <span className="opacity-50">→</span>
        </AppButton>
        <AppButton onClick={() => { window.history.pushState({}, "", "/impressum"); window.dispatchEvent(new PopStateEvent("popstate")); }} variant="secondary" fullWidth className="justify-between bg-white/25 hover:bg-white/35 text-white">
          <span>{t("settings.legal.tab.imprint")}</span>
          <span className="opacity-50">→</span>
        </AppButton>
        <AppButton onClick={() => { window.history.pushState({}, "", "/terms"); window.dispatchEvent(new PopStateEvent("popstate")); }} variant="secondary" fullWidth className="justify-between bg-white/25 hover:bg-white/35 text-white">
          <span>{t("settings.legal.tab.terms")}</span>
          <span className="opacity-50">→</span>
        </AppButton>
      </AppCard>
    </>
  );

  const LanguagePanel = () => (
    <>
      <SectionHeader title={t("settings.section.language")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-3">
        <p className="text-sm opacity-70">{t("settings.language.subtitle")}</p>
        <div className="flex bg-white/20 border border-white/30 rounded-xl p-1 w-fit">
          <button type="button" onClick={() => setLang("de")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${lang === "de" ? "bg-white/40 shadow-sm text-[var(--text)]" : "text-[var(--text)] opacity-60 hover:opacity-100"}`}>
            {t("language.de")}
          </button>
          <button type="button" onClick={() => setLang("en")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${lang === "en" ? "bg-white/40 shadow-sm text-[var(--text)]" : "text-[var(--text)] opacity-60 hover:opacity-100"}`}>
            {t("language.en")}
          </button>
        </div>
      </AppCard>
    </>
  );

  const ThemePanel = () => (
    <>
      <SectionHeader title={t("settings.section.theme")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-3">
        <p className="text-sm opacity-70">{t("settings.theme.subtitle")}</p>
        <div className="flex bg-white/20 border border-white/30 rounded-xl p-1 w-fit">
          <button type="button" onClick={() => { setThemeGlobal("light"); setThemeState("light"); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${theme === "light" ? "bg-white/40 shadow-sm text-[var(--text)]" : "text-[var(--text)] opacity-60 hover:opacity-100"}`}>
            {t("settings.theme.light")}
          </button>
          <button type="button" onClick={() => { setThemeGlobal("dark"); setThemeState("dark"); }} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${theme === "dark" ? "bg-white/40 shadow-sm text-[var(--text)]" : "text-[var(--text)] opacity-60 hover:opacity-100"}`}>
            {t("settings.theme.dark")}
          </button>
        </div>
      </AppCard>
    </>
  );

  const ProPanel = () => (
    <>
      <SectionHeader title={t("settings.section.pro")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-3">
        {isPro ? (
          <div className="flex items-center gap-2 text-green-400 font-semibold p-2 bg-green-500/10 rounded-xl justify-center">
            <span>✅</span>
            <span>{t("settings.pro.active")}</span>
          </div>
        ) : (
          <div className="text-[var(--muted)] bg-[var(--surface2)] rounded-xl p-3 text-center">{t("settings.alert.noActiveSubscription")}</div>
        )}

        {!isPro && (
          <AppButton onClick={openPaywall} variant="primary" fullWidth className="mt-2">{t("settings.pro.buy")}</AppButton>
        )}
        <AppButton onClick={handleRestorePurchases} variant="secondary" fullWidth className="mt-2 text-sm bg-white/25 hover:bg-white/35 text-white">{t("settings.pro.restorePurchases")}</AppButton>
      </AppCard>
    </>
  );

  const DataPanel = () => (
    <>
      <SectionHeader title={t("settings.section.data")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30 space-y-2">
        <p className="text-sm opacity-70">{t("settings.data.subtitle")}</p>
        <div className="space-y-2 pt-2">
          <AppButton onClick={handleClearCalendar} variant="danger" fullWidth className="bg-red-500/10 text-red-500 border-red-500/20">{t("settings.data.clearCalendar")}</AppButton>
          <AppButton onClick={handleClearHistory} variant="danger" fullWidth className="bg-red-500/10 text-red-500 border-red-500/20">{t("settings.data.clearHistory")}</AppButton>
          <AppButton onClick={handleResetOnboarding} variant="danger" fullWidth className="bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20">{t("settings.data.resetOnboarding")}</AppButton>
        </div>
        <p className="text-xs opacity-50 pt-2">{t("settings.data.resetOnboardingNote")}</p>
      </AppCard>
    </>
  );

  const HelpPanel = () => (
    <>
      <SectionHeader title={t("settings.section.help")} />
      <AppCard variant="glass" className="bg-white/20 border-white/30">
        <p className="text-sm opacity-70">{t("settings.help.version")}</p>
        <p className="text-xs opacity-50 mb-3">TrainQ Inc.</p>
        <AppButton variant="secondary" fullWidth className="bg-white/25 hover:bg-white/35 text-white" onClick={() => window.open("mailto:support@trainq.app")}>{t("settings.help.contact")}</AppButton>
      </AppCard>
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
  useEffect(() => {
    // Freeze Background
    document.body.style.overflow = 'hidden';
    return () => {
      // Unfreeze on cleanup
      document.body.style.overflow = '';
    };
  }, []);

  // bg-[var(--bg)] removed to allow global gradient to show through
  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-full bg-black/80 backdrop-blur-xl overflow-y-auto overscroll-contain text-[var(--text)]" style={{ isolation: "isolate" }}>
      <div className="mx-auto w-full max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-[120px] space-y-6">
        <PageHeader
          title={t("settings.title")}
          leftAction={
            <AppButton onClick={onBack} variant="secondary" className="relative z-50 w-10 h-10 !px-0 rounded-full bg-white/25 hover:bg-white/35 text-white" title={t("common.back")}>
              {"<"}
            </AppButton>
          }
          rightAction={
            !isPro && (
              <AppButton onClick={openPaywall} variant="primary" size="sm" className="relative z-50">
                {t("settings.pro.buy")}
              </AppButton>
            )
          }
        />

        {/* MOBILE: Accordion */}
        <div className="md:hidden space-y-3">
          <AppCard variant="glass" className="bg-white/20 border-white/30 p-2">
            <div className="space-y-1">
              {menuItems.map((it) => {
                const isActive = section === it.key;
                return (
                  <div key={it.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onMenuClick(it.key)}
                      className="w-full text-left px-3 py-3 rounded-2xl hover:bg-white/20 transition-colors active:scale-[0.99] duration-150 border border-transparent hover:border-white/30"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold opacity-90">{it.label}</span>
                        <span className="text-lg opacity-50 font-bold">{isActive ? "–" : "+"}</span>
                      </div>
                    </button>
                    {isActive && (
                      <div className="rounded-2xl p-2 bg-white/20 border border-white/30 backdrop-blur-lg">
                        {renderSectionContent(it.key as SettingsSection)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AppCard>
        </div>

        {/* DESKTOP: Sidebar + Content */}
        <div className="hidden md:grid grid-cols-[280px_1fr] gap-6">
          <AppCard variant="glass" className="bg-white/20 border-white/30 h-fit sticky top-6">
            <div className="space-y-1">
              {menuItems.map((it) => {
                const isActive = section === it.key;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => onMenuClick(it.key)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition border ${isActive ? "bg-white/20 border-white/30 font-bold text-[var(--text)]" : "border-transparent hover:bg-white/5 opacity-80"}`}
                  >
                    <span className="text-base">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </AppCard>
          <div className="space-y-4">
            {renderSectionContent(section)}
          </div>
        </div>
      </div>
    </div>
  );
}
