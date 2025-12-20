// src/App.tsx

import React, { useEffect, useMemo, useState } from "react";

// Seiten (Haupt-App)
import { Dashboard } from "./pages/Dashboard";
import TrainingsplanPage from "./pages/TrainingsplanPage";
import { CalendarPage } from "./pages/CalendarPage";
import ProfilePage from "./pages/ProfilePage";

// ✅ TrainQ Core Debug
import TrainQCoreDebug from "./pages/TrainQCoreDebug";

// Live-Training (Full-screen, kein Reiter)
import LiveTrainingPage from "./pages/training/LiveTrainingPage";

// Auth & Onboarding
import LoginPage from "./pages/auth/LoginPage.tsx";
import RegisterPage from "./pages/auth/RegisterPage.tsx";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import OnboardingPage from "./pages/onboarding/OnboardingPage.tsx";

// Context + Hooks
import { AuthContextProvider } from "./context/AuthContext.tsx";
import { useAuth } from "./hooks/useAuth.ts";

// Typen
import type { CalendarEvent, NewCalendarEvent, UpcomingTraining } from "./types/training";

// Icons
import DashboardIcon from "./assets/icons/Dashboard.png";
import KalenderIcon from "./assets/icons/Kalender.png";
import TrainingsplanIcon from "./assets/icons/Trainingsplan.png";
import ProfilIcon from "./assets/icons/Profil.png";

const INITIAL_EVENTS: CalendarEvent[] = [];

/** ✅ Exportiert für andere Komponenten (z.B. NavBar) */
export type TabKey = "dashboard" | "calendar" | "plan" | "profile";

type AppRoute = "/" | "/live-training" | "/debug/trainq";

const ACTIVE_ICON_FILTER =
  "invert(47%) sepia(94%) saturate(1820%) hue-rotate(188deg) brightness(97%) contrast(101%)";
const INACTIVE_ICON_FILTER = "invert(80%) opacity(0.7)";

const STORAGE_KEY_EVENTS = "trainq_calendar_events";
const STORAGE_KEY_ONBOARDING = "trainq_onboarding_completed";
const STORAGE_KEY_ACTIVE_LIVE_EVENT_ID = "trainq_active_live_event_id_v1";

// MVP Monetarisierung / Pro (optional)
const STORAGE_KEY_IS_PRO = "trainq_is_pro_v1";

// -------------------- Helpers --------------------

function uuidFallback(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return uuidFallback("ev");
}

/**
 * Legacy-Training-Erkennung:
 * - type === "training"
 * - oder trainingType/trainingTypeLegacy gesetzt
 * - oder sport == "gym/laufen/..."
 */
function isTrainingLike(ev: any): boolean {
  if (!ev) return false;
  if (ev.type === "training") return true;

  if (typeof ev.trainingType === "string" && ev.trainingType.trim()) return true;
  if (typeof ev.trainingTypeLegacy === "string" && ev.trainingTypeLegacy.trim()) return true;

  const s = String(ev.sport ?? "").toLowerCase();
  if (s === "gym" || s === "laufen" || s === "radfahren" || s === "custom") return true;
  if (s === "run" || s === "running" || s === "bike" || s === "cycling") return true;

  return false;
}

/**
 * ✅ KORRIGIERT:
 * Wenn trainingType "gym" ist, aber Titel cardio nahelegt, überschreiben wir zu laufen/radfahren.
 * Damit werden alte Events aus localStorage beim Laden automatisch repariert.
 */
