import { useState, useCallback, useRef } from "react";
import { getFeed } from "../../services/community/api";
import type { CommunityPost, FeedParams } from "../../services/community/types";

export function useFeed(viewerId: string | undefined) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [feedType, setFeedType] = useState<"forYou" | "following">("forYou");
  const [error, setError] = useState<string | null>(null);

  // Use a ref for cursor so `load` doesn't depend on `posts`
  const postsRef = useRef<CommunityPost[]>([]);

  const load = useCallback(async (reset = false) => {
    if (!viewerId) return;
    setLoading(true);
    if (reset) setError(null);

    // Safety timeout: never leave the spinner stuck for more than 15 seconds
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setError("timeout");
    }, 15000);

    try {
      const cursor = reset ? undefined : postsRef.current[postsRef.current.length - 1]?.createdAt;
      const params: FeedParams = { type: feedType, cursor, limit: 20 };
      const result = await getFeed(params, viewerId);
      clearTimeout(safetyTimer);
      if (reset) {
        postsRef.current = result;
        setPosts(result);
      } else {
        const next = [...postsRef.current, ...result];
        postsRef.current = next;
        setPosts(next);
      }
      setHasMore(result.length >= 20);
      setError(null);
    } catch (e: any) {
      clearTimeout(safetyTimer);
      const msg = e?.message ?? String(e);
      // Detect missing tables (relation does not exist)
      if (/relation.*does not exist/i.test(msg) || /42P01/.test(msg)) {
        setError("tables_missing");
      } else {
        setError(msg || "unknown");
      }
      if (import.meta.env.DEV) console.error("Feed load error:", e);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
    }
  }, [viewerId, feedType]);

  const refresh = useCallback(() => load(true), [load]);
  const loadMore = useCallback(() => { if (hasMore && !loading) load(false); }, [load, hasMore, loading]);

  const switchFeed = useCallback((type: "forYou" | "following") => {
    setFeedType(type);
    postsRef.current = [];
    setPosts([]);
    setHasMore(true);
    setError(null);
  }, []);

  // Update a post in-place (e.g., after like/unlike)
  const updatePost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setPosts((prev) => {
      const next = prev.map((p) => p.id === postId ? { ...p, ...patch } : p);
      postsRef.current = next;
      return next;
    });
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => {
      const next = prev.filter((p) => p.id !== postId);
      postsRef.current = next;
      return next;
    });
  }, []);

  return { posts, loading, hasMore, feedType, error, switchFeed, refresh, loadMore, updatePost, removePost };
}
