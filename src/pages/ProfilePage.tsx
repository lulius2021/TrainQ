// src/pages/ProfilePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  loadWorkoutHistory,
  onWorkoutHistoryUpdated,
  clearWorkoutHistory,
  type WorkoutHistoryEntry,
} from "../utils/workoutHistory";
import { WorkoutHistoryOverlay } from "../components/profile/WorkoutHistoryOverlay";
import { History, Settings } from "lucide-react";

import {
  readOnboardingDataFromStorage,
  writeOnboardingDataToStorage,
  resetOnboardingInStorage,
} from "../context/OnboardingContext";

import { useAuth } from "../hooks/useAuth";
import { useEntitlements } from "../hooks/useEntitlements";
import { track } from "../analytics/track";
import ProfileStatsDashboard from "../components/profile/ProfileStatsDashboard";
import { buildProfileLinks, copyText, shareProfile, shortenId } from "../utils/shareProfile";


// WICHTIG: Datei heißt bei dir "SettingPage.tsx" (ohne s)
import SettingPage from "./SettingPage";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";
import HumanAvatarSvg from "../components/avatar/HumanAvatarSvg";
import { useAvatarState } from "../store/useAvatarStore";
import { levelFromPoints, overallLevel, detectPose } from "../utils/avatarProgression";
import { useStatistics, type TimeRange } from "../hooks/useStatistics";
import { StatsChart } from "../components/stats/StatsChart";
import { ConsistencyHeatmap } from "../components/stats/ConsistencyHeatmap";
import { GarminService } from "../services/garmin/api";
import { useGarminConnection } from "../hooks/useGarminConnection";
import type { GarminActivity } from "../services/garmin/types";
import { ShareableStatCard } from "../components/stats/ShareableStatCard";
import { BottomSpacer } from "../components/layout/BottomSpacer";
import { BottomSheet } from "../components/common/BottomSheet";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { useI18n } from "../i18n/useI18n";
import { useChallengeRewards } from "../hooks/useChallengeRewards";
import { Gift, Trophy, Flame } from "lucide-react";
import { computeStreaks } from "../utils/stats";

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

