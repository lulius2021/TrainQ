// src/pages/SettingPage.tsx
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../hooks/useAuth";
import { useEntitlements } from "../hooks/useEntitlements";
import { isBillingSupported, restorePurchases, syncProToSession } from "../services/purchases";
import { useI18n } from "../i18n/useI18n";

import { loadTheme, setTheme as setThemeGlobal, type ThemeMode } from "../utils/theme";
import { clearUserScopedData, getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { clearWorkoutHistory } from "../utils/workoutHistory";
import { clearCalendarWorkouts } from "../utils/trainqStorage";
import { getSupabaseClient } from "../lib/supabaseClient";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { StatusBanner, type Status } from "../components/common/StatusBanner";

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

interface SettingPageProps {
  onBack: () => void;
  onClearCalendar?: () => void;
  onOpenPaywall?: () => void;
  onOpenGoals?: () => void;
}

type T = (key: any, vars?: any) => string;
type Lang = "de" | "en";

// Helper to call a Supabase Edge Function with the active user's JWT.
async function callEdgeFunction(name: string, init: RequestInit = {}): Promise<Response> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) throw new Error("Supabase URL not configured");
  const client = getSupabaseClient();
  const { data } = (await client?.auth.getSession()) ?? { data: undefined as any };
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return fetch(`${supabaseUrl}/functions/v1/${name}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles — defined at module scope so they're stable across renders.
// ─────────────────────────────────────────────────────────────────────────────

const cardClass =
  "rounded-xl p-4 space-y-3 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]";
const btnClass =
  "w-full rounded-xl px-4 py-2 text-sm bg-[var(--surface2)] border border-[var(--border)] text-[var(--text)] hover:brightness-110 active:scale-[0.98] transition-all";
const btnPrimaryClass =
  "rounded-full px-4 py-2 text-sm font-semibold bg-[#2563EB] text-white hover:bg-sky-500 transition-colors";

const SectionHeader = ({ title }: { title: string }) => (
  <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
);

// ─────────────────────────────────────────────────────────────────────────────
// Panel components — defined at module scope so they're memoizable and never
// remounted when the parent re-renders. Previously they were inline functions
// inside SettingPage which caused full unmount/remount on every state change.
// ─────────────────────────────────────────────────────────────────────────────

const ProfilePanel = ({
  t,
  user,
  onOpenGoals,
}: {
  t: T;
  user: { displayName?: string; email?: string } | null;
  onOpenGoals?: () => void;
}) => (
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

const AccountPanel = ({
  t,
  user,
  onLogout,
  onDelete,
}: {
  t: T;
  user: { email?: string } | null;
  onLogout: () => void;
  onDelete: () => void;
}) => (
  <>
    <SectionHeader title={t("settings.section.account")} />
    <div className={cardClass}>
      <p className="text-sm opacity-70">
        {t("settings.account.email", { value: user?.email || t("settings.value.unset") })}
      </p>
      <button type="button" onClick={onLogout} className={btnClass}>
        {t("settings.account.logout")}
      </button>
      <div className="pt-2 border-t border-[var(--border)]">
        <button
          type="button"
          onClick={onDelete}
          className="w-full rounded-xl px-4 py-2 text-sm font-medium bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20"
        >
          {t("settings.account.deleteProfile")}
        </button>
      </div>
    </div>
  </>
);

const NotificationsPanel = ({
  t,
  notifTraining,
  notifWeekly,
  onToggleTraining,
  onToggleWeekly,
}: {
  t: T;
  notifTraining: boolean;
  notifWeekly: boolean;
  onToggleTraining: () => void;
  onToggleWeekly: () => void;
}) => (
  <>
    <SectionHeader title={t("settings.section.notifications")} />
    <div className={cardClass}>
      <p className="text-sm opacity-70">{t("settings.notifications.subtitle")}</p>
      <div className="space-y-3">
        <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface2)] cursor-pointer">
          <span className="text-base">{t("settings.notifications.trainingReminders")}</span>
          <input
            type="checkbox"
            checked={notifTraining}
            onChange={onToggleTraining}
            className="rounded h-5 w-5 accent-blue-600"
            aria-label={t("settings.notifications.trainingReminders")}
          />
        </label>
        <label className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface2)] cursor-pointer">
          <span className="text-base">{t("settings.notifications.weeklySummary")}</span>
          <input
            type="checkbox"
            checked={notifWeekly}
            onChange={onToggleWeekly}
            className="rounded h-5 w-5 accent-blue-600"
            aria-label={t("settings.notifications.weeklySummary")}
          />
        </label>
      </div>
      <p className="text-sm pt-2 opacity-60">{t("settings.notifications.note")}</p>
    </div>
  </>
);

const IntegrationsPanel = ({
  t,
  garminConnected,
  garminBusy,
  onConnect,
  onDisconnect,
}: {
  t: T;
  garminConnected: boolean;
  garminBusy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) => (
  <>
    <SectionHeader title={t("settings.section.integrations")} />
    <div className={cardClass}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white font-bold text-xs">G</div>
          <span className="font-medium">{t("settings.integrations.garmin")}</span>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            garminConnected ? "bg-green-500/20 text-green-500" : "bg-gray-500/20 text-gray-500"
          }`}
        >
          {garminConnected ? t("settings.integrations.connected") : t("settings.integrations.notConnected")}
        </span>
      </div>

      {garminConnected ? (
        <button
          type="button"
          onClick={onDisconnect}
          disabled={garminBusy}
          className={btnClass + " disabled:opacity-50"}
        >
          {t("settings.integrations.disconnect")}
        </button>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          disabled={garminBusy}
          className={btnClass + " disabled:opacity-50"}
        >
          {t("settings.integrations.connect")}
        </button>
      )}
      <p className="text-xs opacity-50">{t("settings.integrations.subtitle")}</p>
    </div>
  </>
);

