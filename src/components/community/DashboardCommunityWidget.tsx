import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell, ChevronRight, Users, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../i18n/useI18n";
import { useDashboardFeed } from "../../hooks/community/useDashboardFeed";
import { useNotifications } from "../../hooks/community/useNotifications";
import CompactPostCard from "./CompactPostCard";
import CommunityOverlay from "./CommunityOverlay";
import { useModalStore } from "../../store/useModalStore";

export default function DashboardCommunityWidget() {
  const { user } = useAuth();
  const userId = user?.id;
  const { t } = useI18n();

  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayInitialView, setOverlayInitialView] = useState<"feed" | "notifications">("feed");

  const sentinelRef = useRef<HTMLDivElement>(null);

  const { posts, loading, load, refresh, updatePost } = useDashboardFeed(userId, true);
  const { unreadCount } = useNotifications(userId);

  // Load feed on mount
  useEffect(() => {
    if (userId) load();
  }, [userId, load]);

  const activateShield = useModalStore((s) => s.activateShield);

  const handleOverlayClose = useCallback(() => {
    activateShield();
    setOverlayOpen(false);
    refresh();
  }, [refresh, activateShield]);

  const openOverlay = useCallback((view: "feed" | "notifications" = "feed") => {
    setOverlayInitialView(view);
    setOverlayOpen(true);
  }, []);

  const handleLikeChanged = useCallback((postId: string, liked: boolean, newCount: number) => {
    updatePost(postId, { isLiked: liked, likeCount: newCount });
  }, [updatePost]);

  if (!userId) return null;

  return (
    <div ref={sentinelRef}>
      {/* Section header */}
      <div className="flex items-center mb-2 pl-1">
        <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[11px]">
          {t("dashboard.community.title")}
        </h3>
      </div>

      {/* Notification banner */}
      {unreadCount > 0 && (
        <button
          onClick={() => openOverlay("notifications")}
          className="w-full mb-2.5 rounded-[20px] p-3.5 flex items-center gap-3 active:scale-[0.98] transition-transform"
          style={{ background: "var(--accent-color)", opacity: 0.12 }}
        >
          <div
            className="w-full rounded-[20px] p-3.5 flex items-center gap-3 absolute inset-0"
            style={{ background: "transparent" }}
          />
        </button>
      )}
      {unreadCount > 0 && (
        <button
          onClick={() => openOverlay("notifications")}
          className="w-full mb-2.5 rounded-[20px] px-3.5 py-3 flex items-center gap-3 active:scale-[0.98] transition-transform border border-[var(--border-color)]"
          style={{ background: "color-mix(in srgb, var(--accent-color) 10%, transparent)" }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--accent-color)" }}>
            <Bell size={18} color="#fff" />
          </div>
          <span className="text-[13px] font-semibold flex-1 text-left" style={{ color: "var(--text-color)" }}>
            {t("dashboard.community.notifications", { count: unreadCount })}
          </span>
          <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
      )}

      {/* Post list or empty — no spinner shown (loads silently) */}

      {!loading && posts.length === 0 && (
        <div className="bg-[var(--card-bg)] rounded-[20px] p-5 border border-[var(--border-color)] flex flex-col items-center gap-3">
          <Users size={28} style={{ color: "var(--text-secondary)" }} />
          <p className="text-[13px] text-center" style={{ color: "var(--text-secondary)" }}>
            {t("dashboard.community.emptyFeed")}
          </p>
          <button
            onClick={() => openOverlay("feed")}
            className="px-4 py-2 rounded-full text-[13px] font-semibold"
            style={{ background: "var(--accent-color)", color: "#fff" }}
          >
            {t("dashboard.community.exploreCta")}
          </button>
        </div>
      )}

      {posts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {posts.slice(0, 5).map((post) => (
            <CompactPostCard
              key={post.id}
              post={post}
              viewerId={userId}
              onTap={() => openOverlay("feed")}
              onCommentTap={() => openOverlay("feed")}
              onLikeChanged={handleLikeChanged}
            />
          ))}
          <button
            onClick={() => openOverlay("feed")}
            className="w-full mt-1 py-3 rounded-[20px] flex items-center justify-center gap-2 text-[13px] font-semibold active:scale-[0.98] transition-transform"
            style={{ background: "var(--card-bg)", color: "var(--accent-color)" }}
          >
            {t("dashboard.community.showAll")}
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Overlay — lazy mounted */}
      {overlayOpen && (
        <CommunityOverlay
          open={overlayOpen}
          onClose={handleOverlayClose}
          initialView={overlayInitialView}
          userId={userId}
        />
      )}
    </div>
  );
}
