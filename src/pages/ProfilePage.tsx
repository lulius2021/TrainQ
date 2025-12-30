// src/pages/ProfilePage.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FeedbackBar } from "../components/feedback/FeedbackBar";

import {
  loadWorkoutHistory,
  onWorkoutHistoryUpdated,
  clearWorkoutHistory,
  type WorkoutHistoryEntry,
} from "../utils/workoutHistory";

import {
  readOnboardingDataFromStorage,
  writeOnboardingDataToStorage,
  resetOnboardingInStorage, // ✅ sauberer Reset (Single Source of Truth)
} from "../context/OnboardingContext";

type SettingsTab = "account" | "notifications" | "legal";
type LegalTab = "privacy" | "imprint" | "terms";

interface ProfilePageProps {
  onClearCalendar?: () => void;
}

// -------------------- Helpers --------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 So – 6 Sa
  const diff = (day + 6) % 7; // 0 = Mo
  d.setDate(d.getDate() - diff);
  return d;
}

function formatDateRangeWeek(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const from = start.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  const to = end.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${from} – ${to}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function toLocalDateLabel(iso?: string): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function clampMin(v: number, min = 0) {
  return Number.isFinite(v) ? Math.max(min, v) : min;
}

function durationMinutes(w: WorkoutHistoryEntry): number {
  return Math.max(0, Math.round((w.durationSec ?? 0) / 60));
}

function normalizeSport(s?: string): "Gym" | "Laufen" | "Radfahren" | "Custom" | "Unknown" {
  const t = (s || "").trim().toLowerCase();
  if (t === "gym") return "Gym";
  if (t === "laufen") return "Laufen";
  if (t === "radfahren") return "Radfahren";
  if (t === "custom") return "Custom";
  return "Unknown";
}

function isInWeek(entry: WorkoutHistoryEntry, weekStart: Date): boolean {
  const t = new Date(entry.endedAt || entry.startedAt).getTime();
  const start = weekStart.getTime();
  const end = new Date(weekStart).setDate(weekStart.getDate() + 7);
  return t >= start && t < end;
}

function isInMonth(entry: WorkoutHistoryEntry, ref: Date): boolean {
  const d = new Date(entry.endedAt || entry.startedAt);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function weekIndexInMonth(d: Date): number {
  const dayOfMonth = d.getDate();
  return Math.min(Math.floor((dayOfMonth - 1) / 7), 4);
}

function safeInitials(name: string): string {
  const parts = (name || "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map((p) => p[0]).join("");
  return (initials || "TQ").slice(0, 2).toUpperCase();
}

// -------------------- Workout helpers (no any) --------------------

// Wir lesen optionale Felder defensiv als "unknown" und prüfen typ-sicher.
type WorkoutHistoryEntryExtra = WorkoutHistoryEntry & {
  totalVolume?: unknown;
  distanceKm?: unknown;
  paceSecPerKm?: unknown;
};

type WorkoutSetLike = { reps?: unknown; weight?: unknown };
type WorkoutExerciseLike = { sets?: WorkoutSetLike[] };
type WorkoutWithExercises = WorkoutHistoryEntry & { exercises?: WorkoutExerciseLike[] };

function volumeOfEntryKg(w: WorkoutHistoryEntry): number {
  const v = (w as WorkoutHistoryEntryExtra).totalVolume;
  return Math.round(clampMin(typeof v === "number" && Number.isFinite(v) ? v : 0, 0));
}

function distanceKmOfEntry(w: WorkoutHistoryEntry): number {
  const direct = (w as WorkoutHistoryEntryExtra).distanceKm;
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return Math.round(direct * 100) / 100;
  }

  let total = 0;
  const ww = w as WorkoutWithExercises;

  for (const ex of ww.exercises ?? []) {
    for (const s of ex.sets ?? []) {
      const raw = s.weight;

      let km = 0;
      if (typeof raw === "number") km = raw;
      else if (typeof raw === "string") km = Number(raw);

      if (Number.isFinite(km) && km > 0) total += km;
    }
  }

  return Math.round(total * 100) / 100;
}

function paceLabelOfEntry(w: WorkoutHistoryEntry): string {
  const p = (w as WorkoutHistoryEntryExtra).paceSecPerKm;

  if (typeof p === "number" && Number.isFinite(p) && p > 0) {
    const mm = Math.floor(p / 60);
    const ss = Math.round(p % 60);
    return `${mm}:${String(ss).padStart(2, "0")} /km`;
  }

  const mins = durationMinutes(w);
  const km = distanceKmOfEntry(w);
  if (!Number.isFinite(mins) || !Number.isFinite(km) || km <= 0) return "—";

  const pace = mins / km;
  const mm = Math.floor(pace);
  const ss = Math.round((pace - mm) * 60);
  const ss2 = String(ss === 60 ? 0 : ss).padStart(2, "0");
  const mm2 = ss === 60 ? mm + 1 : mm;
  return `${mm2}:${ss2} /km`;
}

function speedKmhOfEntry(w: WorkoutHistoryEntry): string {
  const km = distanceKmOfEntry(w);
  const minutes = durationMinutes(w);
  if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(km) || km <= 0) return "—";
  const hours = minutes / 60;
  const kmh = km / hours;
  if (!Number.isFinite(kmh) || kmh <= 0) return "—";
  return `${(Math.round(kmh * 10) / 10).toLocaleString("de-DE")} km/h`;
}

// -------------------- Page --------------------

const ONBOARDING_CHANGED_EVENT = "trainq:onboarding_changed";

const ProfilePage: React.FC<ProfilePageProps> = ({ onClearCalendar }) => {
  const [onboarding, setOnboarding] = useState(() => readOnboardingDataFromStorage());
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>(() => loadWorkoutHistory());

  const initialName = useMemo(() => {
    return (onboarding.profile?.username || "").trim() || "Dein Name";
  }, [onboarding.profile?.username]);

  const derivedBioFallback = useMemo(() => {
    const goals = onboarding.goals?.selectedGoals ?? [];
    const sports = onboarding.goals?.sports ?? [];
    const g = goals.length ? `Ziele: ${goals.join(", ")}` : "";
    const s = sports.length ? `Sport: ${sports.join(", ")}` : "";
    const combined = [g, s].filter(Boolean).join(" • ");
    return combined || "Kurzbeschreibung deines Trainings.";
  }, [onboarding.goals?.selectedGoals, onboarding.goals?.sports]);

  const initialBio = useMemo(() => {
    const stored = (onboarding.profile?.bio || "").trim();
    return stored || derivedBioFallback;
  }, [onboarding.profile?.bio, derivedBioFallback]);

  const [profileName, setProfileName] = useState<string>(initialName);
  const [profileBio, setProfileBio] = useState<string>(initialBio);

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("account");
  const [legalTab, setLegalTab] = useState<LegalTab>("privacy");

  const [accountEmail, setAccountEmail] = useState("dein.mail@example.com");
  const [notificationsTraining, setNotificationsTraining] = useState(true);
  const [notificationsSummary, setNotificationsSummary] = useState(true);
  const [notificationsNews, setNotificationsNews] = useState(false);

  const WEEKLY_GOAL_MINUTES = useMemo(() => {
    const h = onboarding.training?.hoursPerWeek;
    const hours = typeof h === "number" && Number.isFinite(h) && h > 0 ? h : 5;
    return Math.round(hours * 60);
  }, [onboarding.training?.hoursPerWeek]);

  const refreshOnboarding = useCallback(() => {
    setOnboarding(readOnboardingDataFromStorage());
  }, []);

  const refreshWorkouts = useCallback(() => {
    setWorkouts(loadWorkoutHistory());
  }, []);

  useEffect(() => {
    const off = onWorkoutHistoryUpdated(refreshWorkouts);

    if (typeof window !== "undefined") {
      window.addEventListener("focus", refreshWorkouts);
      window.addEventListener("storage", refreshWorkouts);

      window.addEventListener("focus", refreshOnboarding);
      window.addEventListener("storage", refreshOnboarding);

      window.addEventListener(ONBOARDING_CHANGED_EVENT, refreshOnboarding);
    }

    return () => {
      off();

      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refreshWorkouts);
        window.removeEventListener("storage", refreshWorkouts);

        window.removeEventListener("focus", refreshOnboarding);
        window.removeEventListener("storage", refreshOnboarding);

        window.removeEventListener(ONBOARDING_CHANGED_EVENT, refreshOnboarding);
      }
    };
  }, [refreshOnboarding, refreshWorkouts]);

  // Name: nur automatisch übernehmen, wenn User es nicht custom geändert hat
  useEffect(() => {
    const obName = (onboarding.profile?.username || "").trim();
    if (!obName) return;

    const isDefaultOrAuto =
      profileName.trim() === "" || profileName === "Dein Name" || profileName === initialName;

    if (isDefaultOrAuto) setProfileName(obName);
  }, [onboarding.profile?.username, initialName, profileName]);

  // Bio: nur automatisch übernehmen, wenn User es nicht custom geändert hat
  useEffect(() => {
    const storedBio = (onboarding.profile?.bio || "").trim();

    const isDefaultOrAuto =
      profileBio.trim() === "" ||
      profileBio === "Kurzbeschreibung deines Trainings." ||
      profileBio === initialBio ||
      profileBio === derivedBioFallback;

    if (isDefaultOrAuto) {
      setProfileBio(storedBio || derivedBioFallback);
    }
  }, [onboarding.profile?.bio, derivedBioFallback, initialBio, profileBio]);

  // Close modals with ESC
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsEditProfileOpen(false);
      setIsSettingsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ------------------ Diagramme ------------------

  const [monthRef, setMonthRef] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const [weekRef, setWeekRef] = useState<Date>(new Date());

  const monthLabel = useMemo(() => formatMonthLabel(monthRef), [monthRef]);
  const weekStart = useMemo(() => startOfWeekMonday(weekRef), [weekRef]);
  const weekLabel = useMemo(() => formatDateRangeWeek(weekStart), [weekStart]);

  const monthCountsByWeek = useMemo(() => {
    const arr = [0, 0, 0, 0, 0];
    for (const w of workouts) {
      if (!isInMonth(w, monthRef)) continue;
      const d = new Date(w.endedAt || w.startedAt);
      if (Number.isNaN(d.getTime())) continue;
      const idx = weekIndexInMonth(d);
      arr[idx] += 1;
    }
    return arr;
  }, [workouts, monthRef]);

  const monthTotalSessions = useMemo(() => monthCountsByWeek.reduce((a, b) => a + b, 0), [monthCountsByWeek]);

  const weekTotalMinutes = useMemo(() => {
    let total = 0;
    for (const w of workouts) {
      if (!isInWeek(w, weekStart)) continue;
      total += durationMinutes(w);
    }
    return total;
  }, [workouts, weekStart]);

  const weekTotalSessions = useMemo(() => {
    let total = 0;
    for (const w of workouts) {
      if (!isInWeek(w, weekStart)) continue;
      total += 1;
    }
    return total;
  }, [workouts, weekStart]);

  const weekTotalRunKm = useMemo(() => {
    let km = 0;
    for (const w of workouts) {
      if (!isInWeek(w, weekStart)) continue;
      if (normalizeSport(w.sport) !== "Laufen") continue;
      km += distanceKmOfEntry(w);
    }
    return Math.round(km * 100) / 100;
  }, [workouts, weekStart]);

  const weekTotalBikeKm = useMemo(() => {
    let km = 0;
    for (const w of workouts) {
      if (!isInWeek(w, weekStart)) continue;
      if (normalizeSport(w.sport) !== "Radfahren") continue;
      km += distanceKmOfEntry(w);
    }
    return Math.round(km * 100) / 100;
  }, [workouts, weekStart]);

  const barMax = Math.max(1, ...monthCountsByWeek);

  const donutRatio = Math.min(weekTotalMinutes / Math.max(WEEKLY_GOAL_MINUTES, 1), 1);
  const donutCircumference = 2 * Math.PI * 40;
  const donutStroke = donutRatio * donutCircumference;

  const goPrevMonth = () => setMonthRef((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goNextMonth = () => setMonthRef((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  const goPrevWeek = () => setWeekRef((p) => new Date(p.getTime() - 7 * 24 * 60 * 60 * 1000));
  const goNextWeek = () => setWeekRef((p) => new Date(p.getTime() + 7 * 24 * 60 * 60 * 1000));

  // ------------------ Onboarding Stats ------------------

  const obAge = onboarding.personal?.age;
  const obHeight = onboarding.personal?.height;
  const obWeight = onboarding.personal?.weight;

  const obSessions = onboarding.training?.sessionsPerWeek;
  const obHours = onboarding.training?.hoursPerWeek;

  const obSports = onboarding.goals?.sports ?? [];
  const obGoals = onboarding.goals?.selectedGoals ?? [];

  // ------------------ Save profile edits ------------------

  const saveProfileEdits = () => {
    const nextName = profileName.trim();
    const nextBio = profileBio.trim();

    const current = readOnboardingDataFromStorage();
    const next = {
      ...current,
      profile: {
        ...(current.profile ?? { username: "", bio: "", isPublic: true }),
        username: nextName,
        bio: nextBio,
      },
    };

    writeOnboardingDataToStorage(next);
    setOnboarding(next);
    setIsEditProfileOpen(false);
  };

  // ✅ Reset Onboarding (Single Source of Truth)
  const handleRestartOnboarding = () => {
    if (typeof window === "undefined") return;

    const ok = window.confirm(
      "Onboarding wirklich erneut starten?\n\n" +
        "Deine Onboarding-Daten werden auf Standard zurückgesetzt. " +
        "Du wirst danach beim nächsten App-Render wieder durch das Onboarding geführt."
    );
    if (!ok) return;

    // 1) SSoT reset (emittiert trainq:onboarding_changed)
    resetOnboardingInStorage();

    // 2) Settings-Modal schließen
    setIsSettingsOpen(false);

    // Optional (nur falls du je nach Routing/State Probleme hast):
    // window.location.reload();
  };

  // ------------------ UI ------------------

  return (
    <>
      <div className="h-full w-full overflow-y-auto px-1 py-5 sm:px-2">
        <div className="mx-auto w-full max-w-none space-y-6">
          <section className="mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Profil</h1>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab("account");
                  setIsSettingsOpen(true);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-black/40 border border-white/15 text-xs text-white/70 hover:bg-white/10"
                title="Einstellungen"
              >
                ⚙
              </button>
            </div>

            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-primary to-purple-500 flex items-center justify-center text-lg font-semibold">
                  {safeInitials(profileName)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold">{profileName}</span>
                  </div>

                  <p className="text-xs text-white/70 max-w-xs">{profileBio}</p>

                  <div className="flex flex-wrap gap-3 text-[11px] text-white/60">
                    <span>
                      Trainings diese Woche: <span className="text-white/90">{weekTotalSessions}</span>
                    </span>
                    <span>
                      Zeit diese Woche:{" "}
                      <span className="text-white/90">
                        {Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m
                      </span>
                    </span>
                    {weekTotalRunKm > 0 && (
                      <span>
                        Laufen: <span className="text-white/90">{weekTotalRunKm.toLocaleString("de-DE")} km</span>
                      </span>
                    )}
                    {weekTotalBikeKm > 0 && (
                      <span>
                        Rad: <span className="text-white/90">{weekTotalBikeKm.toLocaleString("de-DE")} km</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(true)}
                  className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs"
                >
                  Profil bearbeiten
                </button>
              </div>
            </div>

            {/* ✅ Onboarding Daten sichtbar im Profil */}
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Deine Daten</h2>
                <span className="text-[10px] text-white/50">aus Onboarding</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] text-white/55">Alter</div>
                  <div className="text-sm font-semibold text-white">{typeof obAge === "number" ? `${obAge}` : "—"}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] text-white/55">Größe</div>
                  <div className="text-sm font-semibold text-white">
                    {typeof obHeight === "number" ? `${obHeight} cm` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] text-white/55">Gewicht</div>
                  <div className="text-sm font-semibold text-white">
                    {typeof obWeight === "number" ? `${obWeight} kg` : "—"}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="text-[10px] text-white/55">Ziel / Woche</div>
                  <div className="text-sm font-semibold text-white">
                    {typeof obHours === "number" ? `${obHours}h` : "—"} <span className="text-white/40">/</span>{" "}
                    {typeof obSessions === "number" ? `${obSessions}x` : "—"}
                  </div>
                </div>
              </div>

              {(obSports.length > 0 || obGoals.length > 0) && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                  {obSports.length > 0 && (
                    <div>
                      <span className="text-white/55">Sport:</span> {obSports.join(", ")}
                    </div>
                  )}
                  {obGoals.length > 0 && (
                    <div className="mt-1">
                      <span className="text-white/55">Ziele:</span> {obGoals.join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Bars (Monat) */}
                <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Wie oft trainiert (Monat)</span>
                    <span className="text-[10px] text-white/60">
                      {monthTotalSessions} Training{monthTotalSessions === 1 ? "" : "e"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={goPrevMonth}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {"<"}
                    </button>
                    <span className="text-white/80 font-medium text-center min-w-[160px]">{monthLabel}</span>
                    <button
                      type="button"
                      onClick={goNextMonth}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {">"}
                    </button>
                  </div>

                  <div className="h-32 flex items-end gap-2">
                    {monthCountsByWeek.map((value, index) => {
                      const heightPct = barMax > 0 ? (value / barMax) * 100 : 0;
                      const fillHeight = value === 0 ? 0 : Math.max(6, heightPct);
                      const label = `W${index + 1}`;

                      return (
                        <div key={label} className="flex flex-col items-center flex-1 gap-1 h-full">
                          <div className="w-full flex-1 rounded-full bg-white/10 overflow-hidden flex items-end">
                            <div className="w-full rounded-full bg-blue-500" style={{ height: `${fillHeight}%` }} />
                          </div>

                          <span className="text-[9px] text-white/70">{label}</span>
                          <span className="text-[9px] text-white/60">{value}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-white/45">
                    Jede Einheit zählt als 1. W1–W5 basiert auf Tag im Monat (1–7, 8–14, ...).
                  </div>
                </div>

                {/* Donut (Woche) */}
                <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-3 text-xs flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Zeit im Training (Woche)</span>
                    <span className="text-[10px] text-white/60">Ziel: {Math.floor(WEEKLY_GOAL_MINUTES / 60)}h</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={goPrevWeek}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {"<"}
                    </button>
                    <span className="text-white/80 font-medium text-center min-w-[160px]">{weekLabel}</span>
                    <button
                      type="button"
                      onClick={goNextWeek}
                      className="h-7 w-7 flex items-center justify-center rounded-full bg-black/40 border border-white/15"
                    >
                      {">"}
                    </button>
                  </div>

                  <div className="mt-1 flex items-center justify-center w-full flex-1">
                    <div className="relative h-32 w-32">
                      <svg viewBox="0 0 100 100" className="h-full w-full rotate-[-90deg]">
                        <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.15)" strokeWidth="10" fill="none" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          stroke="#3b82f6"
                          strokeWidth="10"
                          fill="none"
                          strokeDasharray={donutCircumference}
                          strokeDashoffset={donutCircumference - donutStroke}
                          strokeLinecap="round"
                        />
                      </svg>

                      <div className="absolute inset-0 flex flex-col items-center justify-center text-[11px]">
                        <span className="text-white/70">
                          {Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m
                        </span>
                        <span className="text-[9px] text-white/50">{weekTotalSessions} Trainings</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-white/45 text-center">
                    Kreis füllt sich mit der Summe deiner Trainingsdauer dieser Woche.
                  </div>
                </div>
              </div>
            </div>

            {/* Gemachte Trainings */}
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-100">Gemachte Trainings</h2>
                <span className="text-[10px] text-white/50">
                  {workouts.length} Beitrag{workouts.length === 1 ? "" : "e"}
                </span>
              </div>

              {workouts.length === 0 && (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                  Noch keine Beiträge. Beende ein Training im Live-Modus, dann erscheint hier genau 1 Eintrag pro Training.
                </div>
              )}

              {workouts.length > 0 && (
                <div className="space-y-2">
                  {workouts.slice(0, 30).map((w) => {
                    const sport = normalizeSport(w.sport);
                    const exCount = (w.exercises ?? []).length;
                    const date = toLocalDateLabel(w.endedAt ?? w.startedAt);
                    const mins = durationMinutes(w);

                    const volKg = volumeOfEntryKg(w);
                    const km = distanceKmOfEntry(w);

                    const badge =
                      sport === "Gym"
                        ? { text: "Gym", cls: "bg-indigo-500/15 border border-indigo-400/30 text-indigo-200" }
                        : sport === "Laufen"
                        ? { text: "Laufen", cls: "bg-emerald-500/15 border border-emerald-400/30 text-emerald-200" }
                        : sport === "Radfahren"
                        ? { text: "Radfahren", cls: "bg-sky-500/15 border border-sky-400/30 text-sky-200" }
                        : sport === "Custom"
                        ? { text: "Custom", cls: "bg-slate-500/15 border border-slate-400/30 text-slate-200" }
                        : { text: "Training", cls: "bg-white/10 border border-white/20 text-white/70" };

                    return (
                      <div key={w.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] text-white/60">
                              {date} • {mins} min
                            </div>

                            <div className="text-sm font-semibold text-white truncate">
                              {w.title ?? "Training"}{" "}
                              <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] ${badge.cls}`}>
                                {badge.text}
                              </span>
                              <span className="ml-2 inline-flex rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2 py-0.5 text-[10px] text-emerald-200">
                                Gemacht
                              </span>
                            </div>

                            {sport === "Gym" ? (
                              <div className="mt-1 text-[11px] text-white/70">
                                {exCount} Übung{exCount === 1 ? "" : "en"} • Volumen: {volKg.toLocaleString("de-DE")} kg
                              </div>
                            ) : sport === "Laufen" ? (
                              <div className="mt-1 text-[11px] text-white/70">
                                Distanz:{" "}
                                <span className="text-white/90">
                                  {km > 0 ? `${km.toLocaleString("de-DE")} km` : "—"}
                                </span>{" "}
                                • Pace: <span className="text-white/90">{paceLabelOfEntry(w)}</span>
                              </div>
                            ) : sport === "Radfahren" ? (
                              <div className="mt-1 text-[11px] text-white/70">
                                Distanz:{" "}
                                <span className="text-white/90">
                                  {km > 0 ? `${km.toLocaleString("de-DE")} km` : "—"}
                                </span>{" "}
                                • Ø: <span className="text-white/90">{speedKmhOfEntry(w)}</span>
                              </div>
                            ) : (
                              <div className="mt-1 text-[11px] text-white/70">
                                {exCount > 0 ? `${exCount} Eintrag${exCount === 1 ? "" : "e"}` : "—"}
                              </div>
                            )}
                          </div>
                        </div>

                        {exCount > 0 && (
                          <div className="mt-2 space-y-2">
                            {(w.exercises ?? []).map((ex, exIdx) => (
                              <div
                                key={`${ex.exerciseId ?? ex.name}_${exIdx}`}
                                className="rounded-lg bg-black/25 border border-white/10 p-2"
                              >
                                <div className="text-[11px] font-semibold text-white">{ex.name}</div>

                                <div className="mt-1 space-y-1">
                                  {(ex.sets ?? []).map((s, sIdx) => {
                                    const repsRaw = (s as unknown as { reps?: unknown }).reps;
                                    const weightRaw = (s as unknown as { weight?: unknown }).weight;

                                    if (sport === "Gym") {
                                      const reps =
                                        typeof repsRaw === "number" && Number.isFinite(repsRaw) ? repsRaw : null;
                                      const weight =
                                        typeof weightRaw === "number" && Number.isFinite(weightRaw) ? weightRaw : null;

                                      return (
                                        <div
                                          key={sIdx}
                                          className="flex items-center justify-between text-[11px] text-white/75"
                                        >
                                          <span className="text-white/55">Satz {sIdx + 1}</span>
                                          <span className="tabular-nums">
                                            {weight !== null ? `${weight} kg` : "—"}{" "}
                                            <span className="text-white/40">x</span>{" "}
                                            {reps !== null ? `${reps}` : "—"}
                                          </span>
                                        </div>
                                      );
                                    }

                                    // Cardio (min/km)
                                    const reps = typeof repsRaw === "number" && Number.isFinite(repsRaw) ? repsRaw : null;
                                    const weight =
                                      typeof weightRaw === "number" && Number.isFinite(weightRaw) ? weightRaw : null;

                                    return (
                                      <div
                                        key={sIdx}
                                        className="flex items-center justify-between text-[11px] text-white/75"
                                      >
                                        <span className="text-white/55">Abschnitt {sIdx + 1}</span>
                                        <span className="tabular-nums">
                                          {reps !== null ? `${reps} min` : "—"}{" "}
                                          <span className="text-white/40">•</span>{" "}
                                          {weight !== null ? `${weight} km` : "—"}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <FeedbackBar page="Profil" />
          </section>
        </div>
      </div>

      {/* MODAL: Profil bearbeiten */}
      {isEditProfileOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsEditProfileOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Profil bearbeiten</h2>
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <div className="space-y-1">
                <label className="block text-white/70">Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                  placeholder="Dein Name"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-white/70">Beschreibung</label>
                <textarea
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs min-h-[60px]"
                  placeholder="Kurzbeschreibung deines Trainings, Ziele, Sportarten..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-[11px] text-white/80"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveProfileEdits}
                className="px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-[11px] font-medium"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Einstellungen */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsSettingsOpen(false);
          }}
        >
          <div className="w-full max-w-3xl max-h-[80vh] rounded-2xl bg-brand-card border border-white/10 p-4 sm:p-6 text-xs flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Einstellungen</span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-xs text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4 text-[11px]">
              <button
                type="button"
                onClick={() => setSettingsTab("account")}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (settingsTab === "account"
                    ? "border-brand-primary bg-brand-primary text-black"
                    : "border-white/15 bg-black/40 text-white/70 hover:bg-white/10")
                }
              >
                Konto &amp; Daten
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab("notifications")}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (settingsTab === "notifications"
                    ? "border-brand-primary bg-brand-primary text-black"
                    : "border-white/15 bg-black/40 text-white/70 hover:bg-white/10")
                }
              >
                Benachrichtigungen
              </button>

              <button
                type="button"
                onClick={() => setSettingsTab("legal")}
                className={
                  "px-3 py-1.5 rounded-full border " +
                  (settingsTab === "legal"
                    ? "border-brand-primary bg-brand-primary text-black"
                    : "border-white/15 bg-black/40 text-white/70 hover:bg-white/10")
                }
              >
                Rechtliches / Impressum
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 text-[11px] sm:text-xs space-y-4">
              {settingsTab === "account" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Konto &amp; Basisdaten</h3>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="block text-white/70 text-[11px]">E-Mail-Adresse</span>
                      <input
                        type="email"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-[11px]"
                        placeholder="dein.mail@example.com"
                      />
                      <span className="text-[10px] text-white/40">
                        Login-Optionen (Apple/Email/Gast) bauen wir als eigenes To-Do.
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                      <h4 className="text-[11px] font-semibold text-red-300/90">Kritische Aktionen</h4>
                      <p className="text-[10px] text-white/50">
                        Bitte vorsichtig verwenden – manche Aktionen lassen sich nicht rückgängig machen.
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => alert("Profil löschen wird später eingebaut.")}
                          className="px-3 py-1.5 rounded-xl border border-red-500/60 bg-red-500/10 text-[11px] text-red-50 hover:bg-red-500/20"
                        >
                          Profil löschen
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const ok = window.confirm(
                              "Willst du wirklich deinen Trainingsverlauf löschen?\n\nAlle gemachten Trainings (History) werden entfernt. Diese Aktion kann nicht rückgängig gemacht werden."
                            );
                            if (!ok) return;
                            clearWorkoutHistory();
                            setWorkouts([]);
                            alert("Trainingsverlauf wurde gelöscht.");
                          }}
                          className="px-3 py-1.5 rounded-xl border border-red-500/60 bg-red-500/10 text-[11px] text-red-50 hover:bg-red-500/20"
                        >
                          Trainingsverlauf löschen
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!onClearCalendar) {
                              alert("Kalender leeren ist noch nicht mit der App verbunden.");
                              return;
                            }
                            const ok = window.confirm(
                              "Willst du wirklich alle Kalendereinträge löschen? Diese Aktion kann nicht rückgängig gemacht werden."
                            );
                            if (ok) {
                              onClearCalendar();
                              alert("Kalender wurde geleert.");
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl border border-amber-500/60 bg-amber-500/10 text-[11px] text-amber-50 hover:bg-amber-500/20"
                        >
                          Kalender leeren
                        </button>

                        {/* ✅ neu: Onboarding erneut starten */}
                        <button
                          type="button"
                          onClick={handleRestartOnboarding}
                          className="px-3 py-1.5 rounded-xl border border-blue-500/60 bg-blue-500/10 text-[11px] text-blue-50 hover:bg-blue-500/20"
                        >
                          Onboarding erneut starten
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {settingsTab === "notifications" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Benachrichtigungen</h3>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setNotificationsTraining((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 hover:bg-white/5"
                    >
                      <div className="text-left">
                        <div className="text-[11px] font-medium">Training-Reminder</div>
                        <div className="text-[10px] text-white/55">Erinnerungen für geplante Trainings.</div>
                      </div>
                      <span
                        className={
                          "inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] " +
                          (notificationsTraining
                            ? "bg-brand-primary text-black"
                            : "bg-black/70 text-white/60 border border-white/20")
                        }
                      >
                        {notificationsTraining ? "An" : "Aus"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotificationsSummary((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 hover:bg-white/5"
                    >
                      <div className="text-left">
                        <div className="text-[11px] font-medium">Wöchentliche Zusammenfassung</div>
                        <div className="text-[10px] text-white/55">
                          Überblick über Woche: Trainings, Minuten, Fortschritt.
                        </div>
                      </div>
                      <span
                        className={
                          "inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] " +
                          (notificationsSummary
                            ? "bg-brand-primary text-black"
                            : "bg-black/70 text-white/60 border border-white/20")
                        }
                      >
                        {notificationsSummary ? "An" : "Aus"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotificationsNews((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2 hover:bg-white/5"
                    >
                      <div className="text-left">
                        <div className="text-[11px] font-medium">App-News &amp; Updates</div>
                        <div className="text-[10px] text-white/55">Infos zu neuen Funktionen und Releases.</div>
                      </div>
                      <span
                        className={
                          "inline-flex items-center justify-center rounded-full px-3 py-1 text-[10px] " +
                          (notificationsNews
                            ? "bg-brand-primary text-black"
                            : "bg-black/70 text-white/60 border border-white/20")
                        }
                      >
                        {notificationsNews ? "An" : "Aus"}
                      </span>
                    </button>
                  </div>
                </section>
              )}

              {settingsTab === "legal" && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Rechtliches / Impressum</h3>

                  <div className="inline-flex rounded-full bg-black/40 border border-white/15 p-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLegalTab("privacy")}
                      className={
                        "px-3 py-1 rounded-full " +
                        (legalTab === "privacy" ? "bg-brand-primary text-black" : "text-white/70 hover:bg-white/5")
                      }
                    >
                      Datenschutz
                    </button>

                    <button
                      type="button"
                      onClick={() => setLegalTab("imprint")}
                      className={
                        "px-3 py-1 rounded-full " +
                        (legalTab === "imprint" ? "bg-brand-primary text-black" : "text-white/70 hover:bg-white/5")
                      }
                    >
                      Impressum
                    </button>

                    <button
                      type="button"
                      onClick={() => setLegalTab("terms")}
                      className={
                        "px-3 py-1 rounded-full " +
                        (legalTab === "terms" ? "bg-brand-primary text-black" : "text-white/70 hover:bg-white/5")
                      }
                    >
                      AGB
                    </button>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                    {legalTab === "privacy" && "Datenschutz-Text kommt später (Legal Page / Modal Content)."}
                    {legalTab === "imprint" && "Impressum kommt später (Legal Page / Modal Content)."}
                    {legalTab === "terms" && "AGB kommt später (Legal Page / Modal Content)."}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePage;