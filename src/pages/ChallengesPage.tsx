// src/pages/ChallengesPage.tsx
import React, { useState, useCallback } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { useChallenges } from "../hooks/useChallenges";
import ChallengeCard from "../components/challenges/ChallengeCard";
import ChallengeCompletionModal from "../components/challenges/ChallengeCompletionModal";
import CreateSoloChallengeModal from "../components/challenges/CreateSoloChallengeModal";
import type { ChallengeDefinition } from "../types/challenge";

interface ChallengesPageProps {
  onBack: () => void;
}

type TabId = "available" | "active" | "completed";

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: "available", label: "Verfuegbar" },
  { id: "active", label: "Aktiv" },
  { id: "completed", label: "Abgeschlossen" },
];

const ChallengesPage: React.FC<ChallengesPageProps> = ({ onBack }) => {
  const {
    available,
    active,
    completed,
    joinChallenge,
    claimReward,
    createSolo,
    allDefinitions,
  } = useChallenges();

  const [tab, setTab] = useState<TabId>(() => {
    // Default to "active" if there are active challenges
    if (active.length > 0) return "active";
    return "available";
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completionDef, setCompletionDef] = useState<ChallengeDefinition | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const handleJoin = useCallback(
    (challengeId: string) => {
      joinChallenge(challengeId);
      setTab("active");
    },
    [joinChallenge]
  );

  const handleClaimReward = useCallback(
    (challengeId: string) => {
      const def = allDefinitions.find((d) => d.id === challengeId);
      if (def) {
        setCompletionDef(def);
        setShowCompletionModal(true);
      }
      claimReward(challengeId);
    },
    [claimReward, allDefinitions]
  );

  const handleCreate = useCallback(
    (def: Omit<ChallengeDefinition, "id" | "isAdmin">) => {
      const created = createSolo(def);
      // Auto-join the newly created solo challenge
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
          Challenges
        </h1>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[var(--button-bg)] rounded-2xl p-1">
          {TAB_LABELS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                tab === t.id
                  ? "bg-[var(--card-bg)] text-[var(--text-color)] shadow-sm"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              {t.label}
              {tabCounts[t.id] > 0 && (
                <span className="ml-1 opacity-60">({tabCounts[t.id]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="max-w-lg mx-auto space-y-3 pt-4">
          {/* Available tab */}
          {tab === "available" && (
            <>
              {available.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <p className="text-sm">Keine neuen Challenges verfuegbar.</p>
                  <p className="text-xs mt-1">Erstelle eine eigene Solo-Challenge!</p>
                </div>
              ) : (
                available.map((def) => (
                  <ChallengeCard
                    key={def.id}
                    definition={def}
                    variant="available"
                    onJoin={() => handleJoin(def.id)}
                  />
                ))
              )}
            </>
          )}

          {/* Active tab */}
          {tab === "active" && (
            <>
              {active.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <p className="text-sm">Keine aktiven Challenges.</p>
                  <p className="text-xs mt-1">Tritt einer Challenge bei!</p>
                </div>
              ) : (
                active.map((ac) => (
                  <ChallengeCard
                    key={ac.state.challengeId}
                    definition={ac.definition}
                    state={ac.state}
                    progress={ac.progress}
                    variant="active"
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
                  <p className="text-sm">Noch keine abgeschlossenen Challenges.</p>
                </div>
              ) : (
                completed.map((cc) => (
                  <ChallengeCard
                    key={cc.state.challengeId}
                    definition={cc.definition}
                    state={cc.state}
                    variant="completed"
                    onClaimReward={() => handleClaimReward(cc.state.challengeId)}
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
              Solo-Challenge erstellen
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
        }}
        onClaimReward={
          completionDef?.reward
            ? () => claimReward(completionDef.id)
            : undefined
        }
      />
    </div>
  );
};

export default ChallengesPage;
