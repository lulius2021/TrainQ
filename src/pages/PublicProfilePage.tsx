// src/pages/PublicProfilePage.tsx
import React, { useMemo } from "react";
import { shortenId } from "../utils/shareProfile";
import { loadWorkoutHistory } from "../utils/workoutHistory";

type Props = {
  userId: string | null;
  onBack?: () => void;
};

type StoredUser = {
  id: string;
  displayName?: string;
  email?: string;
  avatarDataUrl?: string;
};

function readLocalUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("trainq_auth_users_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PublicProfilePage({ userId, onBack }: Props) {
  const user = useMemo(() => {
    if (!userId) return null;
    return readLocalUsers().find((u) => u.id === userId) ?? null;
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

  const surface: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)" };
  const surfaceSoft: React.CSSProperties = { background: "var(--surface2)", border: "1px solid var(--border)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-4 py-2 text-xs font-semibold hover:opacity-95"
          style={surfaceSoft}
        >
          Zurück
        </button>
        <div className="text-xs" style={muted}>
          Öffentliches Profil
        </div>
      </div>

      {!user && (
        <div className="rounded-2xl p-4 text-sm" style={surfaceSoft}>
          <div style={muted}>Profil nicht gefunden (MVP: nur lokal gespeicherte Nutzer).</div>
        </div>
      )}

      {user && (
        <div className="tq-surface p-4 flex items-center gap-4" style={surface}>
          <div className="h-16 w-16 rounded-full overflow-hidden flex items-center justify-center" style={surfaceSoft}>
            {user.avatarDataUrl ? (
              <img src={user.avatarDataUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-lg font-semibold" style={{ color: "var(--text)" }}>
                {initials}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="text-base font-semibold" style={{ color: "var(--text)" }}>
              {user.displayName ?? "TrainQ Nutzer"}
            </div>
            <div className="text-xs" style={muted}>
              TrainQ ID: {shortenId(user.id)}
            </div>
            <div className="mt-2 text-[11px]" style={muted}>
              Workouts (lokal): {localHistoryCount}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl p-4 text-xs" style={surfaceSoft}>
        <div style={muted}>
          Hinweis: Öffentliche Profile sind im MVP nur für lokal gespeicherte Nutzer sichtbar. Backend‑Sync folgt später.
        </div>
      </div>
    </div>
  );
}
