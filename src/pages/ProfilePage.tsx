// src/pages/ProfilePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadWorkoutHistory,
  onWorkoutHistoryUpdated,
  clearWorkoutHistory,
  type WorkoutHistoryEntry,
} from "../utils/workoutHistory";
import { WorkoutHistoryOverlay } from "../components/profile/WorkoutHistoryOverlay";
import { History } from "lucide-react";

import {
  readOnboardingDataFromStorage,
  writeOnboardingDataToStorage,
  resetOnboardingInStorage,
} from "../context/OnboardingContext";

import { useAuth } from "../hooks/useAuth";
import { useEntitlements } from "../hooks/useEntitlements";
import ProfileStatsDashboard from "../components/profile/ProfileStatsDashboard";
import { buildProfileLinks, copyText, shareProfile, shortenId } from "../utils/shareProfile";


// WICHTIG: Datei heißt bei dir "SettingPage.tsx" (ohne s)
import SettingPage from "./SettingPage";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import { useStatistics, type TimeRange } from "../hooks/useStatistics";
import { StatsChart } from "../components/stats/StatsChart";
import { ConsistencyHeatmap } from "../components/stats/ConsistencyHeatmap";
import { MuscleSplitChart } from "../components/stats/MuscleSplitChart";
import { ShareableStatCard } from "../components/stats/ShareableStatCard";
import { BottomSpacer } from "../components/layout/BottomSpacer";

interface ProfilePageProps {
  onClearCalendar?: () => void;
  onOpenPaywall?: () => void;
  onOpenWorkoutShare?: (workoutId: string, returnTo?: "dashboard" | "profile") => void;
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

import MonthlyRecapModal from "../components/profile/MonthlyRecapModal";

// ... existing imports ...

// -------------------- Page --------------------

const ProfilePage: React.FC<ProfilePageProps> = ({ onClearCalendar, onOpenPaywall, onOpenWorkoutShare }) => {
  const { user, logout } = useAuth();
  const { isPro } = useEntitlements(user?.id);


  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

  const [onboarding, setOnboarding] = useState(() => readOnboardingDataFromStorage());
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>(() => loadWorkoutHistory());

  const [timeRange, setTimeRange] = useState<TimeRange>("1W");
  const stats = useStatistics(workouts, timeRange);

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
  const initialName = useMemo(
    () => (onboarding.profile?.username || "").trim() || "Dein Name",
    [onboarding.profile?.username]
  );

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
      profileBio === "Kurzbeschreibung deines Trainings."
      || profileBio === initialBio ||
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
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Editable onboarding fields (moved into profile edit)
  const [age, setAge] = useState<string>(() =>
    typeof onboarding.personal?.age === "number" ? String(onboarding.personal?.age) : ""
  );
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
    setSessionsPerWeek(
      typeof current.training?.sessionsPerWeek === "number" ? String(current.training?.sessionsPerWeek) : ""
    );

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

  const [statsOpen, setStatsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const WEEKLY_GOAL_MINUTES = useMemo(() => {
    const h = onboarding.training?.hoursPerWeek;
    const hours = typeof h === "number" && Number.isFinite(h) && h > 0 ? h : 5;
    return Math.round(hours * 60);
  }, [onboarding.training?.hoursPerWeek]);

  const weekStart = useMemo(() => startOfWeekMonday(new Date()), []);

  const weekTotalMinutes = useMemo(() => {
    let total = 0;
    for (const w of workouts ?? []) if (isInWeek(w, weekStart)) total += durationMinutes(w);
    return total;
  }, [workouts, weekStart]);

  const weekTotalSessions = useMemo(() => {
    let total = 0;
    for (const w of workouts ?? []) if (isInWeek(w, weekStart)) total += 1;
    return total;
  }, [workouts, weekStart]);

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

  const handleShareImage = useCallback(
    (w: WorkoutHistoryEntry) => {
      if (!w?.id) return;
      if (typeof onOpenWorkoutShare === "function") {
        onOpenWorkoutShare(w.id, "profile");
        return;
      }
      window.dispatchEvent(
        new CustomEvent("trainq:navigate", {
          detail: { path: "/workout-share", workoutId: w.id, returnTo: "profile" },
        })
      );
    },
    [onOpenWorkoutShare]
  );

  const handleCopyUserId = useCallback(async () => {
    const id = user?.id ?? "";
    if (!id) return;
    const ok = await copyText(id);
    setCopyFeedback(ok ? "Kopiert" : "Kopieren fehlgeschlagen");
    window.setTimeout(() => setCopyFeedback(null), 1600);
  }, [user?.id]);

  const handleShareProfile = useCallback(async () => {
    const id = user?.id ?? "";
    if (!id) return;
    try {
      const result = await shareProfile({ userId: id, displayName: profileName });
      if (result === "copied") setShareFeedback("Link kopiert");
      else if (result === "shared") setShareFeedback("Geteilt");
      else setShareFeedback("Teilen fehlgeschlagen");
    } catch {
      setShareFeedback("Teilen fehlgeschlagen");
    } finally {
      window.setTimeout(() => setShareFeedback(null), 1800);
    }
  }, [user?.id, profileName]);

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

  // -------------------- Theme-safe style helpers --------------------

  const surfaceBox: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)" };
  const surfaceSoft: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  const primaryBtn: React.CSSProperties = { background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" };

  const badgeStylePro: React.CSSProperties = {
    background: "rgba(245, 158, 11, 0.16)",
    border: "1px solid var(--border)",
    color: "rgba(245, 158, 11, 0.95)",
  };

  const badgeStyleFree: React.CSSProperties = {
    background: "rgba(16, 185, 129, 0.14)",
    border: "1px solid var(--border)",
    color: "rgba(16, 185, 129, 0.95)",
  };

  const avatarFallbackStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, var(--primary) 0%, var(--primarySoft) 100%)",
    color: "#061226",
  };

