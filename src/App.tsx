// src/App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "./i18n/useI18n";

// Seiten (Haupt-App)
import { Dashboard } from "./pages/Dashboard";
import TrainingsplanPage from "./pages/TrainingsplanPage";
import { CalendarPage } from "./pages/CalendarPage";
import ProfilePage from "./pages/ProfilePage";
import StartTodayPage from "./pages/StartTodayPage";

// Settings
import SettingsPage from "./pages/SettingPage";

// TrainQ Core Debug
import TrainQCoreDebug from "./pages/TrainQCoreDebug";

// Live-Training
import LiveTrainingPage from "./pages/training/LiveTrainingPage";
import CommunityPage from "./pages/CommunityPage";
import CommunityInboxPage from "./pages/CommunityInboxPage";
import WorkoutSharePage from "./pages/WorkoutSharePage";
import PublicProfilePage from "./pages/PublicProfilePage";

// Auth & Onboarding
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";

// Context + Hooks
import { AuthContextProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { useTabSwipeNavigation } from "./hooks/useTabSwipeNavigation";

// Entitlements
import { useEntitlements } from "./hooks/useEntitlements";
import type { PaywallReason } from "./utils/entitlements";
import { isBillingSupported, purchaseSubscription, restorePurchases, syncProToSession } from "./services/purchases";

// Paywall UI
import PaywallModal from "./components/paywall/PaywallModal";

// Onboarding Source of Truth
import { OnboardingProvider, readOnboardingDataFromStorage } from "./context/OnboardingContext";

// ✅ NavBar (floating)
import { NavBar } from "./components/NavBar";

// Typen
import type { CalendarEvent, NewCalendarEvent, UpcomingTraining } from "./types/training";
import type { DeloadPlan, DeloadRule } from "./types/deload";

// Live Workout API (für Mini-Bar)
import { abortLiveWorkout, getActiveLiveWorkout, persistActiveLiveWorkout } from "./utils/trainingHistory";

// AUTO-SEED FIX
import { resolveLiveSeed, writeLiveSeedForEventOrKey, type LiveTrainingSeed } from "./utils/liveTrainingSeed";

// TestFlight Seed (10 Pro + 3 Free)
import { ensureTestAccountsSeeded } from "./utils/testAccountsSeed";
import { getScopedItem, removeScopedItem, setScopedItem } from "./utils/scopedStorage";
import { getActiveUserId } from "./utils/session";
import { applyDeloadToEvent } from "./utils/deload/apply";
import {
  clearDeloadDismissedUntil,
  clearDeloadPlan,
  readDeloadDismissedUntil,
  readDeloadPlan,
  readLastDeloadIntervalWeeks,
  readLastDeloadStartISO,
  writeDeloadDismissedUntil,
  writeDeloadPlan,
  writeLastDeloadIntervalWeeks,
  writeLastDeloadStartISO,
} from "./utils/deload/storage";
import { computeAvgSessionsPerWeek, mapSessionsToIntervalWeeks } from "./utils/deload/schedule";

const INITIAL_EVENTS: CalendarEvent[] = [];

/** Exportiert für andere Komponenten */
export type TabKey = "dashboard" | "calendar" | "today" | "plan" | "community" | "profile";
type AppRoute =
  | "/"
  | "/today"
  | "/live-training"
  | "/debug/trainq"
  | "/community"
  | "/community/inbox"
  | "/workout-share"
  | "/public-profile";

const STORAGE_KEY_EVENTS = "trainq_calendar_events";
const STORAGE_KEY_ACTIVE_LIVE_EVENT_ID = "trainq_active_live_event_id_v1";
const STORAGE_KEY_PLAN_START_ISO = "trainq_plan_start_date_iso";
const ONBOARDING_CHANGED_EVENT = "trainq:onboarding_changed";

const BOTTOM_NAV_PADDING = "calc(var(--bottom-nav-h) + var(--safe-bottom))";
const MINI_BAR_BOTTOM = "calc(var(--bottom-nav-h) + var(--bottom-nav-gap) + var(--safe-bottom))";

// -------------------- Helpers --------------------

function uuidFallback(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return uuidFallback("ev");
}

function isTrainingLike(ev: unknown): boolean {
  if (!ev || typeof ev !== "object") return false;

  const anyEv = ev as Record<string, unknown>;
  if (anyEv.type === "training") return true;

  const tt = anyEv.trainingType;
  const ttl = anyEv.trainingTypeLegacy;

  if (typeof tt === "string" && tt.trim()) return true;
  if (typeof ttl === "string" && ttl.trim()) return true;

  const s = String(anyEv.sport ?? "").toLowerCase();
  if (s === "gym" || s === "laufen" || s === "radfahren" || s === "custom") return true;
  if (s === "run" || s === "running" || s === "bike" || s === "cycling") return true;

  return false;
}

function deriveTrainingTypeFromMeta(raw: unknown): "gym" | "laufen" | "radfahren" | "custom" {
  const anyRaw = raw as Record<string, unknown>;
  const sportLower = String(anyRaw?.sport ?? "").trim().toLowerCase();
  const titleLower = String(anyRaw?.title ?? "").toLowerCase();

  if (sportLower === "laufen" || sportLower === "run" || sportLower === "running") return "laufen";
  if (sportLower === "radfahren" || sportLower === "bike" || sportLower === "cycling") return "radfahren";
  if (sportLower === "custom") return "custom";
  if (sportLower === "gym") return "gym";

  const tt = String(anyRaw?.trainingType ?? "").trim().toLowerCase();
  if (tt === "laufen") return "laufen";
  if (tt === "radfahren") return "radfahren";
  if (tt === "custom") return "custom";
  if (tt === "gym") {
    if (titleLower.includes("lauf")) return "laufen";
    if (titleLower.includes("rad") || titleLower.includes("bike")) return "radfahren";
    return "gym";
  }

  if (titleLower.includes("lauf")) return "laufen";
  if (titleLower.includes("rad") || titleLower.includes("bike")) return "radfahren";

  return "gym";
}

function migrateTrainingStatus(rawStatus: unknown): "open" | "completed" | "skipped" | undefined {
  const s = String(rawStatus ?? "").trim().toLowerCase();
  if (!s) return undefined;
  if (s === "planned") return "open";
  if (s === "open" || s === "completed" || s === "skipped") return s as "open" | "completed" | "skipped";
  return undefined;
}

function normalizeTitle(s: unknown): string {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLoadedEvent(raw: unknown): CalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const ev: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  if (!ev.userId) ev.userId = getActiveUserId() ?? undefined;

  if (!ev.id) ev.id = ensureId();
  if (ev.title == null) ev.title = "";
  if (!ev.date) return null;

  if (ev.startTime == null) ev.startTime = "";
  if (ev.endTime == null) ev.endTime = "";

  if (ev.type !== "training" && ev.type !== "other") {
    ev.type = isTrainingLike(ev) ? "training" : "other";
  }

  if (ev.type === "training") {
    (ev as any).trainingType = deriveTrainingTypeFromMeta(ev);

    const st = migrateTrainingStatus((ev as any).trainingStatus);
    if (st) (ev as any).trainingStatus = st;
    else if ("trainingStatus" in ev && !st) delete (ev as any).trainingStatus;
  } else {
    if ("trainingType" in ev) delete (ev as any).trainingType;
    if ("trainingTypeLegacy" in ev) delete (ev as any).trainingTypeLegacy;
    if ("trainingStatus" in ev) delete (ev as any).trainingStatus;
  }

  return ev as unknown as CalendarEvent;
}

function ensureTrainingMeta(input: CalendarEvent): CalendarEvent {
  const ev: any = { ...input };

  if (ev.startTime == null) ev.startTime = "";
  if (ev.endTime == null) ev.endTime = "";

  const sportLower = String(ev.sport ?? "").toLowerCase();

  const training =
    ev.type === "training" ||
    !!ev.trainingType ||
    !!ev.trainingTypeLegacy ||
    sportLower === "gym" ||
    sportLower === "laufen" ||
    sportLower === "radfahren" ||
    sportLower === "custom" ||
    sportLower === "run" ||
    sportLower === "running" ||
    sportLower === "bike" ||
    sportLower === "cycling";

  if (!training) return ev as CalendarEvent;

  ev.type = "training";

  if (!ev.templateId) {
    ev.templateId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : uuidFallback("tpl");
  }

  ev.trainingType = deriveTrainingTypeFromMeta(ev);

  const st = migrateTrainingStatus(ev.trainingStatus);
  if (st) ev.trainingStatus = st;

  return ev as CalendarEvent;
}

function getRouteFromLocation(): AppRoute {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname;

  if (path === "/live-training") return "/live-training";
  if (path === "/debug/trainq") return "/debug/trainq";
  if (path === "/today") return "/today";
  if (path === "/community/inbox") return "/community/inbox";
  if (path === "/community") return "/community";
  if (path === "/workout-share") return "/workout-share";
  if (path.startsWith("/u/")) return "/public-profile";

  return "/";
}

function pushRoute(path: AppRoute, search?: string): void {
  if (typeof window === "undefined") return;
  const next = search ? `${path}?${search}` : path;
  if (window.location.pathname + window.location.search === next) return;
  window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function readActiveLiveEventId(userId?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = getScopedItem(STORAGE_KEY_ACTIVE_LIVE_EVENT_ID, userId);
    return v || undefined;
  } catch {
    return undefined;
  }
}

function writeActiveLiveEventId(eventId?: string, userId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (!eventId) {
      removeScopedItem(STORAGE_KEY_ACTIVE_LIVE_EVENT_ID, userId);
    } else {
      setScopedItem(STORAGE_KEY_ACTIVE_LIVE_EVENT_ID, eventId, userId);
    }
  } catch {
    // ignore
  }
}

