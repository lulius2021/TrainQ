// src/pages/onboarding/steps/Step5Profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { StepWrapper } from "../StepWrapper"; // ✅ gleicher Wrapper wie Step1–4
import { useOnboarding } from "../../../context/OnboardingContext";
import { AppCard } from "../../../components/ui/AppCard";
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

  /* Removed inline styles in favor of Tailwind classes */

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
      <AppCard variant="soft" className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center text-[12px] font-semibold bg-white/10 border border-white/10 text-[var(--text)]"
          >
            {initialsOf(usernameTrim || "TrainQ")}
          </div>

          <div className="flex-1 space-y-1">
            <div className="text-[11px] text-[var(--muted)]">
              Benutzername
            </div>
            <input
              type="text"
              placeholder="@deinname"
              value={profile.username}
              onChange={(e) => setProfileSafe((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full rounded-xl px-3 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-offset-0 bg-[var(--surface)] border border-white/10 text-[var(--text)] placeholder:text-[var(--muted)]"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        </div>
      </AppCard>

      {/* Optional: Privat */}
      <AppCard variant="soft" className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-[var(--text)]">
            Öffentlich
          </div>
          <div className="text-[11px] text-[var(--muted)]">
            Profil sichtbar
          </div>
        </div>

        <button
          type="button"
          onClick={() => setProfileSafe((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
          aria-label="Profil öffentlich"
          className={`w-[44px] h-[26px] rounded-full p-0.5 flex items-center border border-[var(--border)] transition-colors duration-200 ${profile.isPublic ? "bg-[var(--primary)] justify-end" : "bg-white/10 justify-start"}`}
        >
          <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
        </button>
      </AppCard>

      {/* Optional: Mini-Vorschau (kurz, kein Textblock) */}
      <AppCard variant="soft">
        <div className="text-[11px] mb-2 text-[var(--muted)]">
          Vorschau
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold bg-white/10 border border-white/10 text-[var(--text)]"
          >
            {initialsOf(usernameTrim || "TrainQ")}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate text-[var(--text)]">
              {usernameTrim || "Dein Name"}
            </div>
            <div className="text-[11px] truncate text-[var(--muted)]">
              {profile.isPublic ? "öffentlich" : "privat"}
            </div>
          </div>
        </div>
      </AppCard>
    </StepWrapper>
  );
};