  // -------- Monthly Recap Logic --------
  const [recapOpen, setRecapOpen] = useState(false);

  const { lastMonthYear, lastMonthIndex, lastMonthName, hasLastMonthWorkouts } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Previous month
    const year = d.getFullYear();
    const month = d.getMonth();
    const name = d.toLocaleString("de-DE", { month: "long" });

    const hasWorkouts = workouts.some(w => {
      const wd = new Date(w.startedAt);
      return wd.getFullYear() === year && wd.getMonth() === month;
    });

    return { lastMonthYear: year, lastMonthIndex: month, lastMonthName: name, hasLastMonthWorkouts: hasWorkouts };
  }, [workouts]);

  return (
    <>
      <div className="w-full text-[var(--text)]">
        <div className="mx-auto w-full max-w-5xl px-4 pt-0 pb-40 space-y-6">
          <section className="mt-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h1 className="text-2xl font-bold text-[var(--text)]">Profil</h1>
              {/* ... existing header buttons ... */}
              <div className="flex items-center gap-2">
                <AppButton
                  onClick={handleShareProfile}
                  variant="ghost"
                  className="rounded-full !p-0 w-10 h-10"
                  title="Profil teilen"
                  aria-label="Profil teilen"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" className="text-white">
                    <path d="M12 3v10m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </AppButton>
                <AppButton
                  onClick={() => setSettingsOpen(true)}
                  variant="ghost"
                  className="rounded-full !p-0 w-10 h-10"
                  title="Einstellungen"
                  aria-label="Einstellungen"
                >
                  <div className="flex flex-col gap-1.5 px-2">
                    <span className="block h-0.5 w-5 rounded bg-white" />
                    <span className="block h-0.5 w-5 rounded bg-white" />
                    <span className="block h-0.5 w-5 rounded bg-white" />
                  </div>
                </AppButton>
              </div>
            </div>

            {/* ✅ Monthly Recap Trigger */}
            {hasLastMonthWorkouts && (
              <div
                onClick={() => setRecapOpen(true)}
                className="w-full rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-transform active:scale-[0.98]"
                style={{
                  background: "linear-gradient(90deg, rgba(0,122,255,0.15) 0%, rgba(0,0,0,0) 100%)",
                  border: "1px solid rgba(0,122,255,0.3)"
                }}
              >
                <div className="flex flex-col">
                  <span className="text-[#007AFF] text-xs font-bold uppercase tracking-wider mb-0.5">Highlights</span>
                  <span className="text-white font-semibold text-lg">Dein {lastMonthName} {lastMonthYear} ist fertig.</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#007AFF]/20 flex items-center justify-center text-[#007AFF]">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </div>
              </div>
            )}

            {/* Profile card */}
            <AppCard variant="glass" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* ... (rest of profile card content) ... */}
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/60">
                  {avatarDataUrl ? (
                    <img src={avatarDataUrl} alt="Profilbild" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-semibold text-white">{safeInitials(profileName)}</span>
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold truncate text-[var(--text)]">{profileName}</h2>
                    {isPro ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)]">Pro</span>
                    ) : (
                      <button type="button" onClick={openPaywall} className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium bg-green-500/10 border border-green-500/20 text-green-500 hover:opacity-90" title="Upgrade auf Pro">
                        Free
                      </button>
                    )}
                  </div>
                  <p className="text-base max-w-xs text-[var(--muted)]">{profileBio}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)] pt-1">
                    {user?.email && <span className="truncate">Account: <span className="text-[var(--text)]">{user.email}</span></span>}
                    <span>Trainings: <span className="text-[var(--text)]">{weekTotalSessions}</span></span>
                    <span>Zeit: <span className="text-[var(--text)]">{Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m</span></span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center self-end sm:self-center">
                <AppButton onClick={openEdit} variant="secondary" size="sm">
                  Bearbeiten
                </AppButton>
              </div>
            </AppCard>

            {/* ... rest of the page ... */}


            {(copyFeedback || shareFeedback) && (
              <AppCard variant="soft" className="px-4 py-2 text-sm text-center">
                <span className="text-[var(--muted)]">{copyFeedback || shareFeedback}</span>
              </AppCard>
            )}

            {/* Upgrade card */}
            {!isPro && (
              <AppCard variant="glass">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text)]">Auf PRO upgraden</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">Schalte alle Funktionen frei und entferne Limits.</p>
                  </div>
                  <AppButton onClick={openPaywall} variant="primary" size="sm">
                    Upgrade
                  </AppButton>
                </div>
              </AppCard>
            )}

            {/* Statistics card */}
            {/* Statistics Section */}
            <div className="space-y-4">
              {/* Heatmap Top */}
              <ShareableStatCard titleForFile={`trainq-heatmap-${new Date().toISOString().split('T')[0]}`}>
                <ConsistencyHeatmap workouts={workouts} />
              </ShareableStatCard>

              <div className="flex items-center justify-between px-1 mt-6">
                <h3 className="text-lg font-semibold text-[var(--text)]">Dein Fortschritt</h3>
                <div className="flex items-center p-1 bg-zinc-950 rounded-lg border border-zinc-800">
                  {(["1W", "1M", "6M", "1Y"] as TimeRange[]).map((tr) => (
                    <button
                      key={tr}
                      onClick={() => setTimeRange(tr)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === tr
                        ? "bg-zinc-700 text-white shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200 bg-transparent"
                        }`}
                    >
                      {tr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ShareableStatCard titleForFile="trainq-volume">
                  <StatsChart
                    title="Trainingslast"
                    valueDisplay={(stats.totals.volume / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " t"}
                    unit="kg"
                    data={stats.volumeData}
                    type="area"
                    color="#007AFF"
                  />
                </ShareableStatCard>

                <ShareableStatCard titleForFile="trainq-duration">
                  <StatsChart
                    title="Zeit im Training"
                    valueDisplay={Math.round(stats.totals.duration / 60) + " h"}
                    unit="min"
                    data={stats.durationData}
                    type="bar"
                    color="#F59E0B"
                  />
                </ShareableStatCard>

                {stats.totals.distance > 0 && (
                  <ShareableStatCard titleForFile="trainq-distance">
                    <StatsChart
                      title="Distanz"
                      valueDisplay={stats.totals.distance.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km"}
                      unit="km"
                      data={stats.distanceData}
                      type="area"
                      color="#10B981"
                    />
                  </ShareableStatCard>
                )}

                <ShareableStatCard titleForFile="trainq-sports">
                  <StatsChart
                    title="Sportarten & Fokus"
                    // valueDisplay={stats.sportSplitData.length + " Sports"}
                    type="pie"
                    data={stats.sportSplitData}
                    unit="x"
                  />
                </ShareableStatCard>

                {/* Muscle Split (Radar) */}
                <ShareableStatCard titleForFile="trainq-muscle-balance">
                  <MuscleSplitChart workouts={workouts} />
                </ShareableStatCard>
              </div>
            </div>

            {/* Workout history list TRIGGER */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-full bg-zinc-800 border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl border border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl p-4 flex items-center justify-between hover:bg-zinc-800 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/5 rounded-2xl text-white/70 group-hover:text-white transition-colors">
                  <History className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-white font-medium">Alle Trainings anzeigen</div>
                  <div className="text-xs text-white/40">{workouts.length} gesamt</div>
                </div>
              </div>
              <div className="text-white/20 group-hover:text-white/50 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </div>
            </button>
          </section>
          <BottomSpacer />
        </div>
      </div>

      <MonthlyRecapModal
        isOpen={recapOpen}
        onClose={() => setRecapOpen(false)}
        year={lastMonthYear}
        month={lastMonthIndex}
        workouts={workouts}
      />

      {isHistoryOpen && (
        <WorkoutHistoryOverlay
          workouts={workouts}
          onClose={() => setIsHistoryOpen(false)}
          onShare={handleShareImage}
        />
      )}

      {/* MODAL: Profil bearbeiten */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsEditProfileOpen(false); }}>
          <AppCard variant="glass" className="w-full max-w-md p-5 space-y-6 max-h-[85vh] overflow-y-auto pb-[140px]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Profil bearbeiten</h2>
              <AppButton onClick={() => setIsEditProfileOpen(false)} variant="ghost" size="sm" className="!p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10">✕</AppButton>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-br from-[var(--primary)] to-[var(--primary)]/60 ring-4 ring-white/5">
                {avatarDataUrl ? (<img src={avatarDataUrl} alt="Profilbild" className="h-full w-full object-cover" />) : (<span className="text-3xl font-semibold text-white">{safeInitials(profileName)}</span>)}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)} />
                <AppButton onClick={onPickAvatar} className="bg-white/10 border border-white/20 text-white hover:bg-white/20" size="sm">
                  Bild wählen
                </AppButton>
                {avatarDataUrl && (
                  <AppButton onClick={() => setAvatarDataUrl("")} className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20" size="sm">
                    Bild entfernen
                  </AppButton>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white/60">Name</label>
                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="Dein Name" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white/60">Beschreibung</label>
                <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none min-h-[100px]" placeholder="Erzähle etwas über dein Training..." />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-lg font-semibold text-white">Deine Daten</h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Alter</label>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-3 text-center outline-none" placeholder="-" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Größe (cm)</label>
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-3 text-center outline-none" placeholder="-" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Gewicht (kg)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-3 text-center outline-none" placeholder="-" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Stunden/Woche</label>
                  <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="h" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Einheiten/Woche</label>
                  <input type="number" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="#" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/60">Sportarten (CSV)</label>
                <input type="text" value={sportsCsv} onChange={(e) => setSportsCsv(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="Laufen, Gym..." />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/60">Ziele (CSV)</label>
                <input type="text" value={goalsCsv} onChange={(e) => setGoalsCsv(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-3xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="Marathon, Kraft..." />
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={saveProfileEdits}
                className="w-full bg-[#007AFF] hover:bg-[#0066CC] text-white font-bold py-4 rounded-3xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all"
              >
                Speichern
              </button>
            </div>
          </AppCard>
        </div>
      )}

      {/* MODAL: Statistiken */}
      {statsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setStatsOpen(false); }}>
          <AppCard variant="glass" className="w-full max-w-5xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text)]">Statistiken</h2>
              <AppButton onClick={() => setStatsOpen(false)} variant="ghost" size="sm" className="!p-1 rounded-full text-[var(--muted)]">✕</AppButton>
            </div>
            <ProfileStatsDashboard workouts={workouts} weeklyGoalMinutes={WEEKLY_GOAL_MINUTES} />
          </AppCard>
        </div>
      )}

      {/* SETTINGS FULLSCREEN MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] bg-black overscroll-none touch-pan-y">
          <SettingPage
            onBack={() => setSettingsOpen(false)}
            onClearCalendar={onClearCalendar || (() => { })}
            onOpenPaywall={openPaywall}
            onOpenGoals={() => { }}
          />
        </div>
      )}
    </>
  );
};

export default ProfilePage;
