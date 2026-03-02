import React, { useState } from "react";
import { Heart, MessageCircle, MoreHorizontal, Share2, Trash2, Flag, Ban } from "lucide-react";
import { likePost, unlikePost, deletePost as apiDeletePost } from "../../services/community/api";
import type { CommunityPost } from "../../services/community/types";
import { POST_TYPE_LABELS, VISIBILITY_LABELS } from "../../services/community/types";

interface Props {
  post: CommunityPost;
  viewerId: string;
  onTap?: () => void;
  onAuthorTap?: () => void;
  onLikeChanged?: (postId: string, liked: boolean, newCount: number) => void;
  onDeleted?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onBlock?: (userId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export default function PostCard({ post, viewerId, onTap, onAuthorTap, onLikeChanged, onDeleted, onReport, onBlock }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const isOwn = post.authorId === viewerId;
  const author = post.author;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (post.isLiked) {
        await unlikePost(post.id, viewerId);
        onLikeChanged?.(post.id, false, post.likeCount - 1);
      } else {
        await likePost(post.id, viewerId);
        onLikeChanged?.(post.id, true, post.likeCount + 1);
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    try {
      await apiDeletePost(post.id);
      onDeleted?.(post.id);
    } catch { /* ignore */ }
  };

  return (
    <div
      className="p-4 border-b"
      style={{ borderColor: "var(--border-color)" }}
      onClick={onTap}
    >
      {/* Header: Avatar + name + time + menu */}
      <div className="flex items-start gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onAuthorTap?.(); }}
          className="shrink-0 h-10 w-10 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600"
        >
          {author?.avatarUrl ? (
            <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-white text-sm font-bold">{(author?.displayName ?? "?")[0].toUpperCase()}</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); onAuthorTap?.(); }} className="font-semibold text-sm truncate" style={{ color: "var(--text-color)" }}>
              {author?.displayName ?? "Unbekannt"}
            </button>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>@{author?.handle ?? "?"}</span>
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>&middot; {timeAgo(post.createdAt)}</span>
          </div>

          {/* Type + visibility badge */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--border-color)", color: "var(--text-secondary)" }}>
              {POST_TYPE_LABELS[post.type]}
            </span>
            {post.visibility !== "public" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "var(--border-color)", color: "var(--text-secondary)" }}>
                {VISIBILITY_LABELS[post.visibility]}
              </span>
            )}
          </div>
        </div>

        {/* Menu button */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="p-1.5 rounded-full"
          style={{ color: "var(--text-secondary)" }}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Text */}
      {post.text && (
        <p className="mt-2 text-sm whitespace-pre-wrap break-words" style={{ color: "var(--text-color)" }}>
          {post.text}
        </p>
      )}

      {/* Card image */}
      {post.cardImageUrl && (
        <div className="mt-3 rounded-xl overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
          <img src={post.cardImageUrl} alt="" className="w-full" />
        </div>
      )}

      {/* Actions: Like, Comment, Share */}
      <div className="flex items-center gap-6 mt-3">
        <button onClick={handleLike} className="flex items-center gap-1.5 text-sm" style={{ color: post.isLiked ? "#E63946" : "var(--text-secondary)" }}>
          <Heart size={18} fill={post.isLiked ? "#E63946" : "none"} />
          {post.likeCount > 0 && <span className="tabular-nums">{post.likeCount}</span>}
        </button>

        <button onClick={onTap} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          <MessageCircle size={18} />
          {post.commentCount > 0 && <span className="tabular-nums">{post.commentCount}</span>}
        </button>

        <button className="flex items-center gap-1.5 text-sm" style={{ color: "var(--text-secondary)" }}>
          <Share2 size={18} />
        </button>
      </div>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          className="mt-2 rounded-xl border shadow-lg p-1"
          style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {isOwn ? (
            <button onClick={handleDelete} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-500 rounded-lg hover:bg-red-500/10">
              <Trash2 size={16} /> Löschen
            </button>
          ) : (
            <>
              <button onClick={() => { setShowMenu(false); onReport?.(post.id); }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm rounded-lg" style={{ color: "var(--text-color)" }}>
                <Flag size={16} /> Melden
              </button>
              <button onClick={() => { setShowMenu(false); onBlock?.(post.authorId); }} className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-500 rounded-lg hover:bg-red-500/10">
                <Ban size={16} /> Blockieren
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
