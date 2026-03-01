export interface NotificationPreferences {
  trainingReminder: boolean; // default: true
  reminderMinutesBefore: number; // default: 30 (options: 15, 30, 60)
  streakMotivation: boolean; // default: false
  prNotification: boolean; // default: false
  deloadNotification: boolean; // default: false
}

const STORAGE_KEY = "trainq_notification_prefs_v1";

const DEFAULT_PREFS: NotificationPreferences = {
  trainingReminder: true,
  reminderMinutesBefore: 30,
  streakMotivation: false,
  prNotification: false,
  deloadNotification: false,
};

export function loadNotificationPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      trainingReminder:
        typeof parsed.trainingReminder === "boolean"
          ? parsed.trainingReminder
          : DEFAULT_PREFS.trainingReminder,
      reminderMinutesBefore:
        typeof parsed.reminderMinutesBefore === "number"
          ? parsed.reminderMinutesBefore
          : DEFAULT_PREFS.reminderMinutesBefore,
      streakMotivation:
        typeof parsed.streakMotivation === "boolean"
          ? parsed.streakMotivation
          : DEFAULT_PREFS.streakMotivation,
      prNotification:
        typeof parsed.prNotification === "boolean"
          ? parsed.prNotification
          : DEFAULT_PREFS.prNotification,
      deloadNotification:
        typeof parsed.deloadNotification === "boolean"
          ? parsed.deloadNotification
          : DEFAULT_PREFS.deloadNotification,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function saveNotificationPrefs(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}
