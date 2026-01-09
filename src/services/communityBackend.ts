// src/services/communityBackend.ts
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import { getSupabaseClient, hasSupabaseEnv } from "../lib/supabaseClient";

export type CommunityPrivacyLevel = "private" | "followers" | "public";

export type CommunityProfileRecord = {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  community_opt_in: boolean;
  privacy_level: CommunityPrivacyLevel;
  created_at: string;
};

export type SuggestedProfile = {
  id: string;
  displayName: string;
  handle: string;
  mutualCount: number;
  privacyLevel: CommunityPrivacyLevel;
  avatarUrl?: string;
};

type FollowStatus = "pending" | "accepted";

const LS_PROFILES = "trainq.community.profiles_backend_v1";

function nowISO(): string {
  return new Date().toISOString();
}

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

function slugify(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
}

function buildUsername(base: string, userId: string): string {
  const cleaned = slugify(base) || "trainq";
  const suffix = userId.slice(0, 6);
  return `${cleaned}${suffix ? `-${suffix}` : ""}`;
}

function readLocalProfiles(userId: string): CommunityProfileRecord[] {
  const raw = getScopedItem(LS_PROFILES, userId);
  const list = safeParse<CommunityProfileRecord[]>(raw, []);
  return Array.isArray(list) ? list : [];
}

function writeLocalProfiles(userId: string, profiles: CommunityProfileRecord[]) {
  const raw = safeStringify(profiles);
  if (!raw) return;
  setScopedItem(LS_PROFILES, raw, userId);
}

function buildFallbackSuggestions(): SuggestedProfile[] {
  return [
    { id: "suggested_1", displayName: "Nora K.", handle: "@norak", mutualCount: 2, privacyLevel: "public" },
    { id: "suggested_2", displayName: "Jonas R.", handle: "@jonasr", mutualCount: 1, privacyLevel: "public" },
    { id: "suggested_3", displayName: "Lea S.", handle: "@leas", mutualCount: 3, privacyLevel: "public" },
    { id: "suggested_4", displayName: "Max T.", handle: "@maxt", mutualCount: 0, privacyLevel: "public" },
    { id: "suggested_5", displayName: "Eva L.", handle: "@eval", mutualCount: 4, privacyLevel: "public" },
  ];
}

export async function ensureCommunityProfile(params: {
  supabaseUserId: string;
  displayName?: string;
  email?: string;
}): Promise<CommunityProfileRecord | null> {
  const { supabaseUserId, displayName, email } = params;
  if (!supabaseUserId) return null;

  if (hasSupabaseEnv()) {
    const client = getSupabaseClient();
    if (!client) return null;

    const { data: existing } = await client
      .from("profiles")
      .select("*")
      .eq("id", supabaseUserId)
      .maybeSingle();

    if (existing) return existing as CommunityProfileRecord;

    const fallbackName = displayName || (email ? email.split("@")[0] : "TrainQ User");
    const username = buildUsername(fallbackName, supabaseUserId);
    const { data } = await client
      .from("profiles")
      .insert({
        id: supabaseUserId,
        username,
        display_name: fallbackName || "TrainQ User",
        community_opt_in: false,
        privacy_level: "private",
      })
      .select("*")
      .single();

    return (data as CommunityProfileRecord) ?? null;
  }

  const profiles = readLocalProfiles(supabaseUserId);
  const existing = profiles.find((p) => p.id === supabaseUserId);
  if (existing) return existing;

  const fallbackName = displayName || (email ? email.split("@")[0] : "TrainQ User");
  const created: CommunityProfileRecord = {
    id: supabaseUserId,
    username: buildUsername(fallbackName, supabaseUserId),
    display_name: fallbackName || "TrainQ User",
    community_opt_in: false,
    privacy_level: "private",
    created_at: nowISO(),
  };
  writeLocalProfiles(supabaseUserId, [...profiles, created]);
  return created;
}

export async function loadCommunityProfile(
  supabaseUserId: string
): Promise<CommunityProfileRecord | null> {
  if (!supabaseUserId) return null;

  if (hasSupabaseEnv()) {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data } = await client.from("profiles").select("*").eq("id", supabaseUserId).maybeSingle();
    return (data as CommunityProfileRecord) ?? null;
  }

  const profiles = readLocalProfiles(supabaseUserId);
  return profiles.find((p) => p.id === supabaseUserId) ?? null;
}

export async function updateCommunitySettings(params: {
  supabaseUserId: string;
  communityOptIn: boolean;
  privacyLevel: CommunityPrivacyLevel;
}): Promise<CommunityProfileRecord | null> {
  const { supabaseUserId, communityOptIn, privacyLevel } = params;
  if (!supabaseUserId) return null;

  if (hasSupabaseEnv()) {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data } = await client
      .from("profiles")
      .update({
        community_opt_in: communityOptIn,
        privacy_level: privacyLevel,
      })
      .eq("id", supabaseUserId)
      .select("*")
      .single();
    return (data as CommunityProfileRecord) ?? null;
  }

  const profiles = readLocalProfiles(supabaseUserId);
  const idx = profiles.findIndex((p) => p.id === supabaseUserId);
  if (idx < 0) return null;
  const next: CommunityProfileRecord = {
    ...profiles[idx],
    community_opt_in: communityOptIn,
    privacy_level: privacyLevel,
  };
  const updated = [...profiles];
  updated[idx] = next;
  writeLocalProfiles(supabaseUserId, updated);
  return next;
}

export async function getSuggestedProfiles(supabaseUserId: string): Promise<SuggestedProfile[]> {
  if (!supabaseUserId) return [];

  if (hasSupabaseEnv()) {
    const client = getSupabaseClient();
    if (!client) return [];
    const { data } = await client
      .from("profiles")
      .select("id, username, display_name, avatar_url, privacy_level, created_at, community_opt_in")
      .eq("community_opt_in", true)
      .eq("privacy_level", "public")
      .neq("id", supabaseUserId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!Array.isArray(data) || data.length === 0) return buildFallbackSuggestions();
    const mapped = data.map((p) => ({
      id: p.id,
      displayName: p.display_name,
      handle: `@${p.username}`,
      mutualCount: 0,
      privacyLevel: p.privacy_level,
      avatarUrl: p.avatar_url ?? undefined,
    }));
    return mapped.length ? mapped : buildFallbackSuggestions();
  }

  return buildFallbackSuggestions();
}

export async function followUser(params: {
  supabaseUserId: string;
  targetId: string;
}): Promise<FollowStatus> {
  const { supabaseUserId, targetId } = params;
  if (!supabaseUserId || !targetId) return "pending";

  if (hasSupabaseEnv()) {
    const client = getSupabaseClient();
    if (!client) return "pending";
    const { data: target } = await client.from("profiles").select("privacy_level").eq("id", targetId).maybeSingle();
    const status: FollowStatus = target?.privacy_level === "public" ? "accepted" : "pending";
    await client
      .from("follows")
      .upsert(
        { follower_id: supabaseUserId, following_id: targetId, status },
        { onConflict: "follower_id,following_id" }
      );
    return status;
  }

  return "accepted";
}
