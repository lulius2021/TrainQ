import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import CommunityPage from "../../pages/community/CommunityPage";
import PostDetailPage from "../../pages/community/PostDetailPage";
import CommunityProfilePage from "../../pages/community/CommunityProfilePage";
import NotificationsPage from "../../pages/community/NotificationsPage";

type View = "feed" | "post-detail" | "profile" | "notifications";

interface Props {
  open: boolean;
  onClose: () => void;
  initialView?: "feed" | "notifications";
  userId: string;
}

export default function CommunityOverlay({ open, onClose, initialView = "feed", userId }: Props) {
  useBodyScrollLock(open);
  const [view, setView] = useState<View>(initialView);
  const [postId, setPostId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Reset to initial view when overlay opens
  React.useEffect(() => {
    if (open) {
      setView(initialView);
      setPostId(null);
      setProfileId(null);
    }
  }, [open, initialView]);

  const goBack = useCallback(() => {
    if (view === "post-detail" || view === "profile" || view === "notifications") {
      setView("feed");
      setPostId(null);
      setProfileId(null);
    } else {
      onClose();
    }
  }, [view, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-overlay-open="true"
          className="fixed inset-0 z-[80] flex flex-col"
          style={{ background: "var(--bg-color)" }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {view === "feed" && (
              <CommunityPage
                onOpenPostDetail={(pid) => { setPostId(pid); setView("post-detail"); }}
                onOpenProfile={(uid) => { setProfileId(uid); setView("profile"); }}
                onOpenNotifications={() => setView("notifications")}
                onBack={onClose}
              />
            )}

            {view === "post-detail" && postId && (
              <PostDetailPage
                postId={postId}
                viewerId={userId}
                onBack={goBack}
                onAuthorTap={(uid) => { setProfileId(uid); setView("profile"); }}
                onPostDeleted={() => { setView("feed"); setPostId(null); }}
              />
            )}

            {view === "profile" && profileId && (
              <CommunityProfilePage
                profileUserId={profileId}
                viewerId={userId}
                onBack={goBack}
                onOpenPostDetail={(pid) => { setPostId(pid); setView("post-detail"); }}
              />
            )}

            {view === "notifications" && (
              <NotificationsPage
                userId={userId}
                onBack={goBack}
                onOpenPostDetail={(pid) => { setPostId(pid); setView("post-detail"); }}
                onOpenProfile={(uid) => { setProfileId(uid); setView("profile"); }}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
