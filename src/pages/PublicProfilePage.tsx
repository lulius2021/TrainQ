// src/pages/PublicProfilePage.tsx
import React, { useMemo } from "react";
import { shortenId } from "../utils/shareProfile";
import { loadWorkoutHistory } from "../utils/workoutHistory";
import { getAllUsers } from "../utils/testAccountsSeed";

type Props = {
  userId: string | null;
  onBack?: () => void;
};

export default function PublicProfilePage({ userId, onBack }: Props) {
  // Previously this read from "trainq_auth_users_v1" — a key that no part of
  // the codebase ever writes, so every public-profile URL rendered "not
  // found". Switch to the actual seeded user list (testAccountsSeed writes
  // "trainq_users_v1").
  const user = useMemo(() => {
    if (!userId) return null;
    return getAllUsers().find((u) => u.id === userId) ?? null;
  }, [userId]);

  const initials = useMemo(() => {
    const name = user?.displayName ?? "TrainQ";
    const parts = name.split(" ").filter(Boolean).slice(0, 2);
    const init = parts.map((p) => p[0]).join("");
    return (init || "TQ").toUpperCase();
  }, [user?.displayName]);

  const localHistoryCount = useMemo(() => {
    const list = loadWorkoutHistory();
    return list.length;
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10"
        >
          Zurück
        </button>
        <div className="text-sm text-gray-400">
          Öffentliches Profil
        </div>
      </div>

      {!user && (
        <div className="rounded-3xl p-6 bg-white/5 border border-white/10 backdrop-blur-xl text-gray-400">
          Profil nicht gefunden (MVP: nur lokal gespeicherte Nutzer).
        </div>
      )}

      {user && (
        <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl p-6 flex items-center gap-6">
          <div className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-brand-primary/50 to-white/10 border-2 border-white/20">
            {/* Avatars live in each user's own scoped onboarding storage; we
                can't safely cross-read another account's avatar from this
                view, so we always show initials for public profiles. */}
            <div className="text-4xl font-bold text-white">
              {initials}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-2xl font-bold text-white">
              {user.displayName ?? "TrainQ Nutzer"}
            </div>
            <div className="text-sm text-gray-400">
              TrainQ ID: {shortenId(user.id)}
            </div>
            <div className="mt-2 text-sm text-gray-400 tabular-nums">
              Workouts (lokal): {localHistoryCount}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-3xl p-4 text-sm bg-white/5 border border-white/10 backdrop-blur-xl text-gray-500">
        Hinweis: Öffentliche Profile sind im MVP nur für lokal gespeicherte Nutzer sichtbar. Backend‑Sync folgt später.
      </div>
    </div>
  );
}
