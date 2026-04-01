import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { getPost } from "../../services/community/api";
import type { CommunityPost } from "../../services/community/types";
import PostCard from "../../components/community/PostCard";
import CommentSection from "../../components/community/CommentSection";
import ReportSheet from "../../components/community/ReportSheet";
import BlockConfirmDialog from "../../components/community/BlockConfirmDialog";
import { useI18n } from "../../i18n/useI18n";

interface Props {
  postId: string;
  viewerId: string;
  onBack: () => void;
  onAuthorTap?: (userId: string) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function PostDetailPage({ postId, viewerId, onBack, onAuthorTap, onPostDeleted }: Props) {
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);

  const loadPost = useCallback(() => {
    setLoading(true);
    setError(false);
    getPost(postId, viewerId)
      .then((p) => setPost(p))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [postId, viewerId]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleLikeChanged = useCallback((_postId: string, liked: boolean, newCount: number) => {
    setPost((prev) => prev ? { ...prev, isLiked: liked, likeCount: newCount } : prev);
  }, []);

  const handleCommentCountChanged = useCallback((delta: number) => {
    setPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + delta } : prev);
  }, []);

  const { t } = useI18n();

  const handleDeleted = useCallback((id: string) => {
    onPostDeleted?.(id);
    onBack();
  }, [onBack, onPostDeleted]);

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-color)" }}>
      {/* Header */}
      <div className="pt-safe">
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
          <button onClick={onBack} className="p-1" style={{ color: "var(--text-color)" }}>
            <ChevronLeft size={24} />
          </button>
          <span className="font-semibold" style={{ color: "var(--text-color)" }}>{t("community.postDetail.title")}</span>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <AlertTriangle size={32} style={{ color: "var(--text-secondary)" }} className="mb-3" />
          <p className="text-sm text-center mb-4" style={{ color: "var(--text-secondary)" }}>
            {t("community.postDetail.loadError")}
          </p>
          <button
            onClick={loadPost}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: "var(--accent-color)", color: "#fff" }}
          >
            <RefreshCw size={14} /> {t("community.error.retry")}
          </button>
        </div>
      )}

      {!loading && !error && !post && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("community.postDetail.notFound")}</div>
        </div>
      )}

      {!loading && !error && post && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Post */}
          <div className="border-b" style={{ borderColor: "var(--border-color)" }}>
            <PostCard
              post={post}
              viewerId={viewerId}
              onAuthorTap={() => post.authorId !== viewerId && onAuthorTap?.(post.authorId)}
              onLikeChanged={handleLikeChanged}
              onDeleted={handleDeleted}
              onReport={(id) => setReportTarget({ id })}
              onBlock={(blockedId) => {
                setBlockTarget({ id: blockedId, name: post.author?.displayName ?? t("community.user.user") });
              }}
            />
          </div>

          {/* Comments */}
          <div className="flex-1 overflow-y-auto">
            <CommentSection
              postId={postId}
              viewerId={viewerId}
              onCommentCountChanged={handleCommentCountChanged}
            />
          </div>
        </div>
      )}

      {/* Report sheet */}
      {reportTarget && (
        <ReportSheet
          reporterId={viewerId}
          targetType="post"
          targetId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}

      {/* Block confirm */}
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
