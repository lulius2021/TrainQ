import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useI18n } from "../i18n/useI18n";

// Pages
import Dashboard from "../pages/Dashboard";
import TrainingsplanPage from "../pages/TrainingsplanPage";
import CalendarPage from "../pages/CalendarPage";
import ProfilePage from "../pages/ProfilePage";
import StartTodayPage from "../pages/StartTodayPage";
import SettingsPage from "../pages/SettingPage";
import TrainQCoreDebug from "../pages/TrainQCoreDebug";
import LiveTrainingPage from "../pages/training/LiveTrainingPage";
import WorkoutSharePage from "../pages/WorkoutSharePage";
import PublicProfilePage from "../pages/PublicProfilePage";
import ImpressumPage from "../pages/legal/ImpressumPage";
import PrivacyPage from "../pages/legal/PrivacyPage";
import TermsPage from "../pages/legal/TermsPage";
import CsvImportPage from "../pages/CsvImportPage";
import ChallengesPage from "../pages/ChallengesPage";
import NutritionPage from "../pages/NutritionPage";
import CommunityPage from "../pages/community/CommunityPage";
import PostDetailPage from "../pages/community/PostDetailPage";
import CommunityProfilePage from "../pages/community/CommunityProfilePage";
import NotificationsPage from "../pages/community/NotificationsPage";

// Components
import { MainLayout } from "../layouts/MainLayout";
import PaywallModal from "../components/paywall/PaywallModal";

// Hooks & Context
import { useAuth } from "../context/AuthContext";
import { useTabSwipeNavigation } from "../hooks/useTabSwipeNavigation";
import { useEntitlements } from "../hooks/useEntitlements";

// Utils
import { scheduleTrainingReminders } from "../utils/notificationScheduler";
import { loadNotificationPrefs } from "../utils/notificationStorage";
import { isBillingSupported, purchaseSubscription, restorePurchases, syncProToSession } from "../services/purchases";
import { track } from "../analytics/track";
import { abortLiveWorkout, getActiveLiveWorkout, persistActiveLiveWorkout } from "../utils/trainingHistory";
import { useLiveTrainingStore } from "../store/useLiveTrainingStore"; // ✅ NEW IMPORT
import { resolveLiveSeed, writeLiveSeedForEventOrKey } from "../utils/liveTrainingSeed";
import type { LiveTrainingSeed } from "../utils/liveTrainingSeed";
import { getScopedItem, removeScopedItem, setScopedItem } from "../utils/scopedStorage";
import { getActiveUserId } from "../utils/session";
import { applyDeloadToEvent } from "../utils/deload/apply";
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
} from "../utils/deload/storage";
import { computeAvgSessionsPerWeek, mapSessionsToIntervalWeeks } from "../utils/deload/schedule";

// Types
import type { CalendarEvent, NewCalendarEvent, UpcomingTraining } from "../types/training";
import type { DeloadPlan, DeloadRule } from "../types/deload";
import type { TabKey } from "../types";
import type { PaywallReason } from "../utils/entitlements";

// Local Constants & Types
type AppRoute =
    | "/"
    | "/dashboard"
    | "/train"
    | "/today"
    | "/calendar"
    | "/plan"
    | "/profile"
    | "/community"
    | "/community/post"
    | "/community/profile"
    | "/community/notifications"
    | "/live-training"
    | "/debug/trainq"
    | "/workout-share"
    | "/public-profile"
    | "/impressum"
    | "/privacy"
    | "/terms"
    | "/import-csv"
    | "/challenges"
    | "/nutrition";

const STORAGE_KEY_EVENTS = "trainq_calendar_events";
const STORAGE_KEY_ACTIVE_LIVE_EVENT_ID = "trainq_active_live_event_id_v1";
const STORAGE_KEY_PLAN_START_ISO = "trainq_plan_start_date_iso";
const MINI_BAR_BOTTOM = "calc(70px + env(safe-area-inset-bottom))";
const INITIAL_EVENTS: CalendarEvent[] = [];

// -------------------- Helpers (Copied from App.tsx) --------------------

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
    return false;
}

