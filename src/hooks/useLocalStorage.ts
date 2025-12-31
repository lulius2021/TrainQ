// src/hooks/useLocalStorage.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveUserId } from "../utils/session";

// Keys standardmäßig PRO USER scopen, damit Accounts getrennt sind.
// "global" nur für Dinge, die wirklich für alle gelten sollen (selten).
export type StorageScope = "user" | "global";

function scopedKey(key: string, scope: StorageScope) {
  const base = String(key || "").trim();
  if (!base) return base;

  if (scope === "global") return base;

  const uid = (getActiveUserId() || "anon").trim();
  return `${base}__uid_${uid}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T, scope: StorageScope = "user") {
  const storageKey = useMemo(() => scopedKey(key, scope), [key, scope]);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    return safeParse<T>(window.localStorage.getItem(storageKey), initialValue);
  });

  // Wenn userId wechselt (session), ändert sich storageKey -> neu laden
  useEffect(() => {
    if (typeof window === "undefined") return;
    setValue(safeParse<T>(window.localStorage.getItem(storageKey), initialValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const write = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {
          // ignore
        }
        return resolved;
      });
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setValue(initialValue);
  }, [storageKey, initialValue]);

  return [value, write, clear] as const;
}