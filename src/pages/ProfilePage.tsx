// src/pages/ProfilePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  resetOnboardingInStorage,
} from "../context/OnboardingContext";

import { useAuth } from "../hooks/useAuth";

// WICHTIG: Datei heißt bei dir "SettingPage.tsx" (ohne s)
// -> deshalb "./SettingPage" importieren.
import SettingPage from "./SettingPage";

interface ProfilePageProps {
  onClearCalendar?: () => void;
  onOpenPaywall?: () => void;
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

function durationMinutes(w: WorkoutHistoryEntry): number {
  return Math.max(0, Math.round((w.durationSec ?? 0) / 60));
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

function parseCsvList(s: string): string[] {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function toNumberOrNull(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// -------------------- Page --------------------

const ProfilePage: React.FC<ProfilePageProps> = ({ onClearCalendar, onOpenPaywall }) => {
  const { user, logout } = useAuth();
  const isPro = user?.isPro === true;

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

  const [onboarding, setOnboarding] = useState(() => readOnboardingDataFromStorage());
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>(() => loadWorkoutHistory());

  const refreshOnboarding = useCallback(() => setOnboarding(readOnboardingDataFromStorage()), []);
  const refreshWorkouts = useCallback(() => setWorkouts(loadWorkoutHistory()), []);

  useEffect(() => {
    refreshOnboarding();
    refreshWorkouts();
  }, [user?.id, refreshOnboarding, refreshWorkouts]);

  useEffect(() => {
    const off = onWorkoutHistoryUpdated(refreshWorkouts);

    if (typeof window !== "undefined") {
      window.addEventListener("focus", refreshWorkouts);
      window.addEventListener("storage", refreshWorkouts);

      window.addEventListener("focus", refreshOnboarding);
      window.addEventListener("storage", refreshOnboarding);
    }

    return () => {
      off();
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refreshWorkouts);
        window.removeEventListener("storage", refreshWorkouts);

        window.removeEventListener("focus", refreshOnboarding);
        window.removeEventListener("storage", refreshOnboarding);
      }
    };
  }, [refreshOnboarding, refreshWorkouts]);

  // -------- Profile basics from storage --------
  const initialName = useMemo(() => (onboarding.profile?.username || "").trim() || "Dein Name", [onboarding.profile?.username]);

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

  const initialAvatar = useMemo(() => {
    const raw = (onboarding.profile as any)?.avatarDataUrl;
    return typeof raw === "string" && raw.trim() ? raw.trim() : "";
  }, [onboarding.profile]);

  const [profileName, setProfileName] = useState<string>(initialName);
  const [profileBio, setProfileBio] = useState<string>(initialBio);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>(initialAvatar);

  // Keep UI in sync if onboarding changes and user hasn't customized locally
  useEffect(() => {
    const obName = (onboarding.profile?.username || "").trim();
    if (!obName) return;

    const isDefaultOrAuto = profileName.trim() === "" || profileName === "Dein Name" || profileName === initialName;
    if (isDefaultOrAuto) setProfileName(obName);
  }, [onboarding.profile?.username, initialName, profileName]);

  useEffect(() => {
    const storedBio = (onboarding.profile?.bio || "").trim();

    const isDefaultOrAuto =
      profileBio.trim() === "" ||
      profileBio === "Kurzbeschreibung deines Trainings." ||
      profileBio === initialBio ||
      profileBio === derivedBioFallback;

    if (isDefaultOrAuto) setProfileBio(storedBio || derivedBioFallback);
  }, [onboarding.profile?.bio, derivedBioFallback, initialBio, profileBio]);

  useEffect(() => {
    const raw = (onboarding.profile as any)?.avatarDataUrl;
    const next = typeof raw === "string" ? raw : "";
    if (next !== avatarDataUrl) setAvatarDataUrl(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding.profile]);

  // -------- Edit modal state --------
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Editable onboarding fields (moved into profile edit)
  const [age, setAge] = useState<string>(() => (typeof onboarding.personal?.age === "number" ? String(onboarding.personal?.age) : ""));
  const [height, setHeight] = useState<string>(() =>
    typeof onboarding.personal?.height === "number" ? String(onboarding.personal?.height) : ""
  );
  const [weight, setWeight] = useState<string>(() =>
    typeof onboarding.personal?.weight === "number" ? String(onboarding.personal?.weight) : ""
  );
  const [hoursPerWeek, setHoursPerWeek] = useState<string>(() =>
    typeof onboarding.training?.hoursPerWeek === "number" ? String(onboarding.training?.hoursPerWeek) : ""
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState<string>(() =>
    typeof onboarding.training?.sessionsPerWeek === "number" ? String(onboarding.training?.sessionsPerWeek) : ""
  );
  const [sportsCsv, setSportsCsv] = useState<string>(() =>
    Array.isArray(onboarding.goals?.sports) ? onboarding.goals!.sports.join(", ") : ""
  );
  const [goalsCsv, setGoalsCsv] = useState<string>(() =>
    Array.isArray(onboarding.goals?.selectedGoals) ? onboarding.goals!.selectedGoals.join(", ") : ""
  );

  const openEdit = useCallback(() => {
    const current = readOnboardingDataFromStorage();

    setProfileName(((current.profile?.username || "") as string).trim() || profileName);
    setProfileBio(((current.profile?.bio || "") as string).trim() || profileBio);

    const av = (current.profile as any)?.avatarDataUrl;
    setAvatarDataUrl(typeof av === "string" ? av : "");

    setAge(typeof current.personal?.age === "number" ? String(current.personal?.age) : "");
    setHeight(typeof current.personal?.height === "number" ? String(current.personal?.height) : "");
    setWeight(typeof current.personal?.weight === "number" ? String(current.personal?.weight) : "");

    setHoursPerWeek(typeof current.training?.hoursPerWeek === "number" ? String(current.training?.hoursPerWeek) : "");
    setSessionsPerWeek(typeof current.training?.sessionsPerWeek === "number" ? String(current.training?.sessionsPerWeek) : "");

    setSportsCsv(Array.isArray(current.goals?.sports) ? (current.goals!.sports as any[]).join(", ") : "");
    setGoalsCsv(Array.isArray(current.goals?.selectedGoals) ? (current.goals!.selectedGoals as any[]).join(", ") : "");

    setIsEditProfileOpen(true);
  }, [profileBio, profileName]);

  const onPickAvatar = useCallback(() => fileRef.current?.click(), []);
  const onAvatarSelected = useCallback(async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader error"));
      r.readAsDataURL(file);
    });

    setAvatarDataUrl(dataUrl);
  }, []);

  const saveProfileEdits = useCallback(() => {
    const current = readOnboardingDataFromStorage();

    const next = {
      ...current,
      profile: {
        ...(current.profile ?? { username: "", bio: "", isPublic: true }),
        username: profileName.trim(),
        bio: profileBio.trim(),
        avatarDataUrl: avatarDataUrl || "",
      },
      personal: {
        ...(current.personal ?? {}),
        age: toNumberOrNull(age),
        height: toNumberOrNull(height),
        weight: toNumberOrNull(weight),
      },
      training: {
        ...(current.training ?? {}),
        hoursPerWeek: toNumberOrNull(hoursPerWeek),
        sessionsPerWeek: toNumberOrNull(sessionsPerWeek),
      },
      goals: {
        ...(current.goals ?? {}),
        sports: parseCsvList(sportsCsv) as unknown as any,
        selectedGoals: parseCsvList(goalsCsv) as unknown as any,
      },
    };

    writeOnboardingDataToStorage(next);
    setOnboarding(next);
    setIsEditProfileOpen(false);
  }, [age, avatarDataUrl, goalsCsv, height, hoursPerWeek, profileBio, profileName, sessionsPerWeek, sportsCsv, weight]);

  // -------- Settings drawer state --------
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Close modals with ESC
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsEditProfileOpen(false);
      setSettingsOpen(false);
      setStatsOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // -------- Stats / Charts --------
  const [monthRef, setMonthRef] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [weekRef, setWeekRef] = useState<Date>(new Date());
  const [statsOpen, setStatsOpen] = useState(false);

  const monthLabel = useMemo(() => formatMonthLabel(monthRef), [monthRef]);
  const weekStart = useMemo(() => startOfWeekMonday(weekRef), [weekRef]);
  const weekLabel = useMemo(() => formatDateRangeWeek(weekStart), [weekStart]);

  const WEEKLY_GOAL_MINUTES = useMemo(() => {
    const h = onboarding.training?.hoursPerWeek;
    const hours = typeof h === "number" && Number.isFinite(h) && h > 0 ? h : 5;
    return Math.round(hours * 60);
  }, [onboarding.training?.hoursPerWeek]);

  const weekTotalMinutes = useMemo(() => {
    let total = 0;
    for (const w of workouts) if (isInWeek(w, weekStart)) total += durationMinutes(w);
    return total;
  }, [workouts, weekStart]);

  const weekTotalSessions = useMemo(() => {
    let total = 0;
    for (const w of workouts) if (isInWeek(w, weekStart)) total += 1;
    return total;
  }, [workouts, weekStart]);

  const monthCountsByWeek = useMemo(() => {
    const arr = [0, 0, 0, 0, 0];
    for (const w of workouts) {
      if (!isInMonth(w, monthRef)) continue;
      const d = new Date(w.endedAt || w.startedAt);
      if (Number.isNaN(d.getTime())) continue;
      arr[weekIndexInMonth(d)] += 1;
    }
    return arr;
  }, [workouts, monthRef]);

  const monthTotalSessions = useMemo(() => monthCountsByWeek.reduce((a, b) => a + b, 0), [monthCountsByWeek]);
  const barMax = Math.max(1, ...monthCountsByWeek);

  const donutRatio = Math.min(weekTotalMinutes / Math.max(WEEKLY_GOAL_MINUTES, 1), 1);
  const donutCircumference = 2 * Math.PI * 40;
  const donutStroke = donutRatio * donutCircumference;

  const goPrevMonth = () => setMonthRef((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const goNextMonth = () => setMonthRef((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));
  const goPrevWeek = () => setWeekRef((p) => new Date(p.getTime() - 7 * 24 * 60 * 60 * 1000));
  const goNextWeek = () => setWeekRef((p) => new Date(p.getTime() + 7 * 24 * 60 * 60 * 1000));

  // -------- Actions --------
  const handleLogout = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm("Willst du dich wirklich abmelden?");
    if (!ok) return;

    setSettingsOpen(false);
    setIsEditProfileOpen(false);
    setStatsOpen(false);

    logout();
  }, [logout]);

  const handleRestartOnboarding = useCallback(() => {
    if (typeof window === "undefined") return;

    const ok = window.confirm(
      "Onboarding wirklich erneut starten?\n\nDeine Onboarding-Daten werden auf Standard zurückgesetzt."
    );
    if (!ok) return;

    resetOnboardingInStorage();
    setSettingsOpen(false);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "Trainingsverlauf wirklich löschen?\n\nAlle gemachten Trainings werden entfernt. Diese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!ok) return;
    clearWorkoutHistory();
    setWorkouts([]);
    alert("Trainingsverlauf wurde gelöscht.");
  }, []);

  // -------------------- UI --------------------

  const badge = isPro
    ? "inline-flex items-center rounded-full bg-amber-500/15 border border-amber-400/35 px-2.5 py-1 text-[11px] text-amber-200"
    : "inline-flex items-center rounded-full bg-emerald-500/15 border border-emerald-400/35 px-2.5 py-1 text-[11px] text-emerald-200";

  return (
    <>
      <div className="h-full w-full overflow-y-auto px-1 py-5 sm:px-2">
        <div className="mx-auto w-full max-w-none space-y-6">
          <section className="mt-2 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold">Profil</h1>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-black/40 border border-white/15 hover:bg-white/10"
                title="Einstellungen"
                aria-label="Einstellungen"
              >
                <div className="flex flex-col gap-1">
                  <span className="block h-[2px] w-4 bg-white/70 rounded" />
                  <span className="block h-[2px] w-4 bg-white/70 rounded" />
                  <span className="block h-[2px] w-4 bg-white/70 rounded" />
                </div>
              </button>
            </div>

            {/* Profile card */}
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-black/30 border border-white/15 overflow-hidden flex items-center justify-center">
                  {avatarDataUrl ? (
                    <img src={avatarDataUrl} alt="Profilbild" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-brand-primary to-purple-500 flex items-center justify-center text-lg font-semibold">
                      {safeInitials(profileName)}
                    </div>
                  )}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold truncate">{profileName}</span>

                    {isPro ? (
                      <span className={badge}>Pro</span>
                    ) : (
                      <button type="button" onClick={openPaywall} className={badge} title="Auf Pro upgraden">
                        Free
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-white/70 max-w-xs">{profileBio}</p>

                  <div className="flex flex-wrap gap-3 text-[11px] text-white/60">
                    {user?.email && (
                      <span className="truncate">
                        Account: <span className="text-white/80">{user.email}</span>
                      </span>
                    )}
                    <span>
                      Trainings diese Woche: <span className="text-white/90">{weekTotalSessions}</span>
                    </span>
                    <span>
                      Zeit diese Woche:{" "}
                      <span className="text-white/90">
                        {Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <button
                  type="button"
                  onClick={openEdit}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs"
                >
                  Profil bearbeiten
                </button>
              </div>
            </div>

            {/* Upgrade card (replaces the old limits box) */}
            {!isPro && (
              <div className="rounded-2xl bg-brand-card border border-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">Auf PRO upgraden</div>
                    <div className="mt-1 text-[11px] text-white/60">
                      Schalte alle Funktionen frei und entferne Limits.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openPaywall}
                    className="rounded-xl bg-brand-primary text-black px-4 py-2 text-xs font-semibold hover:bg-brand-primary/90"
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            )}

            {/* Statistics card -> opens modal with charts */}
            <div className="rounded-2xl bg-brand-card border border-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/90">Statistiken</div>
                  <div className="mt-1 text-[11px] text-white/60">
                    Monatliche Häufigkeit und Wochen-Minuten.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStatsOpen(true)}
                  className="rounded-xl border border-white/15 bg-black/30 px-4 py-2 text-xs text-white/80 hover:bg-white/5"
                >
                  Ansehen
                </button>
              </div>
            </div>

            {/* Workout history list (kept) */}
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

                    const badgeCls =
                      sport === "Gym"
                        ? "bg-indigo-500/15 border border-indigo-400/30 text-indigo-200"
                        : sport === "Laufen"
                        ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-200"
                        : sport === "Radfahren"
                        ? "bg-sky-500/15 border border-sky-400/30 text-sky-200"
                        : "bg-white/10 border border-white/20 text-white/70";

                    return (
                      <div key={w.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-[11px] text-white/60">
                          {date} • {mins} min
                        </div>

                        <div className="mt-1 text-sm font-semibold text-white truncate">
                          {w.title ?? "Training"}{" "}
                          <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] ${badgeCls}`}>
                            {sport === "Unknown" ? "Training" : sport}
                          </span>
                        </div>

                        <div className="mt-1 text-[11px] text-white/70">
                          {exCount > 0 ? `${exCount} Übung${exCount === 1 ? "" : "en"}` : "—"}
                        </div>
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

      {/* MODAL: Profil bearbeiten (inkl. Onboarding-Daten) */}
      {isEditProfileOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsEditProfileOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-brand-card border border-white/10 p-4 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Profil bearbeiten</h2>
              <button type="button" onClick={() => setIsEditProfileOpen(false)} className="text-xs text-white/60 hover:text-white">
                ✕
              </button>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full overflow-hidden border border-white/15 bg-black/30">
                {avatarDataUrl ? (
                  <img src={avatarDataUrl} alt="Profilbild" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-brand-primary to-purple-500 flex items-center justify-center text-base font-semibold">
                    {safeInitials(profileName)}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)}
                />

                <button
                  type="button"
                  onClick={onPickAvatar}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px]"
                >
                  Profilbild auswählen
                </button>

                {avatarDataUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarDataUrl("")}
                    className="px-3 py-1.5 rounded-xl border border-white/15 bg-black/30 hover:bg-white/5 text-[11px] text-white/80"
                  >
                    Profilbild entfernen
                  </button>
                )}
              </div>
            </div>

            {/* Name/Bio */}
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
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs min-h-[70px]"
                  placeholder="Kurzbeschreibung deines Trainings, Ziele, Sportarten..."
                />
              </div>
            </div>

            {/* Onboarding data moved into profile */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3">
              <div className="text-[11px] font-semibold text-white/85">Deine Daten</div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[10px] text-white/60">Alter</label>
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                    inputMode="numeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-white/60">Größe (cm)</label>
                  <input
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                    inputMode="numeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-white/60">Gewicht (kg)</label>
                  <input
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[10px] text-white/60">Ziel Stunden / Woche</label>
                  <input
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                    inputMode="numeric"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-white/60">Sessions / Woche</label>
                  <input
                    value={sessionsPerWeek}
                    onChange={(e) => setSessionsPerWeek(e.target.value)}
                    className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-white/60">Sportarten (kommagetrennt)</label>
                <input
                  value={sportsCsv}
                  onChange={(e) => setSportsCsv(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                  placeholder="Gym, Laufen, Radfahren"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-white/60">Ziele (kommagetrennt)</label>
                <input
                  value={goalsCsv}
                  onChange={(e) => setGoalsCsv(e.target.value)}
                  className="w-full rounded-lg bg-black/40 border border-white/20 px-2 py-1.5 text-xs"
                  placeholder="Muskelaufbau, Ausdauer, ..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
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
                className="px-3 py-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-[11px] font-medium text-black"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Statistiken */}
      {statsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setStatsOpen(false);
          }}
        >
          <div className="w-full max-w-3xl rounded-2xl bg-brand-card border border-white/10 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Statistiken</div>
              <button type="button" onClick={() => setStatsOpen(false)} className="text-xs text-white/60 hover:text-white">
                ✕
              </button>
            </div>

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
        </div>
      )}

      {/* SETTINGS DRAWER (rechts rein) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSettingsOpen(false);
            }}
          />

          {/* panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-black/20 backdrop-blur">
            <div className="h-full bg-transparent">
              <SettingPage
                onBack={() => setSettingsOpen(false)}
                onClearCalendar={onClearCalendar}
                onOpenPaywall={openPaywall}
              />

              {/* Quick actions footer (optional, but useful) */}
              <div className="px-4 pb-4 -mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-50 hover:bg-red-500/20"
                  >
                    Verlauf löschen
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartOnboarding}
                    className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-[11px] text-blue-50 hover:bg-blue-500/20"
                  >
                    Onboarding reset
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[11px] text-white/80 hover:bg-white/5"
                >
                  Abmelden
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePage;