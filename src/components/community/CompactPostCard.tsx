import React from "react";
import { Heart, MessageCircle, Dumbbell, Activity } from "lucide-react";
import { likePost, unlikePost } from "../../services/community/api";
import type { CommunityPost } from "../../services/community/types";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "jetzt";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

interface Props {
  post: CommunityPost;
  viewerId: string;
  onTap: () => void;
  onLikeChanged?: (postId: string, liked: boolean, newCount: number) => void;
}

export default function CompactPostCard({ post, viewerId, onTap, onLikeChanged }: Props) {
  const author = post.author;
  const wd = post.workoutData;

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

  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full text-left bg-[var(--card-bg)] rounded-[20px] p-3.5 border border-[var(--border-color)] active:scale-[0.98] transition-transform"
    >
      {/* Header: avatar, name, time, like & comment counts */}
      <div className="flex items-center gap-2">
        <div className="shrink-0 h-8 w-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
          {author?.avatarUrl ? (
            <img src={author.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-white text-[11px] font-bold">{(author?.displayName ?? "?")[0].toUpperCase()}</span>
          )}
        </div>
        <span className="text-[13px] font-semibold truncate" style={{ color: "var(--text-color)" }}>
          {author?.displayName ?? "Unbekannt"}
        </span>
        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>&middot; {timeAgo(post.createdAt)}</span>
        <div className="ml-auto flex items-center gap-2.5">
          <button onClick={handleLike} className="flex items-center gap-1 text-[12px]" style={{ color: post.isLiked ? "#E63946" : "var(--text-secondary)" }}>
            <Heart size={14} fill={post.isLiked ? "#E63946" : "none"} />
            {post.likeCount > 0 && <span className="tabular-nums">{post.likeCount}</span>}
          </button>
          {post.commentCount > 0 && (
            <span className="flex items-center gap-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              <MessageCircle size={14} />
              <span className="tabular-nums">{post.commentCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* Text preview */}
      {post.text && (
        <p className="mt-1.5 text-[13px] line-clamp-2 whitespace-pre-wrap" style={{ color: "var(--text-color)" }}>
          {post.text}
        </p>
      )}

      {/* Workout summary (single line) */}
      {wd && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <Dumbbell size={13} className="shrink-0" style={{ color: "var(--accent-color)" }} />
          <span className="truncate">
            {wd.title} — {wd.durationLabel} · {wd.totalVolumeKg > 0 ? `${wd.totalVolumeKg.toLocaleString("de-DE")} kg` : ""}{wd.totalVolumeKg > 0 && wd.totalSets > 0 ? " · " : ""}{wd.totalSets > 0 ? `${wd.totalSets} Sätze` : ""}
          </span>
        </div>
      )}

      {/* Garmin activity summary */}
      {post.garminData && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <Activity size={13} className="shrink-0" style={{ color: "#00c853" }} />
          <span className="truncate">
            {post.garminData.activityType} — {Math.round(post.garminData.durationSeconds / 60)} min
            {post.garminData.distanceMeters > 0 ? ` · ${(post.garminData.distanceMeters / 1000).toFixed(1)} km` : ""}
            {post.garminData.calories > 0 ? ` · ${post.garminData.calories} kcal` : ""}
          </span>
        </div>
      )}
    </button>
  );
}
