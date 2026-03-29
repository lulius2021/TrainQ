import { useState, useCallback, useRef } from "react";
import { getFeed } from "../../services/community/api";
import type { CommunityPost } from "../../services/community/types";

export function useDashboardFeed(viewerId: string | undefined, enabled: boolean) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchRef = useRef(0);

  const load = useCallback(async () => {
    if (!viewerId || !enabled) return;
    // 60s cache — skip if fetched recently
    if (Date.now() - lastFetchRef.current < 60_000 && posts.length > 0) return;
    setLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 6000)
      );
      const result = await Promise.race([
        getFeed({ type: "forYou", limit: 3 }, viewerId),
        timeout,
      ]);
      setPosts(result);
      lastFetchRef.current = Date.now();
    } catch {
      // silently ignore on dashboard — timeout or error
    } finally {
      setLoading(false);
    }
  }, [viewerId, enabled]);

  const refresh = useCallback(async () => {
    if (!viewerId) return;
    lastFetchRef.current = 0; // bust cache
    setLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 6000)
      );
      const result = await Promise.race([
        getFeed({ type: "forYou", limit: 3 }, viewerId),
        timeout,
      ]);
      setPosts(result);
      lastFetchRef.current = Date.now();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [viewerId]);

  const updatePost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, ...patch } : p));
  }, []);

  return { posts, loading, load, refresh, updatePost };
}
