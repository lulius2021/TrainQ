// src/pages/ChallengesPage.tsx
import React, { useState, useCallback } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { useI18n } from "../i18n/useI18n";
import { useChallenges } from "../hooks/useChallenges";
import ChallengeCard from "../components/challenges/ChallengeCard";
import ChallengeCompletionModal from "../components/challenges/ChallengeCompletionModal";
import CreateSoloChallengeModal from "../components/challenges/CreateSoloChallengeModal";
import RewardBanner from "../components/challenges/RewardBanner";
import type { ChallengeDefinition } from "../types/challenge";

interface ChallengesPageProps {
  onBack: () => void;
}

type TabId = "available" | "active" | "completed";

const ChallengesPage: React.FC<ChallengesPageProps> = ({ onBack }) => {
  const { t } = useI18n();
  const {
    available,
    active,
    completed,
    joinChallenge,
    claimReward,
    createSolo,
    allDefinitions,
    serverChallenges,
    unclaimedRewards,
    canJoinRewardChallenge,
    serverLoading,
  } = useChallenges();

  const TAB_LABELS: { id: TabId; label: string }[] = [
    { id: "available", label: t("challenges.tabs.available") },
    { id: "active", label: t("challenges.tabs.active") },
    { id: "completed", label: t("challenges.tabs.completed") },
  ];

  const [tab, setTab] = useState<TabId>(() => {
    if (active.length > 0) return "active";
    return "available";
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completionDef, setCompletionDef] = useState<ChallengeDefinition | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isCompletionServer, setIsCompletionServer] = useState(false);
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null);
  const [claimLoadingId, setClaimLoadingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Set of server challenge IDs for easy lookup
  const serverChallengeIds = new Set(serverChallenges.map((sc) => sc.id));

  const handleJoin = useCallback(
    async (challengeId: string) => {
      setJoinLoadingId(challengeId);
      try {
        await joinChallenge(challengeId);
        setTab("active");
      } finally {
        setJoinLoadingId(null);
      }
    },
    [joinChallenge]
  );

  const handleClaimReward = useCallback(
    async (challengeId: string) => {
      const def = allDefinitions.find((d) => d.id === challengeId);
      const isServer = serverChallengeIds.has(challengeId);
      if (def) {
        setCompletionDef(def);
        setIsCompletionServer(isServer);
        setClaimError(null);
        setShowCompletionModal(true);
      }
      if (!isServer) {
        // Local: claim immediately
        await claimReward(challengeId);
      }
    },
    [claimReward, allDefinitions, serverChallengeIds]
  );

  const handleModalClaim = useCallback(async () => {
    if (!completionDef) return;
    setClaimLoadingId(completionDef.id);
    setClaimError(null);
    try {
      const result = await claimReward(completionDef.id);
      if (result && !result.ok && result.error) {
        const errorKey = `challenges.claim.error_${result.error}`;
        const translated = t(errorKey);
        setClaimError(translated !== errorKey ? translated : t("challenges.claim.error"));
        return;
      }
    } catch {
      setClaimError(t("challenges.claim.error"));
      return;
    } finally {
      setClaimLoadingId(null);
    }
    setShowCompletionModal(false);
    setCompletionDef(null);
  }, [completionDef, claimReward, t]);

  const handleCreate = useCallback(
    (def: Omit<ChallengeDefinition, "id" | "isAdmin">) => {
      const created = createSolo(def);
      joinChallenge(created.id);
      setTab("active");
    },
    [createSolo, joinChallenge]
  );

  const tabCounts: Record<TabId, number> = {
    available: available.length,
    active: active.length,
    completed: completed.length,
  };

  // Sort available: server challenges first
  const sortedAvailable = [...available].sort((a, b) => {
    const aServer = serverChallengeIds.has(a.id) ? 0 : 1;
    const bServer = serverChallengeIds.has(b.id) ? 0 : 1;
    return aServer - bServer;
  });

  // Determine join disabled reasons
  const getJoinDisabledReason = (defId: string): string | undefined => {
    if (!serverChallengeIds.has(defId)) return undefined;
    const sc = serverChallenges.find((c) => c.id === defId);
    if (!sc) return undefined;

    if (sc.reward && !canJoinRewardChallenge) return t("challenges.join.activeReward");
    if (sc.reward && sc.currentWinners >= sc.maxWinners) return t("challenges.winners.full");
    return undefined;
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] text-[var(--text-color)] overflow-hidden">
      {/* HEADER */}
      <div className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 pb-2 bg-[var(--nav-bg)] backdrop-blur-xl border-b border-[var(--border-color)] shrink-0 z-10">
        <div className="flex items-center mb-2">
          <button
            onClick={onBack}
            className="p-2 -ml-3 rounded-full hover:bg-[var(--button-bg)] transition-colors text-[var(--text-color)]"
          >
            <ChevronLeft size={32} />
          </button>
        </div>
        <h1 className="text-3xl font-bold text-[var(--text-color)] tracking-tight mb-4">
          {t("challenges.title")}
        </h1>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[var(--button-bg)] rounded-2xl p-1">
          {TAB_LABELS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                tab === tb.id
                  ? "bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {tb.label}
              {tabCounts[tb.id] > 0 && (
                <span className="ml-1 opacity-60">({tabCounts[tb.id]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="max-w-lg mx-auto space-y-3 pt-4">

          {/* Reward Banner at top if unclaimed rewards exist */}
          {unclaimedRewards.length > 0 && (
            <RewardBanner
              unclaimedCount={unclaimedRewards.length}
              onClaim={() => setTab("completed")}
            />
          )}

          {/* Available tab */}
          {tab === "available" && (
            <>
              {sortedAvailable.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <p className="text-sm">{t("challenges.empty.available")}</p>
                  <p className="text-xs mt-1">{t("challenges.empty.availableHint")}</p>
                </div>
              ) : (
                sortedAvailable.map((def) => {
                  const isServer = serverChallengeIds.has(def.id);
                  const sc = serverChallenges.find((c) => c.id === def.id);
                  return (
                    <ChallengeCard
                      key={def.id}
                      definition={def}
                      variant="available"
                      onJoin={() => handleJoin(def.id)}
                      isServerChallenge={isServer}
                      winnerCount={sc?.currentWinners}
                      maxWinners={sc?.maxWinners}
                      isJoinLoading={joinLoadingId === def.id}
                      joinDisabledReason={getJoinDisabledReason(def.id)}
                    />
                  );
                })
              )}
            </>
          )}

          {/* Active tab */}
          {tab === "active" && (
            <>
              {active.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <p className="text-sm">{t("challenges.empty.active")}</p>
                  <p className="text-xs mt-1">{t("challenges.empty.activeHint")}</p>
                </div>
              ) : (
                active.map((ac) => (
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

          {/* Completed tab */}
          {tab === "completed" && (
            <>
              {completed.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <p className="text-sm">{t("challenges.empty.completed")}</p>
                </div>
              ) : (
                completed.map((cc) => (
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
        </div>

        {/* Create Solo Button */}
        <div className="max-w-lg mx-auto mt-6 px-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] transition-colors"
          >
            <Plus size={18} />
            <span className="text-sm font-semibold">
              {t("challenges.createSolo")}
            </span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <CreateSoloChallengeModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreate}
      />

      <ChallengeCompletionModal
        open={showCompletionModal}
        definition={completionDef}
        onClose={() => {
          setShowCompletionModal(false);
          setCompletionDef(null);
          setClaimError(null);
        }}
        onClaimReward={
          completionDef?.reward ? handleModalClaim : undefined
        }
        isServerChallenge={isCompletionServer}
        claimError={claimError ?? undefined}
      />
    </div>
  );
};

export default ChallengesPage;
