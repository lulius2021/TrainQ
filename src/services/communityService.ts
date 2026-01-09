// src/services/communityService.ts
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";

export type PrivacyLevel = "public" | "friends";
export type FollowStatus = "pending" | "accepted";

export type CommunityProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  privacyLevel: PrivacyLevel;
};

export type FollowEdge = {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: string;
};

export type WorkoutSnapshot = {
  title: string;
  sport?: string;
  durationMin: number;
  exerciseCount: number;
  setCount: number;
  volume?: number;
  distanceKm?: number;
};

export type WorkoutShare = {
  id: string;
  ownerId: string;
  workoutId: string;
  visibility: PrivacyLevel;
  createdAt: string;
  summary: string;
  snapshot: WorkoutSnapshot;
};

export type ShareLike = {
  id: string;
  shareId: string;
  userId: string;
  createdAt: string;
};

export type ShareComment = {
  id: string;
  shareId: string;
  userId: string;
  text: string;
  createdAt: string;
};

export type CommunityFeedItem = WorkoutShare & {
  ownerProfile: CommunityProfile;
  likedByMe: boolean;
  likeCount: number;
  commentCount: number;
};

export type SuggestedProfile = {
  id: string;
  displayName: string;
  handle: string;
  mutualCount: number;
  privacyLevel: PrivacyLevel;
};

