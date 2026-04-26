// src/components/onboarding/PermissionsStep.tsx
// Unified permissions request step for Onboarding
// Requests camera, location, and notification permissions

import React, { useState } from "react";
import { Camera, MapPin, Bell } from "lucide-react";
import { AppButton } from "../ui/AppButton";
import { requestLocationPermission } from "../../native/geolocation";
import { requestNotificationPermission } from "../../native/notifications";
import { useI18n } from "../../i18n/useI18n";

type PermissionStatus = "idle" | "granted" | "denied";

interface PermissionItem {
  key: "camera" | "location" | "notifications";
  icon: React.ReactNode;
  title: string;
  description: string;
}

function usePermissionItems(): PermissionItem[] {
  const { t } = useI18n();
  return [
    {
      key: "camera",
      icon: <Camera size={24} />,
      title: t("onboarding.permissions.camera"),
      description: t("onboarding.permissions.cameraDesc"),
    },
    {
      key: "location",
      icon: <MapPin size={24} />,
      title: t("onboarding.permissions.location"),
      description: t("onboarding.permissions.locationDesc"),
    },
    {
      key: "notifications",
      icon: <Bell size={24} />,
      title: t("onboarding.permissions.notifications"),
      description: t("onboarding.permissions.notificationsDesc"),
    },
  ];
}

async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Stop all tracks immediately — we only needed the permission prompt
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

const PermissionsStep: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useI18n();
  const PERMISSIONS = usePermissionItems();
  const [statuses, setStatuses] = useState<Record<string, PermissionStatus>>({
    camera: "idle",
    location: "idle",
    notifications: "idle",
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const setStatus = (key: string, status: PermissionStatus) => {
    setStatuses((prev) => ({ ...prev, [key]: status }));
  };

  const setItemLoading = (key: string, val: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: val }));
  };

  const handleRequest = async (key: "camera" | "location" | "notifications") => {
    if (statuses[key] === "granted") return;
    setItemLoading(key, true);
    try {
      let granted = false;
      if (key === "camera") {
        granted = await requestCameraPermission();
      } else if (key === "location") {
        granted = await requestLocationPermission();
      } else if (key === "notifications") {
        granted = await requestNotificationPermission();
      }
      setStatus(key, granted ? "granted" : "denied");
    } catch {
      setStatus(key, "denied");
    } finally {
      setItemLoading(key, false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-6">
      <h2
        className="text-2xl font-bold tracking-tight mb-2"
        style={{ color: "var(--text-color)" }}
      >
        {t("onboarding.permissions.title")}
      </h2>
      <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
        {t("onboarding.permissions.subtitle")}
      </p>

      <div className="flex flex-col gap-4 mb-auto">
        {PERMISSIONS.map((item) => {
          const status = statuses[item.key];
          const isGranted = status === "granted";
          const isLoading = !!loading[item.key];

          return (
            <div
              key={item.key}
              className="flex items-center gap-4 rounded-3xl p-5 border transition-all"
              style={{
                backgroundColor: isGranted
                  ? "rgba(16,185,129,0.08)"
                  : "var(--card-bg)",
                borderColor: isGranted
                  ? "rgba(16,185,129,0.4)"
                  : "var(--border-color)",
              }}
            >
              <span className="text-[var(--text-secondary)] shrink-0">{item.icon}</span>

              <div className="flex-1 min-w-0">
                <div
                  className="text-base font-bold"
                  style={{ color: "var(--text-color)" }}
                >
                  {item.title}
                </div>
                <div
                  className="text-sm mt-0.5 leading-snug"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {item.description}
                </div>
              </div>

              <div className="shrink-0">
                {isGranted ? (
                  <span className="text-sm font-bold text-emerald-500 whitespace-nowrap">
                    {t("onboarding.permissions.granted")}
                  </span>
                ) : (
                  <button
                    onClick={() => handleRequest(item.key)}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                    style={{
                      backgroundColor: "var(--accent-color)",
                      color: "#fff",
                    }}
                  >
                    {isLoading ? "..." : t("onboarding.permissions.allow")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <AppButton
          onClick={onNext}
          fullWidth
          size="lg"
          className="!rounded-2xl !text-lg !font-black shadow-lg"
        >
          {t("common.next")}
        </AppButton>
      </div>
    </div>
  );
};

export default PermissionsStep;