function deriveTrainingTypeFromMeta(raw: any): "gym" | "laufen" | "radfahren" | "custom" {
  const sportLower = String(raw?.sport ?? "").trim().toLowerCase();
  const titleLower = String(raw?.title ?? "").toLowerCase();

  // 1) sport eindeutig -> sport gewinnt
  if (sportLower === "laufen" || sportLower === "run" || sportLower === "running") return "laufen";
  if (sportLower === "radfahren" || sportLower === "bike" || sportLower === "cycling") return "radfahren";
  if (sportLower === "custom") return "custom";
  if (sportLower === "gym") return "gym";

  // 2) trainingType gesetzt -> normalisieren, aber "gym" kann überschrieben werden
  const tt = String(raw?.trainingType ?? "").trim().toLowerCase();
  if (tt === "laufen") return "laufen";
  if (tt === "radfahren") return "radfahren";
  if (tt === "custom") return "custom";
  if (tt === "gym") {
    // ✅ WICHTIG: falsches "gym" überschreiben, wenn Titel cardio nahelegt
    if (titleLower.includes("lauf")) return "laufen";
    if (titleLower.includes("rad") || titleLower.includes("bike")) return "radfahren";
    return "gym";
  }

  // 3) Fallback: Titel-Heuristik
  if (titleLower.includes("lauf")) return "laufen";
  if (titleLower.includes("rad") || titleLower.includes("bike")) return "radfahren";

  return "gym";
}

/**
 * ✅ Migration / Normalisierung beim Laden:
 * - Falls type fehlt: anhand Meta entscheiden -> "training" oder "other"
 * - Wenn Training: trainingType ableiten (Gym/Laufen/Radfahren/Custom)
 * - Wenn Termin: trainingType entfernen (falls fälschlich vorhanden)
 */
function normalizeLoadedEvent(raw: any): CalendarEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const ev: any = { ...raw };

  // Pflichtfelder-Guards (minimal)
  if (!ev.id) ev.id = ensureId();
  if (ev.title == null) ev.title = "";
  if (!ev.date || !ev.startTime || !ev.endTime) return null;

  // type normalisieren
  if (ev.type !== "training" && ev.type !== "other") {
    ev.type = isTrainingLike(ev) ? "training" : "other";
  }

  if (ev.type === "training") {
    ev.trainingType = deriveTrainingTypeFromMeta(ev);
  } else {
    // Termin: darf nicht als Training erkannt werden
    if ("trainingType" in ev) delete ev.trainingType;
    if ("trainingTypeLegacy" in ev) delete ev.trainingTypeLegacy;
    if ("trainingStatus" in ev) delete ev.trainingStatus;
  }

  return ev as CalendarEvent;
}

/**
 * ✅ sorgt dafür, dass Trainings-Events immer stabile Meta-Felder haben.
 * WICHTIG: NICHT mehr "type ?? 'training'" verwenden.
 */
