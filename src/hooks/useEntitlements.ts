// src/hooks/useEntitlements.ts
// Monetization removed — all users have full access

import { useCallback } from "react";
import type { AdaptiveSuggestion } from "../types/adaptive";

export function useEntitlements(_userId?: string, _isProFromAccount?: boolean) {
  const isPro = true;
  const unlimited = Number.MAX_SAFE_INTEGER;

  const canUseAdaptive = useCallback((_profile: AdaptiveSuggestion["profile"]) => ({ allowed: true }), []);
  const consumeAdaptive = useCallback((_profile: AdaptiveSuggestion["profile"]) => ({}), []);
  const canUseShift = useCallback(() => ({ allowed: true }), []);
  const consumeShift = useCallback(() => ({}), []);
  const canUseCalendar7 = useCallback(() => ({ allowed: true }), []);
  const consumeCalendar7 = useCallback(() => ({}), []);
  const canUseSuggestion = useCallback(() => ({ allowed: true }), []);
  const consumeSuggestion = useCallback(() => ({}), []);
  const canViewStatsRange = useCallback((_range: string) => ({ allowed: true }), []);
  const canCreatePlan = useCallback((_count: number) => ({ allowed: true }), []);
  const canCreateTemplate = useCallback((_count: number) => ({ allowed: true }), []);

  return {
    isPro,

    adaptiveBCRemaining: unlimited,
    planShiftRemaining: unlimited,
    calendar7DaysRemaining: unlimited,
    suggestionsRemaining: unlimited,

    canUseAdaptive,
    consumeAdaptive,
    canUseShift,
    consumeShift,
    canUseCalendar7,
    consumeCalendar7,
    canUseSuggestion,
    consumeSuggestion,
    canViewStatsRange,
    canCreatePlan,
    canCreateTemplate,
  };
}