const UnitsPanel = ({
  t,
  units,
  onSet,
}: {
  t: T;
  units: "metric" | "imperial";
  onSet: (u: "metric" | "imperial") => void;
}) => (
  <>
    <SectionHeader title={t("settings.section.units")} />
    <div className={cardClass}>
      <p className="text-sm opacity-70">{t("settings.units.subtitle")}</p>
      <div className="inline-flex rounded-full p-1 text-base bg-[var(--surface2)] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => onSet("metric")}
          className={`px-4 py-1.5 rounded-full transition ${units === "metric" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}
        >
          {t("settings.units.metric")}
        </button>
        <button
          type="button"
          onClick={() => onSet("imperial")}
          className={`px-4 py-1.5 rounded-full transition ${units === "imperial" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}
        >
          {t("settings.units.imperial")}
        </button>
      </div>
      <p className="text-sm opacity-60">{t("settings.units.note")}</p>
    </div>
  </>
);

const LegalPanel = ({ t }: { t: T }) => {
  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  return (
    <>
      <SectionHeader title={t("settings.section.legal")} />
      <div className={cardClass}>
        <button onClick={() => navigate("/privacy")} className={btnClass + " text-left justify-between flex items-center"}>
          <span>{t("settings.legal.tab.privacy")}</span>
          <span className="opacity-50">→</span>
        </button>
        <button onClick={() => navigate("/impressum")} className={btnClass + " text-left justify-between flex items-center"}>
          <span>{t("settings.legal.tab.imprint")}</span>
          <span className="opacity-50">→</span>
        </button>
        <button onClick={() => navigate("/terms")} className={btnClass + " text-left justify-between flex items-center"}>
          <span>{t("settings.legal.tab.terms")}</span>
          <span className="opacity-50">→</span>
        </button>
      </div>
    </>
  );
};

const LanguagePanel = ({
  t,
  lang,
  setLang,
}: {
  t: T;
  lang: Lang;
  setLang: (l: Lang) => void;
}) => (
  <>
    <SectionHeader title={t("settings.section.language")} />
    <div className={cardClass}>
      <p className="text-sm opacity-70">{t("settings.language.subtitle")}</p>
      <div className="inline-flex rounded-full p-1 text-base bg-[var(--surface2)] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => setLang("de")}
          className={`px-4 py-1.5 rounded-full transition ${lang === "de" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}
        >
          {t("language.de")}
        </button>
        <button
          type="button"
          onClick={() => setLang("en")}
          className={`px-4 py-1.5 rounded-full transition ${lang === "en" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}
        >
          {t("language.en")}
        </button>
      </div>
    </div>
  </>
);

const ThemePanel = ({
  t,
  theme,
  onSet,
}: {
  t: T;
  theme: ThemeMode;
  onSet: (m: ThemeMode) => void;
}) => (
  <>
    <SectionHeader title={t("settings.section.theme")} />
    <div className={cardClass}>
      <p className="text-sm opacity-70">{t("settings.theme.subtitle")}</p>
      <div className="inline-flex rounded-full p-1 text-base bg-[var(--surface2)] border border-[var(--border)]">
        <button
          type="button"
          onClick={() => onSet("light")}
          className={`px-4 py-1.5 rounded-full transition ${theme === "light" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}
        >
          {t("settings.theme.light")}
        </button>
        <button
          type="button"
          onClick={() => onSet("dark")}
          className={`px-4 py-1.5 rounded-full transition ${theme === "dark" ? "bg-[#2563EB] text-white" : "text-gray-400"}`}
        >
          {t("settings.theme.dark")}
        </button>
      </div>
    </div>
  </>
);

const ProPanel = ({
  t,
  isPro,
  onOpenPaywall,
  onRestore,
}: {
  t: T;
  isPro: boolean;
  onOpenPaywall: () => void;
  onRestore: () => void;
}) => (
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
        <button onClick={onOpenPaywall} className={btnPrimaryClass + " w-full mt-2"}>
          {t("settings.pro.buy")}
        </button>
      )}
      <button onClick={onRestore} className={btnClass + " mt-2"}>
        {t("settings.pro.restorePurchases")}
      </button>
    </div>
  </>
);

const DataPanel = ({
  t,
  onClearCalendar,
  onClearHistory,
}: {
  t: T;
  onClearCalendar: () => void;
  onClearHistory: () => void;
}) => (
  <>
    <SectionHeader title={t("settings.section.data")} />
    <div className={cardClass}>
      <p className="text-sm opacity-70">{t("settings.data.subtitle")}</p>
      <div className="space-y-2 pt-2">
        <button
          onClick={onClearCalendar}
          className="w-full text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 hover:bg-red-500/20"
        >
          {t("settings.data.clearCalendar")}
        </button>
        <button
          onClick={onClearHistory}
          className="w-full text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 hover:bg-red-500/20"
        >
          {t("settings.data.clearHistory")}
        </button>
      </div>
    </div>
  </>
);

const HelpPanel = ({ t }: { t: T }) => (
  <>
    <SectionHeader title={t("settings.section.help")} />
    <div className={cardClass}>
      <p className="text-sm opacity-70">{t("settings.help.version")}</p>
      <p className="text-xs opacity-50">TrainQ Inc.</p>
      <button className={btnClass} onClick={() => window.open("mailto:support@trainq.app")}>
        {t("settings.help.contact")}
      </button>
    </div>
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// SettingPage
// ─────────────────────────────────────────────────────────────────────────────

type ConfirmKind =
  | "logout"
  | "deleteAccount"
  | "clearCalendar"
  | "clearHistory"
  | "disconnectGarmin"
  | null;

export default function SettingPage({
  onBack,
  onClearCalendar,
  onOpenPaywall,
  onOpenGoals,
}: SettingPageProps) {
  const safeTop = "env(safe-area-inset-top, 0px)";
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  const { user, logout, setUserPro } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { isPro } = useEntitlements(user?.id, user?.isPro);

  const [section, setSection] = useState<SettingsSection>("theme");
  const [units, setUnits] = useState<"metric" | "imperial">(() => {
    if (typeof window === "undefined") return "metric";
    try {
      return getScopedItem("trainq_units") === "imperial" ? "imperial" : "metric";
    } catch {
      return "metric";
    }
  });

  const [notifTraining, setNotifTraining] = useState(() => {
    try {
      return getScopedItem("trainq_notif_training") !== "false";
    } catch {
      return true;
    }
  });
  const [notifWeekly, setNotifWeekly] = useState(() => {
    try {
      return getScopedItem("trainq_notif_weekly") !== "false";
    } catch {
      return true;
    }
  });

  const [garminConnected, setGarminConnected] = useState(false);
  const [garminBusy, setGarminBusy] = useState(false);

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      return loadTheme("dark");
    } catch {
      return "dark";
    }
  });

  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [status, setStatus] = useState<Status>(null);

  // Race-safe Garmin status check: ignore late responses for stale users.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await callEdgeFunction("garmin-status");
        if (cancelled) return;
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setGarminConnected(!!json.connected);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[Settings] garmin-status failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ── Action handlers ────────────────────────────────────────────────────────

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
    }
  }, [onOpenPaywall]);

  const handleSetUnits = useCallback((next: "metric" | "imperial") => {
    setUnits(next);
    try {
      setScopedItem("trainq_units", next);
    } catch {
      /* ignore */
    }
  }, []);

  const handleSetTheme = useCallback((next: ThemeMode) => {
    setThemeGlobal(next);
    setThemeState(next);
  }, []);

  const handleToggleNotifTraining = useCallback(() => {
    setNotifTraining((prev) => {
      const next = !prev;
      try {
        setScopedItem("trainq_notif_training", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleToggleNotifWeekly = useCallback(() => {
    setNotifWeekly((prev) => {
      const next = !prev;
      try {
        setScopedItem("trainq_notif_weekly", String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const handleRestorePurchases = useCallback(async () => {
    if (!user) return;
    try {
      const supported = await isBillingSupported();
      if (!supported) {
        setStatus({ kind: "error", message: t("settings.alert.purchasesUnavailable") });
        return;
      }
      const nextIsPro = await restorePurchases();
      await syncProToSession({ id: user.id, email: user.email });
      if (nextIsPro) {
        setUserPro(true);
        setStatus({ kind: "success", message: t("paywall.success.title") });
      } else {
        setStatus({ kind: "error", message: t("settings.alert.noActiveSubscription") });
      }
    } catch {
      setStatus({ kind: "error", message: t("settings.alert.restoreFailed") });
    }
  }, [t, user, setUserPro]);

  // Confirm dialog handlers (replace window.confirm)
  const askConfirm = useCallback((kind: Exclude<ConfirmKind, null>) => {
    setConfirm(kind);
  }, []);

  const cancelConfirm = useCallback(() => setConfirm(null), []);

  // Track in-flight delete to prevent double-confirms
  const deleteInFlightRef = useRef(false);

  const handleConfirmed = useCallback(async () => {
    const kind = confirm;
    setConfirm(null);
    if (!kind) return;

    if (kind === "logout") {
      try {
        await logout();
      } finally {
        onBack();
      }
      return;
    }

    if (kind === "deleteAccount") {
      if (deleteInFlightRef.current) return;
      deleteInFlightRef.current = true;
      try {
        if (!user?.id) throw new Error("Not authenticated");
        // 1. Server-side deletion (auth.users + cascading rows)
        const res = await callEdgeFunction("delete-account", { method: "POST" });
        if (!res.ok) throw new Error(`delete-account returned ${res.status}`);
        // 2. Local cleanup
        clearUserScopedData(user.id);
        // 3. Sign out before reload to clear cached session
        await logout();
        setStatus({ kind: "success", message: t("settings.alert.profileDeleted") });
        // Give the banner a moment to flash before reload
        setTimeout(() => window.location.reload(), 600);
      } catch (e) {
        if (import.meta.env.DEV) console.error("[Settings] delete-account failed:", e);
        setStatus({ kind: "error", message: t("settings.alert.deleteAccountFailed") });
      } finally {
        deleteInFlightRef.current = false;
      }
      return;
    }

    if (kind === "clearCalendar") {
      try {
        clearCalendarWorkouts();
        if (onClearCalendar) onClearCalendar();
        setStatus({ kind: "success", message: t("settings.alert.calendarCleared") });
      } catch {
        setStatus({ kind: "error", message: t("settings.alert.profileDeleteError") });
      }
      return;
    }

    if (kind === "clearHistory") {
      try {
        clearWorkoutHistory();
        setStatus({ kind: "success", message: t("settings.alert.historyCleared") });
      } catch {
        setStatus({ kind: "error", message: t("settings.alert.profileDeleteError") });
      }
      return;
    }

    if (kind === "disconnectGarmin") {
      if (garminBusy) return;
      setGarminBusy(true);
      try {
        const res = await callEdgeFunction("garmin-disconnect", { method: "POST" });
        if (res.ok) {
          setGarminConnected(false);
          setStatus({ kind: "success", message: t("settings.integrations.disconnect") });
        } else {
          setStatus({ kind: "error", message: t("settings.integrations.disconnectError") });
        }
      } catch {
        setStatus({ kind: "error", message: t("settings.integrations.disconnectError") });
      } finally {
        setGarminBusy(false);
      }
      return;
    }
  }, [confirm, logout, onBack, user, t, onClearCalendar, garminBusy]);

  // Garmin connect: native uses Capacitor Browser, otherwise full-page redirect.
  const handleGarminConnect = useCallback(async () => {
    if (garminBusy) return;
    setGarminBusy(true);
    try {
      const res = await callEdgeFunction("garmin-auth-init", { method: "POST" });
      if (!res.ok) throw new Error(`garmin-auth-init returned ${res.status}`);
      const { authorizeUrl } = await res.json();
      if (!authorizeUrl) throw new Error("Missing authorizeUrl");
      if (Capacitor.isNativePlatform()) {
        // iOS/Android: open in system browser so the user returns via deep link.
        window.open(authorizeUrl, "_blank");
      } else {
        window.location.href = authorizeUrl;
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error("[Settings] garmin-auth-init failed:", e);
      setStatus({ kind: "error", message: t("settings.integrations.connectError") });
    } finally {
      setGarminBusy(false);
    }
  }, [garminBusy, t]);

  // ── Menu config ────────────────────────────────────────────────────────────

  const menuItems = useMemo<{ key: SettingsSection; label: string }[]>(
    () => [
      { key: "profile", label: t("settings.section.profile") },
      { key: "account", label: t("settings.section.account") },
      { key: "notifications", label: t("settings.section.notifications") },
      { key: "integrations", label: t("settings.section.integrations") },
      { key: "units", label: t("settings.section.units") },
      { key: "language", label: t("settings.section.language") },
      { key: "theme", label: t("settings.section.theme") },
      { key: "pro", label: t("settings.section.pro") },
      { key: "data", label: t("settings.section.data") },
      { key: "legal", label: t("settings.section.legal") },
      { key: "help", label: t("settings.section.help") },
    ],
    [t]
  );

  const onMenuClick = useCallback(
    (k: SettingsSection) => setSection((prev) => (prev === k ? prev : k)),
    []
  );

  // ── Confirm dialog config ──────────────────────────────────────────────────

  const confirmConfig = useMemo(() => {
    if (!confirm) return null;
    if (confirm === "logout") {
      return {
        title: t("settings.account.logout"),
        message: t("settings.confirm.logout"),
        confirmLabel: t("settings.account.logout"),
        destructive: false,
      };
    }
    if (confirm === "deleteAccount") {
      return {
        title: t("settings.account.deleteProfile"),
        message: t("settings.confirm.deleteProfile"),
        confirmLabel: t("settings.account.deleteProfile"),
        destructive: true,
      };
    }
    if (confirm === "clearCalendar") {
      return {
        title: t("settings.data.clearCalendar"),
        message: t("settings.confirm.clearCalendar"),
        confirmLabel: t("settings.data.clearCalendar"),
        destructive: true,
      };
    }
    if (confirm === "clearHistory") {
      return {
        title: t("settings.data.clearHistory"),
        message: t("settings.confirm.clearHistory"),
        confirmLabel: t("settings.data.clearHistory"),
        destructive: true,
      };
    }
    return {
      title: t("settings.integrations.disconnect"),
      message: t("settings.confirm.disconnectGarmin"),
      confirmLabel: t("settings.integrations.disconnect"),
      destructive: true,
    };
  }, [confirm, t]);

  // ── Section dispatch ───────────────────────────────────────────────────────

  const renderSectionContent = (k: SettingsSection) => {
    switch (k) {
      case "profile":
        return <ProfilePanel t={t} user={user} onOpenGoals={onOpenGoals} />;
      case "account":
        return (
          <AccountPanel
            t={t}
            user={user}
            onLogout={() => askConfirm("logout")}
            onDelete={() => askConfirm("deleteAccount")}
          />
        );
      case "notifications":
        return (
          <NotificationsPanel
            t={t}
            notifTraining={notifTraining}
            notifWeekly={notifWeekly}
            onToggleTraining={handleToggleNotifTraining}
            onToggleWeekly={handleToggleNotifWeekly}
          />
        );
      case "integrations":
        return (
          <IntegrationsPanel
            t={t}
            garminConnected={garminConnected}
            garminBusy={garminBusy}
            onConnect={handleGarminConnect}
            onDisconnect={() => askConfirm("disconnectGarmin")}
          />
        );
      case "units":
        return <UnitsPanel t={t} units={units} onSet={handleSetUnits} />;
      case "legal":
        return <LegalPanel t={t} />;
      case "language":
        return <LanguagePanel t={t} lang={lang as Lang} setLang={setLang as (l: Lang) => void} />;
      case "theme":
        return <ThemePanel t={t} theme={theme} onSet={handleSetTheme} />;
      case "pro":
        return (
          <ProPanel
            t={t}
            isPro={isPro}
            onOpenPaywall={openPaywall}
            onRestore={handleRestorePurchases}
          />
        );
      case "data":
        return (
          <DataPanel
            t={t}
            onClearCalendar={() => askConfirm("clearCalendar")}
            onClearHistory={() => askConfirm("clearHistory")}
          />
        );
      case "help":
        return <HelpPanel t={t} />;
      default:
        return null;
    }
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="h-full w-full overflow-y-auto bg-brand-bg text-[var(--text)] px-4 py-5"
      style={{
        paddingTop: `calc(1.25rem + ${safeTop})`,
        paddingBottom: `calc(5rem + ${safeBottom})`,
      }}
    >
      <StatusBanner status={status} onClear={() => setStatus(null)} />

      {confirmConfig && (
        <ConfirmDialog
          open={!!confirm}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={confirmConfig.confirmLabel}
          cancelLabel={t("common.cancel")}
          destructive={confirmConfig.destructive}
          onConfirm={handleConfirmed}
          onCancel={cancelConfirm}
        />
      )}

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
            <button type="button" onClick={openPaywall} className={btnPrimaryClass}>
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
                        {renderSectionContent(it.key)}
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
                    className={`w-full text-left px-4 py-3 rounded-xl transition ${
                      isActive ? "bg-[var(--surface2)] font-semibold" : "hover:bg-[var(--surface2)] opacity-80"
                    }`}
                  >
                    <span className="text-base">{it.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-4">{renderSectionContent(section)}</div>
        </div>
      </div>
    </div>
  );
}
