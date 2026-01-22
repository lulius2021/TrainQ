import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/useI18n";

// Pages
import Dashboard from "../pages/Dashboard";
import TrainingsplanPage from "../pages/TrainingsplanPage";
import { CalendarPage } from "../pages/CalendarPage";
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

// Components
import { MainLayout } from "../layouts/MainLayout";
import PaywallModal from "../components/paywall/PaywallModal";

// Hooks & Context
import { useAuth } from "../context/AuthContext";
import { useTabSwipeNavigation } from "../hooks/useTabSwipeNavigation";
import { useEntitlements } from "../hooks/useEntitlements";

// Utils
import { isBillingSupported, purchaseSubscription, restorePurchases, syncProToSession } from "../services/purchases";
import { abortLiveWorkout, getActiveLiveWorkout, persistActiveLiveWorkout } from "../utils/trainingHistory";
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
    | "/today"
    | "/live-training"
    | "/debug/trainq"
    | "/workout-share"
    | "/public-profile"
    | "/impressum"
    | "/privacy"
    | "/terms";

const STORAGE_KEY_EVENTS = "trainq_calendar_events";
const STORAGE_KEY_ACTIVE_LIVE_EVENT_ID = "trainq_active_live_event_id_v1";
const STORAGE_KEY_PLAN_START_ISO = "trainq_plan_start_date_iso";
const MINI_BAR_BOTTOM = "calc(var(--nav-height) + var(--bottom-nav-gap))";
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
    if (path === "/workout-share") return "/workout-share";
    if (path === "/impressum") return "/impressum";
    if (path === "/privacy") return "/privacy";
    if (path === "/terms") return "/terms";
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
        try { setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(normalized), userId); } catch { }
        return normalized;
    } catch {
        return INITIAL_EVENTS;
    }
}

function writeEventsToStorage(events: CalendarEvent[], userId?: string) {
    if (typeof window === "undefined") return;
    try { setScopedItem(STORAGE_KEY_EVENTS, JSON.stringify(events), userId); } catch { }
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
            <div className="mx-auto max-w-5xl rounded-[32px] border border-[var(--border)] bg-[var(--surface)] p-3 backdrop-blur-xl shadow-lg shadow-black/40">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] text-gray-400">{t("live.mini.running")}</div>
                        <div className="flex items-baseline gap-2">
                            <div className="text-base font-bold tabular-nums text-white">
                                {formatElapsedFromISO(active.startedAt)}
                            </div>
                            <div className="truncate text-[11px] text-gray-400">{active.title}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => onMaximize(active.calendarEventId)} className="rounded-2xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white">
                            {t("live.mini.maximize")}
                        </button>
                        <button type="button" onClick={onAbort} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white/80">
                            {t("common.cancel")}
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
        const onOpenSettings = () => { setActiveTab("profile"); setProfileScreen("settings"); };
        const onOpenPaywall = () => { if (isPro) return; setPaywallReason("calendar_7days"); setPaywallOpen(true); };
        window.addEventListener("trainq:open_settings", onOpenSettings as EventListener);
        window.addEventListener("trainq:open_paywall", onOpenPaywall as EventListener);
        return () => {
            window.removeEventListener("trainq:open_settings", onOpenSettings as EventListener);
            window.removeEventListener("trainq:open_paywall", onOpenPaywall as EventListener);
        };
    }, [isPro]);

    const [hasActiveWorkout, setHasActiveWorkout] = useState<boolean>(() => {
        const a = getActiveLiveWorkout();
        return !!a?.isActive && a?.isMinimized === true;
    });

    useEffect(() => {
        const t = window.setInterval(() => {
            const a = getActiveLiveWorkout();
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

    const tabOrder: TabKey[] = ["dashboard", "calendar", "today", "profile"];
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
        // No explicit 'any' needed if CalendarEvent is strict enough.
        // But for safety against runtime partial objects we keep safe checks
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
        const seed: LiveTrainingSeed = { title, sport, isCardio, exercises: [] };
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
            setPaywallOpen(false);
        } catch (e: any) { alert(String(e?.message ?? "Kauf fehlgeschlagen.")); }
    }, [user]);

    const handleRestorePurchases = useCallback(async () => {
        if (!user) return;
        try {
            const supported = await isBillingSupported();
            if (!supported) { alert("In-App-Käufe sind auf diesem Gerät nicht verfügbar."); return; }
            const nextIsPro = await restorePurchases();
            await syncProToSession({ id: user.id, email: user.email });
            if (!nextIsPro) alert("Kein aktives Abo gefunden.");
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

    // ---------- App Layout via MainLayout ----------

    return (
        <MainLayout
            activeTab={activeTab}
            onTabChange={(next) => {
                setActiveTab(next);
                if (next === "today") { pushRoute("/today"); setRoute("/today"); }
                else if (route !== "/") { pushRoute("/"); setRoute("/"); }
                if (next !== "profile") setProfileScreen("profile");
            }}
            showNavBar={true}
        >
            <LiveTrainingMiniBar visible={showMiniBar} onMaximize={maximizeLiveTraining} onAbort={abortFromMiniBar} />

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
                <Dashboard
                    events={events}
                    upcoming={upcomingTrainings}
                    onCreateQuickTraining={handleCreateQuickTraining}
                    onUpdateEvents={setEvents}
                    isPro={isPro}
                    onOpenPaywall={(reason) => {
                        setPaywallReason(reason);
                        setPaywallOpen(true);
                    }}
                    onOpenWorkoutShare={openWorkoutShare}
                />
            )}

            {isTabRoute && activeTab === "calendar" && (
                <CalendarPage events={events} onAddEvent={handleAddEvent} onDeleteEvent={handleDeleteEvent} onUpdateEvents={setEvents} isPro={isPro} />
            )}

            {isTabRoute && activeTab === "today" && (
                <StartTodayPage events={events} onPlanTraining={() => { setActiveTab("calendar"); pushRoute("/"); setRoute("/"); }} />
            )}

            {isTabRoute && activeTab === "plan" && (
                <TrainingsplanPage onAddEvent={handleAddEvent} isPro={isPro} />
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
