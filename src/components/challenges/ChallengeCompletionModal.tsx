// src/components/challenges/ChallengeCompletionModal.tsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { AppButton } from "../ui/AppButton";
import { useI18n } from "../../i18n/useI18n";
import type { ChallengeDefinition } from "../../types/challenge";

// Workaround for Framer Motion typing issues with motion.div
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionDiv = motion.div as any;

interface ChallengeCompletionModalProps {
  open: boolean;
  definition: ChallengeDefinition | null;
  onClose: () => void;
  onClaimReward?: () => void | Promise<unknown>;
  isServerChallenge?: boolean;
  claimError?: string;
}

// Simple confetti particle
const ConfettiParticle: React.FC<{ delay: number; x: number }> = ({
  delay,
  x,
}) => {
  const colors = [
    "bg-yellow-400",
    "bg-blue-500",
    "bg-green-400",
    "bg-pink-500",
    "bg-purple-500",
    "bg-orange-400",
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 4 + Math.random() * 6;

  return (
    <MotionDiv
      className={`absolute rounded-sm ${color}`}
      style={{ width: size, height: size, left: `${x}%` }}
      initial={{ top: "40%", opacity: 1, rotate: 0 }}
      animate={{
        top: "110%",
        opacity: 0,
        rotate: 360 + Math.random() * 360,
        x: (Math.random() - 0.5) * 120,
      }}
      transition={{
        duration: 1.5 + Math.random() * 1,
        delay,
        ease: "easeOut",
      }}
    />
  );
};

const ChallengeCompletionModal: React.FC<ChallengeCompletionModalProps> = ({
  open,
  definition,
  onClose,
  onClaimReward,
  isServerChallenge,
  claimError,
}) => {
  const { t } = useI18n();
  const [particles, setParticles] = useState<
    { id: number; delay: number; x: number }[]
  >([]);
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const p = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.5,
        x: 10 + Math.random() * 80,
      }));
      setParticles(p);
      setLocalError(null);
    } else {
      setParticles([]);
      setIsClaimLoading(false);
      setLocalError(null);
    }
  }, [open]);

  if (!definition) return null;

  const hasReward = !!definition.reward;

  const handleClaim = async () => {
    if (!onClaimReward) return;
    if (isServerChallenge) {
      setIsClaimLoading(true);
      setLocalError(null);
      try {
        await onClaimReward();
        onClose();
      } catch (e) {
        setLocalError(t("challenges.claim.error"));
      } finally {
        setIsClaimLoading(false);
      }
    } else {
      onClaimReward();
      onClose();
    }
  };

  const displayError = claimError || localError;

  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0 z-[300] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <MotionDiv
            className="relative bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl overflow-hidden"
            initial={{ scale: 0.8, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 30 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            {/* Confetti */}
            {particles.map((p) => (
              <ConfettiParticle key={p.id} delay={p.delay} x={p.x} />
            ))}

            {/* Content */}
            <div className="relative z-10">
              <div className="text-6xl mb-4">{definition.emoji}</div>
              <h2 className="text-2xl font-black text-[var(--text-color)] mb-2">
                {t("challenges.completionTitle")}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
                {t("challenges.completionMessage").replace("{{title}}", definition.title)}
              </p>

              {hasReward && onClaimReward && (
                <>
                  <AppButton
                    variant="primary"
                    fullWidth
                    onClick={handleClaim}
                    disabled={isClaimLoading}
                    className="mb-3"
                  >
                    {isClaimLoading ? (
                      <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : null}
                    {t("challenges.claim.button").replace("{{days}}", String(definition.reward!.days))}
                  </AppButton>
                  {isServerChallenge && (
                    <p className="text-[10px] text-[var(--text-secondary)] mb-3">
                      {t("challenges.claim.expiryHint")}
                    </p>
                  )}
                </>
              )}

              {displayError && (
                <p className="text-xs text-red-500 mb-3">{displayError}</p>
              )}

              <AppButton variant="secondary" fullWidth onClick={onClose}>
                {hasReward ? t("challenges.later") : t("common.close")}
              </AppButton>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

export default ChallengeCompletionModal;
