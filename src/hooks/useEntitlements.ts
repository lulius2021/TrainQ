// src/hooks/useEntitlements.ts
import { useEffect, useMemo, useState } from "react";
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

export function useEntitlements(userId?: string) {
  const [state, setState] = useState<EntitlementsState>(() => loadEntitlements(userId));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refresh = () => setState(loadEntitlements(userId));

    window.addEventListener(ENTITLEMENTS_CHANGED_EVENT, refresh as any);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(ENTITLEMENTS_CHANGED_EVENT, refresh as any);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  const isPro = state.isPro;

  // Adaptive remaining
  const adaptiveBCRemaining = useMemo(() => {
    if (isPro) return Infinity as unknown as number;
    const used = typeof state.adaptiveBCUsedThisMonth === "number" ? state.adaptiveBCUsedThisMonth : 0;
    return Math.max(0, FREE_LIMITS.adaptiveBCPerMonth - used);
  }, [isPro, state.adaptiveBCUsedThisMonth]);

  const canUseAdaptive = (profile: AdaptiveSuggestion["profile"]) => canUseAdaptiveProfile(state, profile);

  const consumeAdaptive = (profile: AdaptiveSuggestion["profile"]) => {
    const next = consumeAdaptiveProfile(state, profile, userId);
    saveEntitlements(next, userId);
    setState(next);
    return next;
  };

  // Plan shift remaining
  const planShiftRemaining = useMemo(() => {
    if (isPro) return Infinity as unknown as number;
    const used = typeof state.planShiftUsedThisMonth === "number" ? state.planShiftUsedThisMonth : 0;
    return Math.max(0, FREE_LIMITS.planShiftPerMonth - used);
  }, [isPro, state.planShiftUsedThisMonth]);

  const canUseShift = () => canUsePlanShift(state);

  const consumeShift = () => {
    const next = consumePlanShift(state, userId);
    saveEntitlements(next, userId);
    setState(next);
    return next;
  };

  // Calendar >7 days remaining
  const calendar7DaysRemaining = useMemo(() => {
    if (isPro) return Infinity as unknown as number;
    const used = typeof state.calendar7DaysUsedThisMonth === "number" ? state.calendar7DaysUsedThisMonth : 0;
    return Math.max(0, FREE_LIMITS.calendar7DaysPerMonth - used);
  }, [isPro, state.calendar7DaysUsedThisMonth]);

  const canUseCalendar7 = () => canUseCalendar7Days(state);

  const consumeCalendar7 = () => {
    const next = consumeCalendar7Days(state, userId);
    saveEntitlements(next, userId);
    setState(next);
    return next;
  };

  // Mutation
  const setPro = (nextPro: boolean) => {
    const next = { ...state, isPro: nextPro };
    saveEntitlements(next, userId);
    setState(next);
  };

  return {
    isPro,
    setPro,

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