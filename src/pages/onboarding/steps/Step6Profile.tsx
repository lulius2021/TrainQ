// src/pages/onboarding/steps/Step6Profile.tsx
import React, { useState } from "react";
import { StepWrapper } from "../../../components/onboarding/StepWrapper.tsx";
import { useOnboarding } from "../../../context/OnboardingContext.tsx";

interface Step6ProfileProps {
  onBack: () => void;
  onFinish: () => void;
}

export const Step6Profile: React.FC<Step6ProfileProps> = ({
  onBack,
  onFinish,
}) => {
  const { data, updateData } = useOnboarding();
  const [profile, setProfile] = useState(data.profile);

  const handleFinish = () => {
    updateData({
      profile,
      isCompleted: true,
    });

    // Onboarding-Status merken
    localStorage.setItem("arvio_onboarding_completed", "true");

    onFinish();
  };

  return (
    <StepWrapper
      title="Profil vervollständigen"
      subtitle="Gestalte dein ARVIO-Profil. Du kannst alles später jederzeit anpassen."
      onNext={handleFinish}
      onBack={onBack}
      nextLabel="Onboarding abschließen"
      isNextDisabled={!profile.username.trim()}
    >
      <div className="space-y-4 text-sm">
        {/* Profil-Header */}
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-500">
            {profile.profileImageUrl ? "Bild" : "Profilbild"}
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-400">Benutzername</label>
            <input
              type="text"
              className="w-full bg-[#05060A] border border-gray-700 rounded-lg px-3 py-2 text-sm"
              placeholder="@deinname"
              value={profile.username}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, username: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Profilbild-URL */}
        <div>
          <label className="text-xs text-gray-400">
            Profilbild (URL, optional)
          </label>
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
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, stravaUrl: e.target.value }))
            }
          />
        </div>

        {/* Öffentlich / Privat Switch */}
        <div className="flex items-center justify-between bg-[#05060A] border border-gray-800 rounded-xl px-3 py-2">
          <div>
            <p className="text-xs text-gray-200">Profil öffentlich</p>
            <p className="text-[11px] text-gray-500">
              Wenn aktiviert, können andere dein Profil und deine Statistiken
              sehen.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setProfile((prev) => ({ ...prev, isPublic: !prev.isPublic }))
            }
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
            <div className="w-8 h-8 rounded-full bg-gray-800" />
            <div>
              <p className="text-sm">
                {profile.username || "Dein Benutzername"}
              </p>
              <p className="text-[11px] text-gray-500">
                Trainingsstatistik wird hier später angezeigt
              </p>
            </div>
          </div>
        </div>
      </div>
    </StepWrapper>
  );
};