function ensureTrainingMeta(input: CalendarEvent): CalendarEvent {
  const ev: any = { ...input };

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

  // type absichern
  ev.type = "training";

  // templateId: stabiler "Plan-Container" (z.B. für Shift / Gruppierung)
  if (!ev.templateId) {
    ev.templateId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : uuidFallback("tpl");
  }

  // trainingType normalisieren / ableiten
  ev.trainingType = deriveTrainingTypeFromMeta(ev);

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

// -------------------- App Shell --------------------

const MainAppShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());

  // ✅ eventId state für LiveTraining (persistiert)
  const [activeLiveEventId, setActiveLiveEventId] = useState<string | undefined>(() => readActiveLiveEventId());

  // ✅ MVP: Pro-State (später via RevenueCat / StoreKit / Play Billing ersetzen)
  const [isPro, setIsPro] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY_IS_PRO) === "true";
    } catch {
      return false;
    }
  });

  // ✅ Events mit Persistenz in localStorage + Migration
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    if (typeof window === "undefined") return INITIAL_EVENTS;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_EVENTS);
      if (!raw) return INITIAL_EVENTS;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return INITIAL_EVENTS;

      const normalized = parsed.map(normalizeLoadedEvent).filter(Boolean) as CalendarEvent[];

      // Falls Migration etwas geändert hat -> direkt zurückschreiben
      try {
        window.localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(normalized));
      } catch {
        // ignore
      }

      return normalized;
    } catch {
      return INITIAL_EVENTS;
    }
  });

  // Route Listener (Back/Forward + Custom Navigate Event)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onPopState = () => {
      const nextRoute = getRouteFromLocation();
      setRoute(nextRoute);

      if (nextRoute === "/live-training") {
        const stored = readActiveLiveEventId();
        setActiveLiveEventId(stored);
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
        setActiveLiveEventId(undefined);
        writeActiveLiveEventId(undefined);
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

  // Events speichern, sobald sie sich ändern
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
    } catch {
      // ignore
    }
  }, [events]);

  // Pro speichern (MVP)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY_IS_PRO, isPro ? "true" : "false");
    } catch {
      // ignore
    }
  }, [isPro]);

  // Quick-Training aus dem Dashboard
  const handleCreateQuickTraining = (data: NewCalendarEvent) => {
    const created: CalendarEvent = {
      ...data,
      id: ensureId(),
    } as any;

    const newEvent: CalendarEvent = ensureTrainingMeta(created);
    setEvents((prev) => [...prev, newEvent]);
  };

  const handleAddEvent = (data: NewCalendarEvent) => {
    const created: CalendarEvent = {
      ...data,
      id: ensureId(),
    } as any;

    const newEvent = ensureTrainingMeta(created);
    setEvents((prev) => [...prev, newEvent]);
  };

  const handleDeleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleClearCalendar = () => {
    setEvents([]);
  };

  const upcomingTrainings: UpcomingTraining[] = useMemo(() => {
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);

    return events
      .filter((e) => {
        // ✅ nur echte Trainings
        const training = e.type === "training";
        return training && e.date >= todayIso;
      })
      .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
      .slice(0, 5)
      .map<UpcomingTraining>((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.startTime,
        notes: e.notes ?? e.description,
        sport: (e as any).trainingType,
        status: (e as any).trainingStatus,
      }));
  }, [events]);

  const exitLiveTraining = () => {
    setActiveLiveEventId(undefined);
    writeActiveLiveEventId(undefined);
    pushRoute("/");
    setActiveTab("dashboard");
  };

  // ✅ MVP Paywall-Hook
  const openPaywall = (reason: "plan_shift" | "calendar_7days" | "adaptive_limit") => {
    if (typeof window === "undefined") return;
    if (isPro) return;

    const msg =
      reason === "plan_shift"
        ? "Free-Limit erreicht: Plan verschieben. Pro entsperrt unbegrenzt."
        : reason === "calendar_7days"
        ? "Free-Limit erreicht: Termine nur 7 Tage im Voraus. Pro entsperrt."
        : "Free-Limit erreicht: Adaptive Trainings. Pro entsperrt.";

    const goPro = window.confirm(`${msg}\n\nMVP: Willst du Pro jetzt testweise aktivieren?`);
    if (goPro) setIsPro(true);
  };

  // -------- Route Switch --------
  if (route === "/live-training") {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-100">
        <LiveTrainingPage events={events} onUpdateEvents={setEvents} onExit={exitLiveTraining} eventId={activeLiveEventId} />
      </div>
    );
  }

  if (route === "/debug/trainq") {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-100 overflow-auto">
        <TrainQCoreDebug />
      </div>
    );
  }

  // -------- Tab App (Default) --------
  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100">
      <div className="flex-1 overflow-hidden">
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
          <CalendarPage events={events} onAddEvent={handleAddEvent} onDeleteEvent={handleDeleteEvent} />
        )}

        {activeTab === "plan" && (
          <TrainingsplanPage onAddEvent={handleAddEvent} isPro={isPro} onOpenPaywall={openPaywall} />
        )}

        {activeTab === "profile" && <ProfilePage onClearCalendar={handleClearCalendar} />}
      </div>

      {/* Bottom Nav */}
      <nav className="border-t border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button onClick={() => setActiveTab("dashboard")} className="flex flex-col items-center gap-0.5">
            <img
              src={DashboardIcon}
              alt="Dashboard"
              className="h-6 w-6"
              style={{ filter: activeTab === "dashboard" ? ACTIVE_ICON_FILTER : INACTIVE_ICON_FILTER }}
            />
            <span className={`text-[10px] font-medium ${activeTab === "dashboard" ? "text-sky-300" : "text-slate-400"}`}>
              Dashboard
            </span>
            <div className={`mt-0.5 h-0.5 w-5 rounded-full transition ${activeTab === "dashboard" ? "bg-sky-400" : "bg-transparent"}`} />
          </button>

          <button onClick={() => setActiveTab("calendar")} className="flex flex-col items-center gap-0.5">
            <img
              src={KalenderIcon}
              alt="Kalender"
              className="h-6 w-6"
              style={{ filter: activeTab === "calendar" ? ACTIVE_ICON_FILTER : INACTIVE_ICON_FILTER }}
            />
            <span className={`text-[10px] font-medium ${activeTab === "calendar" ? "text-sky-300" : "text-slate-400"}`}>
              Kalender
            </span>
            <div className={`mt-0.5 h-0.5 w-5 rounded-full transition ${activeTab === "calendar" ? "bg-sky-400" : "bg-transparent"}`} />
          </button>

          <button onClick={() => setActiveTab("plan")} className="flex flex-col items-center gap-0.5">
            <img
              src={TrainingsplanIcon}
              alt="Plan"
              className="h-6 w-6"
              style={{ filter: activeTab === "plan" ? ACTIVE_ICON_FILTER : INACTIVE_ICON_FILTER }}
            />
            <span className={`text-[10px] font-medium ${activeTab === "plan" ? "text-sky-300" : "text-slate-400"}`}>
              Plan
            </span>
            <div className={`mt-0.5 h-0.5 w-5 rounded-full transition ${activeTab === "plan" ? "bg-sky-400" : "bg-transparent"}`} />
          </button>

          <button onClick={() => setActiveTab("profile")} className="flex flex-col items-center gap-0.5">
            <img
              src={ProfilIcon}
              alt="Profil"
              className="h-6 w-6"
              style={{ filter: activeTab === "profile" ? ACTIVE_ICON_FILTER : INACTIVE_ICON_FILTER }}
            />
            <span className={`text-[10px] font-medium ${activeTab === "profile" ? "text-sky-300" : "text-slate-400"}`}>
              Profil
            </span>
            <div className={`mt-0.5 h-0.5 w-5 rounded-full transition ${activeTab === "profile" ? "bg-sky-400" : "bg-transparent"}`} />
          </button>
        </div>
      </nav>
    </div>
  );
};

