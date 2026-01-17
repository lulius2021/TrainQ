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
import {
  createPost,
  ensureCommunityProfile,
  getFollowers,
  sendMessage,
} from "../services/communityBackend";
import type { CommunityProfileRecord } from "../services/communityBackend";
import ProfileStatsDashboard from "../components/profile/ProfileStatsDashboard";
import {
  buildProfileLinks,
  copyText,
  shareProfile,
  shortenId,
} from "../utils/shareProfile";
import { useI18n } from "../i18n/useI18n";

interface ProfilePageProps {
  onClearCalendar?: () => void;
  onOpenPaywall?: () => void;
  onOpenWorkoutShare?: (
    workoutId: string,
    returnTo?: "dashboard" | "profile"
  ) => void;
  onOpenSettings?: () => void;
}

// -------------------- Page --------------------

const ProfilePage: React.FC<ProfilePageProps> = ({
  onClearCalendar,
  onOpenPaywall,
  onOpenWorkoutShare,
  onOpenSettings,
}) => {
  const { user, logout } = useAuth();
  const { isPro } = useEntitlements(user?.id);
  const { t, formatDate } = useI18n();

  const openPaywall = useCallback(() => {
    if (onOpenPaywall) return onOpenPaywall();
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("trainq:open_paywall"));
  }, [onOpenPaywall]);

  const [onboarding, setOnboarding] = useState(() =>
    readOnboardingDataFromStorage()
  );
  const [workouts, setWorkouts] = useState<WorkoutHistoryEntry[]>(() =>
    loadWorkoutHistory()
  );
  const [detailWorkout, setDetailWorkout] = useState<WorkoutHistoryEntry | null>(null);

  const refreshOnboarding = useCallback(
    () => setOnboarding(readOnboardingDataFromStorage()),
    []
  );
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

  const handleShareWorkout = useCallback(async (w: WorkoutHistoryEntry) => {
    if (onOpenWorkoutShare) {
      onOpenWorkoutShare(w.id, "profile");
    }
  }, [onOpenWorkoutShare]);

  const formatWorkoutDate = useCallback(
    (entry: WorkoutHistoryEntry) => {
      const iso = entry.endedAt || entry.startedAt;
      if (!iso) return "";
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) return "";
      return formatDate(parsed, { day: "2-digit", month: "2-digit", year: "numeric" });
    },
    [formatDate]
  );

  const openWorkoutDetails = useCallback((w: WorkoutHistoryEntry) => {
    setDetailWorkout(w);
  }, []);

  const closeWorkoutDetails = useCallback(() => {
    setDetailWorkout(null);
  }, []);

  const formatDurationLabel = useCallback((w: WorkoutHistoryEntry) => {
    const minutes = Math.max(0, Math.round((w.durationSec ?? 0) / 60));
    if (!Number.isFinite(minutes) || minutes <= 0) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h <= 0) return `${m} min`;
    return `${h}:${String(m).padStart(2, "0")} h`;
  }, []);

  const workoutStats = useCallback((w: WorkoutHistoryEntry) => {
    const exercisesCount = w.exercises?.length ?? 0;
    const setsCount = (w.exercises || []).reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0);
    const volume = Math.max(0, Math.round(w.totalVolume ?? 0));
    return { exercisesCount, setsCount, volume };
  }, []);
  return (
    <>
      <div className="h-full w-full overflow-y-auto px-1 py-5 sm:px-2 space-y-4">
        <div className="flex items-center justify-between px-2">
          <div className="text-white text-lg font-bold">Profil</div>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {t("settings.title")}
          </button>
        </div>
        <ProfileStatsDashboard workouts={workouts} />

        <section className="space-y-4 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 p-6">
          <h2 className="text-white text-lg font-bold">
            {t("profile.workoutHistory")}
          </h2>
          {workouts.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              {t("profile.noWorkouts")}
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map((w) => {
                const stats = workoutStats(w);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => openWorkoutDetails(w)}
                    className="w-full text-left flex items-center justify-between p-4 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-white">{w.title || t("today.untitled")}</p>
                      <p className="text-gray-400 text-xs tabular-nums">
                        {[formatWorkoutDate(w), w.sport || "Gym", formatDurationLabel(w)].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {stats.exercisesCount} Übungen · {stats.setsCount} Sätze · {stats.volume} kg
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareWorkout(w);
                      }}
                      className="bg-brand-primary px-4 py-2 rounded-xl text-xs font-bold text-white hover:bg-brand-primary/90 transition-colors"
                    >
                      {t("common.share")}
                    </button>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {detailWorkout && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4"
          role="dialog"
          aria-modal="true"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeWorkoutDetails();
          }}
        >
          <div className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-white">{detailWorkout.title}</div>
                <div className="text-sm text-gray-400">
                  {[formatWorkoutDate(detailWorkout), detailWorkout.sport || "Gym", formatDurationLabel(detailWorkout)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <button
                type="button"
                onClick={closeWorkoutDetails}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 py-4 space-y-4">
              {(detailWorkout.exercises || []).map((ex, idx) => (
                <div key={`${ex.name}-${idx}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white font-semibold">{ex.name}</div>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    {(ex.sets || []).map((set, setIdx) => (
                      <div key={`${setIdx}`} className="flex items-center justify-between">
                        <span className="text-gray-400">Satz {setIdx + 1}</span>
                        <span className="tabular-nums text-white">
                          {set.weight ?? "—"} × {set.reps ?? "—"}
                          {set.setType ? ` · ${set.setType}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default ProfilePage;
