// src/pages/SettingPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  ensureCommunityProfile,
  loadCommunityProfile,
  updateCommunitySettings,
  type CommunityPrivacyLevel,
  type CommunityProfileRecord,
} from "../services/communityBackend";
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
  const [communityProfile, setCommunityProfile] = useState<CommunityProfileRecord | null>(null);
  const [communityLoading, setCommunityLoading] = useState(false);
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
      { key: "community", label: t("settings.section.community"), kind: "section" as const },
      { key: "data", label: t("settings.section.data"), kind: "section" as const },
      { key: "legal", label: t("settings.section.legal"), kind: "section" as const },
      { key: "help", label: t("settings.section.help"), kind: "section" as const },
    ],
    [t]
  );

  useEffect(() => {
    let active = true;
    const supabaseId = user?.supabaseId;
    if (!supabaseId) {
      setCommunityProfile(null);
      setCommunityLoading(false);
      return;
    }
    setCommunityLoading(true);
    (async () => {
      const loaded = await loadCommunityProfile(supabaseId);
      const ensured =
        loaded ||
        (await ensureCommunityProfile({
          supabaseUserId: supabaseId,
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
    <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
      {title}
    </div>
  );

  const ProfilePanel = () => (
    <>
      <SectionHeader title={t("settings.section.profile")} />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.profile.subtitle")}
        </div>
        {onOpenGoals && (
          <button
            type="button"
            onClick={onOpenGoals}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-95"
            style={{ background: "var(--primary)", color: "#061226" }}
          >
            {t("settings.profile.goals")}
          </button>
        )}
        <div className="text-[11px] pt-2" style={muted}>
          {t("settings.profile.name", { value: user?.displayName || user?.email || t("settings.value.unset") })}
        </div>
      </div>
    </>
  );

  const AccountPanel = () => (
    <>
      <SectionHeader title={t("settings.section.account")} />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.account.email", { value: user?.email || t("settings.value.unset") })}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
          style={surfaceBox}
        >
          <span style={{ color: "var(--text)" }}>{t("settings.account.logout")}</span>
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
            {t("settings.account.deleteProfile")}
          </button>
        </div>
      </div>
    </>
  );

  const NotificationsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.notifications")} />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.notifications.subtitle")}
        </div>
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text)" }}>
              {t("settings.notifications.trainingReminders")}
            </span>
            <input type="checkbox" defaultChecked className="rounded" />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm" style={{ color: "var(--text)" }}>
              {t("settings.notifications.weeklySummary")}
            </span>
            <input type="checkbox" defaultChecked className="rounded" />
          </label>
        </div>
        <div className="text-[10px] pt-2" style={muted}>
          {t("settings.notifications.note")}
        </div>
      </div>
    </>
  );

  const UnitsPanel = () => (
    <>
      <SectionHeader title={t("settings.section.units")} />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.units.subtitle")}
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
            {t("settings.units.metric")}
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
            {t("settings.units.imperial")}
          </button>
        </div>
        <div className="text-[10px]" style={muted}>
          {t("settings.units.note")}
        </div>
      </div>
    </>
  );

  const LegalPanel = () => (
    <>
      <SectionHeader title={t("settings.section.legal")} />

      <div className="inline-flex rounded-full p-1 text-[11px]" style={surfaceSoft}>
        {[
          ["privacy", t("settings.legal.tab.privacy")],
          ["imprint", t("settings.legal.tab.imprint")],
          ["terms", t("settings.legal.tab.terms")],
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
            <div className="font-semibold">{t("settings.legal.privacy.title")}</div>
            <div style={muted}>
              <p className="mb-2">
                {t("settings.legal.privacy.p1")}
              </p>
              <p className="mb-2">
                {t("settings.legal.privacy.p2")}
              </p>
              <p>
                {t("settings.legal.privacy.p3")}
              </p>
            </div>
          </div>
        )}
        {legalTab === "imprint" && (
          <div style={{ color: "var(--text)" }} className="space-y-2">
            <div className="font-semibold">{t("settings.legal.imprint.title")}</div>
            <div style={muted}>
              <p className="mb-2">{t("settings.legal.imprint.p1")}</p>
              <p className="mb-2">{t("settings.legal.imprint.p2")}</p>
              <p>
                {t("settings.legal.imprint.p3")}
              </p>
            </div>
          </div>
        )}
        {legalTab === "terms" && (
          <div style={{ color: "var(--text)" }} className="space-y-2">
            <div className="font-semibold">{t("settings.legal.terms.title")}</div>
            <div style={muted}>
              <p className="mb-2">
                {t("settings.legal.terms.p1")}
              </p>
              <p className="mb-2">
                {t("settings.legal.terms.p2")}
              </p>
              <p>
                {t("settings.legal.terms.p3")}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const LanguagePanel = () => (
    <>
      <SectionHeader title={t("settings.section.language")} />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.language.subtitle")}
        </div>
        <div className="inline-flex rounded-full p-1 text-[11px]" style={surfaceBox}>
          <button
            type="button"
            onClick={() => {
              setLang("de");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={lang === "de" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            {t("language.de")}
          </button>
          <button
            type="button"
            onClick={() => {
              setLang("en");
            }}
            className="px-4 py-1.5 rounded-full transition"
            style={lang === "en" ? { background: "var(--primary)", color: "#061226" } : { color: "var(--text)" }}
          >
            {t("language.en")}
          </button>
        </div>
        <div className="text-[10px]" style={muted}>
          {t("settings.language.note")}
        </div>
      </div>
    </>
  );

  const ThemePanel = () => (
    <>
      <SectionHeader title={t("settings.section.theme")} />

      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.theme.subtitle")}
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
            {t("settings.theme.light")}
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
            {t("settings.theme.dark")}
          </button>
        </div>

        <div className="text-[10px]" style={muted}>
          {t("settings.theme.note")}
        </div>
      </div>
    </>
  );

  const CommunityPanel = () => {
    const optIn = communityProfile?.community_opt_in ?? false;
    const privacy = (communityProfile?.privacy_level ?? "private") as CommunityPrivacyLevel;

    return (
      <>
        <SectionHeader title={t("settings.section.community")} />
        <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
          <div className="text-[11px]" style={muted}>
            {t("settings.community.subtitle")}
          </div>

          {!user?.supabaseId && (
            <div className="text-[11px]" style={muted}>
              {t("settings.community.emailOnly")}
            </div>
          )}

          {user?.supabaseId && (
            <>
              <label className="flex items-center justify-between text-[12px]" style={{ color: "var(--text)" }}>
                <span>{t("settings.community.enable")}</span>
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
                  {t("settings.community.visibility")}
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
                  <option value="private">{t("settings.community.visibility.private")}</option>
                  <option value="followers">{t("settings.community.visibility.followers")}</option>
                  <option value="public">{t("settings.community.visibility.public")}</option>
                </select>
              </div>

              {communityLoading && (
                <div className="text-[10px]" style={muted}>
                  {t("settings.community.loading")}
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
        <SectionHeader title={t("settings.section.pro")} />
        <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
          {isPro ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {t("settings.pro.active")}
              </div>
              <div className="text-[11px]" style={muted}>
                {t("settings.pro.activeSubtitle")}
              </div>
              <button
                type="button"
                onClick={() => {
                  openExternalUrl(MANAGE_SUBSCRIPTIONS_URL);
                }}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
                style={surfaceBox}
              >
                <span style={{ color: "var(--text)" }}>{t("settings.pro.manageSubscription")}</span>
              </button>
              <button
                type="button"
                onClick={handleRestorePurchases}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
                style={surfaceBox}
              >
                <span style={{ color: "var(--text)" }}>{t("settings.pro.restorePurchases")}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {t("settings.pro.title")}
              </div>
              <div className="text-[11px] space-y-1" style={muted}>
                <div>{t("settings.pro.feature.adaptive")}</div>
                <div>{t("settings.pro.feature.planShift")}</div>
                <div>{t("settings.pro.feature.stats")}</div>
                <div>{t("settings.pro.feature.earlyAccess")}</div>
              </div>
              <div className="text-[11px] space-y-1 pt-2" style={muted}>
                <div>{t("settings.pro.remaining.title")}</div>
                <div>
                  {t("settings.pro.remaining.adaptive", {
                    used: Math.max(0, Math.floor(adaptiveBCRemaining || 0)),
                  })}{" "}
                  / 5
                </div>
                <div>
                  {t("settings.pro.remaining.planShift", {
                    used: Math.max(0, Math.floor(planShiftRemaining || 0)),
                  })}{" "}
                  / 5
                </div>
                <div>
                  {t("settings.pro.remaining.calendar", {
                    used: Math.max(0, Math.floor(calendar7DaysRemaining || 0)),
                  })}{" "}
                  / 3
                </div>
              </div>
              <button
                type="button"
                onClick={openPaywall}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-95"
                style={{ background: "var(--primary)", color: "#061226" }}
              >
                {t("settings.pro.buy")}
              </button>
              <button
                type="button"
                onClick={handleRestorePurchases}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95"
                style={surfaceBox}
              >
                <span style={{ color: "var(--text)" }}>{t("settings.pro.restorePurchases")}</span>
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  const DataPanel = () => (
    <>
      <SectionHeader title={t("settings.section.data")} />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.data.subtitle")}
        </div>
        <button
          type="button"
          onClick={handleClearCalendar}
          className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
          style={{ ...surfaceBox, color: "var(--text)" }}
        >
          {t("settings.data.clearCalendar")}
        </button>
        <button
          type="button"
          onClick={handleClearHistory}
          className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
          style={{ ...surfaceBox, color: "var(--text)" }}
        >
          {t("settings.data.clearHistory")}
        </button>
        <div className="text-[10px] pt-2" style={muted}>
          {t("settings.data.warning")}
        </div>
      </div>
    </>
  );

  const HelpPanel = () => (
    <>
      <SectionHeader title={t("settings.section.help")} />
      <div className="rounded-xl p-3 space-y-3" style={surfaceSoft}>
        <div className="text-[11px]" style={muted}>
          {t("settings.help.subtitle")}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              const faq = t("settings.help.faqContent");
              alert(faq);
            }}
            className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
            style={{ ...surfaceBox, color: "var(--text)" }}
          >
            {t("settings.help.faq")}
          </button>
          <button
            type="button"
            onClick={() => {
              const subject = encodeURIComponent(t("settings.help.contactSubject"));
              window.open(`mailto:support@trainq.app?subject=${subject}`, "_blank");
            }}
            className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
            style={{ ...surfaceBox, color: "var(--text)" }}
          >
            {t("settings.help.contact")}
          </button>
          <button
            type="button"
            onClick={() => {
              // In einer echten App würde dies zum App Store führen
              alert(t("settings.help.rateNotice"));
            }}
            className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
            style={{ ...surfaceBox, color: "var(--text)" }}
          >
            {t("settings.help.rate")}
          </button>
          {import.meta.env.DEV && (
            <div className="rounded-xl p-3 space-y-2" style={surfaceBox}>
              <div className="text-[11px] font-semibold" style={{ color: "var(--text)" }}>
                {t("settings.help.liveActivityDebug")}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const res = await debugStartLiveActivity();
                  setLiveActivityDebug(res ? JSON.stringify(res) : t("settings.help.debugNoResponse"));
                }}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
                style={{ ...surfaceSoft, color: "var(--text)" }}
              >
                {t("settings.help.liveActivityStart")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await debugEndLiveActivity();
                  setLiveActivityDebug(res ? JSON.stringify(res) : t("settings.help.debugNoResponse"));
                }}
                className="w-full rounded-xl px-3 py-2 text-xs hover:opacity-95 text-left"
                style={{ ...surfaceSoft, color: "var(--text)" }}
              >
                {t("settings.help.liveActivityEnd")}
              </button>
              {liveActivityDebug && (
                <div className="text-[10px] break-all" style={{ color: "var(--muted)" }}>
                  {liveActivityDebug}
                </div>
              )}
            </div>
          )}
          <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--text)" }}>
              {t("settings.help.about")}
            </div>
            <div className="text-[10px]" style={muted}>
              {t("settings.help.version")}
              <br />
              {t("settings.help.aboutText")}
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
              title={t("common.back")}
              style={surfaceSoft}
            >
              <span style={{ color: "var(--text)" }}>{"<"}</span>
            </button>

            <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>
              {t("settings.title")}
            </h1>
          </div>

          {!isPro && (
            <button
              type="button"
              onClick={openPaywall}
              className="rounded-full px-4 py-2 text-xs font-semibold hover:opacity-95"
              style={{ background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" }}
            >
              {t("settings.pro.buy")}
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
                <span style={{ color: "var(--text)" }}>{t("settings.account.logout")}</span>
              </button>
            </div>
          </div>

          <div className="tq-surface p-4 space-y-3">{renderSectionContent(section)}</div>
        </div>
      </div>
    </div>
  );
}