/**
 * AuthGate:
 * - Wenn kein User -> Login / Register / Passwort-Reset
 * - Wenn User, aber Onboarding nicht abgeschlossen -> Onboarding
 * - Wenn User + Onboarding fertig -> MainAppShell
 */
const AuthGate: React.FC = () => {
  const { user } = useAuth();

  const [authScreen, setAuthScreen] = useState<"login" | "register" | "forgot">("login");

  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY_ONBOARDING) === "true";
    } catch {
      return false;
    }
  });

  if (!user) {
    if (authScreen === "register") {
      return <RegisterPage onGoToLogin={() => setAuthScreen("login")} />;
    }

    if (authScreen === "forgot") {
      return <ForgotPasswordPage onGoBackToLogin={() => setAuthScreen("login")} />;
    }

    return <LoginPage onGoToRegister={() => setAuthScreen("register")} onGoToForgotPassword={() => setAuthScreen("forgot")} />;
  }

  if (!onboardingCompleted) {
    return (
      <OnboardingPage
        onFinished={() => {
          setOnboardingCompleted(true);
          try {
            window.localStorage.setItem(STORAGE_KEY_ONBOARDING, "true");
          } catch {
            // ignore
          }
        }}
      />
    );
  }

  return <MainAppShell />;
};

export const App: React.FC = () => {
  return (
    <AuthContextProvider>
      <AuthGate />
    </AuthContextProvider>
  );
};

export default App;
