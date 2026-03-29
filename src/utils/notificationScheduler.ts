import {
  scheduleLocalNotification,
  cancelNotificationRange,
  requestNotificationPermission,
} from "../native/notifications";
import { loadNotificationPrefs } from "./notificationStorage";

// ID Ranges:
// 1000-1999  Training Reminders
// 2000-2999  Streak Motivation
// 3000-3999  PR Notifications
// 4000-4999  Deload Notifications

const REMINDER_ID_START = 1000;
const REMINDER_ID_END = 1999;
const STREAK_ID_START = 2000;
const PR_ID_START = 3000;
const DELOAD_ID_START = 4000;

// Rolling counter within each range to avoid collisions
let streakCounter = 0;
let prCounter = 0;
let deloadCounter = 0;

/**
 * Schedule training reminders for upcoming calendar events.
 * Cancels all existing reminders first, then schedules new ones based on preferences.
 *
 * @param events         Upcoming training events to schedule reminders for.
 * @param notifTitle     Optional translated title (e.g. "Training Soon!"). Falls back to a default.
 * @param notifBodyTpl   Optional translated body template with {{name}} placeholder.
 */
export async function scheduleTrainingReminders(
  events: { date: string; startTime?: string; title: string }[],
  notifTitle?: string,
  notifBodyTpl?: string
): Promise<void> {
  const prefs = loadNotificationPrefs();
  if (!prefs.trainingReminder) return;

  try {
    // Cancel all existing training reminders
    await cancelNotificationRange(REMINDER_ID_START, REMINDER_ID_END);

    const now = new Date();
    let idCounter = REMINDER_ID_START;

    for (const ev of events) {
      if (idCounter > REMINDER_ID_END) break;

      const dateStr = ev.date; // "YYYY-MM-DD"
      const timeStr = ev.startTime; // "HH:mm" or "" or undefined
      if (!dateStr) continue;

      const hasTime = !!(timeStr && timeStr.includes(":"));

      if (hasTime) {
        // ── Timed training: notify X minutes before ──
        if (!prefs.trainingReminder) continue;

        const eventDate = new Date(`${dateStr}T${timeStr}:00`);
        if (isNaN(eventDate.getTime())) continue;

        const reminderDate = new Date(
          eventDate.getTime() - prefs.reminderMinutesBefore * 60 * 1000
        );
        if (reminderDate <= now) continue;

        const title = notifTitle ?? "Training bald!";
        const body = notifBodyTpl
          ? notifBodyTpl.replace("{{name}}", ev.title)
          : `„${ev.title}" startet in ${prefs.reminderMinutesBefore} Minuten.`;

        await scheduleLocalNotification({
          id: idCounter,
          title,
          body,
          scheduledAt: reminderDate,
        });
        idCounter++;
      } else {
        // ── All-day training: notify at 13:00 on the day ──
        if (!prefs.allDayReminder) continue;

        const reminderDate = new Date(`${dateStr}T13:00:00`);
        if (isNaN(reminderDate.getTime())) continue;
        if (reminderDate <= now) continue;

        await scheduleLocalNotification({
          id: idCounter,
          title: "Heute: Training",
          body: `Vergiss nicht: „${ev.title}" steht heute auf dem Plan.`,
          scheduledAt: reminderDate,
        });
        idCounter++;
      }
    }
  } catch {
    // Non-blocking — silently ignore
  }
}

/**
 * Fire a streak motivation notification.
 * Positive when streak is active, nudge when training has been missed.
 */
export async function fireStreakNotification(
  currentStreak: number
): Promise<void> {
  const prefs = loadNotificationPrefs();
  if (!prefs.streakMotivation) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const id = STREAK_ID_START + (streakCounter % 1000);
    streakCounter++;

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 1000); // 1 second from now

    if (currentStreak > 0) {
      await scheduleLocalNotification({
        id,
        title: `${currentStreak}-Tage-Streak!`,
        body: "Weiter so! Deine Konstanz zahlt sich aus.",
        scheduledAt,
      });
    } else {
      await scheduleLocalNotification({
        id,
        title: "Streak unterbrochen",
        body: "Starte heute eine neue Serie und bleib am Ball!",
        scheduledAt,
      });
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Fire a PR (personal record) notification.
 */
export async function firePRNotification(
  exerciseName: string,
  weight: number
): Promise<void> {
  const prefs = loadNotificationPrefs();
  if (!prefs.prNotification) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const id = PR_ID_START + (prCounter % 1000);
    prCounter++;

    await scheduleLocalNotification({
      id,
      title: "Neuer Rekord!",
      body: `${exerciseName}: ${weight}kg — Neue Bestleistung!`,
      scheduledAt: new Date(Date.now() + 1000),
    });
  } catch {
    // Non-blocking
  }
}

/**
 * Fire a deload recommendation notification.
 */
export async function fireDeloadNotification(): Promise<void> {
  const prefs = loadNotificationPrefs();
  if (!prefs.deloadNotification) return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const id = DELOAD_ID_START + (deloadCounter % 1000);
    deloadCounter++;

    await scheduleLocalNotification({
      id,
      title: "Deload empfohlen",
      body: "Dein Körper braucht Erholung. Plane eine leichtere Woche ein.",
      scheduledAt: new Date(Date.now() + 1000),
    });
  } catch {
    // Non-blocking
  }
}
