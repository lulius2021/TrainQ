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
  loadServerCache,
  saveServerCache,
} from "../utils/challengeStore";
import { computeChallengeProgress } from "../utils/challengeProgress";
import {
  fetchMonthlyChallenges,
  fetchMyParticipations,
  fetchMyActiveProGrants,
  joinServerChallenge as apiJoinServer,
  claimServerReward as apiClaimServer,
} from "../services/challengeService";
import { getSupabaseClient } from "../lib/supabaseClient";
import type {
  ChallengeDefinition,
  UserChallengeState,
  ChallengesUserData,
  ServerChallenge,
  ServerParticipation,
  ServerProGrant,
} from "../types/challenge";
import type { ChallengeProgressResult } from "../utils/challengeProgress";

export interface ActiveChallenge {
  definition: ChallengeDefinition;
  state: UserChallengeState;
  progress: ChallengeProgressResult;
  isServer?: boolean;
}

export interface CompletedChallenge {
  definition: ChallengeDefinition;
  state: UserChallengeState;
  isServer?: boolean;
  rewardExpiresAt?: string;
}

function serverChallengeToDefinition(sc: ServerChallenge): ChallengeDefinition {
  return {
    id: sc.id,
    title: sc.title,
    description: sc.description,
    goal: sc.goal,
    durationDays: sc.durationDays,
    emoji: sc.emoji,
    reward: sc.reward,
    isAdmin: true,
  };
}

function serverParticipationToState(sp: ServerParticipation): UserChallengeState {
  return {
    challengeId: sp.challengeId,
    joinedAt: sp.startDate,
    startDate: sp.startDate,
    endDate: sp.endDate,
    completed: sp.completed,
    completedAt: sp.completedAt,
    rewardClaimed: sp.rewardClaimed,
  };
}