function readEventsFromStorage(userId?: string): CalendarEvent[] {
  if (typeof window === "undefined") return INITIAL_EVENTS;
  try {
    const raw = getScopedItem(STORAGE_KEY_EVENTS, userId);
    if (!raw) return INITIAL_EVENTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_EVENTS;

    const normalized = parsed.map(normalizeLoadedEvent).filter(Boolean) as CalendarEvent[];

    try {
      setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(normalized), userId);
    } catch {
      // ignore
    }

    return normalized;
  } catch {
    return INITIAL_EVENTS;
  }
}

function writeEventsToStorage(events: CalendarEvent[], userId?: string) {
  if (typeof window === "undefined") return;
  try {
    setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(events), userId);
  } catch {
    // ignore
  }
}

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isISOInRange(dateISO: string, startISO: string, endISO: string): boolean {
  return dateISO >= startISO && dateISO <= endISO;
}

function formatElapsedFromISO(startedAt?: string): string {
  if (!startedAt) return "0:00";
  const a = new Date(startedAt).getTime();
  if (!Number.isFinite(a)) return "0:00";
  const sec = Math.max(0, Math.floor((Date.now() - a) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function readOnboardingCompletedSafe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return readOnboardingDataFromStorage().isCompleted === true;
  } catch {
    return false;
  }
}

// -------------------- Mini Bar --------------------

const LiveTrainingMiniBar: React.FC<{
  visible: boolean;
  onMaximize: (eventId?: string) => void;
  onAbort: () => void;
}> = ({ visible, onMaximize, onAbort }) => {
  const { t } = useI18n();
  const [active, setActive] = useState(() => getActiveLiveWorkout());

  useEffect(() => {
    if (!visible) return;

    const t = window.setInterval(() => {
      setActive(getActiveLiveWorkout());
    }, 1000);

    return () => window.clearInterval(t);
  }, [visible]);

  if (!visible) return null;
  if (!active || !active.isActive) return null;

  return (
    <div className="fixed left-0 right-0 z-[60] px-3" style={{ bottom: MINI_BAR_BOTTOM }}>
      <div
        className="
          mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-3
          backdrop-blur-xl shadow-lg shadow-black/40
        "
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-gray-400">{t("live.mini.running")}</div>
            <div className="flex items-baseline gap-2">
              <div className="text-base font-semibold tabular-nums text-white">
                {formatElapsedFromISO(active.startedAt)}
              </div>
              <div className="truncate text-[11px] text-gray-400">{active.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMaximize(active.calendarEventId)}
              className="rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary/90"
            >
              {t("live.mini.maximize")}
            </button>

            <button
              type="button"
              onClick={onAbort}
              className="
                rounded-full border border-white/10 bg-white/10 px-4 py-2.5 
                text-sm text-white/80 hover:bg-white/20
              "
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------- App Shell --------------------

type ProfileScreen = "profile" | "settings";

const MainAppShell: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [activeLiveEventId, setActiveLiveEventId] = useState<string | undefined>(() => readActiveLiveEventId(userId));
  const [shareWorkoutId, setShareWorkoutId] = useState<string | null>(null);
  const [shareReturnTo, setShareReturnTo] = useState<"dashboard" | "profile">("dashboard");
  const [publicProfileId, setPublicProfileId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const path = window.location.pathname;
    if (!path.startsWith("/u/")) return null;
    return decodeURIComponent(path.replace("/u/", "").trim()) || null;
  });

  const [profileScreen, setProfileScreen] = useState<ProfileScreen>("profile");

  const { isPro, adaptiveBCRemaining, planShiftRemaining, calendar7DaysRemaining } = useEntitlements(userId);

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason>("calendar_7days");

  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const loaded = readEventsFromStorage(userId);
    // ✅ Migration: Stelle sicher, dass alle Trainings korrektes trainingType haben
    return loaded.map((ev) => {
      if (ev.type === "training" && !ev.trainingType) {
        return ensureTrainingMeta(ev);
      }
      return ev;
    });
  });

  const [planStartISO, setPlanStartISO] = useState<string | null>(() => getScopedItem(STORAGE_KEY_PLAN_START_ISO, userId));
  const [deloadPlan, setDeloadPlan] = useState<DeloadPlan | null>(() => readDeloadPlan(userId));
  const [deloadDismissedUntilISO, setDeloadDismissedUntilISO] = useState<string | null>(() =>
    readDeloadDismissedUntil(userId)
  );
  const [lastDeloadStartISO, setLastDeloadStartISO] = useState<string | null>(() => readLastDeloadStartISO(userId));
  const [lastDeloadIntervalWeeks, setLastDeloadIntervalWeeks] = useState<number | null>(() =>
    readLastDeloadIntervalWeeks(userId)
  );

  useEffect(() => {
    writeEventsToStorage(events, userId);
  }, [events, userId]);

  useEffect(() => {
    setEvents(readEventsFromStorage(userId));
    setActiveLiveEventId(readActiveLiveEventId(userId));
    setPlanStartISO(getScopedItem(STORAGE_KEY_PLAN_START_ISO, userId));
    setDeloadPlan(readDeloadPlan(userId));
    setDeloadDismissedUntilISO(readDeloadDismissedUntil(userId));
    setLastDeloadStartISO(readLastDeloadStartISO(userId));
    setLastDeloadIntervalWeeks(readLastDeloadIntervalWeeks(userId));
  }, [userId]);

  useEffect(() => {
    if (!deloadPlan) return;
    const today = todayISO();
    if (today <= deloadPlan.endISO) return;
    writeLastDeloadStartISO(userId, deloadPlan.startISO);
    setLastDeloadStartISO(deloadPlan.startISO);
    clearDeloadPlan(userId);
    setDeloadPlan(null);
    setEvents((prev) => prev.map((ev) => (ev.deload ? { ...ev, deload: undefined } : ev)));
  }, [deloadPlan, userId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      const nextRoute = getRouteFromLocation();
      setRoute(nextRoute);

      if (nextRoute === "/live-training") {
        setActiveLiveEventId(readActiveLiveEventId(userId));
      } else if (nextRoute === "/today") {
        setActiveTab("today");
      } else if (nextRoute === "/workout-share") {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("id");
        const from = params.get("from");
        if (id) setShareWorkoutId(id);
        setShareReturnTo(from === "profile" ? "profile" : "dashboard");
      } else if (nextRoute === "/public-profile") {
        const path = window.location.pathname;
        const id = path.startsWith("/u/") ? decodeURIComponent(path.replace("/u/", "")) : null;
        setPublicProfileId(id || null);
      }
    };

    const onCustomNavigate = (ev: Event) => {
      const e = ev as CustomEvent<{ path?: AppRoute; eventId?: string; workoutId?: string; returnTo?: "dashboard" | "profile" }>;
      const next = e?.detail?.path;
      if (!next) return;

      const nextEventId = e?.detail?.eventId;
      if (next === "/live-training") {
        const normalized = typeof nextEventId === "string" && nextEventId.trim() ? nextEventId.trim() : undefined;
        setActiveLiveEventId(normalized);
        writeActiveLiveEventId(normalized, userId);
      } else if (next === "/today") {
        setActiveTab("today");
      } else if (next === "/workout-share") {
        const workoutId = e?.detail?.workoutId;
        if (typeof workoutId === "string" && workoutId.trim()) setShareWorkoutId(workoutId.trim());
        setShareReturnTo(e?.detail?.returnTo === "profile" ? "profile" : "dashboard");
      } else {
        const active = getActiveLiveWorkout();
        if (!active || !active.isActive) {
          setActiveLiveEventId(undefined);
          writeActiveLiveEventId(undefined, userId);
        }
      }

      pushRoute(next);
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("trainq:navigate", onCustomNavigate as EventListener);

    onPopState();

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("trainq:navigate", onCustomNavigate as EventListener);
    };
  }, [userId]);

  const openWorkoutShare = useCallback(
    (workoutId: string, returnTo: "dashboard" | "profile" = "dashboard") => {
      const id = String(workoutId || "").trim();
      if (!id) return;
      setShareWorkoutId(id);
      setShareReturnTo(returnTo);
      setActiveLiveEventId(undefined);
      writeActiveLiveEventId(undefined, userId);
      const search = `id=${encodeURIComponent(id)}&from=${encodeURIComponent(returnTo)}`;
      pushRoute("/workout-share", search);
      setRoute("/workout-share");
    },
    [userId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOpenSettings = () => {
      setActiveTab("profile");
      setProfileScreen("settings");
    };

    const onOpenPaywall = () => {
      if (isPro) return;
      setPaywallReason("calendar_7days");
      setPaywallOpen(true);
    };

    window.addEventListener("trainq:open_settings", onOpenSettings as EventListener);
    window.addEventListener("trainq:open_paywall", onOpenPaywall as EventListener);

    return () => {
      window.removeEventListener("trainq:open_settings", onOpenSettings as EventListener);
      window.removeEventListener("trainq:open_paywall", onOpenPaywall as EventListener);
    };
  }, [isPro]);

  const [hasActiveWorkout, setHasActiveWorkout] = useState<boolean>(() => {
    const a: any = getActiveLiveWorkout();
    return !!a?.isActive && a?.isMinimized === true;
  });

  useEffect(() => {
    const t = window.setInterval(() => {
      const a: any = getActiveLiveWorkout();
      setHasActiveWorkout(!!a?.isActive && a?.isMinimized === true);
    }, 500);
    return () => window.clearInterval(t);
  }, []);

  const showMiniBar = route !== "/live-training" && hasActiveWorkout;

  const isSwipeBlocked = useCallback(() => {
    if (paywallOpen) return true;
    if (typeof document === "undefined") return false;
    if (document.documentElement.classList.contains("modal-open")) return true;
    return !!document.querySelector('[data-overlay-open="true"]');
  }, [paywallOpen]);

  const tabOrder: TabKey[] = ["dashboard", "calendar", "today", "community", "profile"];
  const isTabRoute = route === "/" || route === "/today";
  const tabSwipeEnabled = route === "/" && profileScreen === "profile";

  useTabSwipeNavigation({
    enabled: tabSwipeEnabled,
    isBlocked: isSwipeBlocked,
    noSwipeSelector: '[data-no-tab-swipe="true"]',
    onSwipeLeft: () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx < 0 || idx >= tabOrder.length - 1) return;
      setActiveTab(tabOrder[idx + 1]);
    },
    onSwipeRight: () => {
      const idx = tabOrder.indexOf(activeTab);
      if (idx <= 0) return;
      setActiveTab(tabOrder[idx - 1]);
    },
  });

  const maybeAutoSeedTraining = useCallback((ev: CalendarEvent) => {
    const anyEv: any = ev;
    const isTraining = anyEv?.type === "training";
    if (!isTraining) return;

    const dateISO = String(anyEv?.date ?? "").trim();
    const title = normalizeTitle(anyEv?.title);
    const eventId = String(anyEv?.id ?? "").trim();
    if (!eventId || !dateISO || !title) return;

    // ✅ Prüfe ob Seed bereits existiert (per eventId oder key)
    const existing = resolveLiveSeed({ eventId, dateISO, title });
    if (existing) return;

    // ✅ Bestimme Training-Typ und Sport
    const trainingType = String(anyEv?.trainingType ?? "").toLowerCase() as "gym" | "laufen" | "radfahren" | "custom";
    const sport: LiveTrainingSeed["sport"] =
      trainingType === "laufen" ? "Laufen" : trainingType === "radfahren" ? "Radfahren" : trainingType === "custom" ? "Custom" : "Gym";
    const isCardio = trainingType === "laufen" || trainingType === "radfahren";

    const seed: LiveTrainingSeed = {
      title,
      sport,
      isCardio,
      exercises: [],
    };

    // ✅ Speichere Seed mit eventId (wichtig für Persistenz)
    writeLiveSeedForEventOrKey({ eventId, dateISO, title, seed });
  }, []);

  const createEventFromInput = useCallback(
    (data: NewCalendarEvent): CalendarEvent => {
      const created: CalendarEvent = { ...data, id: ensureId(), userId: userId ?? getActiveUserId() ?? undefined } as any;
      let newEvent = ensureTrainingMeta(created);
      // ✅ Seed wird NACH Event-Erstellung mit eventId geschrieben
      maybeAutoSeedTraining(newEvent);
      if (
        deloadPlan &&
        newEvent.type === "training" &&
        isISOInRange(newEvent.date, deloadPlan.startISO, deloadPlan.endISO)
      ) {
        newEvent = applyDeloadToEvent(newEvent, deloadPlan.rules);
      } else if (newEvent.deload) {
        newEvent = { ...newEvent, deload: undefined };
      }
      return newEvent;
    },
    [maybeAutoSeedTraining, deloadPlan]
  );

  const handleCreateQuickTraining = useCallback(
    (data: NewCalendarEvent) => {
      const newEvent = createEventFromInput(data);
      setEvents((prev) => [...prev, newEvent]);
    },
    [createEventFromInput]
  );

  const handleAddEvent = useCallback(
    (data: NewCalendarEvent) => {
      const newEvent = createEventFromInput(data);
      setEvents((prev) => [...prev, newEvent]);
    },
    [createEventFromInput]
  );

  const handlePlanDeload = useCallback(
    (startISO: string, endISO: string, rules: DeloadRule, previousPlan?: DeloadPlan | null) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : uuidFallback("deload");
      const avgSessions = computeAvgSessionsPerWeek(events, 6);
      const intervalWeeks =
        previousPlan?.baselineIntervalWeeks ??
        lastDeloadIntervalWeeks ??
        mapSessionsToIntervalWeeks(avgSessions);
      const plan: DeloadPlan = {
        id,
        startISO,
        endISO,
        createdAtISO: todayISO(),
        rules,
        baselineIntervalWeeks: intervalWeeks,
      };
      writeDeloadPlan(userId, plan);
      setDeloadPlan(plan);
      writeLastDeloadStartISO(userId, startISO);
      setLastDeloadStartISO(startISO);
      writeLastDeloadIntervalWeeks(userId, intervalWeeks);
      setLastDeloadIntervalWeeks(intervalWeeks);
      clearDeloadDismissedUntil(userId);
      setDeloadDismissedUntilISO(null);

      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.type !== "training") return ev.deload ? { ...ev, deload: undefined } : ev;
          if (previousPlan && isISOInRange(ev.date, previousPlan.startISO, previousPlan.endISO)) {
            if (!isISOInRange(ev.date, startISO, endISO)) return { ...ev, deload: undefined };
          }
          if (isISOInRange(ev.date, startISO, endISO)) return applyDeloadToEvent(ev, rules);
          return ev.deload ? { ...ev, deload: undefined } : ev;
        })
      );
    },
    [userId, events, lastDeloadIntervalWeeks]
  );

  const handleDiscardDeload = useCallback(
    (plan: DeloadPlan) => {
      clearDeloadPlan(userId);
      setDeloadPlan(null);
      setEvents((prev) =>
        prev.map((ev) => {
          if (!isISOInRange(ev.date, plan.startISO, plan.endISO)) return ev;
          return ev.deload ? { ...ev, deload: undefined } : ev;
        })
      );
    },
    [userId]
  );

  const handleDismissDeload = useCallback(
    (dismissedUntilISO: string) => {
      writeDeloadDismissedUntil(userId, dismissedUntilISO);
      setDeloadDismissedUntilISO(dismissedUntilISO);
    },
    [userId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAddEvent = (ev: Event) => {
      const e = ev as CustomEvent<NewCalendarEvent>;
      if (e?.detail) {
        handleAddEvent(e.detail);
      }
    };

    window.addEventListener("trainq:add_calendar_event", onAddEvent as EventListener);

    return () => {
      window.removeEventListener("trainq:add_calendar_event", onAddEvent as EventListener);
    };
  }, [handleAddEvent]);

  const handleDeleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleClearCalendar = useCallback(() => {
    setEvents([]);
  }, []);

  const upcomingTrainings: UpcomingTraining[] = useMemo(() => {
    const todayIso = todayISO();

    return events
      .filter((e) => e.type === "training" && e.date >= todayIso)
      .sort((a, b) => (a.date + (a.startTime || "")).localeCompare(b.date + (b.startTime || "")))
      .slice(0, 5)
      .map<UpcomingTraining>((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.startTime || "",
        notes: e.notes ?? (e as any).description,
        sport: (e as any).trainingType,
        status: (e as any).trainingStatus,
      }));
  }, [events]);

  const exitLiveTraining = useCallback(() => {
    setActiveLiveEventId(undefined);
    writeActiveLiveEventId(undefined, userId);
    pushRoute("/");
    setRoute("/");
    setActiveTab("dashboard");
  }, []);

  const minimizeLiveTraining = useCallback(() => {
    pushRoute("/");
    setRoute("/");
  }, []);

  const maximizeLiveTraining = useCallback(
    (eventIdFromWorkout?: string) => {
      const normalized =
        typeof eventIdFromWorkout === "string" && eventIdFromWorkout.trim()
          ? eventIdFromWorkout.trim()
          : activeLiveEventId;

      setActiveLiveEventId(normalized);
      writeActiveLiveEventId(normalized, userId);

      const active: any = getActiveLiveWorkout();
      if (active && active.isActive) {
        persistActiveLiveWorkout({ ...active, isMinimized: false });
      }

      window.dispatchEvent(
        new CustomEvent("trainq:navigate", { detail: { path: "/live-training", eventId: normalized } })
      );
    },
    [activeLiveEventId]
  );

  const abortFromMiniBar = useCallback(() => {
    const active: any = getActiveLiveWorkout();
    if (active && active.isActive) abortLiveWorkout(active);
    exitLiveTraining();
  }, [exitLiveTraining]);

  const openPaywall = useCallback(
    (reason: PaywallReason) => {
      if (typeof window === "undefined") return;
      if (isPro) return;
      setPaywallReason(reason);
      setPaywallOpen(true);
    },
    [isPro]
  );

  const openPaywallGeneric = useCallback(() => {
    openPaywall("calendar_7days");
  }, [openPaywall]);

  const handlePurchase = useCallback(
    async (plan: "monthly" | "yearly") => {
      if (!user) return;
      try {
        const supported = await isBillingSupported();
        if (!supported) {
          alert("In-App-Käufe sind auf diesem Gerät nicht verfügbar.");
          return;
        }

        await purchaseSubscription(plan);
        const nextIsPro = await syncProToSession({ id: user.id, email: user.email });
        if (!nextIsPro) {
          alert("Kauf abgeschlossen, Abo noch nicht aktiv. Bitte später erneut prüfen.");
        }
        setPaywallOpen(false);
      } catch (e: any) {
        const msg = String(e?.message ?? "Kauf fehlgeschlagen.");
        alert(msg);
      }
    },
    [user]
  );

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
      setPaywallOpen(false);
    } catch (e: any) {
      const msg = String(e?.message ?? "Wiederherstellung fehlgeschlagen.");
      alert(msg);
    }
  }, [user]);

  // ---------- Routing ----------
  if (route === "/live-training") {
    return (
      // ✅ FIX: h-full statt h-[100dvh]
      <div className="w-full h-full overflow-hidden" style={{ background: "transparent", color: "var(--text)" }}>
        <LiveTrainingPage
          events={events}
          onUpdateEvents={setEvents}
          onExit={exitLiveTraining}
          onMinimize={minimizeLiveTraining}
          eventId={activeLiveEventId}
          onShareWorkout={openWorkoutShare}
        />
      </div>
    );
  }

  if (route === "/debug/trainq") {
    return (
      // ✅ FIX: h-full statt h-[100dvh]
      <div className="w-full h-full overflow-auto" style={{ background: "transparent", color: "var(--text)" }}>
        <TrainQCoreDebug />
      </div>
    );
  }

  // ---------- Normal App Layout: genau 1 Scroll-Container ----------
  return (
    // ✅ FIX: h-full statt h-[100dvh]
    <div className="relative w-full h-full overflow-hidden" style={{ background: "transparent", color: "var(--text)" }}>
      <LiveTrainingMiniBar visible={showMiniBar} onMaximize={maximizeLiveTraining} onAbort={abortFromMiniBar} />

      <div className="h-full w-full overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden" data-app-scroll="true" style={{ paddingBottom: BOTTOM_NAV_PADDING }}>
          <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
            {route === "/community" && <CommunityPage />}
            {route === "/community/inbox" && <CommunityInboxPage />}

            {route === "/workout-share" && (
              <WorkoutSharePage
                workoutId={shareWorkoutId}
                onDone={() => {
                  if (shareReturnTo === "profile") {
                    setActiveTab("profile");
                    setProfileScreen("profile");
                  } else {
                    setActiveTab("dashboard");
                  }
                  pushRoute("/");
                  setRoute("/");
                }}
              />
            )}

            {route === "/public-profile" && (
              <PublicProfilePage
                userId={publicProfileId}
                onBack={() => {
                  pushRoute("/");
                  setRoute("/");
                }}
              />
            )}

            {isTabRoute && activeTab === "dashboard" && (
              <Dashboard
                events={events}
                upcoming={upcomingTrainings}
                onCreateQuickTraining={handleCreateQuickTraining}
                onUpdateEvents={setEvents}
                isPro={isPro}
                onOpenPaywall={openPaywall}
                onOpenWorkoutShare={openWorkoutShare}
                deloadPlan={deloadPlan}
                deloadDismissedUntilISO={deloadDismissedUntilISO}
                planStartISO={planStartISO}
                lastDeloadStartISO={lastDeloadStartISO}
                lastDeloadIntervalWeeks={lastDeloadIntervalWeeks}
                onPlanDeload={handlePlanDeload}
                onDiscardDeload={handleDiscardDeload}
                onDismissDeload={handleDismissDeload}
              />
            )}

            {isTabRoute && activeTab === "calendar" && (
              <CalendarPage
                events={events}
                onAddEvent={handleAddEvent}
                onDeleteEvent={handleDeleteEvent}
                onUpdateEvents={setEvents}
                isPro={isPro}
                deloadPlan={deloadPlan}
              />
            )}

            {isTabRoute && activeTab === "today" && (
              <StartTodayPage
                events={events}
                onPlanTraining={() => {
                  setActiveTab("calendar");
                  pushRoute("/");
                  setRoute("/");
                }}
              />
            )}

            {isTabRoute && activeTab === "plan" && (
              <TrainingsplanPage onAddEvent={handleAddEvent} isPro={isPro} />
            )}

            {isTabRoute && activeTab === "profile" &&
              (profileScreen === "settings" ? (
                <SettingsPage
                  onBack={() => setProfileScreen("profile")}
                  onClearCalendar={handleClearCalendar}
                  onOpenPaywall={openPaywallGeneric}
                  onOpenGoals={() => {
                    // Öffne Onboarding-Ziele-Seite oder ähnliches
                    alert("Meine Ziele: Diese Funktion öffnet die Ziele-Verwaltung. In der finalen Version wird dies zur Onboarding-Ziele-Seite führen.");
                  }}
                />
              ) : (
                <ProfilePage
                  onClearCalendar={handleClearCalendar}
                  onOpenWorkoutShare={openWorkoutShare}
                  onOpenSettings={() => setProfileScreen("settings")}
                />
              ))}
          </div>
        </div>
      </div>

      <PaywallModal
        open={paywallOpen}
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
        isPro={isPro}
        adaptiveBCRemaining={Math.max(0, adaptiveBCRemaining)}
        planShiftRemaining={Math.max(0, planShiftRemaining)}
        calendar7DaysRemaining={Math.max(0, calendar7DaysRemaining)}
        onBuyMonthly={() => handlePurchase("monthly")}
        onBuyYearly={() => handlePurchase("yearly")}
        onRestore={handleRestorePurchases}
      />

      <NavBar
        activeTab={activeTab}
        onChange={(next: TabKey) => {
          setActiveTab(next);
          if (next === "today") {
            pushRoute("/today");
            setRoute("/today");
          } else if (route !== "/") {
            pushRoute("/");
            setRoute("/");
          }
          if (next !== "profile") setProfileScreen("profile");
        }}
      />
    </div>
  );
};

