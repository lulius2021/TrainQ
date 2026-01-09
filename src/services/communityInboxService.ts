// src/services/communityInboxService.ts
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { loadWorkoutHistory, type WorkoutHistoryEntry } from "../utils/workoutHistory";

export type InboxThread = {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
};

export type InboxMessage = {
  id: string;
  threadId: string;
  authorId: string;
  text: string;
  createdAt: string;
};

export type InboxGroup = {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
};

export type GroupChallenge = {
  id: string;
  groupId: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: string;
};

export type ChallengeParticipant = {
  id: string;
  challengeId: string;
  userId: string;
  workoutsCount: number;
};

const KEY_THREADS = "trainq.community.inbox.threads_v1";
const KEY_MESSAGES = "trainq.community.inbox.messages_v1";
const KEY_GROUPS = "trainq.community.inbox.groups_v1";
const KEY_CHALLENGES = "trainq.community.inbox.challenges_v1";
const KEY_PARTICIPANTS = "trainq.community.inbox.participants_v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function getAll<T>(key: string, userId: string): T[] {
  const raw = getScopedItem(key, userId);
  const parsed = safeParse<T[]>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function setAll<T>(key: string, list: T[], userId: string): void {
  const raw = safeStringify(list);
  if (!raw) return;
  setScopedItem(key, raw, userId);
}

function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function listThreads(userId: string): InboxThread[] {
  return getAll<InboxThread>(KEY_THREADS, userId).filter((t) => t.memberIds.includes(userId));
}

export function listMessages(userId: string, threadId: string): InboxMessage[] {
  const threads = getAll<InboxThread>(KEY_THREADS, userId);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread || !thread.memberIds.includes(userId)) return [];
  return getAll<InboxMessage>(KEY_MESSAGES, userId).filter((m) => m.threadId === threadId);
}

export function createThread(userId: string, name: string): InboxThread {
  const threads = getAll<InboxThread>(KEY_THREADS, userId);
  const next: InboxThread = {
    id: uid("thread"),
    name: name.trim() || "Neuer Chat",
    memberIds: [userId],
    createdAt: new Date().toISOString(),
  };
  setAll(KEY_THREADS, [next, ...threads], userId);
  return next;
}

export function addThreadMember(userId: string, threadId: string, memberId: string): void {
  const threads = getAll<InboxThread>(KEY_THREADS, userId);
  const next = threads.map((t) => {
    if (t.id !== threadId) return t;
    if (t.memberIds.includes(memberId)) return t;
    return { ...t, memberIds: [...t.memberIds, memberId] };
  });
  setAll(KEY_THREADS, next, userId);
}

export function sendMessage(userId: string, threadId: string, text: string): InboxMessage | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const threads = getAll<InboxThread>(KEY_THREADS, userId);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread || !thread.memberIds.includes(userId)) return null;

  const messages = getAll<InboxMessage>(KEY_MESSAGES, userId);
  const next: InboxMessage = {
    id: uid("msg"),
    threadId,
    authorId: userId,
    text: trimmed,
    createdAt: new Date().toISOString(),
  };
  setAll(KEY_MESSAGES, [...messages, next], userId);
  return next;
}

export function listGroups(userId: string): InboxGroup[] {
  return getAll<InboxGroup>(KEY_GROUPS, userId).filter((g) => g.memberIds.includes(userId));
}

export function createGroup(userId: string, name: string): InboxGroup {
  const groups = getAll<InboxGroup>(KEY_GROUPS, userId);
  const next: InboxGroup = {
    id: uid("group"),
    name: name.trim() || "Neue Gruppe",
    memberIds: [userId],
    createdAt: new Date().toISOString(),
  };
  setAll(KEY_GROUPS, [next, ...groups], userId);
  return next;
}

export function addGroupMember(userId: string, groupId: string, memberId: string): void {
  const groups = getAll<InboxGroup>(KEY_GROUPS, userId);
  const next = groups.map((g) => {
    if (g.id !== groupId) return g;
    if (g.memberIds.includes(memberId)) return g;
    return { ...g, memberIds: [...g.memberIds, memberId] };
  });
  setAll(KEY_GROUPS, next, userId);
}

export function listChallenges(userId: string, groupId?: string): GroupChallenge[] {
  const groups = listGroups(userId);
  const allowedGroupIds = new Set(groups.map((g) => g.id));
  const challenges = getAll<GroupChallenge>(KEY_CHALLENGES, userId);
  return challenges.filter((c) => {
    if (!allowedGroupIds.has(c.groupId)) return false;
    if (groupId) return c.groupId === groupId;
    return true;
  });
}

export function createChallenge(userId: string, groupId: string, name: string): GroupChallenge {
  const challenges = getAll<GroupChallenge>(KEY_CHALLENGES, userId);
  const today = todayISO();
  const next: GroupChallenge = {
    id: uid("challenge"),
    groupId,
    name: name.trim() || "Neue Challenge",
    startDate: today,
    endDate: today,
    createdAt: new Date().toISOString(),
  };
  setAll(KEY_CHALLENGES, [next, ...challenges], userId);
  return next;
}

export function listParticipants(userId: string, challengeId: string): ChallengeParticipant[] {
  const participants = getAll<ChallengeParticipant>(KEY_PARTICIPANTS, userId);
  return participants.filter((p) => p.challengeId === challengeId);
}

export function ensureParticipant(userId: string, challengeId: string): ChallengeParticipant {
  const participants = getAll<ChallengeParticipant>(KEY_PARTICIPANTS, userId);
  const existing = participants.find((p) => p.challengeId === challengeId && p.userId === userId);
  if (existing) return existing;
  const next: ChallengeParticipant = { id: uid("participant"), challengeId, userId, workoutsCount: 0 };
  setAll(KEY_PARTICIPANTS, [next, ...participants], userId);
  return next;
}

export function setParticipantProgress(userId: string, challengeId: string, count: number): void {
  const participants = getAll<ChallengeParticipant>(KEY_PARTICIPANTS, userId);
  const next = participants.map((p) =>
    p.challengeId === challengeId && p.userId === userId ? { ...p, workoutsCount: Math.max(0, count) } : p
  );
  setAll(KEY_PARTICIPANTS, next, userId);
}

export function syncWorkoutsCountFromHistory(
  userId: string,
  challenge: GroupChallenge,
  history?: WorkoutHistoryEntry[]
): number {
  const list = history ?? loadWorkoutHistory();
  const from = new Date(`${challenge.startDate}T00:00:00`);
  const to = new Date(`${challenge.endDate}T23:59:59`);
  const count = list.filter((w) => {
    const d = new Date(w.endedAt || w.startedAt);
    return d.getTime() >= from.getTime() && d.getTime() <= to.getTime();
  }).length;
  setParticipantProgress(userId, challenge.id, count);
  return count;
}
