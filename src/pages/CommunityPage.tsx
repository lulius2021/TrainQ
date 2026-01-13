// src/pages/CommunityPage.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  addComment,
  getCommunityFeed,
  toggleLike,
  type CommunityFeedItem,
} from "../services/communityService";
import {
  followUser,
  getSuggestedProfiles,
  type SuggestedProfile,
} from "../services/communityBackend";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()}.${d.getMonth() + 1}. · ${hh}:${mm}`;
}

function navigate(path: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path } }));
}

function navigateBack() {
  navigate("/");
}

const actionBtnStyle: React.CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  color: "var(--text)",
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
};

export default function CommunityPage() {
  const { user } = useAuth();
  const [feed, setFeed] = useState<CommunityFeedItem[]>([]);
  const [suggested, setSuggested] = useState<SuggestedProfile[] | null>(null);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<Record<string, "pending" | "accepted">>({});

  const fallbackSuggested = useMemo<SuggestedProfile[]>(
    () => [
      { id: "suggested_1", displayName: "Nora K.", handle: "@norak", mutualCount: 2, privacyLevel: "public" },
      { id: "suggested_2", displayName: "Jonas R.", handle: "@jonasr", mutualCount: 1, privacyLevel: "public" },
      { id: "suggested_3", displayName: "Lea S.", handle: "@leas", mutualCount: 3, privacyLevel: "public" },
      { id: "suggested_4", displayName: "Max T.", handle: "@maxt", mutualCount: 0, privacyLevel: "public" },
      { id: "suggested_5", displayName: "Eva L.", handle: "@eval", mutualCount: 4, privacyLevel: "public" },
    ],
    []
  );

  useEffect(() => {
    if (!user?.id) return;
    setFeed(getCommunityFeed(user.id));
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setSuggestedLoading(true);
    const supabaseId = user?.supabaseId;
    if (!supabaseId) {
      setSuggested(fallbackSuggested);
      setSuggestedLoading(false);
      return;
    }
    (async () => {
      const profiles = await getSuggestedProfiles(supabaseId);
      if (!active) return;
      setSuggested(profiles?.length ? profiles : fallbackSuggested);
      setSuggestedLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.supabaseId, fallbackSuggested]);

  const refresh = () => {
    if (!user?.id) return;
    setFeed(getCommunityFeed(user.id));
  };

  return (
    <div className="w-full pt-4 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={navigateBack}
          className="h-10 w-10 rounded-full flex items-center justify-center hover:opacity-95"
          style={actionBtnStyle}
          aria-label="Back"
          title="Zurück"
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>&lsaquo;</span>
        </button>

        <div className="flex-1 text-center">
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Freunde
          </div>
          <div className="text-[18px] font-semibold" style={{ color: "var(--text)" }}>
            Community
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/community/inbox")}
          className="h-10 w-10 rounded-full flex items-center justify-center hover:opacity-95"
          style={actionBtnStyle}
          aria-label="Inbox"
          title="Inbox"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 2 11 13" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 2 15 22 11 13 2 9 22 2Z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <SuggestedProfilesRow
        profiles={suggested}
        loading={suggestedLoading}
        followStatus={followStatus}
        onFollow={async (id) => {
          if (!user?.supabaseId) return;
          const status = await followUser({ supabaseUserId: user.supabaseId, targetId: id });
          setFollowStatus((prev) => ({ ...prev, [id]: status }));
        }}
      />

      <div className="space-y-3">
        {feed.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            onLike={() => {
              if (!user?.id) return;
              toggleLike(item.id, user.id);
              refresh();
            }}
            onComment={() => {
              if (!user?.id) return;
              const text = window.prompt("Kommentar hinzufügen");
              if (!text) return;
              addComment(item.id, user.id, text);
              refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FeedCard({
  item,
  onLike,
  onComment,
}: {
  item: CommunityFeedItem;
  onLike: () => void;
  onComment: () => void;
}) {
  return (
    <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-semibold"
            style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
          >
            {item.ownerProfile.displayName
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text)" }}>
              {item.ownerProfile.displayName}
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              {formatTime(item.createdAt)}
            </div>
          </div>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px]" style={{ background: "var(--surface2)", color: "var(--text)" }}>
          {item.snapshot?.sport || "Training"}
        </span>
      </div>

      <div className="space-y-1">
        <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>
          {item.summary}
        </div>
        {item.snapshot && (
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {item.snapshot.exerciseCount} Übungen · {item.snapshot.setCount} Sätze
          </div>
        )}
        {item.snapshot?.distanceKm && (
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {item.snapshot.distanceKm} km
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        <button type="button" onClick={onLike} className="rounded-full px-3 py-1 hover:opacity-95" style={actionBtnStyle}>
          {item.likedByMe ? "Liked" : "Like"} · {item.likeCount}
        </button>
        <button type="button" onClick={onComment} className="rounded-full px-3 py-1 hover:opacity-95" style={actionBtnStyle}>
          Comment · {item.commentCount}
        </button>
      </div>
    </div>
  );
}

function SuggestedProfilesRow({
  profiles,
  loading,
  followStatus,
  onFollow,
}: {
  profiles: SuggestedProfile[] | null;
  loading: boolean;
  followStatus: Record<string, "pending" | "accepted">;
  onFollow: (id: string) => void;
}) {
  const items = profiles ?? [];

  return (
    <div className="space-y-2">
      <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>
        Vorgeschlagene Profile
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1" data-no-tab-swipe="true" data-no-back-swipe="true">
        {loading && items.length === 0
          ? Array.from({ length: 5 }).map((_, idx) => (
              <div key={`skeleton-${idx}`} className="flex-none w-[170px] rounded-2xl p-3 space-y-2" style={cardStyle}>
                <div
                  className="h-12 w-12 rounded-full"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
                />
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded" style={{ background: "var(--surface2)" }} />
                  <div className="h-2 w-16 rounded" style={{ background: "var(--surface2)" }} />
                </div>
                <div className="h-2 w-20 rounded" style={{ background: "var(--surface2)" }} />
                <div className="h-6 w-full rounded-full" style={{ background: "var(--surface2)" }} />
              </div>
            ))
          : items.map((p) => (
              <div key={p.id} className="flex-none w-[170px] rounded-2xl p-3 space-y-2" style={cardStyle}>
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-[12px] font-semibold"
                  style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  {p.displayName
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                    {p.displayName}
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {p.handle}
                  </div>
                </div>
                <div className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {p.mutualCount} gemeinsame Freunde
                </div>
                <button
                  type="button"
                  onClick={() => onFollow(p.id)}
                  className="w-full rounded-full px-3 py-1 text-[11px] hover:opacity-95"
                  style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}
                >
                  {followStatus[p.id] === "accepted"
                    ? "Folgst du"
                    : followStatus[p.id] === "pending"
                    ? "Angefragt"
                    : p.privacyLevel === "public"
                    ? "Folgen"
                    : "Anfragen"}
                </button>
              </div>
            ))}
      </div>
    </div>
  );
}
