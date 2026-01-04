// src/pages/onboarding/steps/Step5Profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { StepWrapper } from "../StepWrapper"; // ✅ gleicher Wrapper wie Step1–4
import { useOnboarding } from "../../../context/OnboardingContext";
import type { ProfileData } from "../../../types/onboarding";

interface Step5ProfileProps {
  onBack: () => void;
  onFinish: () => void;
}

function initialsOf(name: string): string {
  const parts = (name || "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map((p) => p[0]).join("");
  return (initials || "TQ").slice(0, 2).toUpperCase();
}

function sanitizeProfile(input?: Partial<ProfileData> | null): ProfileData {
  const p = (input ?? {}) as Partial<ProfileData>;
  return {
    username: typeof p.username === "string" ? p.username : "",
    bio: typeof p.bio === "string" ? p.bio : "",
    profileImageUrl: typeof p.profileImageUrl === "string" ? p.profileImageUrl : undefined,
    stravaUrl: typeof p.stravaUrl === "string" ? p.stravaUrl : undefined,
    isPublic: typeof p.isPublic === "boolean" ? p.isPublic : true,
  };
}

export const Step5Profile: React.FC<Step5ProfileProps> = ({ onBack, onFinish }) => {
  const { data, updateData, complete } = useOnboarding();

  const initial = useMemo(() => sanitizeProfile(data?.profile), [data?.profile]);

  const [profile, setProfile] = useState<ProfileData>(() => initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setProfile(initial);
  }, [initial, dirty]);

  const setProfileSafe = (next: React.SetStateAction<ProfileData>) => {
    setDirty(true);
    setProfile(next);
  };

  const usernameTrim = (profile.username || "").trim();
  const isNextDisabled = usernameTrim.length === 0;

  const handleFinish = () => {
    updateData({
      profile: {
        ...profile,
        username: usernameTrim,
        bio: (profile.bio ?? "").trim(),
        profileImageUrl: (profile.profileImageUrl ?? "").trim() || undefined,
        stravaUrl: (profile.stravaUrl ?? "").trim() || undefined,
      },
    });

    complete();
    onFinish();
  };

  const card: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  };

  const text: React.CSSProperties = { color: "var(--text)" };
  const muted: React.CSSProperties = { color: "var(--muted)" };

  const inputStyle =
    "w-full rounded-2xl px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-offset-0";
  const inputInline: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--text)",
  };

  const toggleStyle = (on: boolean): React.CSSProperties => ({
    width: 44,
    height: 26,
    borderRadius: 999,
    padding: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: on ? "flex-end" : "flex-start",
    background: on ? "var(--primary)" : "rgba(255,255,255,0.10)",
    border: "1px solid var(--border)",
  });

  const knobStyle: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: 999,
    background: "#fff",
  };

  return (
    <StepWrapper
      hideProgress
      title="Startklar."
      subtitle="Name setzen, fertig."
      onBack={onBack}
      showBack
      onNext={handleFinish}
      nextLabel="Fertig"
      nextDisabled={isNextDisabled}
    >
      {/* Minimal Profil */}
      <div className="rounded-2xl p-4 space-y-3" style={card}>
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-[12px] font-semibold"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            {initialsOf(usernameTrim || "TrainQ")}
          </div>

          <div className="flex-1 space-y-1">
            <div className="text-[11px]" style={muted}>
              Benutzername
            </div>
            <input
              type="text"
              placeholder="@deinname"
              value={profile.username}
              onChange={(e) => setProfileSafe((prev) => ({ ...prev, username: e.target.value }))}
              className={inputStyle}
              style={inputInline}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        </div>
      </div>

      {/* Optional: Privat */}
      <div className="rounded-2xl p-4 flex items-center justify-between" style={card}>
        <div className="space-y-0.5">
          <div className="text-sm font-semibold" style={text}>
            Öffentlich
          </div>
          <div className="text-[11px]" style={muted}>
            Profil sichtbar
          </div>
        </div>

        <button
          type="button"
          onClick={() => setProfileSafe((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
          aria-label="Profil öffentlich"
          style={toggleStyle(profile.isPublic)}
        >
          <div style={knobStyle} />
        </button>
      </div>

      {/* Optional: Mini-Vorschau (kurz, kein Textblock) */}
      <div className="rounded-2xl p-4" style={card}>
        <div className="text-[11px] mb-2" style={muted}>
          Vorschau
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            {initialsOf(usernameTrim || "TrainQ")}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={text}>
              {usernameTrim || "Dein Name"}
            </div>
            <div className="text-[11px] truncate" style={muted}>
              {profile.isPublic ? "öffentlich" : "privat"}
            </div>
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};