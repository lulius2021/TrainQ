// src/utils/challengeStore.ts
import { getScopedItem, setScopedItem } from "./scopedStorage";
import { getActiveUserId } from "./session";
import type {
  ChallengesUserData,
  UserChallengeState,
  ProGrant,
} from "../types/challenge";

const STORAGE_KEY = "trainq_challenges_user_state_v1";
const UPDATED_EVENT = "trainq:challengeUpdated";

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(UPDATED_EVENT));
  } catch {
    // ignore
  }
}

function defaultData(): ChallengesUserData {
  return { joined: [], soloDefinitions: [], proGrants: [] };
}

export function loadChallengesData(): ChallengesUserData {
  if (typeof window === "undefined") return defaultData();
  const userId = getActiveUserId();
  const raw = getScopedItem(STORAGE_KEY, userId);
  if (!raw) return defaultData();
  try {
    const parsed = JSON.parse(raw);
    return {
      joined: Array.isArray(parsed.joined) ? parsed.joined : [],
      soloDefinitions: Array.isArray(parsed.soloDefinitions) ? parsed.soloDefinitions : [],
      proGrants: Array.isArray(parsed.proGrants) ? parsed.proGrants : [],
    };
  } catch {
    return defaultData();
  }
}

export function saveChallengesData(data: ChallengesUserData): void {
  if (typeof window === "undefined") return;
  const userId = getActiveUserId();
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(data), userId);
    emitUpdated();
  } catch {
    // ignore
  }
}

export function joinChallenge(challengeId: string, durationDays: number): void {
  const data = loadChallengesData();
  // Don't join if already joined
  if (data.joined.some((j) => j.challengeId === challengeId)) return;

  const now = new Date();
  const startDate = now.toISOString().slice(0, 10);
  const endDate = new Date(now.getTime() + durationDays * 86400000).toISOString().slice(0, 10);

  const state: UserChallengeState = {
    challengeId,
    joinedAt: now.toISOString(),
    startDate,
    endDate,
    completed: false,
    rewardClaimed: false,
  };

  data.joined.push(state);
  saveChallengesData(data);
}

export function markCompleted(challengeId: string): void {
  const data = loadChallengesData();
  const entry = data.joined.find((j) => j.challengeId === challengeId);
  if (!entry || entry.completed) return;

  entry.completed = true;
  entry.completedAt = new Date().toISOString();
  saveChallengesData(data);
}

export function claimReward(challengeId: string, rewardDays: number): void {
  const data = loadChallengesData();
  const entry = data.joined.find((j) => j.challengeId === challengeId);
  if (!entry || !entry.completed || entry.rewardClaimed) return;

  entry.rewardClaimed = true;

  const now = new Date();
  const grant: ProGrant = {
    grantedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + rewardDays * 86400000).toISOString(),
    source: challengeId,
  };
  data.proGrants.push(grant);

  saveChallengesData(data);
}

export function getActiveProGrants(): ProGrant[] {
  const data = loadChallengesData();
  const now = new Date().toISOString();
  return data.proGrants.filter((g) => g.expiresAt > now);
}

export function hasActiveChallengeGrant(): boolean {
  return getActiveProGrants().length > 0;
}

export function onChallengeUpdated(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UPDATED_EVENT, cb as EventListener);
  return () => window.removeEventListener(UPDATED_EVENT, cb as EventListener);
}
