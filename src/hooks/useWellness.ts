import { useState, useEffect, useCallback } from "react";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { getActiveUserId } from "../utils/session";
import type { WellnessEntry } from "../types/wellness";

const WELLNESS_KEY = "trainq_wellness_v1";
const MAX_ENTRIES = 90;

export function useWellness() {
  const userId = getActiveUserId();
  const todayISO = new Date().toISOString().slice(0, 10);
  const [todayEntry, setTodayEntry] = useState<WellnessEntry | null>(null);

  const load = useCallback(() => {
    try {
      const raw = getScopedItem(WELLNESS_KEY, userId);
      const list: WellnessEntry[] = raw ? JSON.parse(raw) : [];
      setTodayEntry(list.find((e) => e.date === todayISO) ?? null);
    } catch {
      setTodayEntry(null);
    }
  }, [userId, todayISO]);

  useEffect(() => {
    load();
    window.addEventListener("trainq:wellness_updated", load);
    return () => window.removeEventListener("trainq:wellness_updated", load);
  }, [load]);

  const saveEntry = useCallback(
    (data: Omit<WellnessEntry, "createdAt">) => {
      try {
        const raw = getScopedItem(WELLNESS_KEY, userId);
        const existing: WellnessEntry[] = raw ? JSON.parse(raw) : [];
        const next = [
          { ...data, createdAt: new Date().toISOString() },
          ...existing.filter((e) => e.date !== data.date),
        ].slice(0, MAX_ENTRIES);
        setScopedItem(WELLNESS_KEY, JSON.stringify(next), userId);
        window.dispatchEvent(new Event("trainq:wellness_updated"));
      } catch {
        // ignore
      }
    },
    [userId]
  );

  return { todayEntry, saveEntry };
}