export function useChallenges() {
  const [data, setData] = useState<ChallengesUserData>(() => loadChallengesData());
  const [tick, setTick] = useState(0);

  // Server state
  const [serverChallenges, setServerChallenges] = useState<ServerChallenge[]>([]);
  const [serverParticipations, setServerParticipations] = useState<ServerParticipation[]>([]);
  const [serverGrants, setServerGrants] = useState<ServerProGrant[]>([]);
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);

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

  // Fetch server challenges on mount
  useEffect(() => {
    if (!getSupabaseClient()) return;

    // Try cache first
    const cached = loadServerCache();
    if (cached) {
      setServerChallenges(cached.challenges);
      setServerParticipations(cached.participations);
      setServerGrants(cached.proGrants);
      setIsServerConnected(true);
    }

    // Then fetch fresh
    setServerLoading(true);
    Promise.all([
      fetchMonthlyChallenges(),
      fetchMyParticipations(),
      fetchMyActiveProGrants(),
    ])
      .then(([challenges, participations, grants]) => {
        setServerChallenges(challenges);
        setServerParticipations(participations);
        setServerGrants(grants);
        setIsServerConnected(true);
        saveServerCache({ challenges, participations, proGrants: grants });
      })
      .catch(() => {
        setIsServerConnected(false);
      })
      .finally(() => setServerLoading(false));
  }, []);

  // Build server definitions
  const serverDefinitions: ChallengeDefinition[] = serverChallenges.map(serverChallengeToDefinition);

  // Build server join states
  const serverJoinedStates: UserChallengeState[] = serverParticipations.map(serverParticipationToState);

  // All challenge definitions: admin + user solo + server
  const localDefinitions = [...ADMIN_CHALLENGES, ...data.soloDefinitions];
  const allDefinitions: ChallengeDefinition[] = [
    ...serverDefinitions,
    ...localDefinitions,
  ];

  const todayISO = new Date().toISOString().slice(0, 10);

  // Merged joined states: local + server (dedup by challengeId)
  const mergedJoined: UserChallengeState[] = [...data.joined];
  const localJoinedIds = new Set(data.joined.map((j) => j.challengeId));
  for (const sj of serverJoinedStates) {
    if (!localJoinedIds.has(sj.challengeId)) {
      mergedJoined.push(sj);
    }
  }

  // Track which IDs are server challenges
  const serverChallengeIds = new Set(serverChallenges.map((sc) => sc.id));
  const serverParticipationMap = new Map(serverParticipations.map((sp) => [sp.challengeId, sp]));

  // Available: not yet joined
  const joinedIds = new Set(mergedJoined.map((j) => j.challengeId));
  const available = allDefinitions.filter((d) => !joinedIds.has(d.id));

  // Active: joined, not completed, not expired
  const active: ActiveChallenge[] = mergedJoined
    .filter((j) => !j.completed && j.endDate >= todayISO)
    .map((j) => {
      const def = allDefinitions.find((d) => d.id === j.challengeId);
      if (!def) return null;
      const progress = computeChallengeProgress(def, j);
      return {
        definition: def,
        state: j,
        progress,
        isServer: serverChallengeIds.has(j.challengeId),
      };
    })
    .filter(Boolean) as ActiveChallenge[];

  // Auto-mark completed challenges (local only)
  useEffect(() => {
    let changed = false;
    for (const ac of active) {
      if (ac.progress.isComplete && !ac.state.completed && !ac.isServer) {
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
  const completed: CompletedChallenge[] = mergedJoined
    .filter((j) => j.completed)
    .map((j) => {
      const def = allDefinitions.find((d) => d.id === j.challengeId);
      if (!def) return null;
      const sp = serverParticipationMap.get(j.challengeId);
      return {
        definition: def,
        state: j,
        isServer: serverChallengeIds.has(j.challengeId),
        rewardExpiresAt: sp?.rewardExpiresAt,
      };
    })
    .filter(Boolean) as CompletedChallenge[];

  // Expired (not completed but past end date)
  const expired: CompletedChallenge[] = mergedJoined
    .filter((j) => !j.completed && j.endDate < todayISO)
    .map((j) => {
      const def = allDefinitions.find((d) => d.id === j.challengeId);
      if (!def) return null;
      return {
        definition: def,
        state: j,
        isServer: serverChallengeIds.has(j.challengeId),
      };
    })
    .filter(Boolean) as CompletedChallenge[];

  // Unclaimed server rewards
  const unclaimedRewards = serverParticipations.filter(
    (sp) => sp.completed && sp.rewardEligible && !sp.rewardClaimed
  );

  const joinChallengeAction = useCallback(async (challengeId: string) => {
    // Server challenge?
    if (serverChallengeIds.has(challengeId)) {
      const result = await apiJoinServer(challengeId);
      if (result.ok) {
        // Refetch
        const [challenges, participations, grants] = await Promise.all([
          fetchMonthlyChallenges(),
          fetchMyParticipations(),
          fetchMyActiveProGrants(),
        ]);
        setServerChallenges(challenges);
        setServerParticipations(participations);
        setServerGrants(grants);
        saveServerCache({ challenges, participations, proGrants: grants });
      }
      return result;
    }

    // Local challenge
    const def = allDefinitions.find((d) => d.id === challengeId);
    if (!def) return { ok: false, error: "not_found" };
    storeJoin(challengeId, def.durationDays);
    setData(loadChallengesData());
    return { ok: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDefinitions, serverChallengeIds]);

  const claimRewardAction = useCallback(async (challengeId: string) => {
    // Server challenge?
    const sp = serverParticipationMap.get(challengeId);
    if (sp && serverChallengeIds.has(challengeId)) {
      const result = await apiClaimServer(sp.id);
      if (result.ok) {
        const [challenges, participations, grants] = await Promise.all([
          fetchMonthlyChallenges(),
          fetchMyParticipations(),
          fetchMyActiveProGrants(),
        ]);
        setServerChallenges(challenges);
        setServerParticipations(participations);
        setServerGrants(grants);
        saveServerCache({ challenges, participations, proGrants: grants });
        // Also emit event so AuthContext can update isPro
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("trainq:challengeUpdated"));
        }
      }
      return result;
    }

    // Local
    const def = allDefinitions.find((d) => d.id === challengeId);
    if (!def || !def.reward) return { ok: false, error: "not_found" };
    storeClaimReward(challengeId, def.reward.days);
    setData(loadChallengesData());
    return { ok: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDefinitions, serverChallengeIds, serverParticipationMap]);

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

  // Determine if user can join a reward challenge
  const canJoinRewardChallenge = !active.some(
    (ac) => ac.isServer && ac.definition.reward
  );

  return {
    available,
    active,
    completed: [...completed, ...expired],
    joinChallenge: joinChallengeAction,
    claimReward: claimRewardAction,
    createSolo,
    allDefinitions,
    serverChallenges,
    serverParticipations,
    serverGrants,
    unclaimedRewards,
    canJoinRewardChallenge,
    isServerConnected,
    serverLoading,
  };
}