function deriveTrainingTypeFromMeta(raw: unknown): "gym" | "laufen" | "radfahren" | "custom" {
    const anyRaw = raw as Record<string, unknown>;
    const sportLower = String(anyRaw?.sport ?? "").trim().toLowerCase();
    if (sportLower === "laufen" || sportLower === "run" || sportLower === "running") return "laufen";
    if (sportLower === "radfahren" || sportLower === "bike" || sportLower === "cycling") return "radfahren";
    if (sportLower === "custom") return "custom";
    const tt = String(anyRaw?.trainingType ?? "").trim().toLowerCase();
    if (tt === "laufen") return "laufen";
    if (tt === "radfahren") return "radfahren";
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
    return String(s ?? "").trim().replace(/\s+/g, " ");
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
        ev.type === "training" || !!ev.trainingType || !!ev.trainingTypeLegacy ||
        sportLower === "gym" || sportLower === "laufen" || sportLower === "radfahren" || sportLower === "custom" || sportLower === "run" || sportLower === "running" || sportLower === "bike" || sportLower === "cycling";
    if (!training) return ev as CalendarEvent;
    ev.type = "training";
    if (!ev.templateId) ev.templateId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : uuidFallback("tpl");
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
    if (path === "/train") return "/train";
    if (path === "/dashboard") return "/dashboard";
    if (path === "/calendar") return "/calendar";
    if (path === "/plan") return "/plan";
    if (path === "/profile") return "/profile";
    if (path === "/workout-share") return "/workout-share";
    if (path === "/impressum") return "/impressum";
    if (path === "/privacy") return "/privacy";
    if (path === "/terms") return "/terms";
    if (path === "/import-csv") return "/import-csv";
    if (path === "/challenges") return "/challenges";
    if (path === "/nutrition") return "/nutrition";
    if (path === "/community/post") return "/community/post";
    if (path === "/community/profile") return "/community/profile";
    if (path === "/community/notifications") return "/community/notifications";
    if (path === "/community") return "/community";
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

function replaceRoute(path: AppRoute): void {
    if (typeof window === "undefined") return;
    if (window.location.pathname === path) return;
    window.history.replaceState({}, "", path);
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
        try { setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(normalized), userId); } catch { }
        return normalized;
    } catch {
        return INITIAL_EVENTS;
    }
}

function writeEventsToStorage(events: CalendarEvent[], userId?: string) {
    if (typeof window === "undefined") return;
    try {
        setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(events), userId);
        window.dispatchEvent(new Event("trainq:update_events"));
    } catch { }
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




// -------------------- Mini Bar Component --------------------

