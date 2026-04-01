import React, { useState, useEffect, useCallback, useRef } from "react";
import { Bell, ChevronLeft, Plus, RefreshCw, Search, AlertTriangle, Users, X, Trophy } from "lucide-react";
import { useFeed } from "../../hooks/community/useFeed";
import { useNotifications } from "../../hooks/community/useNotifications";
import { ensureCommunityProfile, searchUsers, followUser, unfollowUser, getDiscoverUsers } from "../../services/community/api";
import type { CommunityProfile } from "../../services/community/types";
import { useAuth } from "../../context/AuthContext";
import PostCard from "../../components/community/PostCard";
import PostComposer from "../../components/community/PostComposer";
import ReportSheet from "../../components/community/ReportSheet";
import BlockConfirmDialog from "../../components/community/BlockConfirmDialog";
import { useChallenges } from "../../hooks/useChallenges";
import ChallengeCard from "../../components/challenges/ChallengeCard";
import ChallengeCompletionModal from "../../components/challenges/ChallengeCompletionModal";
import CreateSoloChallengeModal from "../../components/challenges/CreateSoloChallengeModal";
import RewardBanner from "../../components/challenges/RewardBanner";
import type { ChallengeDefinition } from "../../types/challenge";
import { useI18n } from "../../i18n/useI18n";

