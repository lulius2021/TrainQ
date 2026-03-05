import React, { useState, useEffect, useCallback } from "react";
import { Bell, ChevronLeft, Plus, RefreshCw } from "lucide-react";
import { useFeed } from "../../hooks/community/useFeed";
import { useNotifications } from "../../hooks/community/useNotifications";
import { ensureCommunityProfile } from "../../services/community/api";
import { useAuth } from "../../context/AuthContext";
import PostCard from "../../components/community/PostCard";
import PostComposer from "../../components/community/PostComposer";
import ReportSheet from "../../components/community/ReportSheet";
import BlockConfirmDialog from "../../components/community/BlockConfirmDialog";

interface Props {
  onOpenPostDetail?: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenNotifications?: () => void;
  onBack?: () => void;
}

export default function CommunityPage({ onOpenPostDetail, onOpenProfile, onOpenNotifications, onBack }: Props) {
  const { user } = useAuth();
  const userId = user?.id;

  const { posts, loading, hasMore, feedType, switchFeed, refresh, loadMore, updatePost, removePost } = useFeed(userId);
  const { unreadCount } = useNotifications(userId);

  const [showComposer, setShowComposer] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [profileEnsured, setProfileEnsured] = useState(false);

  // Ensure community profile exists
  useEffect(() => {
    if (!userId || profileEnsured) return;
    const email = user?.email ?? "";
    const handle = email.split("@")[0] || `user_${userId.slice(0, 6)}`;
    const displayName = user?.displayName || handle;
    ensureCommunityProfile(userId, handle, displayName).catch(() => {});
    setProfileEnsured(true);
  }, [userId, profileEnsured]);

  // Initial load
  useEffect(() => {
    if (userId && profileEnsured) refresh();
  }, [userId, feedType, profileEnsured]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  }, [loadMore]);

  const handleLikeChanged = useCallback((postId: string, liked: boolean, newCount: number) => {
    updatePost(postId, { isLiked: liked, likeCount: newCount });
  }, [updatePost]);

  const handleDeleted = useCallback((postId: string) => {
    removePost(postId);
  }, [removePost]);

  if (!userId) return null;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-color)" }}>
      {/* Header */}
      <div className="pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button onClick={onBack} className="p-1 -ml-1">
                <ChevronLeft size={24} style={{ color: "var(--text-color)" }} />
              </button>
            )}
            <h1 className="text-xl font-bold" style={{ color: "var(--text-color)" }}>Community</h1>
          </div>
          <button onClick={onOpenNotifications} className="relative p-2">
            <Bell size={22} style={{ color: "var(--text-color)" }} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-[16px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Feed tabs */}
        <div className="flex px-4 gap-1 pb-2">
          {(["forYou", "following"] as const).map((type) => (
            <button
              key={type}
              onClick={() => switchFeed(type)}
              className="flex-1 py-2 text-sm font-semibold rounded-xl transition-colors"
              style={{
                background: feedType === type ? "var(--accent-color)" : "var(--border-color)",
                color: feedType === type ? "#fff" : "var(--text-secondary)",
              }}
            >
              {type === "forYou" ? "Für dich" : "Folge ich"}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {/* Pull to refresh indicator */}
        {loading && posts.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              {feedType === "following" ? "Folge anderen Nutzern, um ihre Beiträge zu sehen." : "Noch keine Beiträge vorhanden."}
            </p>
          </div>
        )}

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            viewerId={userId}
            onTap={() => onOpenPostDetail?.(post.id)}
            onAuthorTap={() => post.authorId !== userId && onOpenProfile?.(post.authorId)}
            onLikeChanged={handleLikeChanged}
            onDeleted={handleDeleted}
            onReport={(id) => setReportTarget({ id })}
            onBlock={(blockedId) => {
              const author = post.author;
              setBlockTarget({ id: blockedId, name: author?.displayName ?? "Nutzer" });
            }}
          />
        ))}

        {loading && posts.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <RefreshCw size={16} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="py-6 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
            Keine weiteren Beiträge
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowComposer(true)}
        className="fixed right-4 z-40 h-14 w-14 rounded-full flex items-center justify-center shadow-lg"
        style={{ bottom: "calc(100px + env(safe-area-inset-bottom))", background: "var(--accent-color)" }}
      >
        <Plus size={24} color="#fff" />
      </button>

      {/* Composer */}
      {showComposer && (
        <PostComposer
          userId={userId}
          onClose={() => setShowComposer(false)}
          onCreated={refresh}
        />
      )}

      {/* Report sheet */}
      {reportTarget && (
        <ReportSheet
          reporterId={userId}
          targetType="post"
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
          onDone={() => setReportTarget(null)}
        />
      )}

      {/* Block confirm */}
      {blockTarget && (
        <BlockConfirmDialog
          blockerId={userId}
          blockedId={blockTarget.id}
          blockedName={blockTarget.name}
          onClose={() => setBlockTarget(null)}
          onBlocked={() => {
            // Remove all posts from blocked user
            posts.filter((p) => p.authorId === blockTarget.id).forEach((p) => removePost(p.id));
            setBlockTarget(null);
          }}
        />
      )}
    </div>
  );
}