// -------------------- Deferred Section (prevents WebKit rendering crash) --------------------
// -------------------- Section Error Boundary --------------------
class SectionErrorBoundary extends React.Component<{ name: string; children: React.ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { name: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, error: String((error as any)?.message || error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 12, backgroundColor: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.2)", borderRadius: 12, marginBottom: 8 }}>
          <p style={{ fontSize: 12, color: "#FF3B30", margin: 0 }}>[{this.props.name}] {this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// -------------------- Page --------------------

// Error Boundary specifically for Profile — uses hardcoded colors to avoid CSS var issues
class ProfileErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: string; stack: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "", stack: "" };
  }
  static getDerivedStateFromError(error: unknown) {
    const msg = String((error as any)?.message || error);
    const stack = String((error as any)?.stack || "").slice(0, 500);
    return { hasError: true, error: msg, stack };
  }
  componentDidCatch(error: unknown, info: unknown) {
    if (import.meta.env.DEV) console.error("ProfilePage Error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, backgroundColor: "var(--bg-color)", color: "var(--text-color)", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 12, color: "var(--text-color)" }}>Profil-Fehler</h2>
          <div style={{ padding: 16, backgroundColor: "rgba(255,59,48,0.1)", border: "1px solid rgba(255,59,48,0.3)", borderRadius: 12, marginBottom: 16 }}>
            <p style={{ fontSize: 14, color: "#FF3B30", wordBreak: "break-all", margin: 0 }}>{this.state.error}</p>
            {this.state.stack && (
              <pre style={{ fontSize: 10, color: "#FF3B30", opacity: 0.7, marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{this.state.stack}</pre>
            )}
          </div>
          <button onClick={() => this.setState({ hasError: false, error: "", stack: "" })} style={{ padding: "12px 24px", background: "#007AFF", color: "white", border: "none", borderRadius: 12, fontWeight: "bold", fontSize: 16 }}>
            Erneut versuchen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProfilePageInner: React.FC<ProfilePageProps> = ({ onClearCalendar, onOpenPaywall, onOpenWorkoutShare }) => {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { isPro, canViewStatsRange } = useEntitlements(user?.id);
  const { unclaimedRewards, unclaimedCount, activeGrants, hasActiveGrant, claimReward: claimChallengeReward, isLoading: rewardsLoading } = useChallengeRewards();

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

  const avatarState = useAvatarState();
  const avatarPose = detectPose(avatarState, new Date().toISOString().slice(0, 10));
  const avatarOverallLevel = overallLevel(avatarState);
  const avatarBodyLevels = {
    chest:     levelFromPoints(avatarState.bodyParts.chest.points),
    back:      levelFromPoints(avatarState.bodyParts.back.points),
    shoulders: levelFromPoints(avatarState.bodyParts.shoulders.points),
    arms:      levelFromPoints(avatarState.bodyParts.arms.points),
    legs:      levelFromPoints(avatarState.bodyParts.legs.points),
    core:      levelFromPoints(avatarState.bodyParts.core.points),
    cardio:    levelFromPoints(avatarState.bodyParts.cardio.points),
  };

  const [onboarding, setOnboarding] = useState(() => readOnboardingDataFromStorage());
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>(() => loadWorkoutHistory());

  const [timeRange, setTimeRange] = useState<TimeRange>("1W");
  const stats = useStatistics(workouts, timeRange);
  const { connected: garminConnected } = useGarminConnection();
  const [garminActivities, setGarminActivities] = useState<GarminActivity[]>([]);

  useEffect(() => {
    if (!garminConnected) return;
    const now = new Date();
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const from = yearAgo.toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    GarminService.getActivities(from, to).then(setGarminActivities);
  }, [garminConnected]);

  const refreshOnboarding = useCallback(() => setOnboarding(readOnboardingDataFromStorage()), []);
  const refreshWorkouts = useCallback(() => {
    const fresh = loadWorkoutHistory();
    setWorkouts(prev => prev.length === fresh.length ? prev : fresh);
  }, []);

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
    () => (onboarding.profile?.username || "").trim() || t("profile.defaultName"),
    [onboarding.profile?.username]
  );

  const derivedBioFallback = useMemo(() => {
    const goals = onboarding.goals?.selectedGoals ?? [];
    const sports = onboarding.goals?.sports ?? [];
    const g = goals.length ? `${t("profile.goals")}: ${goals.join(", ")}` : "";
    const s = sports.length ? `${t("profile.sports")}: ${sports.join(", ")}` : "";
    const combined = [g, s].filter(Boolean).join(" • ");
    return combined || t("profile.defaultBio");
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

    const isDefaultOrAuto = profileName.trim() === "" || profileName === t("profile.defaultName") || profileName === initialName;
    if (isDefaultOrAuto) setProfileName(obName);
  }, [onboarding.profile?.username, initialName, profileName]);

  useEffect(() => {
    const storedBio = (onboarding.profile?.bio || "").trim();

    const isDefaultOrAuto =
      profileBio.trim() === "" ||
      profileBio === t("profile.defaultBio")
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

  // Lock background scroll whenever any overlay is open
  useBodyScrollLock(statsOpen);

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

  const streaks = useMemo(() => computeStreaks(workouts ?? []), [workouts]);

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
    setCopyFeedback(ok ? t("profile.copied") : t("profile.copyFailed"));
    window.setTimeout(() => setCopyFeedback(null), 2500);
  }, [user?.id]);

  const handleShareProfile = useCallback(async () => {
    const id = user?.id ?? "";
    if (!id) return;
    try {
      const result = await shareProfile({ userId: id, displayName: profileName });
      if (result === "copied") setShareFeedback(t("profile.linkCopied"));
      else if (result === "shared") setShareFeedback(t("profile.shared"));
      else setShareFeedback(t("profile.shareFailed"));
    } catch {
      setShareFeedback(t("profile.shareFailed"));
    } finally {
      window.setTimeout(() => setShareFeedback(null), 1800);
    }
  }, [user?.id, profileName]);

  const handleRestartOnboarding = useCallback(() => {
    if (typeof window === "undefined") return;

    const ok = window.confirm(
      t("profile.confirmRestartOnboarding")
    );
    if (!ok) return;

    resetOnboardingInStorage();
    setSettingsOpen(false);
  }, []);

  const handleClearHistory = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      t("profile.confirmClearHistory")
    );
    if (!ok) return;
    clearWorkoutHistory();
    setWorkouts([]);
    alert(t("profile.historyCleared"));
  }, []);

  // -------------------- Theme-safe style helpers --------------------
  // (unused legacy helpers removed — all styling uses CSS variables inline)

  // -------- Monthly Recap Logic --------
  const [recapOpen, setRecapOpen] = useState(false);

  const { lastMonthYear, lastMonthIndex, lastMonthName, hasLastMonthWorkouts } = useMemo(() => {
    // Only show recap for completed (past) months — check up to 6 months back
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const has = workouts.some(w => {
        const wd = new Date(w.startedAt);
        return wd.getFullYear() === y && wd.getMonth() === m;
      });
      if (has) {
        const name = d.toLocaleString("de-DE", { month: "long" });
        return { lastMonthYear: y, lastMonthIndex: m, lastMonthName: name, hasLastMonthWorkouts: true };
      }
    }
    return { lastMonthYear: now.getFullYear(), lastMonthIndex: now.getMonth() - 1, lastMonthName: "", hasLastMonthWorkouts: false };
  }, [workouts]);