interface Props {
  onOpenPostDetail?: (postId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenNotifications?: () => void;
  onBack?: () => void;
}

export default function CommunityPage({ onOpenPostDetail, onOpenProfile, onOpenNotifications, onBack }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const userId = user?.id;

  const { posts, loading, hasMore, feedType, error, switchFeed, refresh, loadMore, updatePost, removePost } = useFeed(userId);
  const { unreadCount } = useNotifications(userId);

  const [showComposer, setShowComposer] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ id: string } | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [profileEnsured, setProfileEnsured] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(CommunityProfile & { isFollowing?: boolean })[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Discover state
  const [activeTab, setActiveTab] = useState<"forYou" | "following" | "discover" | "challenges">("forYou");
  const [discoverUsers, setDiscoverUsers] = useState<(CommunityProfile & { isFollowing: boolean })[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const discoverLoaded = useRef(false);

  // Ensure community profile exists (await before marking ensured)
  useEffect(() => {
    if (!userId || profileEnsured) return;
    let cancelled = false;
    const email = user?.email ?? "";
    const handle = email.split("@")[0] || `user_${userId.slice(0, 6)}`;
    const displayName = user?.displayName || handle;
    // Safety timeout: if ensureCommunityProfile hangs, unblock the feed after 5s
    const safetyTimer = setTimeout(() => { if (!cancelled) setProfileEnsured(true); }, 5000);
    ensureCommunityProfile(userId, handle, displayName)
      .catch(() => {})
      .finally(() => {
        clearTimeout(safetyTimer);
        if (!cancelled) setProfileEnsured(true);
      });
    return () => { cancelled = true; clearTimeout(safetyTimer); };
  }, [userId, profileEnsured, user?.email, user?.displayName]);

  // Initial load
  useEffect(() => {
    if (userId && profileEnsured) refresh();
  }, [userId, feedType, profileEnsured, refresh]);

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

  // Challenges
  const {
    available,
    active: activeChallenges,
    completed: completedChallenges,
    joinChallenge,
    claimReward,
    createSolo,
    allDefinitions,
    serverChallenges,
    unclaimedRewards,
    canJoinRewardChallenge,
  } = useChallenges();

  type ChallTab = "available" | "active" | "completed";
  const [challTab, setChallTab] = useState<ChallTab>("available");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completionDef, setCompletionDef] = useState<ChallengeDefinition | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isCompletionServer, setIsCompletionServer] = useState(false);
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null);
  const [claimLoadingId, setClaimLoadingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const serverChallengeIds = new Set(serverChallenges.map((sc) => sc.id));
  const sortedAvailable = [...available].sort((a, b) => (serverChallengeIds.has(a.id) ? 0 : 1) - (serverChallengeIds.has(b.id) ? 0 : 1));

  const handleChallengeJoin = useCallback(async (challengeId: string) => {
    setJoinLoadingId(challengeId);
    try { await joinChallenge(challengeId); setChallTab("active"); }
    finally { setJoinLoadingId(null); }
  }, [joinChallenge]);

  const handleClaimReward = useCallback(async (challengeId: string) => {
    const def = allDefinitions.find((d) => d.id === challengeId);
    const isServer = serverChallengeIds.has(challengeId);
    if (def) { setCompletionDef(def); setIsCompletionServer(isServer); setClaimError(null); setShowCompletionModal(true); }
    if (!isServer) await claimReward(challengeId);
  }, [claimReward, allDefinitions, serverChallengeIds]);

  const handleModalClaim = useCallback(async () => {
    if (!completionDef) return;
    setClaimLoadingId(completionDef.id);
    setClaimError(null);
    try {
      const result = await claimReward(completionDef.id);
      if (result && !result.ok && result.error) { setClaimError(t("community.challenges.claimError")); return; }
    } catch { setClaimError(t("community.challenges.claimError")); return; }
    finally { setClaimLoadingId(null); }
    setShowCompletionModal(false);
    setCompletionDef(null);
  }, [completionDef, claimReward]);

  const handleCreate = useCallback((def: Omit<ChallengeDefinition, "id" | "isAdmin">) => {
    const created = createSolo(def);
    joinChallenge(created.id);
    setChallTab("active");
  }, [createSolo, joinChallenge]);

  // Load discover users when tab is selected
  const loadDiscoverUsers = useCallback(async () => {
    if (!userId) return;
    setDiscoverLoading(true);
    try {
      const users = await getDiscoverUsers(userId);
      setDiscoverUsers(users);
      discoverLoaded.current = true;
    } catch { /* ignore */ }
    finally { setDiscoverLoading(false); }
  }, [userId]);

  const handleTabSwitch = useCallback((tab: "forYou" | "following" | "discover" | "challenges") => {
    setActiveTab(tab);
    if (tab === "discover") {
      if (!discoverLoaded.current) loadDiscoverUsers();
    } else if (tab !== "challenges") {
      if (tab !== feedType) switchFeed(tab as "forYou" | "following");
    }
  }, [feedType, switchFeed, loadDiscoverUsers]);

  const handleDiscoverFollow = useCallback(async (targetId: string, currentlyFollowing: boolean) => {
    if (!userId) return;
    try {
      if (currentlyFollowing) {
        await unfollowUser(userId, targetId);
      } else {
        await followUser(userId, targetId);
      }
      setDiscoverUsers((prev) => prev.map((u) => u.id === targetId ? { ...u, isFollowing: !currentlyFollowing } : u));
    } catch { /* ignore */ }
  }, [userId]);

  // Debounced search
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      if (!userId) return;
      setSearchLoading(true);
      try {
        const results = await searchUsers(q.trim(), userId);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  }, [userId]);

  const handleToggleFollow = useCallback(async (targetId: string, currentlyFollowing: boolean) => {
    if (!userId) return;
    try {
      if (currentlyFollowing) {
        await unfollowUser(userId, targetId);
      } else {
        await followUser(userId, targetId);
      }
      setSearchResults((prev) => prev.map((u) => u.id === targetId ? { ...u, isFollowing: !currentlyFollowing } : u));
    } catch { /* ignore */ }
  }, [userId]);

  // Guard: no Supabase user
  if (!userId) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6" style={{ background: "var(--bg-color)" }}>
        <Users size={48} style={{ color: "var(--text-secondary)" }} className="mb-4" />
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          {t("community.login.prompt")}
        </p>
      </div>
    );
  }

  // Error UI
  const errorUI = error && !loading ? (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <AlertTriangle size={36} style={{ color: "var(--text-secondary)" }} className="mb-3" />
      {error === "tables_missing" ? (
        <>
          <p className="text-sm font-medium text-center mb-1" style={{ color: "var(--text-color)" }}>
            {t("community.error.tablesSetup")}
          </p>
          <p className="text-xs text-center mb-4" style={{ color: "var(--text-secondary)" }}>
            {t("community.error.tablesSetupDesc")}
          </p>
        </>
      ) : error === "timeout" ? (
        <>
          <p className="text-sm font-medium text-center mb-1" style={{ color: "var(--text-color)" }}>
            {t("community.error.timeout")}
          </p>
          <p className="text-xs text-center mb-4" style={{ color: "var(--text-secondary)" }}>
            {t("community.error.timeoutDesc")}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-center mb-1" style={{ color: "var(--text-color)" }}>
            {t("community.error.loadFeed")}
          </p>
          <p className="text-xs text-center mb-4" style={{ color: "var(--text-secondary)" }}>
            {t("community.error.loadFeedDesc")}
          </p>
        </>
      )}
      <button
        onClick={refresh}
        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
        style={{ background: "var(--accent-color)", color: "#fff" }}
      >
        <RefreshCw size={14} /> {t("community.error.retry")}
      </button>
    </div>
  ) : null;

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
          <div className="flex items-center gap-1">
            <button onClick={() => setShowSearch((v) => !v)} className="p-2">
              <Search size={22} style={{ color: "var(--text-color)" }} />
            </button>
            <button onClick={onOpenNotifications} className="relative p-2">
              <Bell size={22} style={{ color: "var(--text-color)" }} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 min-w-[16px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--border-color)" }}>
              <Search size={16} style={{ color: "var(--text-secondary)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("community.search.placeholder")}
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "var(--text-color)" }}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                  <X size={16} style={{ color: "var(--text-secondary)" }} />
                </button>
              )}
            </div>

            {/* Search results */}
            {searchLoading && (
              <div className="flex justify-center py-4">
                <RefreshCw size={16} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
              </div>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-color)", background: "var(--card-bg)" }}>
                {searchResults.map((u) => (
                  <button
                    key={u.id}
                    className="flex items-center gap-3 w-full px-3 py-2.5 border-b last:border-b-0"
                    style={{ borderColor: "var(--border-color)" }}
                    onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); onOpenProfile?.(u.id); }}
                  >
                    <div className="shrink-0 h-9 w-9 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-white text-xs font-bold">{u.displayName[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--text-color)" }}>{u.displayName}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>@{u.handle}</div>
                    </div>
                    {u.id !== userId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleFollow(u.id, !!u.isFollowing); }}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold"
                        style={{
                          background: u.isFollowing ? "var(--border-color)" : "var(--accent-color)",
                          color: u.isFollowing ? "var(--text-color)" : "#fff",
                        }}
                      >
                        {u.isFollowing ? t("community.follow.following") : t("community.follow.follow")}
                      </button>
                    )}
                  </button>
                ))}
              </div>
            )}
            {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
              <div className="py-4 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
                {t("community.search.noResults")}
              </div>
            )}
          </div>
        )}

        {/* Feed tabs */}
        {!showSearch && (
          <div className="flex px-4 gap-1 pb-2">
            {([["forYou", "community.tabs.forYou"], ["following", "community.tabs.following"], ["discover", "community.tabs.discover"], ["challenges", "community.tabs.challenges"]] as const).map(([tab, key]) => (
              <button
                key={tab}
                onClick={() => handleTabSwitch(tab)}
                className="flex-1 py-2 text-sm font-semibold rounded-xl transition-colors"
                style={{
                  background: activeTab === tab ? "var(--accent-color)" : "var(--border-color)",
                  color: activeTab === tab ? "#fff" : "var(--text-secondary)",
                }}
              >
                {t(key)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feed / Discover / Challenges */}
      <div className="flex-1 overflow-y-auto" onScroll={activeTab !== "discover" && activeTab !== "challenges" ? handleScroll : undefined}>
        {activeTab === "challenges" ? (
          <div className="px-4 py-3 space-y-3">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-[var(--button-bg)] rounded-2xl p-1">
              {([["available", "community.challenges.available"], ["active", "community.challenges.active"], ["completed", "community.challenges.completed"]] as const).map(([id, key]) => (
                <button
                  key={id}
                  onClick={() => setChallTab(id)}
                  className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition-all ${challTab === id ? "bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm" : "text-[var(--text-secondary)]"}`}
                >
                  {t(key)}
                </button>
              ))}
            </div>

            {unclaimedRewards.length > 0 && (
              <RewardBanner unclaimedCount={unclaimedRewards.length} onClaim={() => setChallTab("completed")} />
            )}

            {challTab === "available" && (
              <>
                {sortedAvailable.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-secondary)]"><p className="text-sm">{t("community.challenges.noAvailable")}</p></div>
                ) : (
                  sortedAvailable.map((def) => {
                    const sc = serverChallenges.find((c) => c.id === def.id);
                    return (
                      <ChallengeCard
                        key={def.id}
                        definition={def}
                        variant="available"
                        onJoin={() => handleChallengeJoin(def.id)}
                        isServerChallenge={serverChallengeIds.has(def.id)}
                        winnerCount={sc?.currentWinners}
                        maxWinners={sc?.maxWinners}
                        isJoinLoading={joinLoadingId === def.id}
                      />
                    );
                  })
                )}
              </>
            )}

            {challTab === "active" && (
              <>
                {activeChallenges.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-secondary)]"><p className="text-sm">{t("community.challenges.noActive")}</p></div>
                ) : (
                  activeChallenges.map((ac) => (
                    <ChallengeCard
                      key={ac.state.challengeId}
                      definition={ac.definition}
                      state={ac.state}
                      progress={ac.progress}
                      variant="active"
                      isServerChallenge={ac.isServer}
                    />
                  ))
                )}
              </>
            )}

            {challTab === "completed" && (
              <>
                {completedChallenges.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-secondary)]"><p className="text-sm">{t("community.challenges.noCompleted")}</p></div>
                ) : (
                  completedChallenges.map((cc) => (
                    <ChallengeCard
                      key={cc.state.challengeId}
                      definition={cc.definition}
                      state={cc.state}
                      variant="completed"
                      onClaimReward={() => handleClaimReward(cc.state.challengeId)}
                      isServerChallenge={cc.isServer}
                      rewardExpiresAt={cc.rewardExpiresAt}
                      isClaimLoading={claimLoadingId === cc.state.challengeId}
                    />
                  ))
                )}
              </>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] transition-colors"
            >
              <Plus size={18} />
              <span className="text-sm font-semibold">{t("community.challenges.create")}</span>
            </button>

            <CreateSoloChallengeModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
            <ChallengeCompletionModal
              open={showCompletionModal}
              definition={completionDef}
              onClose={() => { setShowCompletionModal(false); setCompletionDef(null); setClaimError(null); }}
              onClaimReward={completionDef?.reward ? handleModalClaim : undefined}
              isServerChallenge={isCompletionServer}
              claimError={claimError ?? undefined}
            />
          </div>
        ) : activeTab === "discover" ? (
          <>
            {discoverLoading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
              </div>
            )}
            {!discoverLoading && discoverUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <Users size={40} style={{ color: "var(--text-secondary)" }} className="mb-3" />
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  {t("community.empty.discover")}
                </p>
              </div>
            )}
            {!discoverLoading && discoverUsers.length > 0 && (
              <div className="px-4 py-2 space-y-2">
                {discoverUsers.map((u) => (
                  <button
                    key={u.id}
                    className="flex items-center gap-3 w-full p-3 rounded-2xl border"
                    style={{ background: "var(--card-bg)", borderColor: "var(--border-color)" }}
                    onClick={() => onOpenProfile?.(u.id)}
                  >
                    <div className="shrink-0 h-11 w-11 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-bold">{u.displayName[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--text-color)" }}>{u.displayName}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>@{u.handle}</div>
                      {u.bio && <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>{u.bio}</div>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDiscoverFollow(u.id, u.isFollowing); }}
                      className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold"
                      style={{
                        background: u.isFollowing ? "var(--border-color)" : "var(--accent-color)",
                        color: u.isFollowing ? "var(--text-color)" : "#fff",
                      }}
                    >
                      {u.isFollowing ? t("community.follow.following") : t("community.follow.follow")}
                    </button>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Error state */}
            {errorUI}

            {/* Loading spinner */}
            {loading && posts.length === 0 && !error && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={20} className="animate-spin" style={{ color: "var(--text-secondary)" }} />
              </div>
            )}

            {/* Empty state */}
            {!loading && !error && posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  {feedType === "following" ? t("community.empty.following") : t("community.empty.feed")}
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
                  setBlockTarget({ id: blockedId, name: author?.displayName ?? t("community.user.user") });
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
                {t("community.feed.noMore")}
              </div>
            )}
          </>
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
