import React, { useEffect } from "react";
import { ChevronLeft, Heart, MessageCircle, UserPlus } from "lucide-react";
import { useNotifications } from "../../hooks/community/useNotifications";
import type { CommunityNotification } from "../../services/community/types";

interface Props {
  userId: string;
  onBack: () => void;
  onOpenPostDetail?: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
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

function NotificationIcon({ type }: { type: CommunityNotification["type"] }) {
  switch (type) {
    case "like": return <Heart size={16} fill="#E63946" color="#E63946" />;
    case "comment": return <MessageCircle size={16} style={{ color: "var(--accent-color)" }} />;
    case "follow": return <UserPlus size={16} style={{ color: "var(--accent-color)" }} />;
  }
}

function notificationText(n: CommunityNotification): string {
  const name = n.actor?.displayName ?? "Jemand";
  switch (n.type) {
    case "like": return `${name} gefällt dein Beitrag`;
    case "comment": return `${name} hat kommentiert`;
    case "follow": return `${name} folgt dir jetzt`;
  }
}

export default function NotificationsPage({ userId, onBack, onOpenPostDetail, onOpenProfile }: Props) {
  const { notifications, loading, load, markRead } = useNotifications(userId);

  useEffect(() => { load(); }, [load]);

  const handleTap = (n: CommunityNotification) => {
    if (!n.readAt) markRead(n.id);
    if (n.type === "follow") {
      onOpenProfile?.(n.actorId);
    } else if (n.postId) {
      onOpenPostDetail?.(n.postId);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-color)" }}>
      {/* Header */}
      <div className="pt-safe">
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
          <button onClick={onBack} className="p-1" style={{ color: "var(--text-color)" }}>
            <ChevronLeft size={24} />
          </button>
          <span className="font-semibold" style={{ color: "var(--text-color)" }}>Benachrichtigungen</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && notifications.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Lade...</div>
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <div className="text-sm" style={{ color: "var(--text-secondary)" }}>Keine Benachrichtigungen</div>
          </div>
        )}

        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => handleTap(n)}
            className="flex items-start gap-3 w-full text-left px-4 py-3.5 border-b"
            style={{
              borderColor: "var(--border-color)",
              background: n.readAt ? "transparent" : "var(--accent-color-10, rgba(59,130,246,0.06))",
            }}
          >
            {/* Avatar */}
            <div className="shrink-0 h-10 w-10 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 relative">
              {n.actor?.avatarUrl ? (
                <img src={n.actor.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-white text-sm font-bold">{(n.actor?.displayName ?? "?")[0].toUpperCase()}</span>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white flex items-center justify-center" style={{ background: "var(--bg-color)" }}>
                <NotificationIcon type={n.type} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: "var(--text-color)" }}>
                {notificationText(n)}
              </p>
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{timeAgo(n.createdAt)}</span>
            </div>

            {/* Unread dot */}
            {!n.readAt && (
              <div className="shrink-0 h-2.5 w-2.5 rounded-full mt-1.5" style={{ background: "var(--accent-color)" }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
