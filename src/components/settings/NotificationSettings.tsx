import React, { useState, useEffect, useCallback } from "react";
import { Bell, Clock, Flame, Trophy, Battery } from "lucide-react";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPreferences,
} from "../../utils/notificationStorage";
import { requestNotificationPermission } from "../../native/notifications";

// --- Toggle Switch (same pattern as SettingPage.tsx) ---
const ToggleSwitch = ({
  checked,
  onChange,
  label,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ElementType;
}) => (
  <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
    <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
      {Icon && <Icon size={20} className="text-zinc-400 shrink-0" />}
      <div className="min-w-0">
        <span className="text-base font-medium text-[var(--text-color)] block">
          {label}
        </span>
        {description && (
          <span className="text-xs text-[var(--text-secondary)] block mt-0.5">
            {description}
          </span>
        )}
      </div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full relative transition-colors duration-200 shrink-0 ${
        checked ? "bg-green-500" : "bg-zinc-700"
      }`}
    >
      <div
        className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

// --- Time Selector ---
const TimeSelector = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) => {
  const options = [
    { label: "15 Min", value: 15 },
    { label: "30 Min", value: 30 },
    { label: "60 Min", value: 60 },
  ];

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl">
      <div className="flex items-center gap-3">
        <Clock size={20} className="text-zinc-400" />
        <span className="text-base font-medium text-[var(--text-color)]">
          Vorlaufzeit
        </span>
      </div>
      <div className="flex bg-[var(--button-bg)] p-0.5 rounded-lg">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
              value === opt.value
                ? "bg-blue-500 text-white shadow-sm"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- Main Component ---
const NotificationSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() =>
    loadNotificationPrefs()
  );
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null
  );

  // Persist on every change
  useEffect(() => {
    saveNotificationPrefs(prefs);
  }, [prefs]);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (permissionGranted === true) return true;
    try {
      const granted = await requestNotificationPermission();
      setPermissionGranted(granted);
      return granted;
    } catch {
      return false;
    }
  }, [permissionGranted]);

  const handleToggle = useCallback(
    async (
      key: keyof NotificationPreferences,
      newValue: boolean
    ): Promise<void> => {
      if (newValue) {
        const granted = await ensurePermission();
        if (!granted) return; // Don't enable if permission denied
      }
      setPrefs((prev) => ({ ...prev, [key]: newValue }));
    },
    [ensurePermission]
  );

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300 text-sm">
        Erhalte Benachrichtigungen zu deinem Training, Streaks und neuen
        Bestleistungen.
      </div>

      {/* Training Reminders */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
          Erinnerungen
        </h3>
        <ToggleSwitch
          label="Training-Erinnerungen"
          description="Werde vor deinen geplanten Trainings erinnert"
          checked={prefs.trainingReminder}
          onChange={(v) => handleToggle("trainingReminder", v)}
          icon={Bell}
        />
        {prefs.trainingReminder && (
          <TimeSelector
            value={prefs.reminderMinutesBefore}
            onChange={(v) =>
              setPrefs((prev) => ({ ...prev, reminderMinutesBefore: v }))
            }
          />
        )}
      </div>

      {/* Motivation */}
      <div className="space-y-2 pt-2">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
          Motivation
        </h3>
        <ToggleSwitch
          label="Streak-Motivation"
          description="Benachrichtigungen bei aktiven Trainingsserien"
          checked={prefs.streakMotivation}
          onChange={(v) => handleToggle("streakMotivation", v)}
          icon={Flame}
        />
        <ToggleSwitch
          label="PR-Benachrichtigungen"
          description="Erfahre sofort, wenn du einen neuen Rekord aufstellst"
          checked={prefs.prNotification}
          onChange={(v) => handleToggle("prNotification", v)}
          icon={Trophy}
        />
      </div>

      {/* Recovery */}
      <div className="space-y-2 pt-2">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider ml-1">
          Erholung
        </h3>
        <ToggleSwitch
          label="Deload-Hinweise"
          description="Hinweis, wenn eine Erholungswoche empfohlen wird"
          checked={prefs.deloadNotification}
          onChange={(v) => handleToggle("deloadNotification", v)}
          icon={Battery}
        />
      </div>
    </div>
  );
};

export default NotificationSettings;
