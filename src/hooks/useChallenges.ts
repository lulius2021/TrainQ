// src/hooks/useChallenges.ts
import { useState, useEffect, useCallback } from "react";
import { ADMIN_CHALLENGES } from "../data/challenges";
import {
  loadChallengesData,
  saveChallengesData,
  joinChallenge as storeJoin,
  markCompleted as storeMarkCompleted,
  claimReward as storeClaimReward,
  onChallengeUpdated,
} from "../utils/challengeStore";
import { computeChallengeProgress } from "../utils/challengeProgress";
import type {
  ChallengeDefinition,
  UserChallengeState,
  ChallengesUserData,
} from "../types/challenge";
import type { ChallengeProgressResult } from "../utils/challengeProgress";

export interface ActiveChallenge {
  definition: ChallengeDefinition;
  state: UserChallengeState;
  progress: ChallengeProgressResult;
}

export interface CompletedChallenge {
  definition: ChallengeDefinition;
  state: UserChallengeState;
}

export function useChallenges() {
  const [data, setData] = useState<ChallengesUserData>(() => loadChallengesData());
  const [tick, setTick] = useState(0);

  // Listen for external updates
  useEffect(() => {
    const unsub = onChallengeUpdated(() => {
      setData(loadChallengesData());
      setTick((n) => n + 1);
    });
    return unsub;
  }, []);

  // Also listen to workout history updates to recompute progress
  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener("trainq:workoutHistoryUpdated", handler);
    return () => window.removeEventListener("trainq:workoutHistoryUpdated", handler);
  }, []);

  // All challenge definitions: admin + user solo
  const allDefinitions: ChallengeDefinition[] = [
    ...ADMIN_CHALLENGES,
    ...data.soloDefinitions,
  ];

  const todayISO = new Date().toISOString().slice(0, 10);

  // Available: not yet joined
  const joinedIds = new Set(data.joined.map((j) => j.challengeId));
  const available = allDefinitions.filter((d) => !joinedIds.has(d.id));

  // Active: joined, not completed, not expired
  const active: ActiveChallenge[] = data.joined
    .filter((j) => !j.completed && j.endDate >= todayISO)
    .map((j) => {
      const def = allDefinitions.find((d) => d.id === j.challengeId);
      if (!def) return null;
      const progress = computeChallengeProgress(def, j);
      return { definition: def, state: j, progress };
    })
    .filter(Boolean) as ActiveChallenge[];

  // Auto-mark completed challenges
  useEffect(() => {
    let changed = false;
    for (const ac of active) {
      if (ac.progress.isComplete && !ac.state.completed) {
        storeMarkCompleted(ac.state.challengeId);
        changed = true;
      }
    }
    if (changed) {
      setData(loadChallengesData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // Completed: joined & completed
  const completed: CompletedChallenge[] = data.joined
    .filter((j) => j.completed)
    .map((j) => {
      const def = allDefinitions.find((d) => d.id === j.challengeId);
      if (!def) return null;
      return { definition: def, state: j };
    })
    .filter(Boolean) as CompletedChallenge[];

  // Expired (not completed but past end date) - treat as completed/failed
  const expired: CompletedChallenge[] = data.joined
    .filter((j) => !j.completed && j.endDate < todayISO)
    .map((j) => {
      const def = allDefinitions.find((d) => d.id === j.challengeId);
      if (!def) return null;
      return { definition: def, state: j };
    })
    .filter(Boolean) as CompletedChallenge[];

  const joinChallengeAction = useCallback((challengeId: string) => {
    const def = allDefinitions.find((d) => d.id === challengeId);
    if (!def) return;
    storeJoin(challengeId, def.durationDays);
    setData(loadChallengesData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDefinitions]);

  const claimRewardAction = useCallback((challengeId: string) => {
    const def = allDefinitions.find((d) => d.id === challengeId);
    if (!def || !def.reward) return;
    storeClaimReward(challengeId, def.reward.days);
    setData(loadChallengesData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDefinitions]);

  const createSolo = useCallback(
    (def: Omit<ChallengeDefinition, "id" | "isAdmin">) => {
      const newDef: ChallengeDefinition = {
        ...def,
        id: `solo_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        isAdmin: false,
      };
      const freshData = loadChallengesData();
      freshData.soloDefinitions.push(newDef);
      saveChallengesData(freshData);
      setData(loadChallengesData());
      return newDef;
    },
    []
  );

  return {
    available,
    active,
    completed: [...completed, ...expired],
    joinChallenge: joinChallengeAction,
    claimReward: claimRewardAction,
    createSolo,
    allDefinitions,
  };
}
