import { useState, useCallback } from "react";
import { getFeed } from "../../services/community/api";
import type { CommunityPost, FeedParams } from "../../services/community/types";

export function useFeed(viewerId: string | undefined) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedType, setFeedType] = useState<"forYou" | "following">("forYou");

  const load = useCallback(async (reset = false) => {
    if (!viewerId) return;
    setLoading(true);
    try {
      const cursor = reset ? undefined : posts[posts.length - 1]?.createdAt;
      const params: FeedParams = { type: feedType, cursor, limit: 20 };
      const result = await getFeed(params, viewerId);
      if (reset) {
        setPosts(result);
      } else {
        setPosts((prev) => [...prev, ...result]);
      }
      setHasMore(result.length >= 20);
    } catch (e) {
      if (import.meta.env.DEV) console.error("Feed load error:", e);
    } finally {
      setLoading(false);
    }
  }, [viewerId, feedType, posts]);

  const refresh = useCallback(() => load(true), [load]);
  const loadMore = useCallback(() => { if (hasMore && !loading) load(false); }, [load, hasMore, loading]);

  const switchFeed = useCallback((type: "forYou" | "following") => {
    setFeedType(type);
    setPosts([]);
    setHasMore(true);
  }, []);

  // Update a post in-place (e.g., after like/unlike)
  const updatePost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, ...patch } : p));
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return { posts, loading, hasMore, feedType, switchFeed, refresh, loadMore, updatePost, removePost };
}