const LiveTrainingMiniBar: React.FC<{
    visible: boolean;
    onMaximize: (eventId?: string) => void;
    onAbort: () => void;
}> = ({ visible, onMaximize, onAbort }) => {
    const { t } = useI18n();
    const active = useLiveTrainingStore((state) => state.activeWorkout);
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        if (!visible || !active) return;
        const t = window.setInterval(() => forceUpdate(n => n + 1), 1000);
        return () => window.clearInterval(t);
    }, [visible, !!active]);

    if (!visible) return null;
    if (!active || !active.isActive) return null;

    return (
        <div className="fixed left-4 right-4 z-50" style={{ bottom: "calc(96px + env(safe-area-inset-bottom))" }}>
            <div className="mx-auto max-w-5xl border focus:ring-2 focus:ring-blue-500/20 rounded-2xl p-3 backdrop-blur-xl shadow-lg shadow-black/40" style={{ backgroundColor: "var(--mini-bar-bg)", borderColor: "var(--border-color)" }}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("live.mini.running")}</div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-base font-bold tabular-nums" style={{ color: "var(--text-color)" }}>
                                {formatElapsedFromISO(active.startedAt)}
                            </div>
                            <div className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{active.title}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onMaximize(active.calendarEventId)} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white">
                            {t("live.mini.maximize")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// -------------------- Main App Shell --------------------

type ProfileScreen = "profile" | "settings";

const MainAppShell: React.FC = () => {
    const { user } = useAuth();
    const userId = user?.id;

    const [activeTab, setActiveTab] = useState<TabKey>(() => {
        if (typeof window === "undefined") return "today"; // Default to 'today' (Train)
        const path = window.location.pathname;
        if (path === "/dashboard") return "dashboard";
        if (path === "/calendar") return "calendar";
        if (path === "/plan") return "plan";
        if (path === "/community" || path.startsWith("/community/")) return "community";
        if (path === "/profile") return "profile";
        return "today"; // Default /train -> today tab
    });
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

    // Community sub-navigation state
    const [communityPostId, setCommunityPostId] = useState<string | null>(null);
    const [communityProfileId, setCommunityProfileId] = useState<string | null>(null);

    const { isPro, adaptiveBCRemaining, planShiftRemaining, calendar7DaysRemaining, suggestionsRemaining } = useEntitlements(userId);
    const [paywallOpen, setPaywallOpen] = useState(false);
    const [paywallReason, setPaywallReason] = useState<PaywallReason>("calendar_7days");

    const [events, setEvents] = useState<CalendarEvent[]>(() => {
        const loaded = readEventsFromStorage(userId);
        return loaded.map((ev) => {
            if (ev.type === "training" && !ev.trainingType) {
                return ensureTrainingMeta(ev);
            }
            return ev;
        });
    });

    const [planStartISO, setPlanStartISO] = useState<string | null>(() => getScopedItem(STORAGE_KEY_PLAN_START_ISO, userId));
    const [deloadPlan, setDeloadPlan] = useState<DeloadPlan | null>(() => readDeloadPlan(userId));
    const [deloadDismissedUntilISO, setDeloadDismissedUntilISO] = useState<string | null>(() => readDeloadDismissedUntil(userId));
    const [lastDeloadStartISO, setLastDeloadStartISO] = useState<string | null>(() => readLastDeloadStartISO(userId));
    const [lastDeloadIntervalWeeks, setLastDeloadIntervalWeeks] = useState<number | null>(() => readLastDeloadIntervalWeeks(userId));

    useEffect(() => { writeEventsToStorage(events, userId); }, [events, userId]);

    // Schedule local notifications when events change
    useEffect(() => {
        try {
            const prefs = loadNotificationPrefs();
            if (!prefs.trainingReminder) return;

            const todayStr = todayISO();
            const trainingEvents = events
                .filter((e) => e.type === "training" && e.date >= todayStr)
                .map((e) => ({
                    date: e.date,
                    startTime: e.startTime || undefined,
                    title: e.title,
                }));

            scheduleTrainingReminders(trainingEvents).catch(() => {
                // Non-blocking — silently ignore
            });
        } catch {
            // Non-blocking
        }
    }, [events]);

    // ✅ CHECK AUTO-RESTORE ON MOUNT
    const restoreChecked = useRef(false);
    useEffect(() => {
        if (restoreChecked.current) return;
        restoreChecked.current = true;

        const stored = useLiveTrainingStore.getState().activeWorkout;
        if (stored && stored.isActive) {
            if (stored.calendarEventId) setActiveLiveEventId(stored.calendarEventId);
            setRoute("/live-training");
            window.history.replaceState(null, "", "/live-training");
        }
    }, []);

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
            } else if (nextRoute === "/train" || nextRoute === "/today") {
                setActiveTab("today");
            } else if (nextRoute === "/dashboard") {
                setActiveTab("dashboard");
            } else if (nextRoute === "/calendar") {
                setActiveTab("calendar");
            } else if (nextRoute === "/plan") {
                setActiveTab("plan");
            } else if (nextRoute === "/community") {
                setActiveTab("community");
            } else if (nextRoute === "/profile") {
                setActiveTab("profile");
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
            } else if (next === "/train" || next === "/today") {
                setActiveTab("today");
            } else if (next === "/dashboard") {
                setActiveTab("dashboard");
            } else if (next === "/calendar") {
                setActiveTab("calendar");
            } else if (next === "/plan") {
                setActiveTab("plan");
            } else if (next === "/community") {
                setActiveTab("community");
            } else if (next === "/profile") {
                setActiveTab("profile");
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

        const onEventsUpdated = () => {
            // Force refresh from storage
            setEvents(readEventsFromStorage(userId));
        };
        window.addEventListener("trainq:update_events", onEventsUpdated as EventListener);

        onPopState();
        return () => {
            window.removeEventListener("popstate", onPopState);
            window.removeEventListener("trainq:navigate", onCustomNavigate as EventListener);
            window.removeEventListener("trainq:update_events", onEventsUpdated as EventListener);
        };
    }, [userId]);

    // Deep link listener for Garmin OAuth callback
    useEffect(() => {
        let cleanup: (() => void) | undefined;
        import("@capacitor/app").then(({ App: CapApp }) => {
            const promise = CapApp.addListener("appUrlOpen", (event: { url: string }) => {
                if (event.url.includes("garmin-callback")) {
                    try {
                        const url = new URL(event.url);
                        const status = url.searchParams.get("status");
                        if (status === "success") {
                            window.dispatchEvent(new CustomEvent("trainq:garmin_connected"));
                        } else {
                            window.dispatchEvent(new CustomEvent("trainq:garmin_error", {
                                detail: { message: url.searchParams.get("message") },
                            }));
                        }
                    } catch {
                        // URL parsing failed, ignore
                    }
                }
            });
            cleanup = () => { promise.then((l) => l.remove()); };
        }).catch(() => {
            // @capacitor/app not available (web-only)
        });
        return () => { cleanup?.(); };
    }, []);

    // Redirect root to /train
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.location.pathname === "/") {
            replaceRoute("/train");
            setRoute("/train");
            setActiveTab("today");
        }
    }, []);

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
        const onOpenSettings = () => { setActiveTab("profile"); setProfileScreen("settings"); };
        const onOpenPaywall = (e: Event) => { if (isPro) return; const reason = (e as CustomEvent)?.detail?.reason; setPaywallReason(reason || "calendar_7days"); setPaywallOpen(true); };
        window.addEventListener("trainq:open_settings", onOpenSettings as EventListener);
        window.addEventListener("trainq:open_paywall", onOpenPaywall as EventListener);
        return () => {
            window.removeEventListener("trainq:open_settings", onOpenSettings as EventListener);
            window.removeEventListener("trainq:open_paywall", onOpenPaywall as EventListener);
        };
    }, [isPro]);

    const activeWorkout = useLiveTrainingStore((state) => state.activeWorkout);
    // ✅ CRITICAL FIX: MiniPlayer works globally whenever training is active but NOT on screen
    // We ignore 'isMinimized' flag because if we are not on the route, it IS effectively minimized.
    const hasActiveWorkout = !!activeWorkout?.isActive;

    // Logic: Show if workout is active AND we are NOT on the full-screen live page
    const showMiniBar = hasActiveWorkout && route !== "/live-training";

    const isSwipeBlocked = useCallback(() => {
        if (paywallOpen) return true;
        if (typeof document === "undefined") return false;
        if (document.documentElement.classList.contains("modal-open")) return true;
        return !!document.querySelector('[data-overlay-open="true"]');
    }, [paywallOpen]);

    const tabOrder: TabKey[] = ["dashboard", "calendar", "today", "plan", "community", "profile"];
    const isTabRoute = route === "/" || route === "/dashboard" || route === "/train" || route === "/today" || route === "/calendar" || route === "/plan" || route === "/community" || route === "/profile";
    const tabSwipeEnabled = isTabRoute && profileScreen === "profile" && !paywallOpen;

    useTabSwipeNavigation({
        enabled: false, // ❌ Global Swipe Disabled per User Request
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
        // No explicit 'any' needed if CalendarEvent is strict enough.
        const isTraining = ev.type === "training";
        if (!isTraining) return;

        const dateISO = String(ev.date || "").trim();
        const title = normalizeTitle(ev.title);
        const eventId = String(ev.id || "").trim();

        if (!eventId || !dateISO || !title) return;
        const existing = resolveLiveSeed({ eventId, dateISO, title });
        if (existing) return;

        const trainingType = String(ev.trainingType ?? "").toLowerCase() as "gym" | "laufen" | "radfahren" | "custom";
        const sport: LiveTrainingSeed["sport"] = trainingType === "laufen" ? "Laufen" : trainingType === "radfahren" ? "Radfahren" : trainingType === "custom" ? "Custom" : "Gym";
        const isCardio = trainingType === "laufen" || trainingType === "radfahren";

        // Check if we have pre-planned workout data
        const workoutData = ev.workoutData;
        const exercises = workoutData?.exercises?.map((ex) => ({
            id: ex.id,
            exerciseId: ex.exerciseId,
            name: ex.name,
            sets: ex.sets.map((s) => ({
                id: s.id,
                reps: s.reps,
                weight: s.weight,
                notes: s.notes,
            })),
        })) || [];

        const seed: LiveTrainingSeed = { title, sport, isCardio, exercises };
        writeLiveSeedForEventOrKey({ eventId, dateISO, title, seed });
    }, []);

    const createEventFromInput = useCallback(
        (data: NewCalendarEvent): CalendarEvent => {
            const created: CalendarEvent = { ...data, id: ensureId(), userId: userId ?? getActiveUserId() ?? undefined } as any; // 'as any' here for NewCalendarEvent -> CalendarEvent transition is acceptable if ID is added
            let newEvent = ensureTrainingMeta(created);
            maybeAutoSeedTraining(newEvent);
            if (deloadPlan && newEvent.type === "training" && isISOInRange(newEvent.date, deloadPlan.startISO, deloadPlan.endISO)) {
                newEvent = applyDeloadToEvent(newEvent, deloadPlan.rules);
            } else if (newEvent.deload) {
                newEvent = { ...newEvent, deload: undefined };
            }
            return newEvent;
        },
        [maybeAutoSeedTraining, deloadPlan]
    );

    const handleCreateQuickTraining = useCallback((data: NewCalendarEvent) => {
        const newEvent = createEventFromInput(data);
        setEvents((prev) => [...prev, newEvent]);
    }, [createEventFromInput]);

    const handleAddEvent = useCallback((data: NewCalendarEvent) => {
        const newEvent = createEventFromInput(data);
        setEvents((prev) => [...prev, newEvent]);
    }, [createEventFromInput]);

    const handleDeleteEvent = useCallback((id: string) => { setEvents((prev) => prev.filter((e) => e.id !== id)); }, []);
    const handleClearCalendar = useCallback(() => { setEvents([]); }, []);

    const upcomingTrainings = useMemo(() => {
        const todayIso = todayISO();
        return events.filter((e) => e.type === "training" && e.date >= todayIso).sort((a, b) => (a.date + (a.startTime || "")).localeCompare(b.date + (b.startTime || ""))).slice(0, 5).map<UpcomingTraining>((e) => ({
            id: e.id, title: e.title, date: e.date, time: e.startTime || "", notes: e.notes ?? e.description, sport: e.trainingType, status: e.trainingStatus,
        }));
    }, [events]);

    const exitLiveTraining = useCallback(() => { setActiveLiveEventId(undefined); writeActiveLiveEventId(undefined, userId); pushRoute("/"); setRoute("/"); setActiveTab("dashboard"); }, []);
    const minimizeLiveTraining = useCallback(() => { pushRoute("/"); setRoute("/"); }, []);
    const maximizeLiveTraining = useCallback((eventIdFromWorkout?: string) => {
        const normalized = typeof eventIdFromWorkout === "string" && eventIdFromWorkout.trim() ? eventIdFromWorkout.trim() : activeLiveEventId;
        setActiveLiveEventId(normalized);
        writeActiveLiveEventId(normalized, userId);
        const active: any = getActiveLiveWorkout();
        if (active && active.isActive) persistActiveLiveWorkout({ ...active, isMinimized: false });
        window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/live-training", eventId: normalized } }));
    }, [activeLiveEventId]);
    const abortFromMiniBar = useCallback(() => { const active: any = getActiveLiveWorkout(); if (active && active.isActive) abortLiveWorkout(active); exitLiveTraining(); }, [exitLiveTraining]);

    const handlePurchase = useCallback(async (plan: "monthly" | "yearly") => {
        if (!user) return;
        try {
            const supported = await isBillingSupported();
            if (!supported) { alert("In-App-Käufe sind auf diesem Gerät nicht verfügbar."); return; }
            await purchaseSubscription(plan);
            const nextIsPro = await syncProToSession({ id: user.id, email: user.email });
            if (!nextIsPro) alert("Kauf abgeschlossen, Abo noch nicht aktiv. Bitte später erneut prüfen.");
            else track("monetization_purchase_success", { plan });
            setPaywallOpen(false);
        } catch (e: any) { track("monetization_purchase_failed", { plan, error: String(e?.message ?? "unknown") }); alert(String(e?.message ?? "Kauf fehlgeschlagen.")); }
    }, [user]);

    const handleRestorePurchases = useCallback(async () => {
        if (!user) return;
        try {
            const supported = await isBillingSupported();
            if (!supported) { alert("In-App-Käufe sind auf diesem Gerät nicht verfügbar."); return; }
            const nextIsPro = await restorePurchases();
            await syncProToSession({ id: user.id, email: user.email });
            if (!nextIsPro) alert("Kein aktives Abo gefunden.");
            else track("monetization_restore_success", {});
            setPaywallOpen(false);
        } catch (e: any) { alert(String(e?.message ?? "Wiederherstellung fehlgeschlagen.")); }
    }, [user]);

    // ---------- Routing Views ----------

    if (route === "/live-training") {
        return (
            <div className="w-full h-full overflow-hidden">
                <LiveTrainingPage events={events} onUpdateEvents={setEvents} onExit={exitLiveTraining} onMinimize={minimizeLiveTraining} eventId={activeLiveEventId} onShareWorkout={openWorkoutShare} />
            </div>
        );
    }
    if (route === "/debug/trainq") return <div className="w-full h-full overflow-auto"><TrainQCoreDebug /></div>;
    if (route === "/impressum") return <div className="w-full h-full overflow-y-auto"><ImpressumPage /></div>;
    if (route === "/privacy") return <div className="w-full h-full overflow-y-auto"><PrivacyPage /></div>;
    if (route === "/terms") return <div className="w-full h-full overflow-y-auto"><TermsPage /></div>;
    if (route === "/import-csv") return <div className="w-full h-full overflow-y-auto"><CsvImportPage onBack={() => { pushRoute("/profile"); setRoute("/profile"); setActiveTab("profile"); setProfileScreen("settings"); }} /></div>;
    if (route === "/challenges") return <div className="w-full h-full overflow-y-auto"><ChallengesPage onBack={() => { pushRoute("/dashboard"); setRoute("/dashboard"); setActiveTab("dashboard"); }} /></div>;
    if (route === "/nutrition") return <div className="w-full h-full overflow-y-auto"><NutritionPage onBack={() => { pushRoute("/dashboard"); setRoute("/dashboard"); setActiveTab("dashboard"); }} /></div>;
    if (route === "/community/post" && communityPostId && userId) return <div className="w-full h-full overflow-hidden"><PostDetailPage postId={communityPostId} viewerId={userId} onBack={() => { pushRoute("/community"); setRoute("/community"); setActiveTab("community"); setCommunityPostId(null); }} onAuthorTap={(uid) => { setCommunityProfileId(uid); pushRoute("/community/profile"); setRoute("/community/profile"); }} onPostDeleted={() => {}} /></div>;
    if (route === "/community/profile" && communityProfileId && userId) return <div className="w-full h-full overflow-hidden"><CommunityProfilePage profileUserId={communityProfileId} viewerId={userId} onBack={() => { pushRoute("/community"); setRoute("/community"); setActiveTab("community"); setCommunityProfileId(null); }} onOpenPostDetail={(pid) => { setCommunityPostId(pid); pushRoute("/community/post"); setRoute("/community/post"); }} /></div>;
    if (route === "/community/notifications" && userId) return <div className="w-full h-full overflow-hidden"><NotificationsPage userId={userId} onBack={() => { pushRoute("/community"); setRoute("/community"); setActiveTab("community"); }} onOpenPostDetail={(pid) => { setCommunityPostId(pid); pushRoute("/community/post"); setRoute("/community/post"); }} onOpenProfile={(uid) => { setCommunityProfileId(uid); pushRoute("/community/profile"); setRoute("/community/profile"); }} /></div>;

    // ---------- App Layout via MainLayout ----------

    return (
        <MainLayout
            activeTab={activeTab}
            onTabChange={(next) => {
                setActiveTab(next);
                if (next === "today") { pushRoute("/train"); setRoute("/train"); }
                else if (next === "dashboard") { pushRoute("/dashboard"); setRoute("/dashboard"); }
                else if (next === "calendar") { pushRoute("/calendar"); setRoute("/calendar"); }
                else if (next === "plan") { pushRoute("/plan"); setRoute("/plan"); }
                else if (next === "community") { pushRoute("/community"); setRoute("/community"); }
                else if (next === "profile") { pushRoute("/profile"); setRoute("/profile"); }

                if (next !== "profile") setProfileScreen("profile");
            }}
            showNavBar={true}
            floatingWidget={<LiveTrainingMiniBar visible={showMiniBar} onMaximize={maximizeLiveTraining} onAbort={abortFromMiniBar} />}
        >

            {route === "/workout-share" && (
                <WorkoutSharePage
                    workoutId={shareWorkoutId}
                    onDone={() => {
                        if (shareReturnTo === "profile") { setActiveTab("profile"); setProfileScreen("profile"); } else { setActiveTab("dashboard"); }
                        pushRoute("/"); setRoute("/");
                    }}
                />
            )}

            {route === "/public-profile" && (
                <PublicProfilePage userId={publicProfileId} onBack={() => { pushRoute("/"); setRoute("/"); }} />
            )}

            {isTabRoute && activeTab === "dashboard" && (
                <Dashboard />
            )}

            {isTabRoute && activeTab === "calendar" && (
                <CalendarPage />
            )}

            {isTabRoute && activeTab === "today" && (
                <StartTodayPage events={events} onPlanTraining={() => { setActiveTab("calendar"); pushRoute("/"); setRoute("/"); }} />
            )}

            {isTabRoute && activeTab === "plan" && (
                <TrainingsplanPage onAddEvent={handleAddEvent} isPro={isPro} />
            )}

            {isTabRoute && activeTab === "community" && userId && (
                <CommunityPage
                    onOpenPostDetail={(pid) => { setCommunityPostId(pid); pushRoute("/community/post"); setRoute("/community/post"); }}
                    onOpenProfile={(uid) => { setCommunityProfileId(uid); pushRoute("/community/profile"); setRoute("/community/profile"); }}
                    onOpenNotifications={() => { pushRoute("/community/notifications"); setRoute("/community/notifications"); }}
                />
            )}

            {isTabRoute && activeTab === "profile" && (
                profileScreen === "settings" ? (
                    <SettingsPage onBack={() => setProfileScreen("profile")} onClearCalendar={handleClearCalendar} onOpenPaywall={() => setPaywallOpen(true)} onOpenGoals={() => alert("Funktion folgt.")} />
                ) : (
                    <ProfilePage onClearCalendar={handleClearCalendar} onOpenWorkoutShare={openWorkoutShare} />
                )
            )}

            <PaywallModal open={paywallOpen} reason={paywallReason} onClose={() => setPaywallOpen(false)} isPro={isPro} adaptiveBCRemaining={Math.max(0, adaptiveBCRemaining)} planShiftRemaining={Math.max(0, planShiftRemaining)} calendar7DaysRemaining={Math.max(0, calendar7DaysRemaining)} onBuyMonthly={() => handlePurchase("monthly")} onBuyYearly={() => handlePurchase("yearly")} onRestore={handleRestorePurchases} />
        </MainLayout>
    );
};

export default MainAppShell;