  return (
    <>
      <div className="w-full min-h-full" style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}>
        <div className="mx-auto w-full max-w-5xl px-4 pb-40 space-y-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <section className="mt-2 space-y-4">
            <div className="flex items-center justify-end px-1">
              <div className="flex items-center gap-2">
                <AppButton
                  onClick={handleShareProfile}
                  variant="ghost"
                  className="rounded-full !p-0 w-10 h-10"
                  title={t("profile.shareProfile")}
                  aria-label={t("profile.shareProfile")}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" style={{ color: "var(--text-main)" }}>
                    <path d="M12 3v10m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </AppButton>
                <AppButton
                  onClick={() => setSettingsOpen(true)}
                  variant="ghost"
                  className="rounded-full !p-0 w-11 h-11 flex items-center justify-center"
                  title={t("profile.settings")}
                  aria-label={t("profile.settings")}
                >
                  <Settings className="w-7 h-7" style={{ color: "var(--text-main)" }} />
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
                  <span className="text-[#007AFF] text-xs font-bold uppercase tracking-wider mb-0.5">{t("profile.highlights")}</span>
                  <span className="font-semibold text-lg" style={{ color: "var(--text-color)" }}>{t("profile.monthReady", { month: lastMonthName, year: lastMonthYear })}</span>
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
                <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-indigo-600">
                  {avatarDataUrl ? (
                    <img src={avatarDataUrl} alt={t("profile.profilePicture")} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-semibold text-white">{safeInitials(profileName)}</span>
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold truncate text-[var(--text-color)]">{profileName}</h2>
                    {isPro ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium bg-blue-500/10 border border-blue-500/20 text-blue-500">Pro</span>
                    ) : (
                      <button type="button" onClick={openPaywall} className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium bg-green-500/10 border border-green-500/20 text-green-500 hover:opacity-90" title={t("profile.upgradeToPro")}>
                        Free
                      </button>
                    )}
                  </div>
                  <p className="text-base max-w-xs text-[var(--text-secondary)]">{profileBio}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pt-1" style={{ color: "var(--text-main)" }}>
                    {user?.email && <span className="truncate">Account: <span className="font-medium">{user.email}</span></span>}
                    <span>{t("profile.workouts")}: <span className="font-medium">{weekTotalSessions}</span></span>
                    <span>{t("profile.time")}: <span className="font-medium">{Math.floor(weekTotalMinutes / 60)}h {weekTotalMinutes % 60}m</span></span>
                    {streaks.current > 0 && (
                      <span className="flex items-center gap-1">
                        <Flame size={13} className="text-orange-400" fill="currentColor" />
                        <span className="font-medium text-orange-400">{streaks.current}d Streak</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center self-end sm:self-center">
                <AppButton onClick={openEdit} variant="secondary" size="sm" style={{ color: "var(--text-main)" }}>
                  {t("profile.editProfile")}
                </AppButton>
              </div>
            </AppCard>


            {(copyFeedback || shareFeedback) && (
              <AppCard variant="soft" className="px-4 py-2 text-sm text-center">
                <span className="text-[var(--text-secondary)]">{copyFeedback || shareFeedback}</span>
              </AppCard>
            )}

            {/* Upgrade card */}
            {!isPro && (
              <AppCard variant="glass">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text-color)]">{t("profile.upgradeTitle")}</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("profile.upgradeSubtitle")}</p>
                  </div>
                  <AppButton onClick={openPaywall} variant="primary" size="sm">
                    {t("profile.upgrade")}
                  </AppButton>
                </div>
              </AppCard>
            )}

            {/* Rewards Section */}
            {(unclaimedCount > 0 || hasActiveGrant) && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-[var(--text-color)] px-1">{t("profile.rewards.title")}</h3>

                {/* Unclaimed Rewards */}
                {unclaimedRewards.map((ur) => (
                  <AppCard key={ur.id} variant="glass">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/15 flex items-center justify-center text-yellow-500 shrink-0">
                        <Gift size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-color)]">{t("profile.rewards.unclaimed")}</p>
                        {ur.rewardExpiresAt && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            {t("profile.rewards.expiresAt").replace("{{date}}", new Date(ur.rewardExpiresAt).toLocaleDateString("de-DE"))}
                          </p>
                        )}
                      </div>
                      <AppButton
                        variant="primary"
                        size="sm"
                        onClick={() => claimChallengeReward(ur.id)}
                        disabled={rewardsLoading}
                      >
                        {t("profile.rewards.claim")}
                      </AppButton>
                    </div>
                  </AppCard>
                ))}

                {/* Active Pro Grants */}
                {activeGrants.map((grant) => (
                  <AppCard key={grant.id} variant="glass">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center text-blue-500 shrink-0">
                        <Trophy size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--text-color)]">{t("profile.rewards.activePro")}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {t("profile.rewards.expiresAt").replace("{{date}}", new Date(grant.expiresAt).toLocaleDateString("de-DE"))}
                        </p>
                      </div>
                    </div>
                  </AppCard>
                ))}
              </div>
            )}

            {/* Statistics */}
              <div className="space-y-4">
                {/* Heatmap Top */}
                <SectionErrorBoundary name="Heatmap">
                <ShareableStatCard titleForFile={`trainq-heatmap-${new Date().toISOString().split('T')[0]}`}>
                  <ConsistencyHeatmap workouts={workouts} garminActivities={garminActivities} />
                </ShareableStatCard>
                </SectionErrorBoundary>

                <div className="flex items-center justify-between px-1 mt-6">
                  <h3 className="text-lg font-semibold text-[var(--text-color)]">{t("profile.progress")}</h3>
                  <div className="flex items-center p-1 rounded-lg border" style={{ backgroundColor: "var(--input-bg)", borderColor: "var(--border-color)" }}>
                    {(["1W", "1M", "6M", "1Y"] as TimeRange[]).map((tr) => {
                      const locked = !canViewStatsRange(tr);
                      return (
                        <button
                          key={tr}
                          onClick={() => {
                            if (locked) {
                              window.dispatchEvent(new CustomEvent("trainq:open_paywall", { detail: { reason: "stats_history_limit" } }));
                              track("feature_blocked", { featureKey: "HISTORY_BEYOND_30_DAYS", contextScreen: "profile" });
                              return;
                            }
                            setTimeRange(tr);
                          }}
                          className="px-3 py-1 text-xs font-medium rounded-md transition-all relative"
                          style={{
                            backgroundColor: timeRange === tr ? "var(--card-bg)" : "transparent",
                            color: locked ? "var(--text-muted)" : timeRange === tr ? "var(--text-color)" : "var(--text-muted)",
                            boxShadow: timeRange === tr ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                            opacity: locked ? 0.6 : 1,
                          }}
                        >
                          {tr}
                          {locked && <span className="ml-0.5 text-[9px] align-super">Pro</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SectionErrorBoundary name="AreaChart-Volume">
                    <StatsChart
                      title={t("profile.stats.trainingLoad")}
                      valueDisplay={(stats.totals.volume / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " t"}
                      unit="kg"
                      data={stats.volumeData}
                      type="area"
                      color="#007AFF"
                    />
                  </SectionErrorBoundary>

                  <SectionErrorBoundary name="BarChart-Duration">
                    <StatsChart
                      title={t("profile.stats.trainingTime")}
                      valueDisplay={Math.round(stats.totals.duration / 60) + " h"}
                      unit="min"
                      data={stats.durationData}
                      type="bar"
                      color="#F59E0B"
                    />
                  </SectionErrorBoundary>

                  {stats.totals.distance > 0 && (
                    <SectionErrorBoundary name="AreaChart-Distance">
                      <StatsChart
                        title={t("profile.stats.distance")}
                        valueDisplay={stats.totals.distance.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " km"}
                        unit="km"
                        data={stats.distanceData}
                        type="area"
                        color="#10B981"
                      />
                    </SectionErrorBoundary>
                  )}

                  <SectionErrorBoundary name="PieChart-Sports">
                    <StatsChart
                      title={t("profile.stats.sportsFocus")}
                      type="pie"
                      data={stats.sportSplitData}
                      unit="x"
                    />
                  </SectionErrorBoundary>

                </div>
              </div>


            {/* Workout history list TRIGGER */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-full border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-3xl p-4 flex items-center justify-between transition-all group hover:opacity-90"
              style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-2xl transition-colors" style={{ backgroundColor: "var(--input-bg)", color: "var(--text-muted)" }}>
                  <History className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium" style={{ color: "var(--text-color)" }}>{t("profile.showAllWorkouts")}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{workouts.length} {t("profile.total")}</div>
                </div>
              </div>
              <div style={{ color: "var(--text-muted)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </div>
            </button>
          </section>
          <BottomSpacer />
        </div>
      </div>

      <SectionErrorBoundary name="MonthlyRecap">
      <MonthlyRecapModal
        isOpen={recapOpen}
        onClose={() => setRecapOpen(false)}
        year={lastMonthYear}
        month={lastMonthIndex}
        workouts={workouts}
      />
      </SectionErrorBoundary>

      {isHistoryOpen && (
        <WorkoutHistoryOverlay
          workouts={workouts}
          onClose={() => setIsHistoryOpen(false)}
          onShare={handleShareImage}
        />
      )}

      {/* MODAL: Profil bearbeiten */}
      <BottomSheet
        open={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        maxHeight="92dvh"
        zIndex={100}
        header={
          <div className="px-5 pb-1">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-color)" }}>
              {t("profile.editProfileTitle")}
            </h2>
          </div>
        }
      >
            <div className="px-5 pb-6 space-y-6">
              {/* --- Avatar section --- */}
              <div className="flex flex-col items-center pt-2 pb-2">
                <div className="relative group cursor-pointer" onClick={onPickAvatar}>
                  <div
                    className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 ring-4 shadow-lg shadow-blue-500/20"
                    style={{ ringColor: "var(--accent-color)" } as React.CSSProperties}
                  >
                    {avatarDataUrl
                      ? <img src={avatarDataUrl} alt="Profilbild" className="h-full w-full object-cover" />
                      : <span className="text-3xl font-bold text-white select-none">{safeInitials(profileName)}</span>
                    }
                  </div>
                  {/* Camera overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onAvatarSelected(e.target.files?.[0] ?? null)} />
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={onPickAvatar}
                    className="text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{ color: "var(--accent-color)" }}
                  >
                    {t("profile.chooseImage")}
                  </button>
                  {avatarDataUrl && (
                    <>
                      <span className="text-xs" style={{ color: "var(--border-color)" }}>|</span>
                      <button
                        onClick={() => setAvatarDataUrl("")}
                        className="text-sm font-semibold text-red-500 transition-opacity hover:opacity-80"
                      >
                        {t("profile.removeImage")}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* --- Name & Bio section --- */}
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <label className="text-sm font-medium shrink-0 w-16" style={{ color: "var(--text-secondary)" }}>{t("profile.nameLabel")}</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm"
                    style={{ color: "var(--text-color)" }}
                    placeholder={t("profile.defaultName")}
                  />
                </div>
                <div className="px-4 py-3">
                  <label className="text-sm font-medium block mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("profile.descriptionLabel")}</label>
                  <textarea
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm resize-none min-h-[72px]"
                    style={{ color: "var(--text-color)" }}
                    placeholder={t("profile.descriptionPlaceholder")}
                  />
                </div>
              </div>

              {/* --- Korperdaten section --- */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: "var(--text-secondary)" }}>{t("profile.yourData")}</p>
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
                  <div className="grid grid-cols-3 divide-x" style={{ borderColor: "var(--border-color)" }}>
                    {/* Age */}
                    <div className="px-3 py-3 flex flex-col items-center gap-1">
                      <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{t("profile.age")}</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full bg-transparent outline-none text-center text-lg font-semibold tabular-nums"
                        style={{ color: "var(--text-color)" }}
                        placeholder="--"
                      />
                    </div>
                    {/* Height */}
                    <div className="px-3 py-3 flex flex-col items-center gap-1" style={{ borderColor: "var(--border-color)" }}>
                      <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{t("profile.heightCm")}</label>
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        className="w-full bg-transparent outline-none text-center text-lg font-semibold tabular-nums"
                        style={{ color: "var(--text-color)" }}
                        placeholder="--"
                      />
                    </div>
                    {/* Weight */}
                    <div className="px-3 py-3 flex flex-col items-center gap-1" style={{ borderColor: "var(--border-color)" }}>
                      <label className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{t("profile.weightKg")}</label>
                      <input
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full bg-transparent outline-none text-center text-lg font-semibold tabular-nums"
                        style={{ color: "var(--text-color)" }}
                        placeholder="--"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Trainingsdaten section --- */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: "var(--text-secondary)" }}>Training</p>
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("profile.hoursPerWeek")}</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={hoursPerWeek}
                        onChange={(e) => setHoursPerWeek(e.target.value)}
                        className="w-16 bg-transparent outline-none text-right text-sm font-semibold tabular-nums"
                        style={{ color: "var(--text-color)" }}
                        placeholder="--"
                      />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>h</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{t("profile.sessionsPerWeek")}</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={sessionsPerWeek}
                        onChange={(e) => setSessionsPerWeek(e.target.value)}
                        className="w-16 bg-transparent outline-none text-right text-sm font-semibold tabular-nums"
                        style={{ color: "var(--text-color)" }}
                        placeholder="--"
                      />
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>x</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Sports & Goals section --- */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider px-1 mb-2" style={{ color: "var(--text-secondary)" }}>Interessen</p>
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("profile.sportsCsv")}</label>
                    <input
                      type="text"
                      value={sportsCsv}
                      onChange={(e) => setSportsCsv(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: "var(--text-color)" }}
                      placeholder="Laufen, Gym, Radfahren..."
                    />
                  </div>
                  <div className="px-4 py-3">
                    <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("profile.goalsCsv")}</label>
                    <input
                      type="text"
                      value={goalsCsv}
                      onChange={(e) => setGoalsCsv(e.target.value)}
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ color: "var(--text-color)" }}
                      placeholder="Marathon, Kraft, Ausdauer..."
                    />
                  </div>
                </div>
              </div>

              {/* --- Save button --- */}
              <div className="pt-2 pb-4">
                <button
                  onClick={saveProfileEdits}
                  className="w-full font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all text-[15px]"
                  style={{ backgroundColor: "var(--accent-color)", color: "#fff" }}
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
      </BottomSheet>

      {/* MODAL: Statistiken */}
      {statsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setStatsOpen(false); }}>
          <AppCard variant="glass" className="w-full max-w-5xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-color)]">{t("profile.statistics")}</h2>
              <AppButton onClick={() => setStatsOpen(false)} variant="ghost" size="sm" className="!p-1 rounded-full text-[var(--text-secondary)]">✕</AppButton>
            </div>
            <ProfileStatsDashboard workouts={workouts} weeklyGoalMinutes={WEEKLY_GOAL_MINUTES} />
          </AppCard>
        </div>
      )}

      {/* SETTINGS BOTTOM SHEET */}
      <BottomSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        height="92dvh"
        zIndex={100}
      >
        <SettingPage
          onBack={() => setSettingsOpen(false)}
          onClearCalendar={onClearCalendar || (() => { })}
          onOpenPaywall={openPaywall}
          onOpenGoals={() => { }}
          isSheet
        />
      </BottomSheet>
    </>
  );
};

const ProfilePage: React.FC<ProfilePageProps> = (props) => (
  <ProfileErrorBoundary>
    <ProfilePageInner {...props} />
  </ProfileErrorBoundary>
);

export default ProfilePage;
