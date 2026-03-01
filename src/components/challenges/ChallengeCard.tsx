// src/components/challenges/ChallengeCard.tsx
import React from "react";
import { Check, Gift, Clock } from "lucide-react";
import { AppCard } from "../ui/AppCard";
import { AppButton } from "../ui/AppButton";
import ChallengeProgressBar from "./ChallengeProgressBar";
import type { ChallengeDefinition, UserChallengeState } from "../../types/challenge";
import type { ChallengeProgressResult } from "../../utils/challengeProgress";

interface ChallengeCardProps {
  definition: ChallengeDefinition;
  state?: UserChallengeState;
  progress?: ChallengeProgressResult;
  variant: "available" | "active" | "completed";
  onJoin?: () => void;
  onClaimReward?: () => void;
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

function daysRemainingLabel(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate + "T23:59:59");
  const diffMs = end.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(diffMs / 86400000));
  if (days === 0) return "Endet heute";
  if (days === 1) return "Noch 1 Tag";
  return `Noch ${days} Tage`;
}

const ChallengeCard: React.FC<ChallengeCardProps> = ({
  definition,
  state,
  progress,
  variant,
  onJoin,
  onClaimReward,
}) => {
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
        <div className="flex items-center gap-1.5 mb-3 text-xs text-[var(--text-secondary)]">
          <Clock size={12} />
          <span>{definition.durationDays} Tage</span>
          {hasReward && (
            <>
              <span className="mx-1">|</span>
              <Gift size={12} className="text-yellow-500" />
              <span className="text-yellow-500 font-medium">
                {definition.reward!.days} Tage Pro
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
              {daysRemainingLabel(state.endDate)}
            </span>
            {hasReward && (
              <span className="text-[11px] text-yellow-500 flex items-center gap-1">
                <Gift size={10} />
                {definition.reward!.days} Tage Pro
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
              <AppButton
                variant="primary"
                size="sm"
                fullWidth
                onClick={onClaimReward}
              >
                <Gift size={14} className="mr-1.5" />
                Belohnung einloesen ({definition.reward!.days} Tage Pro)
              </AppButton>
            ) : (
              <div className="text-xs text-green-500 font-semibold text-center py-1">
                {hasReward && state.rewardClaimed
                  ? "Belohnung eingeloest"
                  : "Abgeschlossen"}
              </div>
            )
          ) : (
            <div className="text-xs text-[var(--text-secondary)] text-center py-1">
              Abgelaufen
            </div>
          )}
        </div>
      )}

      {/* Available: join button */}
      {variant === "available" && (
        <AppButton
          variant="primary"
          size="sm"
          fullWidth
          onClick={onJoin}
          className="mt-3"
        >
          Beitreten
        </AppButton>
      )}
    </AppCard>
  );
};

export default ChallengeCard;
