// src/hooks/useEntitlements.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdaptiveSuggestion } from "../types/adaptive";
import {
  ENTITLEMENTS_CHANGED_EVENT,
  FREE_LIMITS,
  loadEntitlements,
  saveEntitlements,
  canUseAdaptiveProfile,
  consumeAdaptiveProfile,
  canUsePlanShift,
  consumePlanShift,
  canUseCalendar7Days,
  consumeCalendar7Days,
  type EntitlementsState,
} from "../utils/entitlements";
import { onSessionChanged } from "../utils/session";

export function useEntitlements(userId?: string, isProFromAccount?: boolean) {
  const [state, setState] = useState<EntitlementsState>(() => loadEntitlements(userId));

  // Refresh wenn userId oder Account-Pro-Status wechselt
  useEffect(() => {
    const loaded = loadEntitlements(userId);

    // ✅ Pro kommt aus dem Account (Auth Source of Truth)
    if (typeof isProFromAccount === "boolean" && loaded.isPro !== isProFromAccount) {
      const synced: EntitlementsState = { ...loaded, isPro: isProFromAccount };
      saveEntitlements(synced, userId);
      setState(synced);
      return;
    }

    setState(loaded);
  }, [userId, isProFromAccount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => {
      const loaded = loadEntitlements(userId);
      if (typeof isProFromAccount === "boolean" && loaded.isPro !== isProFromAccount) {
        const synced: EntitlementsState = { ...loaded, isPro: isProFromAccount };
        saveEntitlements(synced, userId);
        setState(synced);
        return;
      }
      setState(loaded);
    };

    window.addEventListener(ENTITLEMENTS_CHANGED_EVENT, refresh as any);
    window.addEventListener("storage", refresh);
    const offSession = onSessionChanged(refresh);

    return () => {
      window.removeEventListener(ENTITLEMENTS_CHANGED_EVENT, refresh as any);
      window.removeEventListener("storage", refresh);
      offSession();
    };
  }, [userId, isProFromAccount]);

  const isPro = state.isPro;

  // ---------- Remaining (Free) ----------

  const adaptiveBCRemaining = useMemo(() => {
    if (isPro) return Number.MAX_SAFE_INTEGER;
    const used = typeof state.adaptiveBCUsedThisMonth === "number" ? state.adaptiveBCUsedThisMonth : 0;
    return Math.max(0, FREE_LIMITS.adaptiveBCPerMonth - used);
  }, [isPro, state.adaptiveBCUsedThisMonth]);

  const planShiftRemaining = useMemo(() => {
    if (isPro) return Number.MAX_SAFE_INTEGER;
    const used = typeof state.planShiftUsedThisMonth === "number" ? state.planShiftUsedThisMonth : 0;
    return Math.max(0, FREE_LIMITS.planShiftPerMonth - used);
  }, [isPro, state.planShiftUsedThisMonth]);

  const calendar7DaysRemaining = useMemo(() => {
    if (isPro) return Number.MAX_SAFE_INTEGER;
    const used = typeof state.calendar7DaysUsedThisMonth === "number" ? state.calendar7DaysUsedThisMonth : 0;
    return Math.max(0, FREE_LIMITS.calendar7DaysPerMonth - used);
  }, [isPro, state.calendar7DaysUsedThisMonth]);

  // ---------- Checks ----------

  const canUseAdaptive = useCallback(
    (profile: AdaptiveSuggestion["profile"]) => canUseAdaptiveProfile(state, profile),
    [state]
  );

  const canUseShift = useCallback(() => canUsePlanShift(state), [state]);

  const canUseCalendar7 = useCallback(() => canUseCalendar7Days(state), [state]);

  // ---------- Consume ----------

  const consumeAdaptive = useCallback(
    (profile: AdaptiveSuggestion["profile"]) => {
      const next = consumeAdaptiveProfile(state, profile);
      saveEntitlements(next, userId);
      setState(next);
      return next;
    },
    [state, userId]
  );

  const consumeShift = useCallback(() => {
    const next = consumePlanShift(state);
    saveEntitlements(next, userId);
    setState(next);
    return next;
  }, [state, userId]);

  const consumeCalendar7 = useCallback(() => {
    const next = consumeCalendar7Days(state);
    saveEntitlements(next, userId);
    setState(next);
    return next;
  }, [state, userId]);

  return {
    isPro,

    adaptiveBCRemaining,
    planShiftRemaining,
    calendar7DaysRemaining,

    canUseAdaptive,
    consumeAdaptive,

    canUseShift,
    consumeShift,

    canUseCalendar7,
    consumeCalendar7,
  };
}
