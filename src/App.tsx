// src/App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Seiten (Haupt-App)
import { Dashboard } from "./pages/Dashboard";
import TrainingsplanPage from "./pages/TrainingsplanPage";
import { CalendarPage } from "./pages/CalendarPage";
import ProfilePage from "./pages/ProfilePage";

// Settings
import SettingsPage from "./pages/SettingPage";

// TrainQ Core Debug
import TrainQCoreDebug from "./pages/TrainQCoreDebug";

// Live-Training
import LiveTrainingPage from "./pages/training/LiveTrainingPage";

// Auth & Onboarding
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage";

// Context + Hooks
import { AuthContextProvider } from "./context/AuthContext";
import { useAuth } from "./hooks/useAuth";

// Entitlements
import { useEntitlements } from "./hooks/useEntitlements";
import type { PaywallReason } from "./utils/entitlements";

// Paywall UI
import PaywallModal from "./components/paywall/PaywallModal";

// Onboarding Source of Truth
import { OnboardingProvider, readOnboardingDataFromStorage } from "./context/OnboardingContext";

// ✅ NavBar (floating)
import { NavBar } from "./components/NavBar";

// Typen
import type { CalendarEvent, NewCalendarEvent, UpcomingTraining } from "./types/training";

// Live Workout API (für Mini-Bar)
import { abortLiveWorkout, getActiveLiveWorkout, persistActiveLiveWorkout } from "./utils/trainingHistory";

// AUTO-SEED FIX
import { resolveLiveSeed, writeLiveSeedForEventOrKey, type LiveTrainingSeed } from "./utils/liveTrainingSeed";

// TestFlight Seed (10 Pro + 3 Free)
import { ensureTestAccountsSeeded } from "./utils/testAccountsSeed";

const INITIAL_EVENTS: CalendarEvent[] = [];

/** Exportiert für andere Komponenten */
export type TabKey = "dashboard" | "calendar" | "plan" | "profile";
type AppRoute = "/" | "/live-training" | "/debug/trainq";

const STORAGE_KEY_EVENTS = "trainq_calendar_events";
const STORAGE_KEY_ACTIVE_LIVE_EVENT_ID = "trainq_active_live_event_id_v1";
const ONBOARDING_CHANGED_EVENT = "trainq:onboarding_changed";

// Platz, den wir unten IMMER freihalten (NavBar + etwas Luft). Muss zur echten NavBar passen.
const APP_BOTTOM_SPACE_PX = 110;

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

  return "/";
}

function pushRoute(path: AppRoute): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function readActiveLiveEventId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_ACTIVE_LIVE_EVENT_ID);
    return v || undefined;
  } catch {
    return undefined;
  }
}

function writeActiveLiveEventId(eventId?: string) {
  if (typeof window === "undefined") return;
  try {
    if (!eventId) window.localStorage.removeItem(STORAGE_KEY_ACTIVE_LIVE_EVENT_ID);
    else window.localStorage.setItem(STORAGE_KEY_ACTIVE_LIVE_EVENT_ID, eventId);
  } catch {
    // ignore
  }
}

function readEventsFromStorage(): CalendarEvent[] {
  if (typeof window === "undefined") return INITIAL_EVENTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) return INITIAL_EVENTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_EVENTS;

    const normalized = parsed.map(normalizeLoadedEvent).filter(Boolean) as CalendarEvent[];

    try {
      window.localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(normalized));
    } catch {
      // ignore
    }

    return normalized;
  } catch {
    return INITIAL_EVENTS;
  }
}