// -------------------- Auth Gate --------------------

const AuthGate: React.FC = () => {
  const { user } = useAuth();

  const [authScreen, setAuthScreen] = useState<"login" | "register" | "forgot">("login");
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => readOnboardingCompletedSafe());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setOnboardingCompleted(readOnboardingCompletedSafe());
    window.addEventListener(ONBOARDING_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(ONBOARDING_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleOnboardingFinished = useCallback(() => {
    setOnboardingCompleted(true);
  }, []);

  if (!user) {
    if (authScreen === "register") return <RegisterPage onGoToLogin={() => setAuthScreen("login")} />;
    if (authScreen === "forgot") return <ForgotPasswordPage onGoBackToLogin={() => setAuthScreen("login")} />;

    return (
      <LoginPage
        onGoToRegister={() => setAuthScreen("register")}
        onGoToForgotPassword={() => setAuthScreen("forgot")}
      />
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingPage onFinished={handleOnboardingFinished} />;
  }

  return <MainAppShell />;
};

// -------------------- Root --------------------

export const App: React.FC = () => {
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (import.meta.env.DEV) {
      ensureTestAccountsSeeded();
    }
  }, []);

  return (
    <AuthContextProvider>
      <OnboardingProvider>
        <AuthGate />
      </OnboardingProvider>
    </AuthContextProvider>
  );
};

export default App;
