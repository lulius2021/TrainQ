// src/components/challenges/RewardBanner.tsx
import React from "react";
import { Gift, ChevronRight } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";

interface RewardBannerProps {
  unclaimedCount: number;
  onClaim: () => void;
}

const RewardBanner: React.FC<RewardBannerProps> = ({ unclaimedCount, onClaim }) => {
  const { t } = useI18n();

  if (unclaimedCount === 0) return null;

  return (
    <button
      onClick={onClaim}
      className="w-full rounded-2xl p-4 flex items-center gap-3 transition-transform active:scale-[0.98] text-left"
      style={{
        background: "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(234,88,12,0.10) 100%)",
        border: "1px solid rgba(245,158,11,0.3)",
      }}
    >
      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 shrink-0">
        <Gift size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-yellow-500">
          {t("challenges.reward.bannerTitle")}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {t("challenges.reward.bannerSubtitle")}
        </p>
      </div>
      <ChevronRight size={18} className="text-yellow-500 shrink-0" />
    </button>
  );
};

export default RewardBanner;
