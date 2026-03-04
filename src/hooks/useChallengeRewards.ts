// src/hooks/useChallengeRewards.ts
import { useState, useEffect, useCallback } from "react";
import {
  fetchMyUnclaimedRewards,
  fetchMyActiveProGrants,
  claimServerReward,
} from "../services/challengeService";
import { hasActiveChallengeGrant } from "../utils/challengeStore";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { ServerParticipation, ServerProGrant } from "../types/challenge";

export function useChallengeRewards() {
  const [unclaimedRewards, setUnclaimedRewards] = useState<ServerParticipation[]>([]);
  const [activeGrants, setActiveGrants] = useState<ServerProGrant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(false);

  const refresh = useCallback(async () => {
    if (!getSupabaseClient()) return;
    setIsLoading(true);
    try {
      const [unclaimed, grants] = await Promise.all([
        fetchMyUnclaimedRewards(),
        fetchMyActiveProGrants(),
      ]);
      setUnclaimedRewards(unclaimed);
      setActiveGrants(grants);
      setIsServerConnected(true);
    } catch {
      setIsServerConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen for challenge updates
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("trainq:challengeUpdated", handler);
    return () => window.removeEventListener("trainq:challengeUpdated", handler);
  }, [refresh]);

  const claimReward = useCallback(async (participationId: string) => {
    setIsLoading(true);
    try {
      const result = await claimServerReward(participationId);
      if (result.ok) {
        await refresh();
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  const hasActiveGrant = activeGrants.length > 0 || hasActiveChallengeGrant();
  const unclaimedCount = unclaimedRewards.length;

  return {
    unclaimedRewards,
    unclaimedCount,
    activeGrants,
    hasActiveGrant,
    claimReward,
    isLoading,
    isServerConnected,
    refresh,
  };
}