const KEY_PROFILES = "trainq.community.profiles_v1";
const KEY_FOLLOWS = "trainq.community.follows_v1";
const KEY_SHARES = "trainq.community.shares_v1";
const KEY_LIKES = "trainq.community.likes_v1";
const KEY_COMMENTS = "trainq.community.comments_v1";

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

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function getAll<T>(key: string, userId: string): T[] {
  if (!hasWindow()) return [];
  const raw = getScopedItem(key, userId);
  const parsed = safeParse<T[]>(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function setAll<T>(key: string, list: T[], userId: string): void {
  if (!hasWindow()) return;
  const raw = safeStringify(list);
  if (!raw) return;
  setScopedItem(key, raw, userId);
}

function nowISO(): string {
  return new Date().toISOString();
}

function uid(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ensureProfile(user: { id: string; displayName?: string; email?: string }): CommunityProfile {
  const profiles = getAll<CommunityProfile>(KEY_PROFILES, user.id);
  const existing = profiles.find((p) => p.userId === user.id);
  if (existing) return existing;

  const name = user.displayName || (user.email ? user.email.split("@")[0] : "User");
  const profile: CommunityProfile = {
    userId: user.id,
    displayName: name || "User",
    privacyLevel: "friends",
  };
  setAll(KEY_PROFILES, [...profiles, profile], user.id);
  return profile;
}

export function ensureDevFriends(currentUserId: string): void {
  if (!import.meta.env.DEV) return;
  const profiles = getAll<CommunityProfile>(KEY_PROFILES, currentUserId);
  const follows = getAll<FollowEdge>(KEY_FOLLOWS, currentUserId);

  if (!profiles.find((p) => p.userId === "friend_1")) {
    profiles.push({ userId: "friend_1", displayName: "Lena M.", privacyLevel: "friends" });
  }
  if (!profiles.find((p) => p.userId === "friend_2")) {
    profiles.push({ userId: "friend_2", displayName: "Tom K.", privacyLevel: "friends" });
  }
  if (!profiles.find((p) => p.userId === "friend_3")) {
    profiles.push({ userId: "friend_3", displayName: "Mira S.", privacyLevel: "friends" });
  }
  setAll(KEY_PROFILES, profiles, currentUserId);

  const ensureFollow = (followerId: string, followingId: string) => {
    if (follows.some((f) => f.followerId === followerId && f.followingId === followingId)) return;
    follows.push({
      id: uid("follow"),
      followerId,
      followingId,
      status: "accepted",
      createdAt: nowISO(),
    });
  };

  ensureFollow(currentUserId, "friend_1");
  ensureFollow(currentUserId, "friend_2");
  ensureFollow(currentUserId, "friend_3");
  ensureFollow("friend_1", currentUserId);
  ensureFollow("friend_2", currentUserId);
  ensureFollow("friend_3", currentUserId);

  setAll(KEY_FOLLOWS, follows, currentUserId);
}

export function getFollowedUserIds(currentUserId: string): Set<string> {
  const follows = getAll<FollowEdge>(KEY_FOLLOWS, currentUserId);
  const accepted = new Set<string>();
  for (const f of follows) {
    if (f.status !== "accepted") continue;
    if (f.followerId === currentUserId) accepted.add(f.followingId);
    if (f.followingId === currentUserId) accepted.add(f.followerId);
  }
  return accepted;
}

function buildSnapshot(workout: WorkoutHistoryEntry): WorkoutSnapshot {
  const durationMin = Math.max(0, Math.round((workout.durationSec ?? 0) / 60));
  const exerciseCount = (workout.exercises ?? []).length;
  const setCount = (workout.exercises ?? []).reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0);
  const volume = workout.totalVolume ?? undefined;
  return {
    title: workout.title ?? "Training",
    sport: workout.sport,
    durationMin,
    exerciseCount,
    setCount,
    volume,
    distanceKm: workout.distanceKm,
  };
}

function summaryFromSnapshot(snapshot: WorkoutSnapshot): string {
  if (snapshot.sport && (snapshot.sport === "Laufen" || snapshot.sport === "Radfahren")) {
    const km = snapshot.distanceKm ? `${snapshot.distanceKm} km` : "";
    return `${snapshot.durationMin} min ${snapshot.sport}${km ? ` · ${km}` : ""}`;
  }
  return `${snapshot.exerciseCount} Übungen · ${snapshot.setCount} Sätze`;
}

export function createWorkoutShare(
  ownerId: string,
  workout: WorkoutHistoryEntry,
  visibility: PrivacyLevel = "friends"
): WorkoutShare {
  const shares = getAll<WorkoutShare>(KEY_SHARES, ownerId);
  const existing = shares.find((s) => s.ownerId === ownerId && s.workoutId === workout.id);
  if (existing) return existing;

  const snapshot = buildSnapshot(workout);
  const share: WorkoutShare = {
    id: uid("share"),
    ownerId,
    workoutId: workout.id,
    visibility,
    createdAt: nowISO(),
    summary: summaryFromSnapshot(snapshot),
    snapshot,
  };
  setAll(KEY_SHARES, [share, ...shares], ownerId);
  return share;
}

export function getCommunityFeed(currentUserId: string, limit = 30): CommunityFeedItem[] {
  if (!currentUserId) return [];
  ensureDevFriends(currentUserId);

  const profiles = getAll<CommunityProfile>(KEY_PROFILES, currentUserId);
  const profileById = new Map(profiles.map((p) => [p.userId, p]));
  const shares = getAll<WorkoutShare>(KEY_SHARES, currentUserId);
  const likes = getAll<ShareLike>(KEY_LIKES, currentUserId);
  const comments = getAll<ShareComment>(KEY_COMMENTS, currentUserId);
  const allowed = getFollowedUserIds(currentUserId);

  const visible = shares.filter((s) => {
    if (s.ownerId === currentUserId) return true;
    if (s.visibility === "public") return true;
    return allowed.has(s.ownerId);
  });

  const sorted = visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);

  return sorted.map((share) => {
    const ownerProfile =
      profileById.get(share.ownerId) ||
      ({
        userId: share.ownerId,
        displayName: "User",
        privacyLevel: "friends",
      } as CommunityProfile);

    const likeCount = likes.filter((l) => l.shareId === share.id).length;
    const likedByMe = likes.some((l) => l.shareId === share.id && l.userId === currentUserId);
    const commentCount = comments.filter((c) => c.shareId === share.id).length;

    return {
      ...share,
      ownerProfile,
      likeCount,
      likedByMe,
      commentCount,
    };
  });
}

export function toggleLike(shareId: string, userId: string): void {
  if (!shareId || !userId) return;
  const likes = getAll<ShareLike>(KEY_LIKES, userId);
  const existing = likes.find((l) => l.shareId === shareId && l.userId === userId);
  if (existing) {
    setAll(KEY_LIKES, likes.filter((l) => l.id !== existing.id), userId);
    return;
  }
  const next: ShareLike = { id: uid("like"), shareId, userId, createdAt: nowISO() };
  setAll(KEY_LIKES, [next, ...likes], userId);
}

export function addComment(shareId: string, userId: string, text: string): void {
  const trimmed = String(text ?? "").trim();
  if (!shareId || !userId || !trimmed) return;
  const comments = getAll<ShareComment>(KEY_COMMENTS, userId);
  const next: ShareComment = { id: uid("comment"), shareId, userId, text: trimmed, createdAt: nowISO() };
  setAll(KEY_COMMENTS, [next, ...comments], userId);
}

export function getSuggestedProfiles(currentUserId: string): SuggestedProfile[] {
  if (!currentUserId) return [];
  ensureDevFriends(currentUserId);

  const profiles = getAll<CommunityProfile>(KEY_PROFILES, currentUserId).filter((p) => p.userId !== currentUserId);
  const mutualCounts = [2, 1, 3, 0, 4];

  const base = profiles.slice(0, 5).map((p, idx) => ({
    id: p.userId,
    displayName: p.displayName,
    handle: `@${p.displayName.toLowerCase().replace(/\s+/g, "")}`,
    mutualCount: mutualCounts[idx % mutualCounts.length],
    privacyLevel: p.privacyLevel,
  }));

  if (base.length >= 5) return base;

  const fallback: SuggestedProfile[] = [
    { id: "suggested_1", displayName: "Nora K.", handle: "@norak", mutualCount: 2, privacyLevel: "public" },
    { id: "suggested_2", displayName: "Jonas R.", handle: "@jonasr", mutualCount: 1, privacyLevel: "friends" },
    { id: "suggested_3", displayName: "Lea S.", handle: "@leas", mutualCount: 3, privacyLevel: "public" },
    { id: "suggested_4", displayName: "Max T.", handle: "@maxt", mutualCount: 0, privacyLevel: "friends" },
    { id: "suggested_5", displayName: "Eva L.", handle: "@eval", mutualCount: 4, privacyLevel: "public" },
  ];

  const combined = [...base, ...fallback.filter((p) => !base.some((b) => b.id === p.id))];
  return combined.slice(0, 5);
}

export function followUser(currentUserId: string, targetId: string): FollowStatus {
  if (!currentUserId || !targetId) return "pending";
  const profiles = getAll<CommunityProfile>(KEY_PROFILES, currentUserId);
  const target = profiles.find((p) => p.userId === targetId);
  const status: FollowStatus = target?.privacyLevel === "public" ? "accepted" : "pending";

  const follows = getAll<FollowEdge>(KEY_FOLLOWS, currentUserId);
  if (follows.some((f) => f.followerId === currentUserId && f.followingId === targetId)) {
    return status;
  }
  follows.unshift({
    id: uid("follow"),
    followerId: currentUserId,
    followingId: targetId,
    status,
    createdAt: nowISO(),
  });
  setAll(KEY_FOLLOWS, follows, currentUserId);
  return status;
}
