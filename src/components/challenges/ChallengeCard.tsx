// src/components/challenges/ChallengeCard.tsx
import React from "react";
import { Check, Gift, Clock, Trophy, Loader2 } from "lucide-react";
import { AppCard } from "../ui/AppCard";
import { AppButton } from "../ui/AppButton";
import ChallengeProgressBar from "./ChallengeProgressBar";
import { useI18n } from "../../i18n/useI18n";
import type { ChallengeDefinition, UserChallengeState } from "../../types/challenge";
import type { ChallengeProgressResult } from "../../utils/challengeProgress";

interface ChallengeCardProps {
  definition: ChallengeDefinition;
  state?: UserChallengeState;
  progress?: ChallengeProgressResult;
  variant: "available" | "active" | "completed";
  onJoin?: () => void;
  onClaimReward?: () => void;
  isServerChallenge?: boolean;
  rewardExpiresAt?: string;
  winnerCount?: number;
  maxWinners?: number;
  canClaim?: boolean;
  claimBlockReason?: string;
  isClaimLoading?: boolean;
  isJoinLoading?: boolean;
  joinDisabledReason?: string;
}

function goalUnitLabel(type: ChallengeDefinition["goal"]["type"]): string {
  switch (type) {
    case "workout_count":
      return "Einheiten";
    case "distance_km":
      return "km";
    case "volume_kg":
      return "kg";
  }
}

function daysRemainingLabel(endDate: string, t: (key: string) => string): string {
  const now = new Date();
  const end = new Date(endDate + "T23:59:59");
  const diffMs = end.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(diffMs / 86400000));
  if (days === 0) return t("challenges.endsToday");
  if (days === 1) return t("challenges.oneDay");
  return t("challenges.daysLeft").replace("{{days}}", String(days));
}

function rewardExpiryLabel(expiresAt: string): string {
  const now = new Date();
  const exp = new Date(expiresAt);
  const diffDays = Math.max(0, Math.ceil((exp.getTime() - now.getTime()) / 86400000));
  if (diffDays === 0) return "Heute";
  return `${diffDays}d`;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  definition,
  state,
  progress,
  variant,
  onJoin,
  onClaimReward,
  isServerChallenge,
  rewardExpiresAt,
  winnerCount,
  maxWinners,
  canClaim = true,
  claimBlockReason,
  isClaimLoading,
  isJoinLoading,
  joinDisabledReason,
}) => {
  const { t } = useI18n();
  const isCompleted = variant === "completed" && state?.completed;
  const hasReward = !!definition.reward;
  const rewardUnclaimed = isCompleted && hasReward && !state?.rewardClaimed;

  return (
    <AppCard className="relative overflow-hidden">
      {/* Completed indicator */}
      {isCompleted && (
        <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
          <Check size={16} className="text-white" strokeWidth={3} />
        </div>
      )}

      {/* Monthly Challenge Badge */}
      {isServerChallenge && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">
            <Trophy size={10} />
            {t("challenges.monthlyBadge")}
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3 mb-2">
        <div className="text-2xl leading-none flex-shrink-0 mt-0.5">
          {definition.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-[var(--text-color)] leading-tight">
            {definition.title}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
            {definition.description}
          </p>
        </div>
      </div>

      {/* Duration info */}
      {variant === "available" && (
        <div className="flex items-center gap-1.5 mb-3 text-xs text-[var(--text-secondary)] flex-wrap">
          <Clock size={12} />
          <span>{definition.durationDays} {t("challenges.days")}</span>
          {hasReward && (
            <>
              <span className="mx-1">|</span>
              <Gift size={12} className="text-yellow-500" />
              <span className="text-yellow-500 font-medium">
                {definition.reward!.days} {t("challenges.daysPro")}
              </span>
            </>
          )}
          {isServerChallenge && winnerCount !== undefined && maxWinners !== undefined && (
            <>
              <span className="mx-1">|</span>
              <span className="text-[var(--text-secondary)]">
                {t("challenges.winners").replace("{{current}}", String(winnerCount)).replace("{{max}}", String(maxWinners))}
              </span>
            </>
          )}
        </div>
      )}

      {/* Active: progress bar + time remaining */}
      {variant === "active" && progress && state && (
        <div className="mt-3 space-y-2">
          <ChallengeProgressBar
            progress01={progress.progress01}
            current={progress.current}
            target={progress.target}
            unit={goalUnitLabel(definition.goal.type)}
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-secondary)]">
              {daysRemainingLabel(state.endDate, t)}
            </span>
            {hasReward && (
              <span className="text-[11px] text-yellow-500 flex items-center gap-1">
                <Gift size={10} />
                {definition.reward!.days} {t("challenges.daysPro")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Completed: reward claim or completed info */}
      {variant === "completed" && state && (
        <div className="mt-3">
          {state.completed ? (
            rewardUnclaimed ? (
              <div className="space-y-2">
                <AppButton
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={onClaimReward}
                  disabled={!canClaim || isClaimLoading}
                >
                  {isClaimLoading ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Gift size={14} className="mr-1.5" />
                  )}
                  {isClaimLoading
                    ? t("challenges.claim.loading")
                    : t("challenges.claim.button").replace("{{days}}", String(definition.reward!.days))}
                </AppButton>
                {claimBlockReason && (
                  <p className="text-[10px] text-[var(--text-secondary)] text-center">
                    {claimBlockReason}
                  </p>
                )}
                {rewardExpiresAt && (
                  <p className="text-[10px] text-[var(--text-secondary)] text-center">
                    {t("challenges.claim.expiresIn").replace("{{time}}", rewardExpiryLabel(rewardExpiresAt))}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-green-500 font-semibold text-center py-1">
                {hasReward && state.rewardClaimed
                  ? t("challenges.rewardClaimed")
                  : t("challenges.completed")}
              </div>
            )
          ) : (
            <div className="text-xs text-[var(--text-secondary)] text-center py-1">
              {t("challenges.expired")}
            </div>
          )}
        </div>
      )}

      {/* Available: join button */}
      {variant === "available" && (
        <div className="space-y-1.5">
          <AppButton
            variant="primary"
            size="sm"
            fullWidth
            onClick={onJoin}
            disabled={isJoinLoading || !!joinDisabledReason}
            className="mt-3"
          >
            {isJoinLoading ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : null}
            {t("challenges.join")}
          </AppButton>
          {joinDisabledReason && (
            <p className="text-[10px] text-[var(--text-secondary)] text-center">
              {joinDisabledReason}
            </p>
          )}
        </div>
      )}
    </AppCard>
  );
};

export default ChallengeCard;
