// Community API — all Supabase queries for the community module.

import { getSupabaseClient } from "../../lib/supabaseClient";
import type {
  CommunityPost,
  CommunityComment,
  CommunityNotification,
  CommunityProfile,
  FeedParams,
  PostType,
  Visibility,
  ReportReason,
  ReportTarget,
  WorkoutData,
  GarminActivityData,
} from "./types";

const PAGE_SIZE = 20;

function client() {
  const c = getSupabaseClient();
  if (!c) throw new Error("Supabase not available");
  return c;
}

// ── Profile ──

export async function ensureCommunityProfile(userId: string, handle: string, displayName: string): Promise<void> {
  // Check if profile already exists for this user
  const { data: existing } = await client()
    .from("community_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existing) return; // Already exists — don't overwrite

  // Try handle, then handle + last 4 chars of userId on conflict
  const sanitized = handle.replace(/[^a-z0-9_]/gi, "").toLowerCase() || `user${userId.slice(0, 6)}`;
  const fallback = `${sanitized}${userId.slice(-4)}`;

  for (const h of [sanitized, fallback]) {
    const { error } = await client()
      .from("community_profiles")
      .insert({ id: userId, handle: h, display_name: displayName });
    if (!error) return;
    if (!error.message?.includes("unique") && !error.message?.includes("duplicate")) throw error;
  }
}

export async function getCommunityProfile(userId: string): Promise<CommunityProfile | null> {
  const { data } = await client()
    .from("community_profiles")
    .select("id, handle, display_name, avatar_url, bio")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return { id: data.id, handle: data.handle, displayName: data.display_name, avatarUrl: data.avatar_url, bio: data.bio ?? "" };
}

export async function searchUsers(query: string, viewerId: string): Promise<(CommunityProfile & { isFollowing?: boolean })[]> {
  const q = `%${query}%`;
  const { data, error } = await client()
    .from("community_profiles")
    .select("id, handle, display_name, avatar_url, bio")
    .or(`handle.ilike.${q},display_name.ilike.${q}`)
    .neq("id", viewerId)
    .limit(20);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const profiles: CommunityProfile[] = data.map((d: any) => ({
    id: d.id,
    handle: d.handle,
    displayName: d.display_name,
    avatarUrl: d.avatar_url,
    bio: d.bio ?? "",
  }));

  // Check follow status for each result
  const { data: follows } = await client()
    .from("community_follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .in("following_id", profiles.map((p) => p.id));
  const followingSet = new Set((follows ?? []).map((f: any) => f.following_id));

  return profiles.map((p) => ({ ...p, isFollowing: followingSet.has(p.id) }));
}

/**
 * Get all users the viewer doesn't follow yet, sorted by follower count (popular first).
 */
export async function getDiscoverUsers(viewerId: string, limit = 50): Promise<(CommunityProfile & { isFollowing: boolean })[]> {
  // Fetch all profiles except viewer
  const { data, error } = await client()
    .from("community_profiles")
    .select("id, handle, display_name, avatar_url, bio")
    .neq("id", viewerId)
    .limit(limit);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const profiles: CommunityProfile[] = data.map((d: any) => ({
    id: d.id,
    handle: d.handle,
    displayName: d.display_name,
    avatarUrl: d.avatar_url,
    bio: d.bio ?? "",
  }));

  // Check follow status
  const { data: follows } = await client()
    .from("community_follows")
    .select("following_id")
    .eq("follower_id", viewerId)
    .in("following_id", profiles.map((p) => p.id));
  const followingSet = new Set((follows ?? []).map((f: any) => f.following_id));

  // Not-followed first, then followed
  return profiles
    .map((p) => ({ ...p, isFollowing: followingSet.has(p.id) }))
    .sort((a, b) => (a.isFollowing === b.isFollowing ? 0 : a.isFollowing ? 1 : -1));
}

export async function updateCommunityProfile(userId: string, patch: Partial<{ handle: string; displayName: string; avatarUrl: string; bio: string }>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.handle !== undefined) update.handle = patch.handle;
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  if (patch.bio !== undefined) update.bio = patch.bio;
  if (Object.keys(update).length > 0) {
    update.updated_at = new Date().toISOString();
    await client().from("community_profiles").update(update).eq("id", userId);
  }
}

// ── Feed ──

function mapPost(row: any): CommunityPost {
  return {
    id: row.id,
    authorId: row.author_id,
    type: row.type,
    text: row.text,
    cardImageUrl: row.card_image_url,
    workoutRefId: row.workout_ref_id,
    workoutData: row.workout_data ?? null,
    garminData: row.garmin_data ?? null,
    visibility: row.visibility,
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    createdAt: row.created_at,
    author: row.community_profiles ? {
      id: row.community_profiles.id,
      handle: row.community_profiles.handle,
      displayName: row.community_profiles.display_name,
      avatarUrl: row.community_profiles.avatar_url,
      bio: row.community_profiles.bio ?? "",
    } : undefined,
  };
}

export async function getFeed(params: FeedParams, viewerId: string): Promise<CommunityPost[]> {
  const limit = params.limit ?? PAGE_SIZE;

  let query = client()
    .from("community_posts")
    .select("*, community_profiles!community_posts_author_id_fkey(id, handle, display_name, avatar_url, bio)")
    .eq("is_removed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.type === "forYou") {
    query = query.eq("visibility", "public");
  }
  // For "following": RLS handles visibility (followers-only posts from followed users pass through)
  // We additionally filter by followed authors + public
  if (params.type === "following") {
    // Get followed user IDs
    const { data: follows } = await client()
      .from("community_follows")
      .select("following_id")
      .eq("follower_id", viewerId);
    const followingIds = (follows ?? []).map((f: any) => f.following_id);
    followingIds.push(viewerId); // Include own posts
    query = query.in("author_id", followingIds);
  }

  if (params.cursor) {
    query = query.lt("created_at", params.cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []).map(mapPost);

  // Batch check likes for viewer
  if (posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: likes } = await client()
      .from("community_post_likes")
      .select("post_id")
      .eq("user_id", viewerId)
      .in("post_id", postIds);
    const likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
    posts.forEach((p) => { p.isLiked = likedSet.has(p.id); });
  }

  return posts;
}

// ── Single Post ──

export async function getPost(postId: string, viewerId: string): Promise<CommunityPost | null> {
  const { data } = await client()
    .from("community_posts")
    .select("*, community_profiles!community_posts_author_id_fkey(id, handle, display_name, avatar_url, bio)")
    .eq("id", postId)
    .single();
  if (!data) return null;

  const post = mapPost(data);

  // Check like
  const { data: like } = await client()
    .from("community_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", viewerId)
    .maybeSingle();
  post.isLiked = !!like;

  return post;
}

// ── Create / Delete Post ──

export async function createPost(authorId: string, params: {
  type: PostType;
  text?: string;
  visibility: Visibility;
  cardImageUrl?: string;
  workoutRefId?: string;
  workoutData?: WorkoutData;
  garminData?: GarminActivityData;
}): Promise<CommunityPost> {
  // URL rejection (MVP: no URLs allowed)
  if (params.text && /https?:\/\//i.test(params.text)) {
    throw new Error("Links sind im MVP nicht erlaubt.");
  }

  const { data, error } = await client()
    .from("community_posts")
    .insert({
      author_id: authorId,
      type: params.type,
      text: params.text ?? null,
      visibility: params.visibility,
      card_image_url: params.cardImageUrl ?? null,
      workout_ref_id: params.workoutRefId ?? null,
      workout_data: params.workoutData ?? null,
      garmin_data: params.garminData ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapPost(data);
}

export async function deletePost(postId: string): Promise<void> {
  await client().from("community_posts").delete().eq("id", postId);
}

// ── Likes ──

export async function likePost(postId: string, userId: string): Promise<void> {
  await client().from("community_post_likes").upsert(
    { post_id: postId, user_id: userId },
    { onConflict: "post_id,user_id" },
  );
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  await client().from("community_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
}

// ── Comments ──

function mapComment(row: any): CommunityComment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    text: row.text,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    author: row.community_profiles ? {
      id: row.community_profiles.id,
      handle: row.community_profiles.handle,
      displayName: row.community_profiles.display_name,
      avatarUrl: row.community_profiles.avatar_url,
      bio: row.community_profiles.bio ?? "",
    } : undefined,
  };
}

export async function getComments(postId: string, cursor?: string, limit = 30): Promise<CommunityComment[]> {
  let query = client()
    .from("community_comments")
    .select("*, community_profiles!community_comments_author_id_fkey(id, handle, display_name, avatar_url, bio)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (cursor) query = query.gt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapComment);
}

export async function createComment(postId: string, authorId: string, text: string): Promise<CommunityComment> {
  if (text.length > 500) throw new Error("Kommentar zu lang (max 500 Zeichen).");
  const { data, error } = await client()
    .from("community_comments")
    .insert({ post_id: postId, author_id: authorId, text })
    .select("*")
    .single();
  if (error) throw error;
  return mapComment(data);
}

export async function deleteComment(commentId: string): Promise<void> {
  await client()
    .from("community_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
}

// ── Follows ──

export async function followUser(followerId: string, followingId: string): Promise<void> {
  await client().from("community_follows").upsert(
    { follower_id: followerId, following_id: followingId },
    { onConflict: "follower_id,following_id" },
  );
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await client().from("community_follows").delete().eq("follower_id", followerId).eq("following_id", followingId);
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await client()
    .from("community_follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const { count } = await client()
    .from("community_follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);
  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await client()
    .from("community_follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);
  return count ?? 0;
}

// ── Blocks ──

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await client().from("community_blocks").upsert(
    { blocker_id: blockerId, blocked_id: blockedId },
    { onConflict: "blocker_id,blocked_id" },
  );
  // Also unfollow in both directions
  await client().from("community_follows").delete().eq("follower_id", blockerId).eq("following_id", blockedId);
  await client().from("community_follows").delete().eq("follower_id", blockedId).eq("following_id", blockerId);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await client().from("community_blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const { data } = await client()
    .from("community_blocks")
    .select("blocker_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  return !!data;
}

// ── Reports ──

export async function createReport(reporterId: string, targetType: ReportTarget, targetId: string, reason: ReportReason, details?: string): Promise<void> {
  const { error } = await client().from("community_reports").insert({
    reporter_id: reporterId,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details ?? null,
  });
  if (error) throw error;
}

// ── Notifications ──

function mapNotification(row: any): CommunityNotification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    actorId: row.actor_id,
    postId: row.post_id,
    commentId: row.comment_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    actor: row.community_profiles ? {
      id: row.community_profiles.id,
      handle: row.community_profiles.handle,
      displayName: row.community_profiles.display_name,
      avatarUrl: row.community_profiles.avatar_url,
      bio: row.community_profiles.bio ?? "",
    } : undefined,
  };
}

export async function getNotifications(userId: string, cursor?: string, limit = 30): Promise<CommunityNotification[]> {
  let query = client()
    .from("community_notifications")
    .select("*, community_profiles!community_notifications_actor_id_fkey(id, handle, display_name, avatar_url, bio)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await client()
    .from("community_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await client()
    .from("community_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

// ── Profile Posts ──

export async function getProfilePosts(profileUserId: string, viewerId: string, cursor?: string, limit = 20): Promise<CommunityPost[]> {
  // RLS handles visibility; we just query author's posts
  let query = client()
    .from("community_posts")
    .select("*, community_profiles!community_posts_author_id_fkey(id, handle, display_name, avatar_url, bio)")
    .eq("author_id", profileUserId)
    .eq("is_removed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw error;

  const posts = (data ?? []).map(mapPost);

  if (posts.length > 0) {
    const postIds = posts.map((p) => p.id);
    const { data: likes } = await client()
      .from("community_post_likes")
      .select("post_id")
      .eq("user_id", viewerId)
      .in("post_id", postIds);
    const likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
    posts.forEach((p) => { p.isLiked = likedSet.has(p.id); });
  }

  return posts;
}
