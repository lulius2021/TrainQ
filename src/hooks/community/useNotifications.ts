import { useState, useCallback, useEffect, useRef } from "react";
import { getNotifications, getUnreadNotificationCount, markNotificationRead } from "../../services/community/api";
import type { CommunityNotification } from "../../services/community/types";

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const consecutiveFailures = useRef(0);

  const refreshCount = useCallback(async () => {
    if (!userId) return;
    // Stop polling after 3 consecutive failures
    if (consecutiveFailures.current >= 3) return;
    try {
      const count = await getUnreadNotificationCount(userId);
      setUnreadCount(count);
      consecutiveFailures.current = 0;
    } catch {
      consecutiveFailures.current += 1;
    }
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const result = await getNotifications(userId);
      setNotifications(result);
      consecutiveFailures.current = 0;
      await refreshCount();
    } catch (e) {
      if (import.meta.env.DEV) console.error("Notifications load error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId, refreshCount]);

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Poll unread count every 30s, stop after 3 failures
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 30000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  return { notifications, unreadCount, loading, load, markRead, refreshCount };
}
