// src/pages/ProfilePage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import { useEntitlements } from "../hooks/useEntitlements";
import ProfileStatsDashboard from "../components/profile/ProfileStatsDashboard";
import { buildProfileLinks, copyText, shareProfile, shortenId } from "../utils/shareProfile";
import { useI18n } from "../i18n/useI18n";

// WICHTIG: Datei heißt bei dir "SettingPage.tsx" (ohne s)
import SettingPage from "./SettingPage";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";

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

const ProfilePage: React.FC<ProfilePageProps> = ({ onClearCalendar, onOpenPaywall, onOpenWorkoutShare }) => {
  const { user, logout } = useAuth();
  const { isPro } = useEntitlements(user?.id);
  const { t } = useI18n();

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

  return (
    <>
      <div className="w-full text-[var(--text)]">
        <div className="mx-auto w-full max-w-5xl px-4 pt-0 pb-[var(--nav-height)] space-y-6">
          <section className="mt-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h1 className="text-2xl font-bold text-[var(--text)]">Profil</h1>
              <div className="flex items-center gap-2">
                <AppButton
                  onClick={handleShareProfile}
                  variant="ghost"
                  className="rounded-full !p-0 w-10 h-10"
                  title={t("profile.share")}
                  aria-label={t("profile.share")}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" className="text-[var(--muted)]">
                    <path d="M12 3v10m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </AppButton>
                <AppButton
                  onClick={() => setSettingsOpen(true)}
                  variant="ghost"
                  className="rounded-full !p-0 w-10 h-10"
                  title={t("settings.title")}
                  aria-label={t("settings.title")}
                >
                  <div className="flex flex-col gap-1.5 px-2">
                    <span className="block h-0.5 w-5 rounded bg-[var(--muted)]" />
                    <span className="block h-0.5 w-5 rounded bg-[var(--muted)]" />
                    <span className="block h-0.5 w-5 rounded bg-[var(--muted)]" />
                  </div>
                </AppButton>
              </div>
            </div>

            {/* Profile card */}
            <AppCard variant="glass" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                      <button type="button" onClick={openPaywall} className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium bg-green-500/10 border border-green-500/20 text-green-500 hover:opacity-90" title={t("profile.upgradePro")}>
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
                  {t("profile.edit")}
                </AppButton>
              </div>
            </AppCard>

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
            <AppCard variant="glass">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text)]">Statistiken</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">Monatliche Häufigkeit und Wochen-Minuten.</p>
                </div>
                <AppButton onClick={() => setStatsOpen(true)} variant="secondary" size="sm">
                  {t("profile.view")}
                </AppButton>
              </div>
            </AppCard>

            {/* Workout history list */}
            <AppCard variant="glass" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--text)]">Gemachte Trainings</h2>
                <span className="text-sm text-[var(--muted)]">
                  {workouts.length} Beitrag{workouts.length === 1 ? "" : "e"}
                </span>
              </div>

              {workouts.length === 0 && (
                <div className="rounded-xl p-3 text-sm bg-[var(--surface)] border-[1.5px] border-[var(--border)] text-[var(--muted)]">
                  Noch keine Beiträge. Beende ein Training im Live-Modus, dann erscheint hier genau 1 Eintrag pro Training.
                </div>
              )}

              {workouts.length > 0 && (
                <div className="space-y-3">
                  {workouts.slice(0, 30).map((w) => {
                    const sport = normalizeSport(w.sport);
                    const exCount = (w.exercises ?? []).length;
                    const date = toLocalDateLabel(w.endedAt ?? w.startedAt);
                    const mins = durationMinutes(w);
                    return (
                      <div key={w.id} className="rounded-xl p-3 bg-[var(--surface)] border-[1.5px] border-[var(--border)]">
                        <p className="text-sm text-[var(--muted)]">{date} • {mins} min</p>
                        <h4 className="mt-1 text-base font-semibold truncate text-[var(--text)]">{w.title ?? "Training"}</h4>
                        <p className="mt-1 text-sm text-[var(--muted)]">{exCount > 0 ? `${exCount} Übung${exCount === 1 ? "" : "en"}` : "—"}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <AppButton onClick={() => handleShareImage(w)} variant="ghost" size="sm" className="rounded-full !px-3 !py-1.5 h-auto text-xs border border-[var(--border)] bg-[var(--surface2)] hover:bg-[var(--surface)]" aria-label={t("profile.shareWorkout")} title={t("profile.shareWorkout")}>
                            <span className="inline-flex items-center gap-1.5 text-[var(--text)]">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M12 3v10m0 0 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                              Export
                            </span>
                          </AppButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </AppCard>
          </section>
        </div>
      </div>

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
                  {t("profile.avatarSelect")}
                </AppButton>
                {avatarDataUrl && (
                  <AppButton onClick={() => setAvatarDataUrl("")} className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20" size="sm">
                    {t("profile.avatarRemove")}
                  </AppButton>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white/60">Name</label>
                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder={t("profile.namePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-white/60">Beschreibung</label>
                <textarea value={profileBio} onChange={(e) => setProfileBio(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none min-h-[100px]" placeholder={t("profile.bioPlaceholder")} />
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <h3 className="text-lg font-semibold text-white">Deine Daten</h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Alter</label>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-3 text-center outline-none" placeholder="-" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Größe (cm)</label>
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-3 text-center outline-none" placeholder="-" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Gewicht (kg)</label>
                  <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-3 text-center outline-none" placeholder="-" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Stunden/Woche</label>
                  <input type="number" value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="h" />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-white/60">Einheiten/Woche</label>
                  <input type="number" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="#" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/60">Sportarten (CSV)</label>
                <input type="text" value={sportsCsv} onChange={(e) => setSportsCsv(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="Laufen, Gym..." />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-white/60">Ziele (CSV)</label>
                <input type="text" value={goalsCsv} onChange={(e) => setGoalsCsv(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:bg-white/10 focus:border-[#007AFF] transition-all p-4 outline-none" placeholder="Marathon, Kraft..." />
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={saveProfileEdits}
                className="w-full bg-[#007AFF] hover:bg-[#0066CC] text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all"
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

      {/* SETTINGS DRAWER (rechts rein) */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSettingsOpen(false)} />

          {/* panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl">
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto">
                <SettingPage onBack={() => setSettingsOpen(false)} onClearCalendar={onClearCalendar} onOpenPaywall={openPaywall} />
              </div>

              {/* Quick actions footer */}
              <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)]">
                <div className="grid grid-cols-2 gap-3">
                  <AppButton
                    onClick={handleClearHistory}
                    variant="danger"
                    size="sm"
                  >
                    Verlauf löschen
                  </AppButton>
                  <AppButton
                    onClick={handleRestartOnboarding}
                    variant="secondary"
                    size="sm"
                  >
                    Onboarding reset
                  </AppButton>
                </div>

                <AppButton
                  onClick={handleLogout}
                  variant="ghost"
                  className="mt-3 w-full"
                >
                  {t("settings.account.logout")}
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfilePage;