function writeEventsToStorage(events: CalendarEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
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
  const safeBottom = "env(safe-area-inset-bottom, 0px)";
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

  const MINI_BAR_BOTTOM_PX = Math.max(84, APP_BOTTOM_SPACE_PX - 6);

  return (
    <div className="fixed left-0 right-0 z-[60] px-3" style={{ bottom: `calc(${MINI_BAR_BOTTOM_PX}px + ${safeBottom})` }}>
      <div
        className="
          mx-auto max-w-5xl rounded-2xl border px-4 py-3 backdrop-blur shadow-lg
          bg-white/85 border-black/10 text-slate-900 shadow-black/10
          dark:bg-brand-card/90 dark:border-white/10 dark:text-slate-100 dark:shadow-black/40
        "
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-white/60">Live-Training läuft</div>
            <div className="flex items-baseline gap-2">
              <div className="text-base font-semibold tabular-nums text-slate-900 dark:text-white/90">
                {formatElapsedFromISO(active.startedAt)}
              </div>
              <div className="text-[11px] truncate text-slate-600 dark:text-white/55">{active.title}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onMaximize(active.calendarEventId)}
              className="rounded-2xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand-primary/90"
            >
              Maximieren
            </button>

            <button
              type="button"
              onClick={onAbort}
              className="
                rounded-2xl border px-4 py-2.5 text-sm
                border-black/10 bg-black/5 text-slate-700 hover:bg-black/10
                dark:border-white/15 dark:bg-black/30 dark:text-white/80 dark:hover:bg-white/5
              "
            >
              Abbrechen
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
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [activeLiveEventId, setActiveLiveEventId] = useState<string | undefined>(() => readActiveLiveEventId());

  const [profileScreen, setProfileScreen] = useState<ProfileScreen>("profile");

  const { user, setUserPro } = useAuth();
  const userId = user?.id;

  const { isPro, setPro, adaptiveBCRemaining, planShiftRemaining, calendar7DaysRemaining } = useEntitlements(userId);

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason>("calendar_7days");

  const [events, setEvents] = useState<CalendarEvent[]>(() => readEventsFromStorage());

  useEffect(() => {
    writeEventsToStorage(events);
  }, [events]);

  useEffect(() => {
    if (!userId) return;
    const accountPro = user?.isPro === true;
    if (accountPro !== isPro) setPro(accountPro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user?.isPro]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      const nextRoute = getRouteFromLocation();
      setRoute(nextRoute);

      if (nextRoute === "/live-training") {
        setActiveLiveEventId(readActiveLiveEventId());
      }
    };

    const onCustomNavigate = (ev: Event) => {
      const e = ev as CustomEvent<{ path?: AppRoute; eventId?: string }>;
      const next = e?.detail?.path;
      if (!next) return;

      const nextEventId = e?.detail?.eventId;
      if (next === "/live-training") {
        const normalized = typeof nextEventId === "string" && nextEventId.trim() ? nextEventId.trim() : undefined;
        setActiveLiveEventId(normalized);
        writeActiveLiveEventId(normalized);
      } else {
        const active = getActiveLiveWorkout();
        if (!active || !active.isActive) {
          setActiveLiveEventId(undefined);
          writeActiveLiveEventId(undefined);
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
  }, []);

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

  const maybeAutoSeedGymTraining = useCallback((ev: CalendarEvent) => {
    const anyEv: any = ev;
    const isTraining = anyEv?.type === "training";
    const isGym = String(anyEv?.trainingType ?? "").toLowerCase() === "gym";
    if (!isTraining || !isGym) return;

    const dateISO = String(anyEv?.date ?? "").trim();
    const title = normalizeTitle(anyEv?.title);
    const eventId = String(anyEv?.id ?? "").trim();
    if (!eventId || !dateISO || !title) return;

    const existing = resolveLiveSeed({ eventId, dateISO, title });
    if (existing) return;

    const seed: LiveTrainingSeed = {
      title,
      sport: "Gym",
      isCardio: false,
      exercises: [],
    };

    writeLiveSeedForEventOrKey({ eventId, dateISO, title, seed });
  }, []);

  const createEventFromInput = useCallback(
    (data: NewCalendarEvent): CalendarEvent => {
      const created: CalendarEvent = { ...data, id: ensureId() } as any;
      const newEvent = ensureTrainingMeta(created);
      maybeAutoSeedGymTraining(newEvent);
      return newEvent;
    },
    [maybeAutoSeedGymTraining]
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
    writeActiveLiveEventId(undefined);
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
      writeActiveLiveEventId(normalized);

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
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: `calc(${APP_BOTTOM_SPACE_PX}px + ${safeBottom})` }}>
          <div className="mx-auto w-full max-w-5xl px-2 sm:px-4">
            {activeTab === "dashboard" && (
              <Dashboard
                events={events}
                upcoming={upcomingTrainings}
                onCreateQuickTraining={handleCreateQuickTraining}
                onUpdateEvents={setEvents}
                isPro={isPro}
                onOpenPaywall={openPaywall}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarPage
                events={events}
                onAddEvent={handleAddEvent}
                onDeleteEvent={handleDeleteEvent}
                isPro={isPro}
                onOpenPaywall={openPaywall}
              />
            )}

            {activeTab === "plan" && (
              <TrainingsplanPage onAddEvent={handleAddEvent} isPro={isPro} onOpenPaywall={openPaywall} />
            )}

            {activeTab === "profile" &&
              (profileScreen === "settings" ? (
                <SettingsPage
                  onBack={() => setProfileScreen("profile")}
                  onClearCalendar={handleClearCalendar}
                  onOpenPaywall={openPaywallGeneric}
                />
              ) : (
                <ProfilePage onClearCalendar={handleClearCalendar} />
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
        onStartTrial={() => {
          setPaywallOpen(false);
          setUserPro(true);
        }}
        onBuyMonthly={() => {
          setPaywallOpen(false);
          setUserPro(true);
        }}
        onBuyYearly={() => {
          setPaywallOpen(false);
          setUserPro(true);
        }}
      />

      <NavBar
        activeTab={activeTab}
        onChange={(next: TabKey) => {
          setActiveTab(next);
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
    ensureTestAccountsSeeded();
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