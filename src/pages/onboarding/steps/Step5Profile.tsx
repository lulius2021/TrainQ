// src/pages/onboarding/steps/Step5Profile.tsx
import React, { useMemo, useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper.tsx";
import { useOnboarding } from "../../../context/OnboardingContext.tsx";
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

export const Step5Profile: React.FC<Step5ProfileProps> = ({ onBack, onFinish }) => {
  const { data, updateData, complete } = useOnboarding();

  const initialProfile = useMemo<ProfileData>(() => {
    const p = data.profile ?? { username: "", isPublic: true };
    return {
      username: typeof p.username === "string" ? p.username : "",
      bio: typeof p.bio === "string" ? p.bio : "",
      profileImageUrl: p.profileImageUrl,
      stravaUrl: p.stravaUrl,
      isPublic: typeof p.isPublic === "boolean" ? p.isPublic : true,
    };
  }, [data.profile]);

  const [profile, setProfile] = useState<ProfileData>(initialProfile);

  const handleFinish = () => {
    // 1) Profil persistieren
    updateData({
      profile: {
        ...profile,
        username: (profile.username || "").trim(),
        bio: (profile.bio ?? "").trim(),
      },
    });

    // 2) zentraler Completion-Pfad (Single Source of Truth)
    complete();

    // 3) Optionaler Legacy-Flag (nur wenn du ihn wirklich noch irgendwo nutzt)
    try {
      localStorage.setItem("trainq_onboarding_completed", "true");
    } catch {
      // ignore
    }

    onFinish();
  };

  const bioPreview = (profile.bio ?? "").trim();

  return (
    <StepWrapper
      title="Profil vervollständigen"
      subtitle="Gestalte dein TrainQ-Profil. Du kannst alles später jederzeit anpassen."
      onNext={handleFinish}
      onBack={onBack}
      nextLabel="Onboarding abschließen"
      isNextDisabled={!profile.username.trim()}
    >
      <div className="space-y-4 text-sm">
        {/* Profil-Header */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-300">
            {profile.profileImageUrl?.trim() ? "Bild" : initialsOf(profile.username || "TrainQ")}
          </div>

          <div className="flex-1">
            <label className="text-xs text-gray-400">Benutzername</label>
            <input
              type="text"
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-3 py-2 text-sm"
              placeholder="@deinname"
              value={profile.username}
              onChange={(e) => setProfile((prev) => ({ ...prev, username: e.target.value }))}
            />
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="text-xs text-gray-400">Bio (optional)</label>
          <textarea
            className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-3 py-2 text-sm min-h-[70px]"
            placeholder="Kurzbeschreibung (z.B. Ziele, Sportarten, Fokus...)"
            value={profile.bio ?? ""}
            onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
          />
          <div className="text-[11px] text-gray-500 mt-1">
            Wird im Profil gespeichert und kann später jederzeit geändert werden.
          </div>
        </div>

        {/* Profilbild-URL */}
        <div>
          <label className="text-xs text-gray-400">Profilbild (URL, optional)</label>
          <input
            type="text"
            className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="https://..."
            value={profile.profileImageUrl ?? ""}
            onChange={(e) =>
              setProfile((prev) => ({
                ...prev,
                profileImageUrl: e.target.value,
              }))
            }
          />
        </div>

        {/* Strava-Link */}
        <div>
          <label className="text-xs text-gray-400">Strava-Link (optional)</label>
          <input
            type="text"
            className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder="https://www.strava.com/athletes/..."
            value={profile.stravaUrl ?? ""}
            onChange={(e) => setProfile((prev) => ({ ...prev, stravaUrl: e.target.value }))}
          />
        </div>

        {/* Öffentlich / Privat Switch */}
        <div className="flex items-center justify-between bg-[#05060A] border border-gray-800 rounded-xl px-3 py-2">
          <div>
            <p className="text-xs text-gray-200">Profil öffentlich</p>
            <p className="text-[11px] text-gray-500">
              Wenn aktiviert, können andere dein Profil und deine Statistiken sehen.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setProfile((prev) => ({ ...prev, isPublic: !prev.isPublic }))}
            className={`w-12 h-6 rounded-full flex items-center px-1 transition-colors ${
              profile.isPublic ? "bg-blue-600" : "bg-gray-700"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transform transition-transform ${
                profile.isPublic ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Profil-Vorschau */}
        <div className="mt-2 border border-gray-800 rounded-xl p-3 text-xs text-gray-300">
          <p className="font-medium mb-2">Profil Vorschau</p>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-[10px] text-gray-300">
              {initialsOf(profile.username || "TrainQ")}
            </div>

            <div className="min-w-0">
              <p className="text-sm truncate">{profile.username || "Dein Benutzername"}</p>
              <p className="text-[11px] text-gray-500 truncate">
                {bioPreview ? bioPreview : "Deine Bio erscheint hier."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};