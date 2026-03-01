import { LocalNotifications } from "@capacitor/local-notifications";

export async function requestNotificationPermission(): Promise<boolean> {
  const result = await LocalNotifications.requestPermissions();
  return result.display === "granted";
}

export async function scheduleLocalNotification(opts: {
  id: number;
  title: string;
  body: string;
  scheduledAt: Date;
}): Promise<void> {
  await LocalNotifications.schedule({
    notifications: [
      {
        id: opts.id,
        title: opts.title,
        body: opts.body,
        schedule: { at: opts.scheduledAt },
      },
    ],
  });
}

export async function cancelNotifications(ids: number[]): Promise<void> {
  await LocalNotifications.cancel({
    notifications: ids.map((id) => ({ id })),
  });
}

export async function cancelNotificationRange(
  startId: number,
  endId: number
): Promise<void> {
  const ids: number[] = [];
  for (let i = startId; i <= endId; i++) ids.push(i);
  if (ids.length > 0) await cancelNotifications(ids);
}
