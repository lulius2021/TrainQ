import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, UserPlus, UserMinus, AlertTriangle, RefreshCw } from "lucide-react";
import { getCommunityProfile, getFollowerCount, getFollowingCount, isFollowing, followUser, unfollowUser, getProfilePosts } from "../../services/community/api";
import type { CommunityProfile, CommunityPost } from "../../services/community/types";
import PostCard from "../../components/community/PostCard";
import ReportSheet from "../../components/community/ReportSheet";
import BlockConfirmDialog from "../../components/community/BlockConfirmDialog";
import { useI18n } from "../../i18n/useI18n";

interface Props {
  profileUserId: string;
  viewerId: string;
  onBack: () => void;
  onOpenPostDetail?: (postId: string) => void;
}

export default function CommunityProfilePage({ profileUserId, viewerId, onBack, onOpenPostDetail }: Props) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowed, setIsFollowed] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [reportTarget, setReportTarget] = useState<{ id: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);

  const loadProfile = useCallback(() => {
    setLoading(true);
    setError(false);
    Promise.all([
      getCommunityProfile(profileUserId),
      getFollowerCount(profileUserId),
      getFollowingCount(profileUserId),
      isFollowing(viewerId, profileUserId),
      getProfilePosts(profileUserId, viewerId),
    ]).then(([prof, fc, fic, followed, p]) => {
      setProfile(prof);
      setFollowers(fc);
      setFollowing(fic);
      setIsFollowed(followed);
      setPosts(p);
      setHasMore(p.length >= 20);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, [profileUserId, viewerId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleFollow = async () => {
    if (isFollowed) {
      await unfollowUser(viewerId, profileUserId);
      setIsFollowed(false);
      setFollowers((c) => Math.max(0, c - 1));
    } else {
      await followUser(viewerId, profileUserId);
      setIsFollowed(true);
      setFollowers((c) => c + 1);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const cursor = posts[posts.length - 1]?.createdAt;
      const result = await getProfilePosts(profileUserId, viewerId, cursor);
      setPosts((prev) => [...prev, ...result]);
      setHasMore(result.length >= 20);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }, [posts, loadingMore, hasMore, profileUserId, viewerId]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      handleLoadMore();
    }
  }, [handleLoadMore]);

  const handleLikeChanged = useCallback((postId: string, liked: boolean, newCount: number) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, isLiked: liked, likeCount: newCount } : p));
  }, []);

  const handleDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const { t } = useI18n();
  const isOwnProfile = profileUserId === viewerId;

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-color)" }}>
      {/* Header */}
      <div className="pt-safe">
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
          <button onClick={onBack} className="p-1" style={{ color: "var(--text-color)" }}>
            <ChevronLeft size={24} />
          </button>
          <span className="font-semibold" style={{ color: "var(--text-color)" }}>{profile?.displayName ?? t("community.profile.title")}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <AlertTriangle size={32} style={{ color: "var(--text-secondary)" }} className="mb-3" />
          <p className="text-sm text-center mb-4" style={{ color: "var(--text-secondary)" }}>
            {t("community.profile.loadError")}
          </p>
          <button
            onClick={loadProfile}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: "var(--accent-color)", color: "#fff" }}
          >
            <RefreshCw size={14} /> {t("community.error.retry")}
          </button>
        </div>
      ) : !profile ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("community.profile.notFound")}</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
          {/* Profile header */}
          <div className="px-4 py-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-white text-xl font-bold">{profile.displayName[0].toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg" style={{ color: "var(--text-color)" }}>{profile.displayName}</div>
                <div className="text-sm" style={{ color: "var(--text-secondary)" }}>@{profile.handle}</div>
              </div>
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm whitespace-pre-wrap" style={{ color: "var(--text-color)" }}>{profile.bio}</p>
            )}

            {/* Stats */}
            <div className="flex gap-5 mt-3">
              <div>
                <span className="font-bold text-sm" style={{ color: "var(--text-color)" }}>{followers}</span>
                <span className="text-xs ml-1" style={{ color: "var(--text-secondary)" }}>{t("community.profile.followers")}</span>
              </div>
              <div>
                <span className="font-bold text-sm" style={{ color: "var(--text-color)" }}>{following}</span>
                <span className="text-xs ml-1" style={{ color: "var(--text-secondary)" }}>{t("community.profile.following")}</span>
              </div>
            </div>

            {/* Follow button */}
            {!isOwnProfile && (
              <button
                onClick={handleFollow}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: isFollowed ? "var(--border-color)" : "var(--accent-color)",
                  color: isFollowed ? "var(--text-color)" : "#fff",
                }}
              >
                {isFollowed ? <><UserMinus size={16} /> {t("community.follow.unfollow")}</> : <><UserPlus size={16} /> {t("community.follow.follow")}</>}
              </button>
            )}
          </div>

          {/* Posts */}
          <div className="border-t" style={{ borderColor: "var(--border-color)" }}>
            <div className="px-4 py-3">
              <span className="font-semibold text-sm" style={{ color: "var(--text-color)" }}>{t("community.profile.posts")}</span>
            </div>
            {posts.length === 0 && (
              <div className="py-8 text-center text-sm" style={{ color: "var(--text-secondary)" }}>
                {t("community.profile.noPosts")}
              </div>
            )}
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                viewerId={viewerId}
                onTap={() => onOpenPostDetail?.(post.id)}
                onLikeChanged={handleLikeChanged}
                onDeleted={handleDeleted}
                onReport={(id) => setReportTarget({ id })}
                onBlock={(blockedId) => setBlockTarget({ id: blockedId, name: post.author?.displayName ?? t("community.user.user") })}
              />
            ))}
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportSheet
          reporterId={viewerId}
          targetType="post"
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}

      {blockTarget && (
        <BlockConfirmDialog
          blockerId={viewerId}
          blockedId={blockTarget.id}
          blockedName={blockTarget.name}
          onClose={() => setBlockTarget(null)}
          onBlocked={onBack}
        />
      )}
    </div>
  );
}
